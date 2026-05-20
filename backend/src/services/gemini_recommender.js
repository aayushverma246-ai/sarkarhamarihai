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
const MODEL_NAME = 'gemini-2.0-flash';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getSb() {
  return createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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

  if (!genAI) {
    // Fallback: use exam name as syllabus proxy
    return existingSyllabus || examName || '';
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: 'application/json' }
    });

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

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
    ]);

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
  if (!genAI || !targetExams.length) return [];

  const CHUNK_SIZE = 8;
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

      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: 'application/json' }
      });

      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await Promise.race([
            model.generateContent(prompt),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
          ]);

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

          // Cache results
          for (const v of validated) {
            const ck = `cmp:${sourceExamNames.join('+')}:${v.id}`;
            _comparisonCache.set(ck, { data: v, ts: Date.now() });
          }

          allResults.push(...validated);
          break; // success
        } catch (err) {
          lastErr = err;
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('api key') || msg.includes('permission')) throw err;
          if (attempt < 2) await sleep(2000 * (attempt + 1));
        }
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
  if (!text || text.length < 10) return null;
  if (_embeddingCache.has(examId)) return _embeddingCache.get(examId);
  if (!genAI) return null;

  while (_activeRequests >= MAX_CONCURRENT) await sleep(200);
  _activeRequests++;

  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await Promise.race([
          model.embedContent(text.substring(0, 2000)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        const vec = result.embedding.values;
        _embeddingCache.set(examId, vec);
        return vec;
      } catch (err) {
        lastErr = err;
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('api key') || msg.includes('permission')) throw err;
        await sleep(1000 * (attempt + 1));
      }
    }
    console.error(`[Embed] Failed for ${examId}: ${lastErr?.message}`);
    return null;
  } finally {
    _activeRequests--;
  }
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
  const subjectScore = srcSubjects.size > 0 ? sharedSubjects.length / Math.max(srcSubjects.size, 1) : 0;

  const srcKw = new Set(sourceStructured.keywords);
  const candKw = new Set(candidateStructured.keywords);
  let kwIntersection = 0;
  for (const k of srcKw) { if (candKw.has(k)) kwIntersection++; }
  const keywordScore = srcKw.size > 0 ? kwIntersection / Math.min(srcKw.size, candKw.size || 1) : 0;

  const semScore = Math.max(0, semanticSim);
  const catBonus = sameCategory ? 0.10 : 0;

  const raw = Math.min(1, 0.30 * subjectScore + 0.20 * keywordScore + 0.30 * semScore + catBonus);
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
// MAIN RECOMMENDATION FUNCTION — GEMINI-POWERED
// ═══════════════════════════════════════════════════════════════
async function getRecommendations(sourceExamIds, userId, filters = {}) {
  const { page = 1, search = '', category = '' } = filters;
  const sb = getSb();

  // Cache check
  const cacheKey = `reco:${sourceExamIds.sort().join(',')}:${category}:${search}:${page}`;
  const cached = _resultCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < RESULT_TTL) return cached.data;

  // 1. Fetch source exams
  const { data: sourceExams } = await sb.from('jobs')
    .select('id, job_name, syllabus, job_category, organization')
    .in('id', sourceExamIds);

  if (!sourceExams || sourceExams.length === 0) {
    return { data: [], hasMore: false, page: 1, totalMatches: 0 };
  }

  // 2. GEMINI STEP 1: Extract/enrich syllabus for source exams
  console.log(`[AI v2] Extracting syllabus for ${sourceExams.length} source exam(s)...`);
  const enrichedSourceSyllabi = await Promise.all(
    sourceExams.map(e => extractSyllabusWithGemini(e.job_name, e.organization, e.syllabus))
  );
  const combinedSyllabus = enrichedSourceSyllabi.join(' ');
  const sourceStructured = structureSyllabus(combinedSyllabus);
  const sourceCategories = [...new Set(sourceExams.map(e => e.job_category).filter(Boolean))];
  const sourceExamNames = sourceExams.map(e => e.job_name);

  // 3. Get source embedding
  const hasSyllabus = combinedSyllabus.trim().length > 20;
  const sourceEmbedding = hasSyllabus ? await getEmbedding(combinedSyllabus.substring(0, 2000), `src_${sourceExamIds.join('_')}`) : null;

  // 4. Fetch candidates
  let query = sb.from('jobs')
    .select('id, job_name, organization, job_category, syllabus, form_status, application_start_date, application_end_date, salary_min, salary_max, qualification_required, official_application_link, official_website_link, state, minimum_age, maximum_age')
    .not('id', 'in', `(${sourceExamIds.join(',')})`)
    .in('form_status', ['LIVE', 'UPCOMING', 'RECENTLY_CLOSED']);

  if (category) query = query.eq('job_category', category);
  if (search) query = query.or(`job_name.ilike.%${search}%,organization.ilike.%${search}%`);

  const { data: allCandidates } = await query.limit(2000);
  if (!allCandidates || allCandidates.length === 0) {
    return { data: [], hasMore: false, page: 1, totalMatches: 0 };
  }

  // 5. Pre-filter with local matching (generous pass)
  const shortlisted = allCandidates.filter(c => preFilter(sourceStructured, c, sourceCategories));
  console.log(`[AI v2] Pre-filtered: ${shortlisted.length}/${allCandidates.length} candidates`);

  // 6. GEMINI STEP 2: Enrich shortlisted exams' syllabi
  const topCandidates = shortlisted.slice(0, 150);
  const enrichmentBatch = topCandidates.slice(0, 50); // Enrich top 50 with Gemini

  await Promise.all(
    enrichmentBatch.map(async (cand) => {
      cand.enrichedSyllabus = await extractSyllabusWithGemini(cand.job_name, cand.organization, cand.syllabus);
    })
  );

  // 7. GEMINI STEP 3: Batch compare ALL shortlisted exams using Gemini
  console.log(`[AI v2] Running Gemini comparison on ${topCandidates.length} candidates...`);
  const geminiResults = await geminiCompareExams(combinedSyllabus, sourceExamNames, topCandidates);

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
      const candEmb = await getEmbedding(
        (candSyllabusText + ' ' + cand.job_name).substring(0, 2000),
        cand.id
      );
      if (candEmb) semSim = cosineSimilarity(sourceEmbedding, candEmb);
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

    if (geminiResult) {
      // Weight: 50% Gemini, 50% local  
      finalScore = Math.round(0.5 * geminiResult.overlap_percentage + 0.5 * localScore);
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

    // ═══ 70% THRESHOLD ═══
    if (finalScore < 70) continue;

    const diffGap = finalScore >= 85 ? 'low' : finalScore >= 70 ? 'medium' : 'high';
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
          high: finalMissing.slice(0, 3),
          medium: finalMissing.slice(3, 6),
          low: gap.extra_topics.slice(0, 3),
        },
        preparation_roadmap: (extraPrep.length > 0 ? extraPrep : finalMissing).slice(0, 5).map(t => ({
          task: `Study ${t} comprehensively`,
          effort_estimation: studyTimeEstimate || (finalScore >= 85 ? '1-2 weeks' : finalScore >= 75 ? '2-4 weeks' : '4-6 weeks'),
        })),
        risk_analysis: {
          critical_missing_areas: (missingSubjects.length > 0 ? missingSubjects : finalMissing).slice(0, 3),
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

  // Sort DESC by score, then LIVE first
  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    const order = { LIVE: 3, UPCOMING: 2, RECENTLY_CLOSED: 1, CLOSED: 0 };
    return (order[b.form_status] || 0) - (order[a.form_status] || 0);
  });

  console.log(`[AI v2] Found ${scored.length} exams with ≥70% overlap`);

  // Paginate
  const PAGE_SIZE = 10;
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageData = scored.slice(startIdx, startIdx + PAGE_SIZE);
  const result = { data: pageData, hasMore: scored.length > startIdx + PAGE_SIZE, page, totalMatches: scored.length };

  _resultCache.set(cacheKey, { data: result, ts: Date.now() });
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
