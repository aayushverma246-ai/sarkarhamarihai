const express = require('express');
const router = express.Router();
const { getDb, ensureVercelUser, getSupabase } = require('../db');
const auth = require('../middleware/auth');
const { CANONICAL_CATEGORIES, CANONICAL_STATES, normalizeCategory, normalizeState, validateJob } = require('../constants');

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

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Compute form_status from dates (using IST to avoid timezone flickering)
// Pre-compute today's date string once for all jobs
const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;

    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';

    // Simple day difference calculation
    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    const diffDays = todayDays - endDays;

    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

// ── State name patterns for inferring state from job name ──
const _STATE_NAME_PATTERNS = CANONICAL_STATES.map(s => ({
    name: s,
    re: new RegExp('\\b' + s.replace(/[&]/g, '\\&').replace(/\s+/g, '\\s+') + '\\b', 'i')
}));
// Add common abbreviations
const _STATE_ABBR_MAP = {
    'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam',
    'BR': 'Bihar', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'GJ': 'Gujarat',
    'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JH': 'Jharkhand',
    'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh',
    'MH': 'Maharashtra', 'MN': 'Manipur', 'ML': 'Meghalaya',
    'MZ': 'Mizoram', 'NL': 'Nagaland', 'OD': 'Odisha', 'PB': 'Punjab',
    'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu',
    'TS': 'Telangana', 'TR': 'Tripura', 'UP': 'Uttar Pradesh',
    'UK': 'Uttarakhand', 'WB': 'West Bengal', 'DL': 'Delhi',
    'J&K': 'Jammu & Kashmir', 'JK': 'Jammu & Kashmir',
};

// State PSC organization patterns — these are always State PSCs, never UPSC
const _STATE_PSC_ORG_RE = /\b(?:APPSC|APSC|BPSC|CGPSC|DSSSB|GPSC|HPSC|HPPSC|JPSC|KPSC|MPPSC|MPSC|NPSC|OPSC|PPSC|RPSC|SPSC|TNPSC|TSPSC|TPSC|UPPSC|UKPSC|WBPSC|JKPSC)\b/i;
const _STATE_PSC_ORG_LONG_RE = /\bstate\s+public\s+service|public\s+service\s+commission\b/i;
const _STATE_CIVIL_SERVICES_RE = /\bstate\s+civil\s+services?\b|\bstate\s+services?\b/i;

/**
 * Infer state from job name. Returns canonical state name or null.
 */
function inferStateFromName(jobName, org) {
    const combined = ((jobName || '') + ' ' + (org || '')).toLowerCase();
    for (const { name, re } of _STATE_NAME_PATTERNS) {
        const lowerName = name.toLowerCase();
        if (combined.includes(lowerName)) {
            if (re.test(combined)) return name;
        }
    }
    return null;
}

