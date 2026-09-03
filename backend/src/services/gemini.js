/**
 * gemini.js — AI Recommendation & Syllabus Analyzer Engine
 *
 * This service implements a production-grade AI layer:
 *  - Primary: Google GenAI SDK (@google/genai) with Gemini API key.
 *  - Fallback: NVIDIA LLaMA 3.1 8B via OpenAI-compatible API.
 *  - Automatically handles rate limits (429s), network issues, and API key sanitization.
 */
'use strict';

const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
require('dotenv').config();

// ── Configuration ─────────────────────────────────────────────────────────────
const MODEL_NAME = "gemini-2.5-flash"; // Current stable fast model
const EMBEDDING_MODEL = "gemini-embedding-001";

// CRITICAL FIX: Sanitize API key — remove embedded \r\n, quotes, and whitespace
// that Vercel CLI env pull sometimes injects
function sanitizeApiKey(raw) {
  if (!raw) return null;
  let cleaned = raw.trim();
  // Remove literal \r\n sequences and actual carriage returns/newlines
  cleaned = cleaned.replace(/\\r\\n/g, '').replace(/\\r/g, '').replace(/\\n/g, '');
  cleaned = cleaned.replace(/[\r\n]/g, '');
  // Remove surrounding quotes if present
  cleaned = cleaned.replace(/^"|"$/g, '');
  cleaned = cleaned.trim();
  return cleaned || null;
}

const apiKey = sanitizeApiKey(process.env.GEMINI_API_KEY_NEW) || sanitizeApiKey(process.env.GEMINI_API_KEY);
let genAI = null;

if (apiKey) {
  try {
    genAI = new GoogleGenAI({ apiKey });
    console.log(`[AI] Gemini provider configured (Model: ${MODEL_NAME})`);
  } catch (err) {
    console.error('[AI] Failed to initialize GoogleGenAI SDK:', err.message);
  }
} else {
  console.warn('[AI] WARNING: No valid GEMINI_API_KEY_NEW found. AI features will be unavailable.');
}

// ── NVIDIA LLaMA 3.1 8B Fallback Provider ────────────────────────────────────
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

if (NVIDIA_API_KEY) {
  console.log('[AI] NVIDIA LLaMA 3.1 8B fallback configured');
}

/**
 * Calls NVIDIA LLaMA 3.1 8B via OpenAI-compatible API as a fallback when Gemini fails.
 * Returns an object with a .text() method for backward compatibility with Gemini responses.
 */
