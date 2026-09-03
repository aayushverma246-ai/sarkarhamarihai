const express = require('express');
const router = express.Router();
const { getDb, ensureVercelUser, getSupabase } = require('../db');
const auth = require('../middleware/auth');
const { CANONICAL_CATEGORIES, CANONICAL_STATES, normalizeCategory, normalizeState, validateJob } = require('../constants');
const { isJobVerified } = require('../services/gemini_recommender');

// ── Server-side in-memory cache for heavy endpoints ────────────────────────────
const _serverCache = {};
function getCachedResult(key, ttlMs = 60000) {
    const entry = _serverCache[key];
    if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
    return null;
}
function setCachedResult(key, data) {
    _serverCache[key] = { data, ts: Date.now() };
}

const { getTodayIST, computeFormStatus, inferStateFromName, withStatus, MINIMAL_COLUMNS, serializeMinimalJob } = require('../utils/job-serializer');

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function getQualificationLevel(qualStr) {
    if (!qualStr) return 0;
    const normalized = qualStr.toLowerCase();
    if (normalized.includes('phd') || normalized.includes('doctorate')) return 5;
    if (normalized.includes('post grad') || normalized.includes('postgrad') || normalized.includes('master') || normalized.includes('m.tech') || normalized.includes('m.sc') || normalized.includes('mba') || normalized.includes('m.com') || normalized.includes('m.ca')) return 4;
    if (normalized.includes('graduat') || normalized.includes('degree') || normalized.includes('b.tech') || 
        normalized.includes('b.e.') || normalized.includes('b.sc') || normalized.includes('b.com') || 
        normalized.includes('b.a') || normalized.includes('bachelor') || normalized.includes('pharm') || 
        normalized.includes('mbbs') || normalized.includes('ca')) return 3;
    if (normalized.includes('diploma')) return 2.5;
    if (normalized.includes('12th') || normalized.includes('class 12') || normalized.includes('hsc') || normalized.includes('intermediate') || normalized.includes('senior secondary')) return 2;
    if (normalized.includes('10th') || normalized.includes('class 10') || normalized.includes('ssc') || normalized.includes('matric') || normalized.includes('high school')) return 1;
    return 0;
}

function meetsQualification(user, job) {
    if (!user.qualification_type) return false;

    // If the candidate job does not specify qualification_required, it is open to all
    if (!job.qualification_required || job.qualification_required.trim().toLowerCase() === 'none') return true;

    const userLevel = getQualificationLevel(user.qualification_type);
    const jobLevel = getQualificationLevel(job.qualification_required);

    // If the job requires an unrecognized qualification, do not hard-block
    if (jobLevel === 0) return true;
    if (userLevel === 0) return false;

    if (user.qualification_status === 'Completed') {
        // Completed users are eligible for jobs at or below their qualification level
        return userLevel >= jobLevel;
    }

    if (user.qualification_status === 'Pursuing') {
        // Pursuing users have COMPLETED the level below, so they match lower-level jobs
        if (userLevel > jobLevel) return true;

        // Allow pursuing matching degree by default to keep recommendations helpful
        if (userLevel === jobLevel) {
            if (!job.allows_final_year_students) return true; // lenient default
            const currentYearStr = getTodayIST().substring(0, 4);
            const currentYear = parseInt(currentYearStr);
            const expectedGradYear = parseInt(user.expected_graduation_year);
            if (!expectedGradYear || expectedGradYear === currentYear || expectedGradYear === currentYear + 1) {
                return true;
            }
        }
    }
    return false;
}

// Use canonical states from shared constants
const indianStates = CANONICAL_STATES;

