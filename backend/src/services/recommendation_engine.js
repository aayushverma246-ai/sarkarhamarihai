/**
 * AI RECOMMENDATION ENGINE v2 — Deterministic + Hybrid Scoring
 * 
 * Multi-factor scoring system:
 *   - Category match:       30 pts
 *   - Qualification match:  20 pts
 *   - Syllabus overlap:     25 pts
 *   - State relevance:      15 pts
 *   - Status bonus:         10 pts
 *   Total max:             100 pts
 * 
 * All recommendations are validated against DB existence.
 * No hallucinated recommendations. No guessing on missing data.
 */
'use strict';

const { getDb } = require('../db');
const { CANONICAL_CATEGORIES, normalizeCategory, normalizeState } = require('../constants');

// ── In-memory cache (5-minute TTL) ──────────────────────────────────────────
const _recCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedRecs(key) {
  const entry = _recCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCachedRecs(key, data) {
  _recCache.set(key, { data, ts: Date.now() });
  // Prevent unbounded growth
  if (_recCache.size > 200) {
    const oldest = _recCache.keys().next().value;
    _recCache.delete(oldest);
  }
}

// ── Qualification ordering ──────────────────────────────────────────────────
const QUAL_ORDER = { 'Class 10': 1, 'Class 12': 2, 'Graduation': 3, 'Post Graduation': 4, 'PhD': 5 };

function qualLevel(q) {
  return QUAL_ORDER[q] || 0;
}

// ── Syllabus overlap (word-level Jaccard-like) ──────────────────────────────
// Returns 0.0 to 1.0
function syllabusOverlap(text1, text2) {
  if (!text1 || !text2) return 0;
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  return intersection / Math.min(words1.size, words2.size);
}

// ── Core scoring function ───────────────────────────────────────────────────
function scoreJob(candidateJob, userProfile) {
  let score = 0;
  const reasons = [];

  // 1. CATEGORY MATCH (30 pts)
  if (userProfile.categories.length > 0) {
    const candidateCat = (candidateJob.job_category || '').toLowerCase();
    const matchesCat = userProfile.categories.some(c => c.toLowerCase() === candidateCat);
    if (matchesCat) {
      score += 30;
      reasons.push(`Same category: ${candidateJob.job_category}`);
    } else {
      // Partial match for related categories
      const related = getRelatedCategories(candidateJob.job_category);
      const hasRelated = userProfile.categories.some(c => related.includes(c.toLowerCase()));
      if (hasRelated) {
        score += 15;
        reasons.push(`Related category: ${candidateJob.job_category}`);
      }
    }
  }

  // 2. QUALIFICATION MATCH (20 pts)
  if (userProfile.qualification) {
    const userLevel = qualLevel(userProfile.qualification);
    const jobLevel = qualLevel(candidateJob.qualification_required);
    if (userLevel > 0 && jobLevel > 0) {
      if (userLevel >= jobLevel) {
        score += 20;
        reasons.push('Qualification eligible');
      } else if (userLevel === jobLevel - 1) {
        score += 10;
        reasons.push('Qualification nearly eligible');
      }
    }
  }

  // 3. SYLLABUS OVERLAP (25 pts)
  if (userProfile.combinedSyllabus) {
    const jobSyllabus = candidateJob.syllabus || candidateJob.structured_syllabus_json || '';
    if (jobSyllabus) {
      const overlap = syllabusOverlap(userProfile.combinedSyllabus, jobSyllabus);
      const syllabusScore = Math.round(overlap * 25);
      if (syllabusScore > 0) {
        score += syllabusScore;
        reasons.push(`${Math.round(overlap * 100)}% syllabus overlap`);
      }
    }
  }

  // 4. STATE RELEVANCE (15 pts)
  if (userProfile.state) {
    const jobState = (candidateJob.state || '').toLowerCase();
    const userState = userProfile.state.toLowerCase();
    if (jobState === 'all india') {
      score += 10;
      reasons.push('Pan-India opportunity');
    } else if (jobState === userState) {
      score += 15;
      reasons.push(`Matches your state: ${candidateJob.state}`);
    }
    // Check multi-state
    if (candidateJob.states && Array.isArray(candidateJob.states)) {
      const statesLower = candidateJob.states.map(s => (s || '').toLowerCase());
      if (statesLower.includes(userState)) {
        score += 15;
        reasons.push(`Available in your state`);
      }
    }
  }

  // 5. STATUS BONUS (10 pts)
  const todayStr = getTodayIST();
  const status = computeFormStatus(candidateJob, todayStr);
  if (status === 'LIVE') {
    score += 10;
    reasons.push('Currently accepting applications');
  } else if (status === 'UPCOMING') {
    score += 5;
    reasons.push('Applications opening soon');
  }

  // Cap at 100
  score = Math.min(score, 100);

  return {
    score,
    explanation: reasons.length > 0
      ? reasons.join(' • ')
      : 'General recommendation based on profile'
  };
}

// ── Related category mapping ────────────────────────────────────────────────
function getRelatedCategories(category) {
  const related = {
    'UPSC': ['state pscs', 'central government'],
    'SSC': ['central government', 'railways'],
    'Banking': ['insurance', 'cooperative'],
    'Railways': ['ssc', 'central government', 'engineering'],
    'Defence': ['police', 'central government'],
    'Police': ['defence', 'state government'],
    'State PSCs': ['upsc', 'state government'],
    'Teaching': ['research & science', 'entrance exam'],
    'Engineering': ['psu', 'railways', 'telecom'],
    'Healthcare': ['research & science'],
    'PSU': ['engineering', 'banking'],
    'Insurance': ['banking'],
    'Judiciary': ['upsc', 'state pscs'],
    'Research & Science': ['teaching', 'engineering'],
    'Central Government': ['ssc', 'upsc'],
    'State Government': ['state pscs', 'police'],
    'Agriculture': ['cooperative', 'state government'],
    'Entrance Exam': ['teaching', 'engineering'],
    'Forest & Environment': ['upsc', 'state pscs'],
    'Telecom': ['engineering', 'psu'],
    'Cooperative': ['banking', 'agriculture'],
    'Shipping & Ports': ['engineering', 'defence'],
  };
  return (related[category] || []).map(c => c.toLowerCase());
}

// ── Helper: today in IST ────────────────────────────────────────────────────
function getTodayIST() {
  const today = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(today.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
}

function computeFormStatus(job, todayStr) {
  const start = job.application_start_date;
  const end = job.application_end_date;
  if (!start || !end) return 'CLOSED';
  if (todayStr < start) return 'UPCOMING';
  if (todayStr <= end) return 'LIVE';
  return 'CLOSED';
}

// ── Build user profile from applied exams + user data ───────────────────────
function buildUserProfile(user, appliedExams, likedExams) {
  const profile = {
    state: user?.state || '',
    qualification: user?.qualification_type || '',
    qualificationStatus: user?.qualification_status || '',
    age: user?.age || 0,
    categories: [],
    combinedSyllabus: '',
    appliedIds: new Set(),
    likedIds: new Set(),
  };

  if (appliedExams && appliedExams.length > 0) {
    profile.categories = [...new Set(appliedExams.map(e => e.job_category).filter(Boolean))];
    profile.combinedSyllabus = appliedExams
      .map(e => e.syllabus || e.structured_syllabus_json || '')
      .join(' ');
    profile.appliedIds = new Set(appliedExams.map(e => e.id));
  }

  if (likedExams && likedExams.length > 0) {
    // Merge liked exam categories into profile
    const likedCats = likedExams.map(e => e.job_category).filter(Boolean);
    profile.categories = [...new Set([...profile.categories, ...likedCats])];
    profile.likedIds = new Set(likedExams.map(e => e.id));
  }

  return profile;
}

// ── Main recommendation function ────────────────────────────────────────────
async function getRecommendations(userId, appliedExams, filters = {}) {
  const { search = '', category = '', page = 1 } = filters;
  const db = getDb();

  // Cache key
  const cacheKey = `rec:${userId}:${category}:${search}:${page}`;
  const cached = getCachedRecs(cacheKey);
  if (cached) return cached;

  // Build user profile
  let user = null;
  try {
    const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    user = userResult.rows[0] || null;
  } catch (_) { /* guest user */ }

  // Get liked exams for enriched profile
  let likedExams = [];
  try {
    const likedResult = await db.execute({
      sql: `SELECT j.* FROM liked_jobs l JOIN jobs j ON l.job_id = j.id WHERE l.user_id = ?`,
      args: [userId]
    });
    likedExams = likedResult.rows || [];
  } catch (_) { /* ignore */ }

  const profile = buildUserProfile(user, appliedExams, likedExams);
  const excludeIds = new Set([...profile.appliedIds, ...profile.likedIds]);

  // Fetch candidate jobs
  let query = 'SELECT * FROM jobs';
  let args = [];

  if (category && category !== 'All') {
    query += ' WHERE job_category = ?';
    args.push(category);
  }

  if (search) {
    const prefix = args.length > 0 ? ' AND' : ' WHERE';
    query += `${prefix} (LOWER(job_name) LIKE ? OR LOWER(organization) LIKE ?)`;
    args.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const candidateResult = await db.execute({ sql: query, args });
  const allCandidates = candidateResult.rows || [];

  // Score each candidate
  const scored = [];
  for (const job of allCandidates) {
    if (excludeIds.has(job.id)) continue;

    const { score, explanation } = scoreJob(job, profile);
    if (score > 0) {
      scored.push({
        id: job.id,
        job_name: job.job_name,
        organization: job.organization,
        job_category: job.job_category,
        form_status: computeFormStatus(job, getTodayIST()),
        application_start_date: job.application_start_date,
        application_end_date: job.application_end_date,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        qualification_required: job.qualification_required,
        official_application_link: job.official_application_link,
        state: job.state,
        vacancies: job.vacancies,
        score,
        explanation,
      });
    }
  }

  // Sort by score descending, then by LIVE status, then by name
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // LIVE > UPCOMING > CLOSED
    const statusOrder = { 'LIVE': 3, 'UPCOMING': 2, 'RECENTLY_CLOSED': 1, 'CLOSED': 0 };
    return (statusOrder[b.form_status] || 0) - (statusOrder[a.form_status] || 0);
  });

  // Paginate
  const pageSize = 10;
  const start = (page - 1) * pageSize;
  const data = scored.slice(start, start + pageSize);
  const hasMore = scored.length > start + pageSize;

  const result = { data, hasMore, page, totalMatches: scored.length };

  // Cache
  setCachedRecs(cacheKey, result);

  return result;
}

module.exports = { getRecommendations, scoreJob, buildUserProfile, syllabusOverlap };