async function callNvidiaLlama31(prompt, responseMimeType = null, timeoutMs = 20000) {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY not configured — cannot use LLaMA 3.1 8B fallback');
  }

  const isJsonMode = responseMimeType === 'application/json';
  const systemPrompt = isJsonMode
    ? 'You are an expert assistant. You MUST respond with ONLY valid JSON. No text outside JSON.'
    : 'You are an expert assistant. Respond concisely and accurately.';

  try {
    const response = await axios.post(NVIDIA_API_URL, {
      model: NVIDIA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }
      ],
      temperature: 0.3,
      max_tokens: 8192,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`
      },
      timeout: timeoutMs
    });

    const text = response.data?.choices?.[0]?.message?.content || '';
    if (!text) {
      throw new Error('NVIDIA LLaMA 3.1 8B returned empty response');
    }

    console.log(`[AI Fallback: NVIDIA LLaMA 3.1 8B] Success — ${text.length} chars`);
    return { text: () => text };
  } catch (err) {
    const status = err.response?.status;
    console.error(`[AI Fallback: NVIDIA LLaMA 3.1 8B] Failed (HTTP ${status || 'N/A'}): ${err.message}`);
    throw err;
  }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

let oldestUserCreatedAt = null;

let _circuitBreakerTrippedUntil = 0;

function isGeminiHealthy() {
  return Date.now() > _circuitBreakerTrippedUntil;
}

function tripCircuitBreaker(durationMs = 30000) {
  // Cap max circuit breaker trip to 30 seconds to prevent prolonged lockouts
  const cappedDuration = Math.min(durationMs, 30000);
  const trippedUntil = Date.now() + cappedDuration;
  if (trippedUntil > _circuitBreakerTrippedUntil) {
    _circuitBreakerTrippedUntil = trippedUntil;
    console.warn(`[AI] Circuit breaker TRIPPED! Bypassing Gemini API calls for ${Math.round(cappedDuration / 1000)}s.`);
  }
}



/**
 * Dynamic content generator using the new @google/genai SDK.
 * Returns an object with a .text() method for backward compatibility.
 */
async function generateContentDynamic(prompt, responseMimeType = null, timeoutMs = 30000) {
  const isHealthy = isGeminiHealthy();

  // ── Try Gemini first ──
  if (genAI && isHealthy) {
    const config = {};
    if (responseMimeType) {
      config.responseMimeType = responseMimeType;
    }

    try {
      const result = await withTimeout(
        genAI.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined,
        }),
        timeoutMs
      );

      const text = result.text;
      if (!text && typeof text !== 'string') {
        throw new Error('EMPTY_RESPONSE: Gemini returned no text content');
      }

      // Return wrapper with .text() method for backward compatibility
      return {
        text: () => text
      };
    } catch (err) {
      const errMsg = (err.message || '').toLowerCase();
      const isTransient = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit')
        || errMsg.includes('timeout') || errMsg.includes('timed out') || errMsg.includes('resource exhausted')
        || errMsg.includes('unavailable') || errMsg.includes('overloaded');
      const isKeyError = errMsg.includes('api key not valid') || errMsg.includes('api_key_invalid') || errMsg.includes('invalid api key');

      if (isKeyError) {
        console.error('[AI] CRITICAL: Google API key is INVALID or unauthorized. Check GEMINI_API_KEY_NEW environment variable.');
      }

      // Trip circuit breaker on rate limit / resource exhaustion
      if (isTransient || isKeyError) {
        tripCircuitBreaker(30000);
      }

      // ── Fallback to NVIDIA LLaMA 3.1 8B on transient/quota/key errors ──
      if ((isTransient || isKeyError) && NVIDIA_API_KEY) {
        console.warn(`[AI] Gemini failed (${err.message}). Falling back to NVIDIA LLaMA 3.1 8B...`);
        try {
          return await callNvidiaLlama31(prompt, responseMimeType, Math.min(timeoutMs, 20000));
        } catch (nvidiaErr) {
          console.error(`[AI] NVIDIA fallback also failed: ${nvidiaErr.message}`);
          throw err; // Throw the original Gemini error
        }
      }

      throw err;
    }
  }

  // ── No Gemini configured or unhealthy — try NVIDIA directly ──
  if (NVIDIA_API_KEY) {
    console.log('[AI] Gemini unavailable or unhealthy. Using NVIDIA LLaMA 3.1 8B directly.');
    return await callNvidiaLlama31(prompt, responseMimeType, Math.min(timeoutMs, 20000));
  }

  throw new Error("No AI provider configured or healthy. Please supply GEMINI_API_KEY_NEW or NVIDIA_API_KEY environment variable.");
}

/**
 * Dynamic embedding generator using the new @google/genai SDK.
 */
async function getEmbeddingDynamic(text, timeoutMs = 10000) {
  if (!text || typeof text !== 'string') return null;
  const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 2048);
  if (!cleanText) return null;

  if (!genAI || !isGeminiHealthy()) return null;

  try {
    const result = await withTimeout(
      genAI.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: cleanText,
      }),
      timeoutMs
    );
    const values = result.embeddings?.[0]?.values || result.embedding?.values;
    if (values && values.length > 0) {
      return values;
    }
    return null;
  } catch (err) {
    console.warn('[AI] Embedding failed:', err.message);
    return null;
  }
}



/**
 * UNIVERSAL RETRY — handles ALL transient errors (429, 500, network, timeout, content filter)
 */
const IS_VERCEL = process.env.VERCEL === '1';

async function callWithRetry(fn, retries = 3, delay = 2000) {
  const maxRetries = IS_VERCEL ? 1 : retries;
  const initialDelay = IS_VERCEL ? 1000 : delay;

  let currentDelay = initialDelay;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      const isPermanent = msg.includes('api key') || msg.includes('not found') || msg.includes('permission') || msg.includes('invalid') || msg.includes('blocked') || msg.includes('billing');
      if (isPermanent) throw err;

      if (i < maxRetries) {
        const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource exhausted');
        const waitTime = isRateLimit ? currentDelay * 1.5 : currentDelay;
        console.log(`[AI] Retrying after error: ${err.message}. Retrying in ${waitTime}ms (${i + 1}/${maxRetries})`);
        await sleep(waitTime);
        currentDelay = Math.min(currentDelay * 2, 4000);
        continue;
      }

      // Trip circuit breaker if final attempt failed due to rate limits
      const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource exhausted');
      if (isRateLimit) {
        tripCircuitBreaker(30000);
      }
      throw err;
    }
  }
}

/**
 * Wraps a promise with a hard timeout to prevent serverless function hangs
 */
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Generative AI request timed out')), ms))
  ]);
}

/**
 * AI CORE ENGINE V18.0 — BATCH SYLLABUS MATCH
 */
async function batchSyllabusMatch(sourceSyllabus, targetExams) {
  if (!targetExams || targetExams.length === 0) return [];
  
  const CHUNK_SIZE = 6;
  const allResults = [];

  for (let start = 0; start < targetExams.length; start += CHUNK_SIZE) {
    const chunk = targetExams.slice(start, start + CHUNK_SIZE);
    
    let geminiResult = null;
    try {
      geminiResult = await callGeminiChunk(sourceSyllabus, chunk);
    } catch (err) {
      console.error('[AI Core] Gemini chunk call failed, using fallback:', err.message);
    }

    if (geminiResult && geminiResult.length > 0) {
      allResults.push(...geminiResult);
    } else {
      // Deterministic heuristic fallback — generates structured fallback responses so user experience is never blocked
      const fallback = generateHeuristicFallbackResponse(sourceSyllabus, chunk);
      allResults.push(...fallback);
    }

    if (start + CHUNK_SIZE < targetExams.length) {
      await sleep(200);
    }
  }

  return allResults;
}

/**
 * GEMINI CHUNK CALL — 5s timeout, 3 retries, strict validation
 */
async function callGeminiChunk(sourceSyllabus, chunk) {
  const examList = chunk.map(e => `- ID: ${e.id}, Name: ${e.job_name}, Syllabus: ${(e.syllabus || e.job_name || '').substring(0, 300)}`).join('\n');

  const prompt = `You are an expert Indian government exam syllabus analyzer.

TASK: Compare this SOURCE syllabus with each TARGET exam. Return STRICT JSON.

SOURCE SYLLABUS:
${(sourceSyllabus || '').substring(0, 800)}

TARGET EXAMS:
${examList}

REQUIRED OUTPUT (JSON array — one object per exam):
[
  {
    "id": "exact exam ID from input",
    "similarity": 0-100,
    "overlapping_topics": ["topic1", "topic2"],
    "missing_topics": ["topic1", "topic2"],
    "difficulty_gap": "low|medium|high",
    "explanation": "One clear sentence explaining the match"
  }
]

RULES:
- similarity = percentage of syllabus overlap (0-100)
- overlapping_topics = subjects/topics shared between source and target
- missing_topics = subjects/topics in target NOT in source
- difficulty_gap = low (>85% overlap), medium (70-85%), high (<70%)
- explanation = concise, specific reason for the match score
- Return ONLY the JSON array. NO text outside JSON.`;

  try {
    return await callWithRetry(async () => {
      const response = await generateContentDynamic(prompt, "application/json", 5000);
      const text = response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('NO_JSON_ARRAY');
        parsed = JSON.parse(match[0]);
      }

      const arr = Array.isArray(parsed) ? parsed : (parsed.results || parsed.exams || []);
      const validated = arr.filter(item => {
        if (!item || !item.id) return false;
        if (typeof item.similarity !== 'number') return false;
        if (!Array.isArray(item.overlapping_topics)) item.overlapping_topics = [];
        if (!Array.isArray(item.missing_topics)) item.missing_topics = [];
        if (!['low', 'medium', 'high'].includes(item.difficulty_gap)) {
          item.difficulty_gap = item.similarity >= 85 ? 'low' : item.similarity >= 70 ? 'medium' : 'high';
        }
        if (!item.explanation || typeof item.explanation !== 'string') {
          item.explanation = `${item.similarity}% syllabus overlap detected.`;
        }
        return true;
      });

      if (validated.length === 0) throw new Error('EMPTY_VALIDATED');
      return validated;
    }, 3, 1500);
  } catch (err) {
    console.error(`[AI Core] Hybrid Gemini failed for chunk: ${err.message}`);
    return null;
  }
}

/**
 * Deterministic heuristic fallback
 */
function generateHeuristicFallbackResponse(sourceSyllabus, targets) {
  const sourceText = (sourceSyllabus || '').toLowerCase();
  const sourceWords = sourceText.split(/[^a-zA-Z]+/).filter(w => w.length > 3);
  const sourceSet = new Set(sourceWords);

  const topicClusters = {
    'mathematics': ['mathematics', 'algebra', 'geometry', 'trigonometry', 'calculus', 'arithmetic', 'number', 'percentage', 'ratio', 'profit', 'loss', 'average', 'mensuration', 'statistics'],
    'reasoning': ['reasoning', 'analogy', 'syllogism', 'coding', 'decoding', 'series', 'pattern', 'logical', 'arrangement', 'puzzle', 'direction', 'blood', 'relation', 'ranking'],
    'english': ['english', 'grammar', 'vocabulary', 'comprehension', 'passage', 'sentence', 'error', 'synonym', 'antonym', 'cloze', 'idiom', 'phrase', 'spelling'],
    'general_awareness': ['general', 'awareness', 'current', 'affairs', 'history', 'geography', 'polity', 'economy', 'science', 'constitution', 'policy', 'budget'],
    'science': ['science', 'physics', 'chemistry', 'biology', 'environment', 'nutrition', 'disease', 'element', 'compound', 'force', 'energy', 'cell'],
    'computer': ['computer', 'internet', 'software', 'hardware', 'network', 'database', 'programming', 'operating', 'system', 'cyber', 'security']
  };

  return targets.map(target => {
    const targetText = ((target.syllabus || '') + ' ' + (target.job_name || '')).toLowerCase();
    const targetWords = targetText.split(/[^a-zA-Z]+/).filter(w => w.length > 3);
    const targetSet = new Set(targetWords);

    const sharedClusters = [];
    const missingClusters = [];
    for (const [cluster, keywords] of Object.entries(topicClusters)) {
      const sourceHas = keywords.some(k => sourceText.includes(k));
      const targetHas = keywords.some(k => targetText.includes(k));
      if (sourceHas && targetHas) sharedClusters.push(cluster);
      else if (!sourceHas && targetHas) missingClusters.push(cluster);
    }

    const sharedWords = targetWords.filter(w => sourceSet.has(w));
    const missingWords = [...targetSet].filter(w => !sourceSet.has(w));
    
    const wordOverlap = Math.min(100, Math.round((sharedWords.length / Math.max(1, sourceSet.size)) * 100));
    const clusterBonus = Math.min(20, sharedClusters.length * 5);
    const similarity = Math.min(100, wordOverlap + clusterBonus);

    const capitalize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const overlapping = sharedClusters.length > 0
      ? sharedClusters.map(capitalize).concat([...new Set(sharedWords)].slice(0, 5))
      : [...new Set(sharedWords)].slice(0, 10);
    const missing = missingClusters.length > 0
      ? missingClusters.map(capitalize).concat([...new Set(missingWords)].slice(0, 5))
      : [...new Set(missingWords)].slice(0, 10);

    const capOverlapping = overlapping.slice(0, 3).map(s => typeof s === 'string' ? capitalize(s) : s);
    const capMissing = missing.slice(0, 2).map(s => typeof s === 'string' ? capitalize(s) : s);

    let explanation = '';
    if (similarity >= 85) {
      const sharedText = capOverlapping.length > 0 ? `${capOverlapping.join(', ')} align closely. ` : '';
      explanation = `Very strong syllabus overlap of ${similarity}% — ${sharedText}${capMissing.length === 0 ? 'No major preparation gaps detected.' : `Minor gaps exist in ${capMissing.join(', ')}.`}`;
    } else if (similarity >= 70) {
      const sharedText = capOverlapping.length > 0 ? ` in ${capOverlapping.slice(0, 2).join(' and ')}` : '';
      explanation = `High syllabus compatibility of ${similarity}%${sharedText}. Focus on studying ${capMissing.join(' and ')} to bridge the remaining gaps.`;
    } else {
      const sharedText = capOverlapping.length > 0 ? ` on ${capOverlapping.slice(0, 2).join(', ')}` : '';
      explanation = `Moderate syllabus match of ${similarity}%${sharedText}. Additional preparation is required for subjects like ${capMissing.join(', ')}.`;
    }

    return {
      id: target.id,
      similarity,
      overlapping_topics: overlapping.slice(0, 10),
      missing_topics: missing.slice(0, 10),
      difficulty_gap: similarity >= 85 ? 'low' : similarity >= 70 ? 'medium' : 'high',
      explanation
    };
  });
}

/**
 * PHASE-WISE ROADMAP V13.0
 */
async function generateAIRoadmap(user, job, syllabus, extra = {}, additionalContext = "") {
  const safeExtra = extra || {};
  const skillLevel = safeExtra.skillLevel || "Beginner";
  const timeRemaining = safeExtra.timeRemaining || "30 days";

  const prompt = `Generate a STUNNING Phase-Wise preparation roadmap for ${job.job_name}.
User: ${user.full_name}, Level: ${skillLevel}, Time: ${timeRemaining}.
Syllabus: ${syllabus}.
${additionalContext}

Follow this STRICT phase structure:

# Phase 1: Fundamentals
- List specific topics from syllabus
- Estimated time needed
- Difficulty: Low
- Suggested Order: 1

# Phase 2: Core Topics
- List specific topics from syllabus
- Estimated time needed
- Difficulty: Medium
- Suggested Order: 2

# Phase 3: Advanced Topics
- List specific topics from syllabus
- Estimated time needed
- Difficulty: High
- Suggested Order: 3

# Phase 4: Revision + PYQs
- List specific topics from syllabus.

Exactly follow this structure with these EXACT PHASE HEADERS:
1. PHASE 1: FUNDAMENTALS
2. PHASE 2: CORE TOPICS 
3. PHASE 3: ADVANCED TOPICS
4. PHASE 4: REVISION + PYQS

Rule: 
- Use EXACT specific topics from the syllabus (merge overlapping parts).
- Do not use vague steps like "study basics".
- Clean bullet points only (-).
- No generic content. Mobile optimized layout.
- Return ONLY the roadmap text.`;

  return await callWithRetry(async () => {
    const response = await generateContentDynamic(prompt, null, 10000);
    return response.text();
  });
}

/**
 * STRICT JSON ROADMAP ENGINE V3.0
 */
async function generateStrictRoadmapJSON(user, job, syllabus, targets = []) {
  const prompt = `You are a Senior Exam AI Architect.
Generate a COMPLETELY PERSONALIZED, 100% structured study roadmap for this specific user and exam.

USER PROFILE (STRICTLY PROCESS EVERY FIELD):
- Name: ${user.full_name || 'Aspirant'}
- Age: ${user.age || 'Not set'}
- Qualification: ${user.qualification_status} ${user.qualification_type || ''}
- Category: ${user.category || 'General'}
- Preparation Level: ${user.prep_level || 'Beginner'}
- Available Study Hours: ${user.study_hours || '4'} hours/day
- Interests/Skills: ${user.interests || 'Not provided'}
- Target Exams: ${targets.join(', ') || 'This individual target'}

EXAM CONTEXT:
- Job Name: ${job.job_name}
- Organization: ${job.organization}
- Syllabus: ${syllabus}

REQUIRED OUTPUT (STRICT JSON ONLY):
{
  "recommended_exams": [
    {"name": "string", "overlap": "0-100%", "reason": "string"}
  ],
  "roadmap": {
    "daily_plan": {
      "morning": "string (2-3 items)",
      "afternoon": "string (2-3 items)",
      "evening": "string (2-3 items)"
    },
    "weekly_plan": {
      "mon_to_fri": "Subject focus + hours",
      "saturday": "Mock test + analysis",
      "sunday": "Revision + weak areas"
    },
    "phase_breakdown": [
      {
        "phase": "PHASE 1: FUNDAMENTALS",
        "duration": "weeks",
        "topics": ["topic1", "topic2"],
        "goal": "string"
      }
    ],
    "revision_strategy": "string",
    "mock_tests": "Weekly frequency + source tips"
  },
  "reasoning": "Data-backed explanation."
}

RULES:
- NO plain text outside the JSON.
- Return ONLY the JSON object.`;

  return await callWithRetry(async () => {
    const response = await generateContentDynamic(prompt, "application/json", 10000);
    const text = response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("[AI] JSON Parse Fail, attempting cleanup...");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("CRITICAL_JSON_FAILURE");
      return JSON.parse(jsonMatch[0]);
    }
  });
}

async function generateOneTimeMasterRoadmap(user, job, syllabus, targets = []) {
  const prompt = `You are a Senior Strategic Exam Consultant. 
GENERATE a ONE-TIME, COMPLETE, PERSONALIZED STUDY ROADMAP.
DO NOT make it adaptive. This is a ONE-SHOT FINAL ROADMAP from START → EXAM DAY.

INPUT:
- Exam: ${job.job_name} (${job.organization})
- Syllabus: ${syllabus}
- User: ${user.full_name}, Level: ${user.prep_level}, Hours: ${user.study_hours}/day
- Targets: ${targets.join(', ')}

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "roadmap": {
    "total_days": "number",
    "phases": [{ "phase_name": "string", "duration_days": "number", "focus": "string" }],
    "daily_plan": [{ "day": "number", "schedule": [{ "time_slot": "string", "subject": "string", "topic": "string", "task": "string" }] }]
  },
  "subject_strategy": [{ "subject": "string", "priority": "string", "approach": "string", "topics_covered": [] }],
  "revision_plan": { "cycles": [], "final_revision_strategy": "string" },
  "mock_test_plan": { "start_day": "number", "frequency": "string", "full_length_tests": "number", "sectional_tests": "number" },
  "final_phase": { "last_30_days": "string", "last_7_days": "string", "exam_day_strategy": "string" }
}
NO TEXT OUTSIDE JSON. FULL SYLLABUS MUST BE COVERED.`;

  return await callWithRetry(async () => {
    const response = await generateContentDynamic(prompt, "application/json", 10000);
    return JSON.parse(response.text());
  });
}

/**
 * PREMIUM ROADMAP V14.0 — Comprehensive 10-Section Master Guide
 */
async function generatePremiumRoadmapV9(user, job, syllabus, targets = []) {
  const prompt = `You are the Elite AI Exam Strategist for "SarkarHamariHai" — India's premier government exam preparation platform.