function withStatus(job, todayStr) {
    const isVerified = Boolean(job.job_name && job.organization && job.official_application_link?.length > 5);
    const lastUpdated = job.created_at || todayStr;

    let parsedStates = [];
    if (job.states && job.states !== '[]') {
        try {
            parsedStates = JSON.parse(job.states);
        } catch (_) { }
    }

    const name = (job.job_name || '').toLowerCase();
    const org = (job.organization || '');

    // ── On-the-fly normalization so filters ALWAYS match canonical values ──
    let normalizedCategory = job.job_category;
    if (normalizedCategory) {
        const canonical = normalizeCategory(normalizedCategory);
        if (canonical) normalizedCategory = canonical;

        // ── FIX: Reclassify UPSC-tagged state PSC exams ──
        // State Civil Services exams (e.g. "Bihar State Civil Services 2026" by BPSC)
        // were erroneously seeded as UPSC. Detect and fix them.
        if (normalizedCategory === 'UPSC') {
            const isStatePSCOrg = _STATE_PSC_ORG_RE.test(org) && !/\bUPSC\b|Union Public Service Commission/i.test(org);
            const isStateCivilServices = _STATE_CIVIL_SERVICES_RE.test(name);
            const hasStatePSCOrgLong = _STATE_PSC_ORG_LONG_RE.test(org) && !/\bUnion\b/i.test(org);

            if (isStateCivilServices || (isStatePSCOrg && !name.startsWith('upsc ')) || hasStatePSCOrgLong) {
                normalizedCategory = 'State PSCs';
            }
        }

        // Smart re-categorization based on job name for state exams
        // that were blanket-tagged as 'State Government' or 'State PSCs'
        if (normalizedCategory === 'State Government' || normalizedCategory === 'State PSCs') {
            if (/\bpsc\b|\bcivil services\b|\bstate services\b/.test(name)) {
                normalizedCategory = 'State PSCs';
            } else if (/\bpolice\b|\bconstable\b|\bsub inspector\b|\b(?:si)\b|\bhead constable\b|\bjail\b|\bprison\b|\bfire\s*(?:service|man)\b|\btraffic police\b|\barmed police\b|\bcyber\s*(?:crime|police)\b|\bhome guard\b|\bexcise\b/.test(name)) {
                normalizedCategory = 'Police';
            } else if (/\btet\b|\bteacher\b|\btgt\b|\bpgt\b|\bprimary teacher\b|\bschool\b|\beducation\b|\blab assistant\b/.test(name)) {
                normalizedCategory = 'Teaching';
            } else if (/\bforest\b|\bvan rakshak\b|\bwildlife\b|\bpollution\b/.test(name)) {
                normalizedCategory = 'Forest & Environment';
            } else if (/\bnhm\b|\bnursing\b|\bstaff nurse\b|\bcho\b|\banm\b|\bgnm\b|\bpharmacist\b|\bmedical officer\b|\bsurgeon\b|\bhospital\b|\bhealth\b/.test(name)) {
                normalizedCategory = 'Healthcare';
            } else if (/\bcourt\b|\bjudge\b|\bjudicial\b|\bsteno.*court\b|\bpeon.*court\b|\bbailiff\b/.test(name)) {
                normalizedCategory = 'Judiciary';
            } else if (/\belectricity\b|\bengineer\b|\bje\b|\bjunior engineer\b|\bwater board\b/.test(name)) {
                normalizedCategory = 'Engineering';
            } else if (/\bcooperative\b|\bbank clerk\b/.test(name)) {
                normalizedCategory = 'Cooperative';
            } else if (/\bagriculture\b|\bhorticulture\b|\bdairy\b|\bfisheries\b|\banimal husbandry\b|\bsericulture\b/.test(name)) {
                normalizedCategory = 'Agriculture';
            } else if (/\btransport\b|\bdriver\b|\bconductor\b|\brto\b|\bmotor vehicle\b|\broadways\b/.test(name)) {
                normalizedCategory = 'State Government';
            }
            // else keep as State Government for generic state exams
        }
    }

    let normalizedState = job.state;
    if (normalizedState) {
        const canonical = normalizeState(normalizedState);
        if (canonical) normalizedState = canonical;
    }

    // ── FIX: Infer correct state for state-specific jobs tagged "All India" ──
    // Jobs like "Andhra Pradesh - Gram Panchayat Data Entry Operator 2026" with
    // org "Andhra Pradesh State Government" should NOT be state: "All India".
    if (normalizedState === 'All India') {
        // Check if the org clearly names a state (e.g. "Andhra Pradesh State Government")
        const inferredFromOrg = inferStateFromName('', org);
        const inferredFromName = inferStateFromName(job.job_name, '');

        // Only override if the job is clearly state-specific (org contains a state name
        // AND it's a state government/PSC org, not a national org with a state chapter)
        if (inferredFromOrg && /state government|psc|state\s/i.test(org)) {
            normalizedState = inferredFromOrg;
        } else if (inferredFromName && normalizedCategory === 'State PSCs') {
            // State PSC exams always belong to a specific state
            normalizedState = inferredFromName;
        }
    }

    // Normalize states array entries too
    const normalizedStatesArr = parsedStates.map(s => {
        const c = normalizeState(s);
        return c || s;
    });

    return {
        ...job,
        job_category: normalizedCategory || job.job_category,
        state: normalizedState || job.state,
        states: normalizedStatesArr,
        form_status: computeFormStatus(job, todayStr),
        allows_final_year_students: !!job.allows_final_year_students,
        is_verified: isVerified,
        last_updated: lastUpdated
    };
}

