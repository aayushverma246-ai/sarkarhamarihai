const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY_NEW ? process.env.GEMINI_API_KEY_NEW.trim() : null;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const MODEL_NAME = "gemini-2.0-flash";

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function callWithRetry(fn, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate limit');
            if (isRateLimit && i < retries - 1) {
                console.log(`[AI] Rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await sleep(delay);
                delay *= 2;
                continue;
            }
            throw err;
        }
    }
}

/**
 * STRICT SEMANTIC SYLLABUS MATCHING V14.0
 * Enhanced with subject-wise gap analysis and improvement suggestions
 */
async function batchSyllabusMatch(sourceSyllabus, targetExams) {
    if (!genAI) return keywordFallbackMatch(sourceSyllabus, targetExams);

    // Process in chunks of 10 for API efficiency
    const chunk = targetExams.slice(0, 10);
    const targetsJson = JSON.stringify(chunk.map(t => ({
        id: t.id,
        name: t.job_name,
        syllabus: (t.syllabus || t.job_name).substring(0, 500)
    })));

    const prompt = `You are an expert Indian government exam analyst.
Compare the SOURCE EXAM syllabus to each CANDIDATE EXAM syllabus.
Compute STRICT topic-level overlap percentage.

Return a JSON ARRAY (strictly, no extra text):
[
  {
    "id": "candidate_id",
    "similarity": 0-100,
    "overlapping_topics": ["topic1", "topic2", ...],
    "missing_topics": ["topic_not_covered_1", "topic_not_covered_2", ...],
    "difficulty_gap": "low|medium|high",
    "explanation": "1-2 line explanation of why this exam matches or differs, mentioning specific shared subjects."
  }
]

RULES:
- similarity MUST be the actual % of source topics covered by the candidate.
- overlapping_topics: list the SPECIFIC shared topics/subjects (max 10).
- missing_topics: list topics in the CANDIDATE that are NOT in the source exam (max 10). These are topics the student would need to study additionally.
- difficulty_gap: "low" if similar level, "medium" if somewhat harder, "high" if significantly harder.
- Be precise. Do not inflate similarity scores.

SOURCE EXAM SYLLABUS: ${sourceSyllabus.substring(0, 800)}
CANDIDATE EXAMS: ${targetsJson}`;

    try {
        return await callWithRetry(async () => {
            const model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            try {
                const parsed = JSON.parse(text);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
                if (!jsonMatch) throw new Error("No JSON array returned");
                const finalObj = JSON.parse(jsonMatch[0]);
                return Array.isArray(finalObj) ? finalObj : [finalObj];
            }
        });
    } catch (err) {
        console.error("[AI] Gemini Failed, using Keyword Fallback:", err.message);
        return keywordFallbackMatch(sourceSyllabus, targetExams);
    }
}

/**
 * KEYWORD FALLBACK LOGIC (enhanced with missing topics)
 */
function keywordFallbackMatch(source, targets) {
    const sourceWords = new Set(source.toLowerCase().split(/[^a-zA-Z]+/).filter(w => w.length > 3));
    return targets.map(t => {
        const targetText = (t.syllabus || t.job_name).toLowerCase();
        const targetWords = targetText.split(/[^a-zA-Z]+/).filter(w => w.length > 3);
        const targetSet = new Set(targetWords);
        const overlap = targetWords.filter(w => sourceWords.has(w));
        const missing = [...targetSet].filter(w => !sourceWords.has(w));
        const overlapPercent = Math.min(100, Math.round((overlap.length / Math.max(1, sourceWords.size)) * 100));

        return {
            id: t.id,
            similarity: overlapPercent,
            overlapping_topics: [...new Set(overlap)].slice(0, 10),
            missing_topics: [...new Set(missing)].slice(0, 10),
            difficulty_gap: "medium",
            explanation: `Keyword-based overlap match (${overlapPercent}%). ${overlap.length} common topics found.`
        };
    });
}

/**
 * PHASE-WISE ROADMAP V13.0 (legacy — kept for backward compatibility)
 */
async function generateAIRoadmap(user, job, syllabus, extra = {}, additionalContext = "") {
    if (!genAI) throw new Error("GEMINI_API_KEY_NEW not configured.");

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
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(prompt);
        return result.response.text();
    });
}

/**
 * STRICT JSON ROADMAP ENGINE V3.0 (legacy — kept for backward compatibility)
 */
async function generateStrictRoadmapJSON(user, job, syllabus, targets = []) {
    if (!genAI) throw new Error("GEMINI_API_KEY_NEW not configured.");

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
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
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
    if (!genAI) throw new Error("GEMINI_API_KEY_NEW not configured.");

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
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    });
}

/**
 * PREMIUM ROADMAP V14.0 — Comprehensive 10-Section Master Guide
 * Generates a one-time, permanent, fully personalized study roadmap.
 */
async function generatePremiumRoadmapV9(user, job, syllabus, targets = []) {
    if (!genAI) throw new Error("GEMINI_API_KEY_NEW not configured.");

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
- Every section MUST be filled — no empty arrays or placeholders.
- 100% personalized to this user's age, qualification, available hours.
- Use SPECIFIC topics from the syllabus, NOT generic advice.
- Bullet-heavy. NO paragraphs. Clean and minimal.
- Return ONLY the JSON object. NO text outside JSON.`;

    return await callWithRetry(async () => {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
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

module.exports = {
    batchSyllabusMatch,
    generateAIRoadmap,
    generateStrictRoadmapJSON,
    generateOneTimeMasterRoadmap,
    generatePremiumRoadmapV9
};