GENERATE a COMPREHENSIVE, PERSONALIZED, ONE-TIME MASTER GUIDE with EXACTLY 10 sections.

USER PROFILE:
- Age: ${user.age || 'Not specified'}
- Category: ${user.category || 'General'}
- Qualification: ${user.qualification_type || 'Not specified'} (${user.qualification_status || 'Not specified'})
- Daily Available Hours: ${user.study_hours || 4}h
- Preparation Level: ${user.prep_level || 'Beginner'}
- Interests: ${user.interests || 'Not specified'}

EXAM:
- Name: ${job.job_name}
- Organization: ${job.organization}
- Syllabus: ${syllabus}
- Other Target Exams: ${targets.join(', ') || 'None'}

STRICT OUTPUT FORMAT (JSON ONLY):
{
  "overview": {
    "exam_name": "string",
    "readiness_score": 0-100,
    "feasibility_status": "Achievable|Challenging|Risky",
    "recommended_daily_hours": number,
    "days_remaining": number,
    "key_insight": "One-line personalized insight about this user's preparation"
  },
  "syllabus_breakdown": [
    { "subject": "string", "topics": ["topic1", "topic2"], "weightage": "High|Medium|Low", "priority_order": number }
  ],
  "phase_plan": [
    { "phase_name": "string", "duration": "string", "focus": "string", "daily_targets": ["target1", "target2"], "milestone": "string" }
  ],
  "daily_strategy": {
    "morning": { "duration": "string", "activities": ["activity1", "activity2"] },
    "afternoon": { "duration": "string", "activities": ["activity1", "activity2"] },
    "evening": { "duration": "string", "activities": ["activity1", "activity2"] }
  },
  "weekly_strategy": {
    "weekdays": "string — subject rotation plan",
    "saturday": "string — mock test + analysis",
    "sunday": "string — revision + weak area focus"
  },
  "resources": [
    { "type": "Book|Platform|YouTube|Website", "name": "string", "purpose": "string" }
  ],
  "revision_plan": {
    "method": "string",
    "cycles": ["Cycle 1 description", "Cycle 2 description"],
    "spaced_repetition": "string — how to implement"
  },
  "mock_test_strategy": {
    "start_after": "string",
    "frequency": "string",
    "analysis_method": "string",
    "recommended_sources": ["source1", "source2"]
  },
  "weak_area_plan": {
    "identification_method": "string",
    "improvement_tactics": ["tactic1", "tactic2"],
    "time_allocation": "string"
  },
  "final_month_strategy": {
    "last_30_days": "string",
    "last_7_days": "string",
    "exam_day": "string",
    "mental_preparation": "string"
  },
  "warnings": ["warning1", "warning2"],
  "success_formula": ["rule1", "rule2", "rule3"]
}

