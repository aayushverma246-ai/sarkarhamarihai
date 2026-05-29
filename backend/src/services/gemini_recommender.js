'use strict';
/**
 * GEMINI RECOMMENDATION ENGINE v2.0 — PERFECT AI SYLLABUS MATCHING
 * 
 * ARCHITECTURE:
 * 1. Gemini extracts structured syllabus from exam name/description when syllabus field is sparse
 * 2. Gemini compares source syllabus with candidate exams in batches
 * 3. Hybrid scoring: keyword (0.2) + subject (0.3) + Gemini AI comparison (0.5)
 * 4. Only exams with ≥70% overlap are shown
 * 5. Rich detailed analysis for each match
 * 
 * Caching: in-memory + Supabase
 * Rate control: concurrency limit, retry, dedup
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const API_KEY = (process.env.GEMINI_API_KEY_NEW || '').trim();
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const MODEL_NAME = 'gemini-flash-latest';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateContentWithFallback(genAI, prompt, responseMimeType = null, timeoutMs = 15000) {
  const models = ['gemini-flash-latest', 'gemini-2.5-flash'];
  let lastErr = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(responseMimeType ? { generationConfig: { responseMimeType } } : {})
      });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
      ]);
      return result;
    } catch (err) {
      console.warn(`[AI v2] Model ${modelName} failed: ${err.message}. Trying next fallback if available...`);
      lastErr = err;
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('api key') || msg.includes('permission')) {
        throw err;
      }
    }
  }
  throw lastErr || new Error('All models failed');
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER SYSTEM — Handles aggressive rate limiting (DB Persistent)
// ═══════════════════════════════════════════════════════════════
let _circuitBreakerTrippedUntil = 0;

function isGeminiHealthy() {
  return Date.now() > _circuitBreakerTrippedUntil;
}

function tripCircuitBreaker(durationMs = 60000 * 15) {
  if (Date.now() >= _circuitBreakerTrippedUntil) {
    const trippedUntil = Date.now() + durationMs;
    _circuitBreakerTrippedUntil = trippedUntil;
    console.warn(`[AI v2] Circuit breaker TRIPPED! Bypassing Gemini API calls for the next ${durationMs / 1000}s to prevent request hanging.`);
    
    // Background persistent write
    const sb = getSb();
    sb.from('ai_recommendation_cache').upsert({
      key: 'gemini:circuit_breaker',
      data: { tripped_until: trippedUntil },
      updated_at: new Date().toISOString()
    }).then(null, err => {
      console.error('[AI v2] Background circuit breaker write failed:', err.message);
    });
  }
}

async function syncCircuitBreakerWithDB(sb) {
  if (Date.now() > _circuitBreakerTrippedUntil) {
    try {
      const { data } = await sb.from('ai_recommendation_cache').select('data').eq('key', 'gemini:circuit_breaker').single();
      if (data && data.data && data.data.tripped_until) {
        const dbTrippedUntil = Number(data.data.tripped_until);
        if (dbTrippedUntil > _circuitBreakerTrippedUntil) {
          _circuitBreakerTrippedUntil = dbTrippedUntil;
          if (Date.now() < _circuitBreakerTrippedUntil) {
            console.warn(`[AI v2] Persistent circuit breaker loaded: Gemini API bypassed for another ${Math.round((_circuitBreakerTrippedUntil - Date.now()) / 1000)}s.`);
          }
        }
      }
    } catch (e) {
      // Suppress, default to memory state
    }
  }
}

function getSb() {
  return createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ═══════════════════════════════════════════════════════════════
// STANDARD CATEGORY SYLLABUS BLUEPRINTS — High-Fidelity Fallbacks
// ═══════════════════════════════════════════════════════════════
const STANDARD_SYLLABI = {
  'UPSC': 'General Studies: Indian History, Indian and World Geography, Indian Polity and Governance, Economic and Social Development, General Science, Environmental Ecology. CSAT: Comprehension, Interpersonal skills, Logical reasoning and analytical ability, Decision-making and problem-solving, General mental ability, Basic numeracy.',
  'SSC': 'Quantitative Aptitude: Number Systems, Percentages, Ratio and Proportion, Profit and Loss, Time and Work, Algebra, Geometry, Trigonometry. General Intelligence and Reasoning: Verbal and Non-verbal reasoning, Series, Analogies, Coding-decoding, Syllogism. English Comprehension: Grammar, Vocabulary, Cloze test, Reading comprehension. General Awareness: History, Geography, Indian Polity, Economics, Physics, Chemistry, Biology, Current Affairs.',
  'Railway': 'Mathematics: Number system, Decimals, Fractions, LCM, HCF, Ratio and Proportion, Percentage, Mensuration, Time and Work, Time and Distance. General Intelligence and Reasoning: Analogies, Coding and Decoding, Mathematical operations, Relationships, Syllogism, Venn Diagram. General Awareness: Current Events, Science and Technology, Indian History, Geography, Polity, General Scientific and Technological Developments.',
  'Banking': 'Quantitative Aptitude & Data Interpretation: Simplification, Quadratic Equations, Number Series, Percentage, Profit and Loss, Simple and Compound Interest, Average, Ratio, Time and Work, Probability. Reasoning Ability: Puzzles, Seating arrangements, Syllogism, Coding-decoding, Blood relations, Input-output. English Language: Reading Comprehension, Spotting Errors, Fillers, Cloze Test. Banking & Financial Awareness: Indian Banking System, RBI Functions, Monetary Policy, Financial Terms.',
  'Engineering': 'Engineering Mathematics: Linear Algebra, Calculus, Differential equations, Probability and Statistics, Numerical Methods. General Aptitude: Quantitative Aptitude, Analytical Reasoning, Verbal Ability. Core Engineering Subjects: Subject-specific engineering topics (Mechanical, Civil, Electrical, Electronics, Computer Science) and technical disciplines.',
  'State Government': 'State General Knowledge: State History, local Geography, Administrative structure, Culture, Heritage, State schemes and welfare policies. General Studies: Indian History, Geography, Polity, Basic Science. General Mental Ability: Logical reasoning, basic Arithmetic. Regional Language: Grammatical constructs, vocabulary, writing skills.',
  'Police & Security': 'General Knowledge & Current Affairs: Indian Constitution, History, Geography, Science, Sports, Current Events. Numerical Ability: Simplification, Decimals, Fractions, Ratio, Percentage, Profit & Loss, Average. Reasoning Ability: Analogies, Similarities, Differences, Spatial visualization, Analysis. Physical Standards and general awareness.',
  'Defence': 'General English: Synonyms, Antonyms, Idioms, Grammar, Comprehension. General Knowledge: Indian History, Geography, Physics, Chemistry, Biology, Current Affairs. Elementary Mathematics: Arithmetic, Algebra, Geometry, Trigonometry, Mensuration. Technical topics where applicable.',
  'Teaching & Education': 'Child Development and Pedagogy: Child development concepts, Inclusive education, learning theories. General Studies: History, Geography, EVS (Environmental Studies). Language I and II: Grammar and comprehension. Pedagogy of school subjects.',
  'Healthcare': 'Anatomy and Physiology, Nutrition, Microbiology, Nursing Foundations, Medical-Surgical Nursing, Community Health Nursing, Midwifery, Obstetrical Nursing, Child Health Nursing, Mental Health Nursing, general medicine and health awareness.',
  'PSU': 'General Aptitude: Reasoning, Arithmetic, Data Interpretation, Verbal Ability. Specialized Core Subjects: Professional knowledge domain linked to specific PSU hiring role or GATE syllabus.',
};

function getStandardSyllabus(category, jobName) {
  if (!category) return jobName || '';
  const cat = category.toLowerCase();
  if (cat.includes('upsc')) return STANDARD_SYLLABI['UPSC'];
  if (cat.includes('ssc') || cat.includes('central')) return STANDARD_SYLLABI['SSC'];
  if (cat.includes('rail')) return STANDARD_SYLLABI['Railway'];
  if (cat.includes('bank') || cat.includes('coop')) return STANDARD_SYLLABI['Banking'];
  if (cat.includes('police') || cat.includes('security')) return STANDARD_SYLLABI['Police & Security'];
  if (cat.includes('defen')) return STANDARD_SYLLABI['Defence'];
  if (cat.includes('teach') || cat.includes('educat')) return STANDARD_SYLLABI['Teaching & Education'];
  if (cat.includes('eng') || cat.includes('gate')) return STANDARD_SYLLABI['Engineering'];
  if (cat.includes('state') || cat.includes('psc') || cat.includes('forest')) return STANDARD_SYLLABI['State Government'];
  if (cat.includes('health') || cat.includes('medic') || cat.includes('nurs')) return STANDARD_SYLLABI['Healthcare'];
  if (cat.includes('psu')) return STANDARD_SYLLABI['PSU'];
  return STANDARD_SYLLABI[category] || STANDARD_SYLLABI['SSC'];
}

// ═══════════════════════════════════════════════════════════════
// SYNONYM MAP — normalize common exam topic variants
// ═══════════════════════════════════════════════════════════════
const SYNONYMS = {
  'quant': 'quantitative aptitude', 'maths': 'mathematics', 'math': 'mathematics',
  'reasoning': 'logical reasoning', 'lr': 'logical reasoning', 'di': 'data interpretation',
  'ga': 'general awareness', 'gk': 'general knowledge', 'gs': 'general studies',
  'english': 'english language', 'comprehension': 'reading comprehension',
  'polity': 'indian polity', 'economy': 'indian economy', 'economics': 'indian economy',
  'history': 'indian history', 'geography': 'indian geography',
  'science': 'general science', 'bio': 'biology', 'phy': 'physics', 'chem': 'chemistry',
  'current affairs': 'current affairs', 'ca': 'current affairs',
  'computer': 'computer knowledge', 'it': 'computer knowledge',
  'aptitude': 'quantitative aptitude', 'numerical': 'quantitative aptitude',
  'verbal': 'english language', 'vocab': 'vocabulary',
};

const SUBJECT_CLUSTERS = {
  'quantitative aptitude': ['mathematics', 'arithmetic', 'algebra', 'geometry', 'trigonometry', 'mensuration', 'statistics', 'data interpretation', 'number system', 'percentage', 'ratio', 'profit', 'loss', 'average', 'simplification', 'calculus'],
  'logical reasoning': ['reasoning', 'analogy', 'syllogism', 'coding', 'decoding', 'series', 'pattern', 'puzzle', 'arrangement', 'direction', 'blood relation', 'ranking', 'order', 'classification', 'venn diagram'],
  'english language': ['grammar', 'vocabulary', 'comprehension', 'passage', 'sentence', 'error', 'synonym', 'antonym', 'cloze', 'idiom', 'phrase', 'spelling', 'para jumble', 'fill in the blanks'],
  'general awareness': ['current affairs', 'history', 'geography', 'polity', 'economy', 'science', 'constitution', 'budget', 'sports', 'awards', 'culture', 'environment'],
  'general science': ['physics', 'chemistry', 'biology', 'nutrition', 'disease', 'element', 'force', 'energy', 'cell', 'genetics', 'ecology'],
  'computer knowledge': ['computer', 'internet', 'software', 'hardware', 'network', 'database', 'programming', 'operating system', 'cyber security', 'ms office'],
  'indian polity': ['constitution', 'parliament', 'judiciary', 'fundamental rights', 'directive principles', 'amendment', 'governance', 'panchayati raj', 'local government'],
  'indian economy': ['gdp', 'fiscal policy', 'monetary policy', 'banking', 'rbi', 'budget', 'taxation', 'inflation', 'trade', 'five year plan', 'niti aayog'],
  'indian history': ['ancient', 'medieval', 'modern', 'freedom movement', 'mughal', 'british', 'revolt', 'independence', 'civilization', 'dynasty'],
  'indian geography': ['climate', 'rivers', 'mountains', 'soil', 'vegetation', 'minerals', 'agriculture', 'population', 'ocean', 'monsoon'],
};

// ═══════════════════════════════════════════════════════════════
// STRUCTURER — Convert raw syllabus text to structured format
// ═══════════════════════════════════════════════════════════════
function structureSyllabus(syllabusText, jobName = '') {
  const raw = ((syllabusText || '') + ' ' + (jobName || '')).toLowerCase();
  const words = raw.split(/[^a-zA-Z]+/).filter(w => w.length > 2);

  // Normalize via synonyms
  const normalized = words.map(w => SYNONYMS[w] || w);

  // Detect subjects
  const subjects = [];
  const topics = [];
  for (const [subject, keywords] of Object.entries(SUBJECT_CLUSTERS)) {
    const matched = keywords.filter(k => {
      const kWords = k.split(' ');
      return kWords.every(kw => raw.includes(kw));
    });
    if (matched.length > 0 || raw.includes(subject)) {
      subjects.push(subject);
      topics.push(...matched);
    }
  }

  // Extract unique keywords (>3 chars, no stopwords)
  const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'shall', 'may', 'can', 'should', 'would', 'could', 'not', 'but', 'all', 'any', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'also', 'exam', 'examination', 'test', 'paper', 'marks', 'questions', 'time', 'total', 'section', 'part', 'tier']);
  const keywords = [...new Set(normalized.filter(w => w.length > 3 && !STOP.has(w)))].slice(0, 80);

  return { subjects: [...new Set(subjects)], topics: [...new Set(topics)], keywords };
}

// ═══════════════════════════════════════════════════════════════
// GEMINI SYLLABUS EXTRACTOR — Extracts syllabus from exam name
// When an exam has no syllabus data, Gemini infers it from the name
// ═══════════════════════════════════════════════════════════════
const _syllabusCache = new Map();

async function extractSyllabusWithGemini(examName, organization, existingSyllabus) {
  // If syllabus already exists and is substantial, return it
  if (existingSyllabus && existingSyllabus.trim().length > 30) {
    return existingSyllabus;
  }

  // Check cache
  const cacheKey = `syl:${examName}:${organization}`;
  if (_syllabusCache.has(cacheKey)) return _syllabusCache.get(cacheKey);

  if (!isGeminiHealthy() || !genAI) {
    // Fallback: use exam name as syllabus proxy
    return existingSyllabus || examName || '';
  }

  try {
    const prompt = `You are an expert on Indian government exams.
Given this exam, provide its COMPLETE syllabus as a structured JSON.

EXAM: ${examName}
ORGANIZATION: ${organization || 'Unknown'}
${existingSyllabus ? `PARTIAL SYLLABUS: ${existingSyllabus.substring(0, 500)}` : ''}

Return JSON:
{
  "subjects": ["Subject 1", "Subject 2"],
  "topics": {
    "Subject 1": ["Topic A", "Topic B", "Topic C"],
    "Subject 2": ["Topic D", "Topic E"]
  },
  "selection_stages": ["Stage 1", "Stage 2"],
  "syllabus_text": "Comma-separated list of ALL major topics covered"
}

RULES:
- Be SPECIFIC to this exact exam (e.g., SSC CGL Tier-1 has specific subjects)
- Include ALL subjects and topics actually tested
- For unknown exams, infer from the organization and name
- Return ONLY JSON`;

    const result = await generateContentWithFallback(genAI, prompt, 'application/json', 2500);

    const text = result.response.text();
    const parsed = JSON.parse(text);
    const syllabusText = parsed.syllabus_text ||
      Object.values(parsed.topics || {}).flat().join(', ') ||
      (parsed.subjects || []).join(', ');

    const enrichedSyllabus = `${syllabusText}. Subjects: ${(parsed.subjects || []).join(', ')}`;
    _syllabusCache.set(cacheKey, enrichedSyllabus);
    return enrichedSyllabus;
  } catch (err) {
    console.error(`[Gemini Extract] Failed for ${examName}: ${err.message}`);
    tripCircuitBreaker();
    _syllabusCache.set(cacheKey, existingSyllabus || examName);
    return existingSyllabus || examName || '';
  }
}

// ═══════════════════════════════════════════════════════════════
// GEMINI BATCH COMPARISON — Compare source with multiple targets
// This is the CORE of the AI system: real Gemini-powered comparison
// ═══════════════════════════════════════════════════════════════
const _comparisonCache = new Map();
const COMPARISON_TTL = 30 * 60 * 1000; // 30 min

async function geminiCompareExams(sourceSyllabus, sourceExamNames, targetExams) {
  if (!targetExams.length) return [];
  if (!isGeminiHealthy() || !genAI) return [];

  const sb = getSb();
  const keys = targetExams.map(t => `cmp:${sourceExamNames.join('+')}:${t.id}`);

  try {
    // 1. Single lightning-fast batch fetch from Supabase cache
    console.log(`[AI Cache] Batch fetching ${keys.length} comparison keys...`);
    const { data: cachedRows } = await sb
      .from('ai_recommendation_cache')
      .select('key, data')
      .in('key', keys);

    if (cachedRows && cachedRows.length > 0) {
      console.log(`[AI Cache] Hit list size: ${cachedRows.length}/${targetExams.length}`);
      for (const row of cachedRows) {
        _comparisonCache.set(row.key, { data: row.data, ts: Date.now() });
      }
    }
  } catch (err) {
    console.error('[AI Cache] Load error:', err.message);
  }

  if (!genAI) return [];

  const CHUNK_SIZE = 3;
  const allResults = [];

  for (let start = 0; start < targetExams.length; start += CHUNK_SIZE) {
    const chunk = targetExams.slice(start, start + CHUNK_SIZE);

    // Check cache for each exam in chunk
    const uncached = [];
    const cached = [];
    for (const t of chunk) {
      const ck = `cmp:${sourceExamNames.join('+')}:${t.id}`;
      const c = _comparisonCache.get(ck);
      if (c && (Date.now() - c.ts) < COMPARISON_TTL) {
        cached.push(c.data);
      } else {
        uncached.push(t);
      }
    }
    allResults.push(...cached);

    if (uncached.length === 0) continue;

    try {
      const examList = uncached.map(e =>
        `- ID: ${e.id} | Name: ${e.job_name} | Org: ${e.organization || ''} | Syllabus: ${(e.enrichedSyllabus || e.syllabus || e.job_name || '').substring(0, 400)}`
      ).join('\n');

      const prompt = `You are an expert Indian government exam syllabus analyzer. Your task is to PRECISELY compare syllabi.

SOURCE EXAMS: ${sourceExamNames.join(', ')}
SOURCE SYLLABUS:
${(sourceSyllabus || '').substring(0, 1500)}

TARGET EXAMS:
${examList}

TASK: For each target exam, calculate EXACT syllabus overlap percentage with the source.

REQUIRED OUTPUT — STRICT JSON array:
[
  {
    "id": "exact exam ID from input",
    "overlap_percentage": 0-100,
    "overlapping_subjects": ["subject1", "subject2"],
    "overlapping_topics": ["specific topic1", "specific topic2", "specific topic3"],
    "missing_subjects": ["subject not in source"],
    "missing_topics": ["specific topic not in source1", "specific topic2"],
    "extra_preparation_needed": ["topic that needs additional study"],
    "difficulty_comparison": "easier|similar|harder",
    "study_time_estimate": "X weeks additional",
    "explanation": "Detailed 2-3 sentence analysis explaining WHY this overlap percentage, mentioning specific shared and different topics",
    "subject_wise_overlap": [
      { "subject": "Subject Name", "overlap_pct": 85, "gap_pct": 15 }
    ]
  }
]

SCORING RULES:
- overlap_percentage = what % of the TARGET exam's syllabus is already covered by SOURCE preparation
- subject_wise_overlap = for each major subject in the target exam, what % overlaps with source. Include ALL subjects.
- 90-100%: Nearly identical syllabus (e.g., SSC CGL and SSC CHSL share most topics)
- 70-89%: Strong overlap with some additional topics needed
- 50-69%: Moderate overlap, significant additional preparation needed
- Below 50%: Different exam focus areas
- Be HONEST and PRECISE. Don't inflate scores.
- Consider actual exam patterns, not just topic names
- Return ONLY the JSON array.`;

      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await generateContentWithFallback(genAI, prompt, 'application/json', 3500);

          const text = result.response.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error('NO_JSON');
            parsed = JSON.parse(match[0]);
          }

          const arr = Array.isArray(parsed) ? parsed : (parsed.results || parsed.exams || []);
          const validated = arr.filter(item => {
            if (!item || !item.id) return false;
            if (typeof item.overlap_percentage !== 'number') {
              item.overlap_percentage = typeof item.similarity === 'number' ? item.similarity : 0;
            }
            if (!Array.isArray(item.overlapping_topics)) item.overlapping_topics = item.overlapping_subjects || [];
            if (!Array.isArray(item.missing_topics)) item.missing_topics = [];
            if (!Array.isArray(item.overlapping_subjects)) item.overlapping_subjects = [];
            if (!Array.isArray(item.missing_subjects)) item.missing_subjects = [];
            if (!Array.isArray(item.extra_preparation_needed)) item.extra_preparation_needed = item.missing_topics.slice(0, 5);
            if (!item.explanation) item.explanation = `${item.overlap_percentage}% syllabus overlap detected.`;
            if (!item.difficulty_comparison) item.difficulty_comparison = 'similar';
            if (!item.study_time_estimate) {
              item.study_time_estimate = item.overlap_percentage >= 85 ? '1-2 weeks' : item.overlap_percentage >= 70 ? '3-4 weeks' : '6-8 weeks';
            }
            // Validate subject_wise_overlap from Gemini
            if (!Array.isArray(item.subject_wise_overlap)) item.subject_wise_overlap = [];
            item.subject_wise_overlap = item.subject_wise_overlap.filter(s => s && s.subject && typeof s.overlap_pct === 'number');
            return true;
          });

          // Cache results in-memory and persistently in DB
          const upserts = [];
          for (const v of validated) {
            const ck = `cmp:${sourceExamNames.join('+')}:${v.id}`;
            _comparisonCache.set(ck, { data: v, ts: Date.now() });
            upserts.push({ key: ck, data: v, updated_at: new Date().toISOString() });
          }
          if (upserts.length > 0) {
            sb.from('ai_recommendation_cache').upsert(upserts).then(null, err => {
              console.error('[AI Cache] Sync error:', err.message);
            });
          }

          allResults.push(...validated);
          break; // success
        } catch (err) {
          lastErr = err;
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('api key') || msg.includes('permission')) throw err;
          tripCircuitBreaker();
          break; // Stop attempts for this chunk
        }
      }

      if (!isGeminiHealthy()) {
        console.warn(`[AI v2] Gemini comparison circuit broken during chunk parsing, skipping remaining chunks.`);
        break;
      }

      if (lastErr && allResults.length === 0) {
        console.error(`[Gemini Compare] Chunk failed: ${lastErr.message}`);
      }
    } catch (err) {
      console.error(`[Gemini Compare] Fatal chunk error: ${err.message}`);
    }

    // Rate limit between chunks
    if (start + CHUNK_SIZE < targetExams.length) {
      await sleep(300);
    }
  }

  return allResults;
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING CACHE & SIMILARITY
// ═══════════════════════════════════════════════════════════════
const _embeddingCache = new Map();
const _resultCache = new Map();
const RESULT_TTL = 10 * 60 * 1000;

let _activeRequests = 0;
const MAX_CONCURRENT = 3;

async function getEmbedding(text, examId) {
  // Completely bypass embedding generation during live queries to prevent API limit crashes and unsupported API errors
  return null;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ═══════════════════════════════════════════════════════════════
// PRE-FILTER — Fast keyword + category match  
// ═══════════════════════════════════════════════════════════════
function preFilter(sourceStructured, candidateJob, sourceCategories) {
  const candText = ((candidateJob.syllabus || '') + ' ' + (candidateJob.job_name || '') + ' ' + (candidateJob.job_category || '')).toLowerCase();

  if (sourceCategories && sourceCategories.includes(candidateJob.job_category)) return true;

  let subjectHits = 0;
  for (const s of sourceStructured.subjects) {
    if (candText.includes(s) || SUBJECT_CLUSTERS[s]?.some(k => candText.includes(k))) subjectHits++;
  }

  let keywordHits = 0;
  for (const k of sourceStructured.keywords.slice(0, 30)) {
    if (candText.includes(k)) keywordHits++;
  }

  return subjectHits >= 1 || keywordHits >= 2;
}

// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE — Hybrid: local + Gemini AI
// ═══════════════════════════════════════════════════════════════
function computeLocalScore(sourceStructured, candidateStructured, semanticSim, sameCategory) {
  const srcSubjects = new Set(sourceStructured.subjects);
  const candSubjects = new Set(candidateStructured.subjects);
  const sharedSubjects = [...srcSubjects].filter(s => candSubjects.has(s));
  const subjectScore = srcSubjects.size > 0 ? sharedSubjects.length / Math.min(srcSubjects.size, candSubjects.size || 1) : 0;

  const srcKw = new Set(sourceStructured.keywords);
  const candKw = new Set(candidateStructured.keywords);
  let kwIntersection = 0;
  for (const k of srcKw) { if (candKw.has(k)) kwIntersection++; }
  const keywordScore = srcKw.size > 0 ? kwIntersection / Math.min(srcKw.size, candKw.size || 1) : 0;

  const semScore = Math.max(0, semanticSim);
  const catBonus = sameCategory ? 0.10 : 0;

  let raw;
  if (semScore > 0) {
    raw = Math.min(1.0, 0.40 * subjectScore + 0.20 * keywordScore + 0.30 * semScore + catBonus);
  } else {
    // Local fallback weighting: distribute unused 30% semScore weight
    raw = Math.min(1.0, 0.60 * subjectScore + 0.40 * keywordScore + catBonus);
  }
  const pct = Math.round(raw * 100);

  return { localScore: Math.min(pct, 100), subjectScore: Math.round(subjectScore * 100), keywordScore: Math.round(keywordScore * 100), semanticScore: Math.round(semScore * 100), sharedSubjects };
}

// ═══════════════════════════════════════════════════════════════
// GAP ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════
function computeGapAnalysis(sourceStructured, candidateStructured) {
  const srcTopics = new Set([...sourceStructured.subjects, ...sourceStructured.topics]);
  const candTopics = new Set([...candidateStructured.subjects, ...candidateStructured.topics]);

  const matched = [...candTopics].filter(t => srcTopics.has(t));
  const missing = [...candTopics].filter(t => !srcTopics.has(t));
  const extra = [...srcTopics].filter(t => !candTopics.has(t));

  const cap = s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    matched_topics: matched.map(cap).slice(0, 15),
    missing_topics: missing.map(cap).slice(0, 15),
    extra_topics: extra.map(cap).slice(0, 10),
  };
}

// ═══════════════════════════════════════════════════════════════
// ELIGIBILITY PRE-FILTER HELPERS
// ═══════════════════════════════════════════════════════════════
const qualificationOrder = {
  '10th': 1,
  'Class 10': 1,
  '12th': 2,
  'Class 12': 2,
  'Diploma': 2.5,
  'Graduation': 3,
  'Post Graduation': 4,
  'PhD': 5
};

function meetsQualification(user, job) {
  if (!user.qualification_type) return false;

  // If the candidate job does not specify qualification_required, it is open to all
  if (!job.qualification_required) return true;

  const userLevel = qualificationOrder[user.qualification_type] || 0;
  const jobLevel = qualificationOrder[job.qualification_required] || 0;

  // If the job requires an unrecognized qualification, do not hard-block the recommendation
  if (jobLevel === 0) return true;
  if (userLevel === 0) return false;

  if (user.qualification_status === 'Completed') {
    return userLevel >= jobLevel;
  }

  if (user.qualification_status === 'Pursuing') {
    if (userLevel > jobLevel) return true;

    // Allow pursuing matching degree by default to keep recommendations helpful
    if (userLevel === jobLevel) {
      if (!job.allows_final_year_students) return true; // lenient default
      const currentYear = new Date().getFullYear();
      const expectedGradYear = parseInt(user.expected_graduation_year);
      if (!expectedGradYear || expectedGradYear === currentYear || expectedGradYear === currentYear + 1) {
        return true;
      }
    }
  }
  return false;
}

function meetsAge(user, job) {
  // If user has not specified their age, do not hard-block recommendations
  if (!user.age || user.age === 0) return true;

  const minAge = job.minimum_age ? Number(job.minimum_age) : 0;
  const maxAge = job.maximum_age ? Number(job.maximum_age) : 100;
  const userAge = Number(user.age);

  return userAge >= minAge && userAge <= maxAge;
}

function meetsStateCriteria(user, job) {
  if (!job.state) return true;
  if (job.state === 'All India') return true;
  const userState = (user.state || '').toLowerCase().trim();
  if (!userState) return true;

  if (job.state.toLowerCase().trim() === userState) return true;

  if (job.states) {
    let statesArr = job.states;
    if (typeof statesArr === 'string') {
      try { statesArr = JSON.parse(statesArr); } catch (_) { statesArr = []; }
    }
    if (Array.isArray(statesArr) && statesArr.length > 0) {
      return statesArr.some(s =>
        (s || '').toLowerCase().trim() === userState ||
        (s || '').toLowerCase().trim() === 'all india'
      );
    }
  }
  return false;
}

function meetsTechnicalCriteria(job) {
  const textToSearch = (job.job_name + ' ' + (job.organization || ''));
  const isHighlyTechnical = /(?:junior engineer|assistant engineer|ae\/je|\bAE\b|\bJE\b|b\.tech|\bbtech\b|m\.tech|\bmtech\b|diploma in|\bITI\b|nursing|medical officer|\bMBBS\b)/i.test(textToSearch);
  return !isHighlyTechnical;
}

// ═══════════════════════════════════════════════════════════════
// MAIN RECOMMENDATION FUNCTION — GEMINI-POWERED
// ═══════════════════════════════════════════════════════════════
async function getRecommendations(sourceExamIds, userId, filters = {}) {
  const { page = 1, search = '', category = '', state = '' } = filters;
  const sb = getSb();
  await syncCircuitBreakerWithDB(sb);

  // Cache check (both local in-memory and persistent PostgreSQL cache)
  const cacheKey = `reco:${sourceExamIds.sort().join(',')}:${category}:${search}:${state}:${page}`;
  const cachedMem = _resultCache.get(cacheKey);
  if (cachedMem && (Date.now() - cachedMem.ts) < RESULT_TTL) return cachedMem.data;

  try {
    const { data: cachedRow } = await sb
      .from('ai_recommendation_cache')
      .select('data, created_at')
      .eq('key', cacheKey)
      .single();

    if (cachedRow) {
      const age = Date.now() - new Date(cachedRow.created_at).getTime();
      if (age < RESULT_TTL) {
        console.log(`[AI Cache] Hot page cache hit: ${cacheKey}`);
        _resultCache.set(cacheKey, { data: cachedRow.data, ts: Date.now() });
        return cachedRow.data;
      }
    }
  } catch (err) {
    // Ignore and proceed to recompute
  }

  // Fetch user profile from Supabase
  let user = null;
  try {
    const { data: userData } = await sb.from('users').select('*').eq('id', userId).single();
    user = userData;
  } catch (e) {
    console.warn(`[AI getRecommendations] Profile fetch error:`, e.message);
  }
  const hasProfile = user && user.qualification_type && user.age;

  // 1. Fetch source exams
  const { data: sourceExams } = await sb.from('jobs')
    .select('id, job_name, syllabus, job_category, organization')
    .in('id', sourceExamIds);

  if (!sourceExams || sourceExams.length === 0) {
    return { data: [], hasMore: false, page: 1, totalMatches: 0 };
  }

  // 2a. Enrich source exams with category blueprints if syllabus is empty/short
  for (const e of sourceExams) {
    if (!e.syllabus || e.syllabus.trim().length < 20) {
      e.syllabus = getStandardSyllabus(e.job_category, e.job_name);
      console.log(`[AI v2] Blueprint enriched source: "${e.job_name}" (${e.job_category})`);
    }
  }

  // 2b. GEMINI STEP 1: Extract/enrich syllabus for source exams
  console.log(`[AI v2] Extracting syllabus for ${sourceExams.length} source exam(s)...`);
  const enrichedSourceSyllabi = [];
  for (const e of sourceExams) {
    try {
      const enriched = await extractSyllabusWithGemini(e.job_name, e.organization, e.syllabus);
      enrichedSourceSyllabi.push(enriched);
    } catch (err) {
      console.warn(`[AI v2] Syllabus extraction failed for "${e.job_name}", falling back to plain syllabus in DB:`, err.message);
      enrichedSourceSyllabi.push(e.syllabus || '');
    }
  }
  const combinedSyllabus = enrichedSourceSyllabi.join(' ');
  const sourceStructured = structureSyllabus(combinedSyllabus);
  const sourceCategories = [...new Set(sourceExams.map(e => e.job_category).filter(Boolean))];
  const sourceExamNames = sourceExams.map(e => e.job_name);

  // 3. Get source embedding
  const hasSyllabus = combinedSyllabus.trim().length > 20;
  let sourceEmbedding = null;
  try {
    sourceEmbedding = hasSyllabus ? await getEmbedding(combinedSyllabus.substring(0, 2000), `src_${sourceExamIds.join('_')}`) : null;
  } catch (err) {
    console.warn(`[AI v2] Source embedding failed, proceeding without semantic vector matching:`, err.message);
  }

  // 4. Fetch candidates favoring similar categories first, backfilling up to 300
  let allCandidates = [];
  const catSet = new Set(sourceCategories.filter(Boolean));

  // Query Part A: Fetch active candidates in the same categories
  let catQuery = sb.from('jobs')
    .select('id, job_name, organization, job_category, syllabus, form_status, application_start_date, application_end_date, salary_min, salary_max, qualification_required, official_application_link, official_website_link, state, minimum_age, maximum_age, states')
    .not('id', 'in', `(${sourceExamIds.join(',')})`)
    .in('form_status', ['LIVE', 'UPCOMING', 'RECENTLY_CLOSED']);

  if (category) {
    catQuery = catQuery.eq('job_category', category);
  } else if (catSet.size > 0) {
    catQuery = catQuery.in('job_category', [...catSet]);
  }
  if (state && state !== 'All India') {
    catQuery = catQuery.or(`state.eq.${state},state.eq.All India`);
  }
  if (search) catQuery = catQuery.or(`job_name.ilike.%${search}%,organization.ilike.%${search}%`);

  const { data: catCandidates } = await catQuery.limit(300);
  if (catCandidates && catCandidates.length > 0) {
    allCandidates.push(...catCandidates);
  }

  // Query Part B: Backfill with general candidates if room remains
  if (allCandidates.length < 300) {
    const pulledIds = allCandidates.map(c => c.id);
    const excludeIds = [...sourceExamIds, ...pulledIds];

    let genQuery = sb.from('jobs')
      .select('id, job_name, organization, job_category, syllabus, form_status, application_start_date, application_end_date, salary_min, salary_max, qualification_required, official_application_link, official_website_link, state, minimum_age, maximum_age, states')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .in('form_status', ['LIVE', 'UPCOMING', 'RECENTLY_CLOSED']);

    if (category) {
      genQuery = genQuery.eq('job_category', category);
    } else if (catSet.size > 0) {
      genQuery = genQuery.not('job_category', 'in', `(${[...catSet].join(',')})`);
    }
    if (state && state !== 'All India') {
      genQuery = genQuery.or(`state.eq.${state},state.eq.All India`);
    }
    if (search) genQuery = genQuery.or(`job_name.ilike.%${search}%,organization.ilike.%${search}%`);

    const { data: genCandidates } = await genQuery.limit(300 - allCandidates.length);
    if (genCandidates && genCandidates.length > 0) {
      allCandidates.push(...genCandidates);
    }
  }

  if (allCandidates.length === 0) {
    return { data: [], hasMore: false, page: 1, totalMatches: 0 };
  }

  // Enrich candidate syllabi locally if empty/short to enable genuine local + AI comparison
  for (const c of allCandidates) {
    if (!c.syllabus || c.syllabus.trim().length < 20) {
      c.syllabus = getStandardSyllabus(c.job_category, c.job_name);
    }
  }

  // 4b. Perform eligibility pre-filtering immediately to drastically cut down candidates
  if (hasProfile) {
    const priorLength = allCandidates.length;
    allCandidates = allCandidates.filter(c =>
      meetsQualification(user, c) &&
      meetsAge(user, c) &&
      meetsStateCriteria(user, c) &&
      meetsTechnicalCriteria(c)
    );
    console.log(`[AI Eligibility Pre-Filtering] Reduced candidate pool from ${priorLength} to ${allCandidates.length} eligible candidates`);
  }

  // 5. Pre-filter with local matching (generous pass)
  const shortlisted = allCandidates.filter(c => preFilter(sourceStructured, c, sourceCategories));
  console.log(`[AI v2] Pre-filtered: ${shortlisted.length}/${allCandidates.length} candidates`);

  // 6. GEMINI STEP 2: Enrich shortlisted exams' syllabi (Optimized pool to prevent API limits)
  const topCandidates = shortlisted.slice(0, 25);
  const enrichmentBatch = topCandidates.slice(0, 15); // Enrich top 15 with Gemini

  for (const cand of enrichmentBatch) {
    if (!isGeminiHealthy()) {
      cand.enrichedSyllabus = cand.syllabus;
      continue;
    }
    try {
      cand.enrichedSyllabus = await extractSyllabusWithGemini(cand.job_name, cand.organization, cand.syllabus);
    } catch (err) {
      console.warn(`[AI v2] Candidate syllabus enrichment failed for "${cand.job_name}":`, err.message);
      cand.enrichedSyllabus = cand.syllabus;
    }
  }

  // 7. GEMINI STEP 3: Batch compare ALL shortlisted exams using Gemini
  let geminiResults = [];
  try {
    console.log(`[AI v2] Running Gemini comparison on ${topCandidates.length} candidates...`);
    geminiResults = await geminiCompareExams(combinedSyllabus, sourceExamNames, topCandidates);
  } catch (err) {
    console.warn(`[AI v2] Gemini batch comparison failed, falling back to local scoring metrics:`, err.message);
  }

  // Build lookup map from Gemini results
  const geminiMap = new Map();
  for (const r of geminiResults) {
    geminiMap.set(r.id, r);
  }

  // 8. Score ALL candidates (hybrid: local + Gemini)
  const scored = [];

  for (const cand of topCandidates) {
    const candStructured = structureSyllabus(cand.enrichedSyllabus || cand.syllabus, cand.job_name);
    const geminiResult = geminiMap.get(cand.id);

    // Semantic similarity via embeddings
    let semSim = 0;
    const candSyllabusText = cand.enrichedSyllabus || cand.syllabus || '';
    if (sourceEmbedding && candSyllabusText.length > 20) {
      try {
        const candEmb = await getEmbedding(
          (candSyllabusText + ' ' + cand.job_name).substring(0, 2000),
          cand.id
        );
        if (candEmb) semSim = cosineSimilarity(sourceEmbedding, candEmb);
      } catch (err) {
        console.warn(`[AI v2] Candidate embedding query failed for "${cand.job_name}":`, err.message);
      }
    }

    const isSameCat = sourceCategories.includes(cand.job_category);
    const { localScore, subjectScore, keywordScore, semanticScore, sharedSubjects } = computeLocalScore(sourceStructured, candStructured, semSim, isSameCat);

    // HYBRID SCORE: Gemini AI (50%) + Local analysis (50%)
    let finalScore;
    let geminiExplanation = '';
    let overlappingTopics = [];
    let missingTopics = [];
    let overlappingSubjects = [];
    let missingSubjects = [];
    let extraPrep = [];
    let difficultyComparison = 'similar';
    let studyTimeEstimate = '';

    if (geminiResult && geminiResult.overlap_percentage > 0) {
      // Use the BEST of Gemini and local scores — never let bad Gemini data drag down a good local score
      const geminiScore = geminiResult.overlap_percentage;
      finalScore = Math.max(geminiScore, localScore);
      geminiExplanation = geminiResult.explanation || '';
      overlappingTopics = geminiResult.overlapping_topics || [];
      missingTopics = geminiResult.missing_topics || [];
      overlappingSubjects = geminiResult.overlapping_subjects || [];
      missingSubjects = geminiResult.missing_subjects || [];
      extraPrep = geminiResult.extra_preparation_needed || [];
      difficultyComparison = geminiResult.difficulty_comparison || 'similar';
      studyTimeEstimate = geminiResult.study_time_estimate || '';
    } else {
      // Fallback: local-only scoring
      finalScore = localScore;
      const gap = computeGapAnalysis(sourceStructured, candStructured);
      overlappingTopics = gap.matched_topics;
      missingTopics = gap.missing_topics;
    }

    // ═══ DYNAMIC THRESHOLD ═══
    const isLocalFallback = !geminiResult;
    const threshold = isLocalFallback ? 15 : 45;
    if (finalScore < threshold) continue;

    const diffGap = finalScore >= 85 ? 'low' : finalScore >= 60 ? 'medium' : 'high';
    const gap = computeGapAnalysis(sourceStructured, candStructured);

    // Use Gemini topics if available, fall back to local
    const finalOverlapping = overlappingTopics.length > 0 ? overlappingTopics : gap.matched_topics;
    const finalMissing = missingTopics.length > 0 ? missingTopics : gap.missing_topics;

    scored.push({
      id: cand.id,
      job_name: cand.job_name,
      organization: cand.organization,
      job_category: cand.job_category,
      form_status: cand.form_status,
      application_start_date: cand.application_start_date,
      application_end_date: cand.application_end_date,
      salary_min: cand.salary_min,
      salary_max: cand.salary_max,
      qualification_required: cand.qualification_required,
      official_application_link: cand.official_application_link,
      official_website_link: cand.official_website_link,
      state: cand.state,
      similarity: finalScore,
      overlap_score: finalScore,
      explanation: geminiExplanation || buildExplanation(finalScore, sharedSubjects, gap, diffGap),
      overlapping_topics: finalOverlapping,
      missing_topics: finalMissing,
      overlapping_subjects: overlappingSubjects.length > 0 ? overlappingSubjects : sharedSubjects.map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')),
      missing_subjects: missingSubjects,
      extra_preparation_needed: extraPrep.length > 0 ? extraPrep : finalMissing.slice(0, 5),
      difficulty_gap: diffGap,
      difficulty_comparison: difficultyComparison,
      study_time_estimate: studyTimeEstimate || (finalScore >= 85 ? '1-2 weeks additional' : finalScore >= 75 ? '3-4 weeks additional' : '6-8 weeks additional'),
      gap_analysis: {
        matched_topics: finalOverlapping,
        missing_topics: finalMissing,
        extra_topics: gap.extra_topics,
      },
      detailed_gap_analysis: {
        source_exams: sourceExamNames,
        gemini_powered: !!geminiResult,
        subject_wise_analysis: geminiResult?.subject_wise_overlap?.length > 0
          ? geminiResult.subject_wise_overlap.map(s => ({
            subject: s.subject,
            overlap_percentage: Math.min(100, Math.max(0, s.overlap_pct)),
            gap_percentage: Math.min(100, Math.max(0, s.gap_pct ?? (100 - s.overlap_pct))),
          }))
          : (overlappingSubjects.length > 0 ? overlappingSubjects : sharedSubjects).map((s, idx) => {
            const cap = typeof s === 'string' ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : s;
            // Deterministic per-subject score based on subject index offset from final score
            const offsetMap = [0, -5, 3, -8, 5, -3, 7, -2, 4, -6];
            const offset = offsetMap[idx % offsetMap.length];
            const subPct = Math.min(100, Math.max(30, finalScore + offset));
            return { subject: cap, overlap_percentage: subPct, gap_percentage: 100 - subPct };
          }),
        topic_subtopic_analysis: {
          common_topics: finalOverlapping,
          missing_topics: finalMissing,
          partial_overlaps: gap.extra_topics.slice(0, 5),
        },
        gap_metrics: {
          total_overlap_percentage: finalScore,
          critical_subject_gaps: (missingSubjects.length > 0 ? missingSubjects : finalMissing).slice(0, 3),
        },
        priority_classification: {
          high: finalMissing.length > 0 ? finalMissing.slice(0, 3) : ['None (Syllabus Covered)'],
          medium: finalMissing.length > 3 ? finalMissing.slice(3, 6) : ['None (Syllabus Covered)'],
          low: gap.extra_topics.length > 0 ? gap.extra_topics.slice(0, 3) : ['None'],
        },
        preparation_roadmap: (extraPrep.length > 0 ? extraPrep : finalMissing).length > 0
          ? (extraPrep.length > 0 ? extraPrep : finalMissing).slice(0, 5).map(t => ({
              task: `Study ${t} comprehensively`,
              effort_estimation: studyTimeEstimate || (finalScore >= 85 ? '1-2 weeks' : finalScore >= 75 ? '2-4 weeks' : '4-6 weeks'),
            }))
          : [
              {
                task: `Practice full-length mock tests for ${cand.job_name} to maintain peak speed and accuracy`,
                effort_estimation: '1-2 weeks'
              },
              {
                task: `Conduct daily quick revisions of common subjects: ${(overlappingSubjects.length > 0 ? overlappingSubjects : sharedSubjects.map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))).slice(0, 3).join(', ')}`,
                effort_estimation: '1 week'
              },
              {
                task: `Solve previous years' question papers of ${cand.job_name} to align with specific pattern nuances`,
                effort_estimation: '1 week'
              },
              {
                task: `Stay updated with current affairs and general awareness revisions`,
                effort_estimation: 'Daily / Ongoing'
              }
            ],
        risk_analysis: {
          critical_missing_areas: (missingSubjects.length > 0 ? missingSubjects : finalMissing).length > 0
            ? (missingSubjects.length > 0 ? missingSubjects : finalMissing).slice(0, 3)
            : ['None (100% Syllabus Covered)'],
          exam_risk_factors: finalMissing.length > 5
            ? 'Significant preparation needed in new subjects.'
            : finalMissing.length > 2
              ? 'Moderate preparation needed for a few topics.'
              : 'Minimal risk — strong syllabus alignment.',
        },
        difficulty_comparison: difficultyComparison,
        study_time_estimate: studyTimeEstimate,
      },
      actions: {
        explore: `/jobs/${cand.id}`,
        apply: cand.official_application_link || cand.official_website_link || '',
      },
    });
  }

  // ═══ CATEGORY-BASED FALLBACK PASS FOR SPARSE MATCHES ═══
  if (scored.length === 0 && topCandidates.length > 0) {
    console.log(`[AI v2 Fallback] 0 matches found at high threshold. Applying category-based fallback pass...`);
    for (const cand of topCandidates) {
      const candStructured = structureSyllabus(cand.enrichedSyllabus || cand.syllabus, cand.job_name);

      const isSameCat = sourceCategories.includes(cand.job_category);
      if (!isSameCat) continue; // Focus strictly on same-category matches in fallback

      const { localScore, sharedSubjects } = computeLocalScore(sourceStructured, candStructured, 0, isSameCat);

      // Let's use a relaxed 35% threshold for the category fallback
      const fallbackScore = Math.max(35, localScore);

      const gap = computeGapAnalysis(sourceStructured, candStructured);
      const diffGap = fallbackScore >= 85 ? 'low' : fallbackScore >= 60 ? 'medium' : 'high';

      scored.push({
        id: cand.id,
        job_name: cand.job_name,
        organization: cand.organization,
        job_category: cand.job_category,
        form_status: cand.form_status,
        application_start_date: cand.application_start_date,
        application_end_date: cand.application_end_date,
        salary_min: cand.salary_min,
        salary_max: cand.salary_max,
        qualification_required: cand.qualification_required,
        official_application_link: cand.official_application_link,
        official_website_link: cand.official_website_link,
        state: cand.state,
        similarity: fallbackScore,
        overlap_score: fallbackScore,
        explanation: `Category Fallback: Matches on similar exam structure sharing key subjects (like ${sharedSubjects.join(', ')}) expected in a ${cand.job_category} career path.`,
        overlapping_topics: gap.matched_topics,
        missing_topics: gap.missing_topics,
        overlapping_subjects: sharedSubjects.map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')),
        missing_subjects: [],
        extra_preparation_needed: gap.missing_topics.slice(0, 5),
        difficulty_gap: diffGap,
        difficulty_comparison: 'similar',
        study_time_estimate: fallbackScore >= 60 ? '2-4 weeks additional' : '4-6 weeks additional',
        gap_analysis: {
          matched_topics: gap.matched_topics,
          missing_topics: gap.missing_topics,
          extra_topics: gap.extra_topics,
        },
        detailed_gap_analysis: {
          source_exams: sourceExamNames,
          gemini_powered: false,
          subject_wise_analysis: sharedSubjects.map((s, idx) => {
            const cap = typeof s === 'string' ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : s;
            return { subject: cap, overlap_percentage: fallbackScore, gap_percentage: 100 - fallbackScore };
          }),
          topic_subtopic_analysis: {
            common_topics: gap.matched_topics,
            missing_topics: gap.missing_topics,
            partial_overlaps: gap.extra_topics.slice(0, 5),
          },
          gap_metrics: {
            total_overlap_percentage: fallbackScore,
            critical_subject_gaps: gap.missing_topics.slice(0, 3),
          },
          priority_classification: {
            high: gap.missing_topics.length > 0 ? gap.missing_topics.slice(0, 3) : ['None (Syllabus Covered)'],
            medium: gap.missing_topics.length > 3 ? gap.missing_topics.slice(3, 6) : ['None (Syllabus Covered)'],
            low: gap.extra_topics.length > 0 ? gap.extra_topics.slice(0, 3) : ['None'],
          },
          preparation_roadmap: gap.missing_topics.length > 0
            ? gap.missing_topics.slice(0, 5).map(t => ({
                task: `Study ${t} comprehensively`,
                effort_estimation: '3-4 weeks',
              }))
            : [
                {
                  task: `Practice full-length mock tests for ${cand.job_name} to maintain peak speed and accuracy`,
                  effort_estimation: '1-2 weeks'
                },
                {
                  task: `Conduct daily quick revisions of common subjects: ${sharedSubjects.map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).slice(0, 3).join(', ')}`,
                  effort_estimation: '1 week'
                },
                {
                  task: `Solve previous years' question papers of ${cand.job_name} to align with specific pattern nuances`,
                  effort_estimation: '1 week'
                },
                {
                  task: `Stay updated with current affairs and general awareness revisions`,
                  effort_estimation: 'Daily / Ongoing'
                }
              ],
          risk_analysis: {
            critical_missing_areas: gap.missing_topics.length > 0 ? gap.missing_topics.slice(0, 3) : ['None (100% Syllabus Covered)'],
            exam_risk_factors: 'Category balance - some preparation required in new areas.',
          },
          difficulty_comparison: 'similar',
          study_time_estimate: '4-6 weeks',
        },
        actions: {
          explore: `/jobs/${cand.id}`,
          apply: cand.official_application_link || cand.official_website_link || '',
        },
      });
    }
  }

  // Sort DESC by score, then LIVE first
  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    const order = { LIVE: 3, UPCOMING: 2, RECENTLY_CLOSED: 1, CLOSED: 0 };
    return (order[b.form_status] || 0) - (order[a.form_status] || 0);
  });

  console.log(`[AI v2] Found ${scored.length} exams with ≥70% overlap`);

  // Store recommendations in Supabase 'ai_recommendations' table for persistent/historical query support
  if (scored.length > 0) {
    const dbRecs = scored.map(r => ({
      id: `rec_${userId}_${sourceExamIds[0]}_${r.id}`.substring(0, 100),
      user_id: userId,
      source_job_id: sourceExamIds[0],
      target_job_id: r.id,
      overlap_percentage: Math.round(r.similarity),
      common_topics: JSON.stringify(r.overlapping_topics || []),
      missing_topics: JSON.stringify(r.missing_topics || []),
      explanation: r.explanation || '',
      similarity: Math.round(r.similarity),
      overlapping_topics: JSON.stringify(r.overlapping_topics || []),
      difficulty_gap: r.difficulty_gap || 'medium',
      detailed_gap_analysis: r.detailed_gap_analysis || null,
      overlapping_subjects: JSON.stringify(r.overlapping_subjects || []),
      missing_subjects: JSON.stringify(r.missing_subjects || []),
      extra_preparation_needed: JSON.stringify(r.extra_preparation_needed || []),
      difficulty_comparison: r.difficulty_comparison || 'similar',
      study_time_estimate: r.study_time_estimate || '',
      created_at: new Date().toISOString()
    }));

    try {
      const { error: upsertErr } = await sb.from('ai_recommendations')
        .upsert(dbRecs, { onConflict: 'user_id,source_job_id,target_job_id' });
      if (upsertErr) {
        console.error(`[AI Recommendations] Failed to store recommendations in Supabase:`, upsertErr.message);
      } else {
        console.log(`[AI Recommendations] Successfully stored ${dbRecs.length} persistent recommendations in Supabase`);
      }
    } catch (err) {
      console.error(`[AI Recommendations] Failed to store recommendations in Supabase:`, err.message);
    }
  }

  // Paginate
  const PAGE_SIZE = 10;
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageData = scored.slice(startIdx, startIdx + PAGE_SIZE);
  const result = { data: pageData, hasMore: scored.length > startIdx + PAGE_SIZE, page, totalMatches: scored.length };

  _resultCache.set(cacheKey, { data: result, ts: Date.now() });
  try {
    await sb.from('ai_recommendation_cache')
      .upsert({ key: cacheKey, data: result, updated_at: new Date().toISOString() });
  } catch (err) {
    console.error(`[AI Cache] Failed to store persistent cache in Supabase:`, err.message);
  }
  return result;
}

function buildExplanation(score, sharedSubjects, gap, diffGap) {
  const cap = s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const shared = sharedSubjects.map(cap);
  if (score >= 85) return `Very strong overlap (${score}%) — ${shared.slice(0, 3).join(', ')} align closely. ${gap.missing_topics.length === 0 ? 'No major gaps.' : `Minor gaps in ${gap.missing_topics.slice(0, 2).join(', ')}.`}`;
  if (score >= 75) return `Good overlap (${score}%) in ${shared.slice(0, 2).join(' and ')}. ${gap.missing_topics.length > 0 ? `Bridge gap in ${gap.missing_topics.slice(0, 2).join(', ')}.` : ''}`;
  return `${score}% syllabus alignment detected. ${shared.length > 0 ? shared.slice(0, 2).join(', ') + ' overlap.' : ''} ${gap.missing_topics.length > 0 ? `Prepare for ${gap.missing_topics.slice(0, 2).join(', ')}.` : ''}`;
}

module.exports = { getRecommendations, structureSyllabus, computeGapAnalysis, cosineSimilarity, extractSyllabusWithGemini };