function meetsStateCriteria(user, job) {
    if (!job.state) return true;
    if (job.state === 'All India') return true;
    const userState = (user.state || '').toLowerCase().trim();
    if (!userState) return true;

    // Exact match on primary state
    if (job.state.toLowerCase().trim() === userState) return true;

    // Check multi-state array for multi-state jobs
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

function meetsTechnicalCriteria(user, job) {
    const textToSearch = ((job.job_name || '') + ' ' + (job.organization || '')).toLowerCase();
    const isHighlyTechnical = /(?:junior engineer|assistant engineer|ae\/je|\bae\b|\bje\b|b\.tech|\bbtech\b|m\.tech|\bmtech\b|diploma in|\biti\b|nursing|medical officer|\bmbbs\b)/i.test(textToSearch);
    
    if (!isHighlyTechnical) return true;
    if (!user || !user.qualification_type) return false;
    
    const userQual = user.qualification_type.toLowerCase();
    return userQual.includes('b.tech') || 
           userQual.includes('b.e.') || 
           userQual.includes('m.tech') || 
           userQual.includes('diploma') ||
           userQual.includes('nursing') ||
           userQual.includes('medical') ||
           userQual.includes('iti');
}

function meetsAge(user, job) {
    if (!user.age || user.age === 0) return true;

    const minAge = job.minimum_age ? Number(job.minimum_age) : 0;
    let maxAge = job.maximum_age ? Number(job.maximum_age) : 100;
    const userAge = Number(user.age);

    if (user.category === 'OBC') {
        maxAge += 3;
    } else if (user.category === 'SC' || user.category === 'ST') {
        maxAge += 5;
    }

    return userAge >= minAge && userAge <= maxAge;
}

// GET /api/jobs/categories — returns canonical categories merged with DB data
router.get('/categories', async (req, res) => {
    try {
        const cacheKey = 'categories_v2';
        const cached = getCachedResult(cacheKey, 300000);
        if (cached) return res.json(cached);

        // Merge canonical list with any DB-specific categories
        const sb = getSupabase();
        const { data } = await sb.from('jobs').select('job_category').not('job_category', 'is', null).neq('job_category', '');
        const dbCats = (data || []).map(r => r.job_category).filter(Boolean);

        // Start with canonical, add any DB categories not already present
        const merged = new Set(CANONICAL_CATEGORIES);
        for (const cat of dbCats) {
            const normalized = normalizeCategory(cat);
            if (normalized) merged.add(normalized);
        }
        merged.delete('Others');
        merged.delete('Other');
        merged.delete('Misc');

        const sorted = ['All', ...Array.from(merged).sort((a, b) => a.localeCompare(b))];
        setCachedResult(cacheKey, sorted);
        res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.json(sorted);
    } catch (err) {
        console.error('GET /api/jobs/categories error:', err);
        return res.json(['All', ...CANONICAL_CATEGORIES]);
    }
});

// GET /api/jobs/states — returns canonical states list
router.get('/states', async (req, res) => {
    try {
        const cacheKey = 'states_v2';
        const cached = getCachedResult(cacheKey, 300000);
        if (cached) return res.json(cached);

        // Return canonical states — always complete, always correct
        const states = [...CANONICAL_STATES];
        setCachedResult(cacheKey, states);
        res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.json(states);
    } catch (err) {
        console.error('GET /api/jobs/states error:', err);
        return res.json(CANONICAL_STATES);
    }
});

// GET /api/jobs/all-minimal
// Extremely lightweight endpoint returning ALL jobs instantly (no heavy columns) for client-side search/filtering.
router.get('/all-minimal', async (req, res) => {
    try {
        const todayStr = getTodayIST();
        const cacheKey = `all-minimal:${todayStr}`;

        // ── Server-side cache check (5-min TTL to avoid constant DB hammering) ─────
        const cachedJobs = getCachedResult(cacheKey, 300000);
        if (cachedJobs) {
            res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            res.set('X-Cache', 'HIT');
            return res.json(cachedJobs);
        }

        const db = getDb();
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, job_category, state, states, application_start_date, application_end_date, vacancies, official_application_link, last_verified_at, created_at';

        const allRows = [];
        const limit = 1000;
        let offset = 0;

        // Fetch paginated jobs sequentially to guarantee compatibility with both:
        //  1. PostgreSQL direct connection (no limits).
        //  2. Supabase REST fallback client (which enforces a strict max limit of 1000 rows per query).
        while (true) {
            try {
                const result = await db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date DESC, id LIMIT ${limit} OFFSET ${offset}`);
                const rows = result.rows || [];
                if (rows.length === 0) break;
                allRows.push(...rows);
                if (rows.length < limit) break; // last page detected or capped by server-side limit
                offset += limit;
            } catch (err) {
                console.warn(`[all-minimal sequential page fail at offset ${offset}]:`, err.message);
                break; // stop on error to avoid infinite loop
            }
        }

        // Remove duplicate IDs (safety net)
        const seen = new Set();
        const unique = [];
        for (const row of allRows) {
            if (row.id && !seen.has(row.id)) { seen.add(row.id); unique.push(row); }
        }

        // Columns definition used to reduce JSON payload size
        const columns = MINIMAL_COLUMNS;

        const rows = unique.map(j => {
            const statusJob = withStatus(j, todayStr);
            return columns.map(col => statusJob[col] ?? null);
        });

        // Final Output Sorted strict alphabetically by job_name (index 1)
        rows.sort((a, b) => {
            const nameA = a[1] || '';
            const nameB = b[1] || '';
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

        const responsePayload = { columns, jobs: rows };

        // Cache for 5 minutes
        setCachedResult(cacheKey, responsePayload);

        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.set('X-Cache', 'MISS');
        res.json(responsePayload);
    } catch (err) {
        console.error('Failed fetching all-minimal jobs:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});


// Helper builder for exact filtering
function buildFilters(req, statusParam) {
    let whereClauses = [];
    let args = [];
    let index = 1;

    // Status filter
    if (statusParam) {
        if (statusParam === 'CLOSED') {
            const today = getTodayIST();
            whereClauses.push(`application_end_date < $${index++}`);
            args.push(today);
        } else if (statusParam === 'UPCOMING') {
            const today = getTodayIST();
            whereClauses.push(`application_start_date > $${index++}`);
            args.push(today);
        } else if (statusParam === 'LIVE') {
            const today = getTodayIST();
            whereClauses.push(`application_start_date <= $${index++}`);
            args.push(today);
            whereClauses.push(`application_end_date >= $${index++}`);
            args.push(today);
        }
    }

    // Exact state and category mapping
    const { state, category } = req.query;
    if (state && state !== 'All India') {
        // Match exact state OR jobs open to all India
        whereClauses.push(`(state = $${index++} OR state = 'All India')`);
        args.push(state);
    }

    if (category && category !== 'All') {
        whereClauses.push(`job_category = $${index++}`);
        args.push(category);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return { whereStr, args };
}

// GET /api/jobs
// Uses Supabase SDK directly with batch pagination to bypass the 1000-row REST limit.
router.get('/', async (req, res) => {
    try {
        const sb = getSupabase();
        const { limit: limitParam, offset: offsetParam, status, state, category } = req.query;
        const todayStr = getTodayIST();

        const limit = Math.min(parseInt(limitParam) || 100, 5000);
        const offset = parseInt(offsetParam) || 0;

        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, last_verified_at, created_at';

        // Build Supabase SDK query with filters
        const buildSbQuery = () => {
            let q = sb.from('jobs').select(selectFields);

            // Status filter
            const today = getTodayIST();
            if (status === 'CLOSED') {
                q = q.lt('application_end_date', today);
            } else if (status === 'UPCOMING') {
                q = q.gt('application_start_date', today);
            } else if (status === 'LIVE') {
                q = q.lte('application_start_date', today).gte('application_end_date', today);
            }

            // State filter: match exact state OR All India records
            if (state && state !== 'All India') {
                q = q.or(`state.eq.${state},state.eq.All India`);
            }

            // Category filter
            if (category && category !== 'All') {
                q = q.eq('job_category', category);
            }

            return q;
        };

        // Get total count first (fast — head=true means no body returned)
        const { count: total, error: countErr } = await sb.from('jobs')
            .select('*', { count: 'exact', head: true });
        if (countErr) throw new Error(countErr.message);

        // Fetch data using batch pagination if limit > 1000 (Supabase REST cap)
        const BATCH = 1000;
        const allRows = [];

        if (limit <= BATCH) {
            const { data, error } = await buildSbQuery()
                .order('application_end_date', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error) throw new Error(error.message);
            allRows.push(...(data || []));
        } else {
            // Batch fetch to bypass 1000-row limit
            let batchOffset = offset;
            const target = offset + limit;
            while (batchOffset < target) {
                const batchEnd = Math.min(batchOffset + BATCH - 1, target - 1);
                const { data, error } = await buildSbQuery()
                    .order('application_end_date', { ascending: false })
                    .range(batchOffset, batchEnd);
                if (error) throw new Error(error.message);
                if (!data || data.length === 0) break;
                allRows.push(...data);
                batchOffset += BATCH;
                if (data.length < BATCH) break; // Last page
            }
        }

        const jobs = allRows.map(job => withStatus(job, todayStr));

        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json({
            jobs,
            total: total || jobs.length,
            limit,
            offset,
            hasMore: offset + jobs.length < (total || 0)
        });
    } catch (err) {
        console.error('GET /api/jobs error:', err);
        return res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
    }
});

// GET /api/jobs/eligible
router.get('/eligible', auth, async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0] || req.user;
        if (!user) return res.status(404).json({ error: 'User not found' });

        const hasCompleteProfile = !!(user.qualification_type && user.age && user.age > 0);

        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, last_verified_at, created_at';
        const { whereStr, args } = buildFilters(req, null);

        // Optimized database fetch
        const query = `SELECT ${selectFields} FROM jobs ${whereStr} ORDER BY application_end_date ASC LIMIT 500`;
        const allRows = (await db.execute({ sql: query, args })).rows || [];

        const jobs = allRows.map(row => withStatus(row, todayStr));

        let allEligible = [];
        let broadlyEligible = [];

        for (const j of jobs) {
            if (!isJobVerified(j)) continue; // Strictly filter out unverified/placeholder exams

            if (hasCompleteProfile) {
                if (meetsQualification(user, j) && meetsAge(user, j) && meetsTechnicalCriteria(user, j) && meetsStateCriteria(user, j)) {
                    allEligible.push(j);
                }
            }
            // Broad fallback only used for incomplete profiles
            if (!hasCompleteProfile && (j.form_status === 'LIVE' || j.form_status === 'UPCOMING') && meetsTechnicalCriteria(user, j) && meetsStateCriteria(user, j)) {
                broadlyEligible.push(j);
            }
        }

        // If user has complete profile, return strict matches only (even if 0).
        // Fallback to broadly eligible ONLY for incomplete profiles.
        let finalResult = hasCompleteProfile ? allEligible : broadlyEligible.slice(0, 100);

        // Debug logging for troubleshooting eligibility
        console.log('[Eligible Debug]', JSON.stringify({
            userId: user.id,
            qualification_type: user.qualification_type,
            qualification_status: user.qualification_status,
            expected_graduation_year: user.expected_graduation_year,
            age: user.age,
            state: user.state,
            hasCompleteProfile,
            totalJobsFetched: jobs.length,
            strictEligible: allEligible.length,
            broadlyEligible: broadlyEligible.length,
            finalCount: finalResult.length,
            currentYear: getTodayIST().substring(0, 4),
        }));

        res.set('Cache-Control', 'no-store, max-age=0');
        return res.json(finalResult);
    } catch (err) {
        console.error('GET /api/jobs/eligible error:', err);
        return res.status(500).json({ error: 'Failed to fetch eligible jobs', details: err.message });
    }
});

// GET /api/jobs/partial
router.get('/partial', auth, async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0] || req.user;
        if (!user) return res.status(404).json({ error: 'User not found' });

        const hasCompleteProfile = !!(user.qualification_type && user.age && user.age > 0);

        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, last_verified_at, created_at';
        const { whereStr, args } = buildFilters(req, null);

        const query = `SELECT ${selectFields} FROM jobs ${whereStr} ORDER BY application_start_date ASC LIMIT 500`;
        const allRows = (await db.execute({ sql: query, args })).rows || [];

        const jobs = allRows.map(row => withStatus(row, todayStr));

        let allPartial = [];
        let fallbackJobs = [];

        for (const j of jobs) {
            if (!isJobVerified(j)) continue; // Strictly filter out unverified/placeholder exams

            if (hasCompleteProfile) {
                // Partial means they meet qualification OR age, but NOT both.
                const isPartial = (meetsQualification(user, j) || meetsAge(user, j)) && !(meetsQualification(user, j) && meetsAge(user, j)) && meetsTechnicalCriteria(user, j) && meetsStateCriteria(user, j);
                if (isPartial) allPartial.push(j);
            }
            // Fallback only for incomplete profiles
            if (!hasCompleteProfile && j.form_status === 'UPCOMING' && meetsTechnicalCriteria(user, j) && meetsStateCriteria(user, j)) {
                fallbackJobs.push(j);
            }
        }

        // Strict matches for complete profiles; fallback only for incomplete ones
        let finalResult = hasCompleteProfile ? allPartial : fallbackJobs.slice(0, 50);

        res.set('Cache-Control', 'no-store, max-age=0');
        return res.json(finalResult);
    } catch (err) {
        console.error('GET /api/jobs/partial error:', err);
        return res.status(500).json({ error: 'Failed to fetch partial jobs', details: err.message });
    }
});

// GET /api/jobs/liked
router.get('/liked', auth, async (req, res) => {
    try {
        const sb = getSupabase();
        const todayStr = getTodayIST();
        const { data: likedRows, error } = await sb.from('liked_jobs')
            .select('job_id')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!likedRows || likedRows.length === 0) {
            return res.json([]);
        }
        
        const jobIds = likedRows.map(r => r.job_id);
        
        const { data: jobs, error: jobsError } = await sb.from('jobs')
            .select('*')
            .in('id', jobIds);
            
        if (jobsError) throw jobsError;
        
        const jobMap = new Map();
        for (const j of (jobs || [])) {
            jobMap.set(j.id, j);
        }
        
        const orderedJobs = [];
        for (const id of jobIds) {
            const j = jobMap.get(id);
            if (j) orderedJobs.push(withStatus(j, todayStr));
        }
        
        return res.json(orderedJobs);
    } catch (err) {
        console.error('GET /api/jobs/liked error:', err);
        return res.status(500).json({ error: 'Failed to fetch liked jobs', details: err.message });
    }
});

// GET /api/jobs/live
router.get('/live', async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();

        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, last_verified_at, created_at';
        const { whereStr, args } = buildFilters(req, 'LIVE');

        const query = `SELECT ${selectFields} FROM jobs ${whereStr} ORDER BY application_end_date ASC LIMIT 500`;
        const result = await db.execute({ sql: query, args });
        const jobs = (result.rows || []).map(row => withStatus(row, todayStr));

        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(jobs);
    } catch (err) {
        console.error('GET /api/jobs/live error:', err);
        return res.status(500).json({ error: 'Failed to fetch live jobs', details: err.message });
    }
});

// GET /api/jobs/upcoming
router.get('/upcoming', async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();

        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, last_verified_at, created_at';
        const { whereStr, args } = buildFilters(req, 'UPCOMING');

        const query = `SELECT ${selectFields} FROM jobs ${whereStr} ORDER BY application_start_date ASC LIMIT 500`;
        const result = await db.execute({ sql: query, args });
        const jobs = (result.rows || []).map(row => withStatus(row, todayStr));

        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(jobs);
    } catch (err) {
        console.error('GET /api/jobs/upcoming error:', err);
        return res.status(500).json({ error: 'Failed to fetch upcoming jobs', details: err.message });
    }
});

// GET /api/jobs/recommendations - now handled by /api/ai/recommendations
router.get('/recommendations', auth, async (req, res) => {
    try {
        const sb = getSupabase();
        const todayStr = getTodayIST();
        const { data: popular } = await sb.from('jobs')
            .select('id, job_name, organization, job_category, form_status, application_start_date, application_end_date, salary_min, salary_max, qualification_required, official_application_link, state, states, vacancies')
            .in('form_status', ['LIVE', 'UPCOMING'])
            .order('application_end_date', { ascending: false })
            .limit(30);
        return res.json((popular || []).map(j => withStatus(j, todayStr)));
    } catch (err) {
        console.error('GET /api/jobs/recommendations error:', err);
        return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        const job = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [req.params.id] })).rows[0];
        if (!job) return res.status(404).json({ error: 'Job not found' });
        return res.json(withStatus(job, todayStr));
    } catch (err) {
        console.error('GET /api/jobs/:id error:', err);
        return res.status(500).json({ error: 'Failed to fetch job', details: err.message });
    }
});

// POST /api/jobs/:id/like
router.post('/:id/like', auth, async (req, res) => {
    try {
        const sb = getSupabase();
        const jobId = req.params.id;
        const userId = req.user.id;

        // Check job exists
        const { data: jobData } = await sb.from('jobs').select('id').eq('id', jobId).limit(1);
        if (!jobData || jobData.length === 0) return res.status(404).json({ error: 'Job not found' });

        // Upsert into liked_jobs (separating Liking/Tracking from Applied)
        const id = 'like_' + Math.random().toString(36).substring(2, 9);
        const { error } = await sb.from('liked_jobs')
            .upsert({ id: id, user_id: userId, job_id: jobId }, { onConflict: 'user_id,job_id', ignoreDuplicates: true });
        if (error && error.code !== '23505') throw error;

        // Invalidate recommendation cache in DB
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco:${userId}:%`);
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco_full:${userId}:%`);

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            await invalidateRecommendationsCache(userId);
        } catch (e) {
            console.error('Failed to invalidate recommendations memory cache:', e);
        }

        return res.json({ liked: true });
    } catch (err) {
        console.error('Like error (mapped to Saved):', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/jobs/:id/like
router.delete('/:id/like', auth, async (req, res) => {
    try {
        const sb = getSupabase();
        const userId = req.user.id;
        await sb.from('liked_jobs').delete().eq('user_id', userId).eq('job_id', req.params.id);

        // Invalidate recommendation cache in DB
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco:${userId}:%`);
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco_full:${userId}:%`);

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            await invalidateRecommendationsCache(userId);
        } catch (e) {
            console.error('Failed to invalidate recommendations memory cache:', e);
        }

        return res.json({ liked: false });
    } catch (err) {
        console.error('Unlike error (mapped to Saved):', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/jobs/:id/liked-status
router.get('/:id/liked-status', auth, async (req, res) => {
    try {
        const sb = getSupabase();
        const { data } = await sb.from('liked_jobs').select('id').eq('user_id', req.user.id).eq('job_id', req.params.id).limit(1);
        return res.json({ liked: (data || []).length > 0 });
    } catch (err) {
        console.error('Liked-status error (mapped to Saved):', err.message);
        return res.json({ liked: false });
    }
});

// POST /api/jobs/admin — add a job
router.post('/admin', auth, async (req, res) => {
    try {
        if (req.user.email !== 'aayushverma246@gmail.com') {
            return res.status(403).json({ error: 'Forbidden: Admin access only' });
        }

        const {
            id, job_name, organization, qualification_required, allows_final_year_students,
            minimum_age, maximum_age, application_start_date, application_end_date,
            salary_min, salary_max, job_category, official_application_link,
        } = req.body;

        if (!job_name || !organization) {
            return res.status(400).json({ error: 'job_name and organization are required' });
        }

        const db = getDb();
        const jobId = id || generateId();

        const tempJob = {
            id: jobId,
            job_name,
            organization,
            qualification_required: qualification_required || 'Graduation',
            allows_final_year_students: allows_final_year_students ? 1 : 0,
            minimum_age: minimum_age || 18,
            maximum_age: maximum_age || 30,
            application_start_date,
            application_end_date,
            salary_min: salary_min || 0,
            salary_max: salary_max || 0,
            job_category: job_category || 'SSC',
            official_application_link: official_application_link || '',
            state: req.body.state || 'All India',
            states: req.body.states || []
        };

        const audit = validateJob(tempJob);
        if (!audit.valid) {
            return res.status(400).json({ error: `Validation failed: ${audit.errors.join('; ')}` });
        }

        // Search for placeholder values
        const exactPlaceholders = [
            'placeholder', 'dummy', 'lorem', 'lorem ipsum', 'mock', 'test', 
            'sample', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'na', 'null'
        ];
        const strictFields = ['job_name', 'organization', 'official_application_link'];
        const strictPatterns = [
            /\bplaceholder\b/i,
            /\blorem\b/i,
            /\bdummy\b/i,
            /\bmock\b/i,
            /test-(?:job|org|user|exam)/i,
            /^test$/i,
            /^sample$/i
        ];

        for (const [key, value] of Object.entries(tempJob)) {
            if (typeof value === 'string' && key !== 'id') {
                const clean = value.trim().toLowerCase();
                if (exactPlaceholders.includes(clean)) {
                    return res.status(400).json({ error: `Forbidden: Field '${key}' contains exact placeholder text: "${value}"` });
                }
                if (strictFields.includes(key)) {
                    for (const re of strictPatterns) {
                        if (re.test(clean)) {
                            return res.status(400).json({ error: `Forbidden: Strict field '${key}' contains placeholder match: "${value}"` });
                        }
                    }
                }
            }
        }
        await db.execute({
            sql: `INSERT INTO jobs (
                id, job_name, organization, qualification_required, allows_final_year_students,
                minimum_age, maximum_age, application_start_date, application_end_date,
                salary_min, salary_max, job_category, official_application_link, state, states
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                job_name = EXCLUDED.job_name, organization = EXCLUDED.organization,
                qualification_required = EXCLUDED.qualification_required,
                allows_final_year_students = EXCLUDED.allows_final_year_students,
                minimum_age = EXCLUDED.minimum_age, maximum_age = EXCLUDED.maximum_age,
                application_start_date = EXCLUDED.application_start_date,
                application_end_date = EXCLUDED.application_end_date,
                salary_min = EXCLUDED.salary_min, salary_max = EXCLUDED.salary_max,
                job_category = EXCLUDED.job_category, official_application_link = EXCLUDED.official_application_link,
                state = EXCLUDED.state, states = EXCLUDED.states`,
            args: [
                jobId, job_name, organization, qualification_required || 'Graduation',
                allows_final_year_students ? 1 : 0,
                minimum_age || 18, maximum_age || 30,
                application_start_date, application_end_date,
                salary_min || 0, salary_max || 0,
                job_category || 'SSC', official_application_link || '',
                req.body.state || 'All India',
                JSON.stringify(req.body.states || [])
            ]
        });

        const job = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [jobId] })).rows[0];
        return res.status(201).json(withStatus(job, getTodayIST()));
    } catch (err) {
        console.error('Add job error:', err);
        return res.status(500).json({ error: 'Server error adding job' });
    }
});

module.exports = router;