RULES:
- Every section MUST be filled — no empty arrays, generic text, or mock placeholders.
- Any reference books, platforms, websites, or YouTube channels recommended MUST be real, authentic, widely-known, and specific to the Indian government exam category (e.g., M. Laxmikanth for Indian Polity, R.S. Aggarwal for Quantitative Aptitude, Testbook for Mock Tests, The Hindu for Current Affairs). Never return placeholders like 'Standard reference books', 'Book A', 'XYZ Website', or generic/dummy titles.
- 100% personalized to this user's age, qualification, available hours.
- Use SPECIFIC topics from the syllabus, NOT generic advice.
- Bullet-heavy. NO paragraphs. Clean and minimal.
- Return ONLY the JSON object. NO text outside JSON.`;

  return await callWithRetry(async () => {
    const response = await generateContentDynamic(prompt, "application/json", 12000);
    const text = response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("[AI] V14 Roadmap JSON parse fail, attempting cleanup...");
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("CRITICAL_JSON_FAILURE");
      return JSON.parse(jsonMatch[0]);
    }
  });
}

async function generateDailyPlan(wake_time, sleep_time, planned_hours, subjects, preferences, targetsContext = "") {
  const prompt = `You are a Senior Strategic AI Coach for SarkarHamariHai.
TASK: Build a highly personalized study schedule for today.
INPUTS:
- Wake time: ${wake_time}
- Sleep time: ${sleep_time}
- Target study hours: ${planned_hours} hours
- Focus subjects/topics: ${subjects.join(', ') || 'General Studies'}
- Preferences: ${JSON.stringify(preferences || {})}
${targetsContext}