function getQualificationLevel(qualStr) {
    if (!qualStr) return 0;
    const normalized = qualStr.toLowerCase();
    if (normalized.includes('phd') || normalized.includes('doctorate')) return 5;
    if (normalized.includes('post grad') || normalized.includes('postgrad') || normalized.includes('master') || normalized.includes('m.tech') || normalized.includes('m.sc') || normalized.includes('mba') || normalized.includes('m.com') || normalized.includes('m.ca')) return 4;
    if (normalized.includes('graduat') || normalized.includes('degree') || normalized.includes('b.tech') || normalized.includes('b.e.') || normalized.includes('b.sc') || normalized.includes('b.com') || normalized.includes('b.a') || normalized.includes('bachelor')) return 3;
    if (normalized.includes('diploma')) return 2.5;
    if (normalized.includes('12th') || normalized.includes('class 12') || normalized.includes('hsc') || normalized.includes('intermediate') || normalized.includes('senior secondary')) return 2;
    if (normalized.includes('10th') || normalized.includes('class 10') || normalized.includes('ssc') || normalized.includes('matric') || normalized.includes('high school')) return 1;
    return 0;
}

function meetsQualification(user, job) {
    if (!user.qualification_type) return false;
    const userLevel = getQualificationLevel(user.qualification_type);
    const jobLevel = getQualificationLevel(job.qualification_required);
    if (userLevel === 0 || jobLevel === 0) return false;

    if (user.qualification_status === 'Completed') {
        // Completed users are eligible for jobs at or below their qualification level
        return userLevel >= jobLevel;
    }

    if (user.qualification_status === 'Pursuing') {
        // Pursuing users have COMPLETED the level below, so they match lower-level jobs
        if (userLevel > jobLevel) return true;

        // For same-level jobs, only eligible if job allows final year AND user is in final year
        if (userLevel === jobLevel && job.allows_final_year_students) {
            const currentYearStr = getTodayIST().substring(0, 4);
            const currentYear = parseInt(currentYearStr);
            const expectedGradYear = parseInt(user.expected_graduation_year);
            if (expectedGradYear > 0 && expectedGradYear === currentYear) {
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

function meetsTechnicalCriteria(job) {
    const textToSearch = (job.job_name + ' ' + job.organization);
    const isHighlyTechnical = /(?:junior engineer|assistant engineer|ae\/je|\bAE\b|\bJE\b|b\.tech|\bbtech\b|m\.tech|\bmtech\b|diploma in|\bITI\b|nursing|medical officer|\bMBBS\b)/i.test(textToSearch);
    return !isHighlyTechnical;
}

function meetsAge(user, job) {
    if (!user.age || user.age === 0) return false;
    return Number(user.age) >= Number(job.minimum_age) && Number(user.age) <= Number(job.maximum_age);
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

        // Columns definition to compress JSON payload (drops from 11.3MB to ~2.5MB)
        const columns = ['id', 'job_name', 'organization', 'qualification_required', 'allows_final_year_students', 'minimum_age', 'maximum_age', 'job_category', 'state', 'states', 'application_start_date', 'application_end_date', 'vacancies', 'official_application_link', 'last_verified_at', 'created_at', 'form_status', 'is_verified', 'last_updated'];

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
            if (hasCompleteProfile) {
                if (meetsQualification(user, j) && meetsAge(user, j) && meetsTechnicalCriteria(j) && meetsStateCriteria(user, j)) {
                    allEligible.push(j);
                }
            }
            // Broad fallback only used for incomplete profiles
            if (!hasCompleteProfile && (j.form_status === 'LIVE' || j.form_status === 'UPCOMING') && meetsTechnicalCriteria(j) && meetsStateCriteria(user, j)) {
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
            if (hasCompleteProfile) {
                // Partial means they meet qualification OR age, but NOT both.
                const isPartial = (meetsQualification(user, j) || meetsAge(user, j)) && !(meetsQualification(user, j) && meetsAge(user, j)) && meetsTechnicalCriteria(j) && meetsStateCriteria(user, j);
                if (isPartial) allPartial.push(j);
            }
            // Fallback only for incomplete profiles
            if (!hasCompleteProfile && j.form_status === 'UPCOMING' && meetsTechnicalCriteria(j) && meetsStateCriteria(user, j)) {
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
        const { getDb } = require('../db');
        const db = getDb();
        const todayStr = getTodayIST();
        const result = await db.execute({
            sql: `SELECT j.* FROM liked_jobs l JOIN jobs j ON l.job_id = j.id WHERE l.user_id = ? ORDER BY l.created_at DESC`,
            args: [req.user.id]
        });
        const jobs = result.rows || [];
        return res.json(jobs.map(job => withStatus(job, todayStr)));
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

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            invalidateRecommendationsCache(userId);
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

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            invalidateRecommendationsCache(userId);
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