REQUIRED OUTPUT FORMAT (STRICT JSON ARRAY ONLY):
[
  {
    "start_time": "09:00 AM",
    "end_time": "11:00 AM",
    "session_type": "study",
    "title": "Specific topic from subjects (e.g. Profit & Loss or Indian Polity)",
    "exam_name": "Target Exam Name if related to one of the active targets, otherwise null"
  }
]

RULES:
1. Divide the day between wake time and sleep time.
2. The total duration of all "study", "mock", and "revision" sessions must add up exactly to ${planned_hours} hours.
3. Schedule reasonable breaks (session_type: "break") and rest sessions (session_type: "rest", e.g. for meals/nap). Breaks/rests do not count towards target study hours.
4. Align sessions with active exam targets if provided in targetsContext.
5. NO text outside the JSON. Return only the array.`;

  try {
    return await callWithRetry(async () => {
      const response = await generateContentDynamic(prompt, "application/json", 5000);
      const text = response.text();
      let parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed.sessions || parsed.plan || []);
      if (arr.length > 0) return arr;
      throw new Error("EMPTY_PLAN_ARRAY");
    }, 2, 1000);
  } catch (err) {
    console.error(`[AI Daily Plan] Hybrid Gemini failed, using heuristic: ${err.message}`);
    return getHeuristicDailyPlan(wake_time, sleep_time, planned_hours, subjects);
  }
}

function getHeuristicDailyPlan(wake_time, sleep_time, planned_hours, subjects) {
  const list = [];
  const subjectsToUse = subjects && subjects.length > 0 ? subjects : ['General Studies', 'Quantitative Aptitude'];
  
  let [wakeH, wakeM] = wake_time.split(':').map(Number);
  let [sleepH, sleepM] = sleep_time.split(':').map(Number);
  
  const wakeMinutes = wakeH * 60 + wakeM;
  const sleepMinutes = sleepH * 60 + sleepM;
  
  const totalStudyHours = Math.max(1, planned_hours);
  const slotsCount = Math.ceil(totalStudyHours / 2);
  const hoursPerSlot = totalStudyHours / slotsCount;
  
  let currentMinutes = wakeMinutes + 60; // Start study 1 hour after waking up
  
  for (let i = 0; i < slotsCount; i++) {
    const startH = Math.floor(currentMinutes / 60) % 24;
    const startM = currentMinutes % 60;
    
    const studyDuration = hoursPerSlot * 60;
    const endMinutes = currentMinutes + studyDuration;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = Math.round(endMinutes) % 60;
    
    const formatTime = (h, m) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = m.toString().padStart(2, '0');
      return `${displayH}:${displayM} ${period}`;
    };
    
    const subject = subjectsToUse[i % subjectsToUse.length];
    const isLast = (i === slotsCount - 1);
    
    list.push({
      start_time: formatTime(startH, startM),
      end_time: formatTime(endH, endM),
      session_type: isLast ? "revision" : (i === 1 ? "mock" : "study"),
      title: isLast ? `Revision: ${subject}` : (i === 1 ? `Mock Test Practice: ${subject}` : `Focus Study: ${subject}`),
      exam_name: null
    });
    
    if (!isLast) {
      const breakStartMinutes = endMinutes;
      const breakEndMinutes = breakStartMinutes + 30; // 30 min break
      const bStartH = Math.floor(breakStartMinutes / 60) % 24;
      const bStartM = Math.round(breakStartMinutes) % 60;
      const bEndH = Math.floor(breakEndMinutes / 60) % 24;
      const bEndM = Math.round(breakEndMinutes) % 60;
      
      list.push({
        start_time: formatTime(bStartH, bStartM),
        end_time: formatTime(bEndH, bEndM),
        session_type: "break",
        title: "Refresher Break",
        exam_name: null
      });
      
      currentMinutes = breakEndMinutes;
    } else {
      currentMinutes = endMinutes;
    }
  }
  
  return list;
}

async function generatePlanDebrief(data) {
  const prompt = `You are a motivating, senior Indian government exam preparation coach.
Review this student's daily performance metrics and generate a direct, highly encouraging, and strategic debrief (2-3 sentences max).
METRICS:
- Planned Hours: ${data.planned_hours}
- Completed Hours: ${data.completed_hours}
- Productivity Score: ${data.productivityScore}%
- Streak: ${data.newStreak} days
- Average Syllabus Completion: ${data.avgSyllabus}%
- Imminent Exam countdown: ${data.mostImminentDate ? `${data.mostImminentDate} days remaining` : 'No upcoming dates set'}
- Projected clearance probability: ${data.clearanceProbability}%

RULES:
1. Speak directly to the student in a supportive, professional coaching tone.
2. Refer to their streak and productivity score specifically.
3. Keep it brief (under 60 words). No headers, start directly with the feedback.`;

  try {
    return await callWithRetry(async () => {
      const response = await generateContentDynamic(prompt, null, 5000);
      return response.text().trim();
    }, 2, 1000);
  } catch (err) {
    console.error(`[AI Debrief] Hybrid Gemini failed, using fallback: ${err.message}`);
    return `Consistent daily efforts are the key to cracking competitive exams. You completed ${data.completed_hours.toFixed(1)} hours today with a ${data.productivityScore}% productivity rate. Keep up the ${data.newStreak}-day streak and let's aim higher tomorrow!`;
  }
}

/**
 * Normalizes raw syllabus text into structured JSON format.
 */
async function normalizeSyllabus(rawSyllabusText) {
  const prompt = `You are a SYLLABUS NORMALIZATION ENGINE. 
Transform the following raw syllabus text into a STRICT structured JSON.
Rules:
- Subject-level grouping
- Topic and Subtopic hierarchy
- Estimate weightage based on typical exam patterns if not provided

Input:
${rawSyllabusText}

Return ONLY valid JSON in this exact structure:
[
  {
    "subject": "string",
    "topics": [
      {
        "topic": "string",
        "subtopics": ["string"],
        "weightage": number
      }
    ]
  }
]
No extra text, no markdown.`;

  try {
    const response = await generateContentDynamic(prompt, "application/json", 15000);
    const reply = response.text();
    const firstBrace = reply.indexOf('[');
    const lastBrace = reply.lastIndexOf(']');
    if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON array found");
    let cleaned = reply.substring(firstBrace, lastBrace + 1);
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); 
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Syllabus normalization error:', err.message);
    return [];
  }
}

/**
 * Estimates live exam statistics (vacancies, applicants).
 */
async function estimateLiveData(examName, organization) {
  const prompt = `You are a LIVE EXAM DATA ENGINE.
Estimate the current 'vacancies' and 'applicants_count' for this exam based on historical trends and current news.
Exam: ${examName} by ${organization}

Return ONLY valid JSON:
{
  "vacancies": number,
  "applicants_count": number,
  "last_updated": "ISO-DATE"
}
No extra text.`;

  try {
    const response = await generateContentDynamic(prompt, "application/json", 15000);
    const reply = response.text();
    const firstBrace = reply.indexOf('{');
    const lastBrace = reply.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON found");
    let cleaned = reply.substring(firstBrace, lastBrace + 1);
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); 
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Live data estimation error:', err.message);
    return { vacancies: null, applicants_count: null, last_updated: new Date().toISOString(), status: 'unavailable' };
  }
}

module.exports = {
  batchSyllabusMatch,
  compareSyllabi: batchSyllabusMatch,
  batchCompareSyllabi: batchSyllabusMatch,
  generateAIRoadmap,
  generateStrictRoadmapJSON,
  generateOneTimeMasterRoadmap,
  generatePremiumRoadmapV9,
  generateDailyPlan,
  generatePlanDebrief,
  generateContentDynamic,
  getEmbeddingDynamic,
  normalizeSyllabus,
  estimateLiveData,
  isGeminiHealthy,
  tripCircuitBreaker
};
