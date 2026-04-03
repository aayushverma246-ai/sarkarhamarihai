const express = require('express');
const router = express.Router();
const { getDb, ensureVercelUser } = require('../db');
const auth = require('../middleware/auth');

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

function withStatus(job, todayStr) {
    const isVerified = Boolean(job.job_name && job.organization && job.official_application_link?.length > 5);
    const lastUpdated = job.created_at || todayStr;

    let parsedStates = [];
    if (job.states && job.states !== '[]') {
        try {
            parsedStates = JSON.parse(job.states);
        } catch (_) {}
    }

    return { 
        ...job, 
        states: parsedStates,
        form_status: computeFormStatus(job, todayStr), 
        allows_final_year_students: !!job.allows_final_year_students,
        is_verified: isVerified,
        last_updated: lastUpdated
    };
}

const qualificationOrder = { 'Class 10': 1, 'Class 12': 2, 'Graduation': 3, 'Post Graduation': 4, 'PhD': 5 };

function meetsQualification(user, job) {
    if (!user.qualification_type) return false;
    const userLevel = qualificationOrder[user.qualification_type] || 0;
    const jobLevel = qualificationOrder[job.qualification_required] || 0;
    if (userLevel === 0) return false;
    if (user.qualification_status === 'Completed') return userLevel >= jobLevel;
    if (user.qualification_status === 'Pursuing') {
        if (userLevel > jobLevel) return true;
        if (userLevel === jobLevel && job.allows_final_year_students) return true;
    }
    return false;
}

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// Escape regex special chars in state names to handle them safely
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function meetsStateCriteria(user, job) {
    const textToSearch = (job.job_name + ' ' + job.organization);
    const userState = (user.state || '').toLowerCase();

    // Detect all Indian states mentioned in the job title/org
    const mentionedStates = indianStates.filter(state => {
        const regex = new RegExp(`(?:^|\\s|,)${escapeRegex(state)}(?:\\s|,|$)`, 'i');
        return regex.test(textToSearch);
    });

    // If no specific state is mentioned, it's a central/all-India job — open to everyone.
    if (mentionedStates.length === 0) return true;

    // If a state IS mentioned (e.g., "Assam PWD"), user MUST be from that state.
    if (userState && mentionedStates.some(state => state.toLowerCase() === userState)) {
        return true;
    }
    return false;
}

function meetsTechnicalCriteria(job) {
    const textToSearch = (job.job_name + ' ' + job.organization);
    // Exclude highly specific technical roles that require non-general degrees.
    // Uses strict word boundaries to avoid false positives (e.g., 'career' containing 'ae').
    const isHighlyTechnical = /(?:junior engineer|assistant engineer|ae\/je|\bAE\b|\bJE\b|b\.tech|\bbtech\b|m\.tech|\bmtech\b|diploma in|\bITI\b|nursing|medical officer|\bMBBS\b)/i.test(textToSearch);
    return !isHighlyTechnical;
}

function meetsAge(user, job) {
    if (!user.age || user.age === 0) return false;
    return Number(user.age) >= Number(job.minimum_age) && Number(user.age) <= Number(job.maximum_age);
}

// GET /api/jobs/all-minimal
// Extremely lightweight endpoint returning ALL jobs instantly (no heavy columns) for client-side search/filtering.
router.get('/all-minimal', async (req, res) => {
    try {
        const todayStr = getTodayIST();
        const cacheKey = `all-minimal:${todayStr}`;

        // ── Server-side cache check (90s TTL) ───────────────────────────────────
        const cachedJobs = getCachedResult(cacheKey, 90000);
        if (cachedJobs) {
            res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            res.set('X-Cache', 'HIT');
            return res.json({ jobs: cachedJobs });
        }

        const db = getDb();
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, job_category, state, states, application_start_date, application_end_date, vacancies, official_application_link';
        
        // Use a fixed safe page count to avoid a costly COUNT(*) pre-query.
        // Extra empty pages cost <1ms each. 25 pages × 1000 = 25,000 max rows.
        const SAFE_MAX_PAGES = 25;
        const limit = 1000;
        const fetchPromises = [];
        for (let i = 0; i < SAFE_MAX_PAGES; i++) {
            fetchPromises.push(
                // CRITICAL: secondary sort key 'id' prevents unstable pagination.
                // Without it, rows with identical application_end_date can appear
                // on multiple pages (or be skipped) causing the ~450 row gap.
                db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date DESC, id LIMIT ${limit} OFFSET ${i * limit}`)
                  .then(r => r.rows || [])
                  .catch(() => [])
            );
        }
        
        const results = await Promise.all(fetchPromises);
        const allRows = results.flat().filter((_, idx, arr) => {
            // Deduplicate in case of overlap and filter trailing empty pages
            return true;
        });

        // Remove duplicate IDs (safety net)
        const seen = new Set();
        const unique = [];
        for (const row of allRows) {
            if (row.id && !seen.has(row.id)) { seen.add(row.id); unique.push(row); }
        }
        
        // Compute form_status natively
        const jobs = unique.map(j => withStatus(j, todayStr));
        
        // Cache for 90 seconds
        setCachedResult(cacheKey, jobs);
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.set('X-Cache', 'MISS');
        res.json({ jobs });
    } catch(err) {
        console.error('Failed fetching all-minimal jobs:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// GET /api/jobs
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const { status, full, limit: limitParam, offset: offsetParam } = req.query;
        const todayStr = getTodayIST();
        
        // Default pagination: return first 500 jobs
        const limit = Math.min(parseInt(limitParam) || 500, 1000);
        const offset = parseInt(offsetParam) || 0;
        
        // Select only essential fields for list view
        const selectFields = full === 'true' 
            ? '*' 
            : 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
        
        // Build query - always paginate to avoid timeout
        const baseQuery = `SELECT ${selectFields} FROM jobs ORDER BY application_end_date DESC`;
        
        // Get total count
        const countResult = await db.execute('SELECT COUNT(*) as total FROM jobs');
        const total = Number(countResult.rows[0]?.total || 0);
        
        // Get paginated results
        const result = await db.execute(`${baseQuery} LIMIT ${limit} OFFSET ${offset}`);
        const jobs = result.rows.map(job => withStatus(job, todayStr));
        
        // Apply status filter if requested (after fetching)
        let filteredJobs = jobs;
        if (status) {
            const s = status.toUpperCase();
            if (s === 'CLOSED') {
                filteredJobs = jobs.filter(j => j.form_status === 'CLOSED' || j.form_status === 'RECENTLY_CLOSED');
            } else {
                filteredJobs = jobs.filter(j => j.form_status === s);
            }
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json({
            jobs: filteredJobs,
            total,
            limit,
            offset,
            hasMore: offset + limit < total
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
        
        // Check if user has a complete profile for strict filtering
        const hasCompleteProfile = !!(user.qualification_type && user.age && user.age > 0);
        
        // Fetch all jobs in parallel batches to avoid timeout
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
        
        const countRes = await db.execute('SELECT COUNT(*) as count FROM jobs');
        const total = Number(countRes.rows[0]?.count || countRes.rows[0]?.total || 18000);
        
        const limit = 1000;
        const totalPages = Math.ceil(total / limit);
        const fetchPromises = [];
        for (let i = 0; i < totalPages; i++) {
            fetchPromises.push(
                db.execute(`SELECT ${selectFields} FROM jobs LIMIT ${limit} OFFSET ${i * limit}`)
                  .then(r => r.rows || [])
                  .catch(() => [])
            );
        }
        
        const results = await Promise.all(fetchPromises);
        const allRows = results.flat();
        
        const jobs = allRows.map(row => withStatus(row, todayStr));
        
        const fallbackJobs = []; // Store fallback jobs if strict filtering returns 0
        const allEligible = [];
        
        if (hasCompleteProfile) {
            // Strict filtering for users with complete profile
            const eligible = jobs.filter(j =>
                meetsQualification(user, j) &&
                meetsAge(user, j) &&
                meetsStateCriteria(user, j) &&
                meetsTechnicalCriteria(j)
            );
            allEligible.push(...eligible);
        }
        
        // Build fallback: broadly eligible (LIVE or UPCOMING, non-technical)
        const broadlyEligible = jobs.filter(j =>
            (j.form_status === 'LIVE' || j.form_status === 'UPCOMING') &&
            meetsTechnicalCriteria(j) &&
            meetsStateCriteria(user, j)
        );
        fallbackJobs.push(...broadlyEligible);
        
        // FALLBACK SYSTEM: If strict filtering returns 0, use broadly eligible exams
        let finalResult = allEligible;
        if (finalResult.length === 0) {
            console.log(`[eligible] No strictly eligible jobs for user ${req.user.id}, using fallback (${fallbackJobs.length} jobs)`);
            // Sort fallback by application_end_date DESC (most urgent first)
            finalResult = fallbackJobs.sort((a, b) => {
                const dateA = new Date(a.application_end_date);
                const dateB = new Date(b.application_end_date);
                return dateB - dateA;
            }).slice(0, 100); // Limit to 100 for performance
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
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
        
        // Check if user has a complete profile for strict filtering
        const hasCompleteProfile = !!(user.qualification_type && user.age && user.age > 0);
        
        // Fetch all jobs in parallel batches to avoid timeout
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
        
        const countRes = await db.execute('SELECT COUNT(*) as count FROM jobs');
        const total = Number(countRes.rows[0]?.count || countRes.rows[0]?.total || 18000);
        
        const limit = 1000;
        const totalPages = Math.ceil(total / limit);
        const fetchPromises = [];
        for (let i = 0; i < totalPages; i++) {
            fetchPromises.push(
                db.execute(`SELECT ${selectFields} FROM jobs LIMIT ${limit} OFFSET ${i * limit}`)
                  .then(r => r.rows || [])
                  .catch(() => [])
            );
        }
        
        const results = await Promise.all(fetchPromises);
        const allRows = results.flat();
        
        const jobs = allRows.map(row => withStatus(row, todayStr));
        
        const allPartial = [];
        const fallbackJobs = [];
        
        if (hasCompleteProfile) {
            // Original logic: partial match (meets SOME but not ALL criteria)
            const partial = jobs.filter(j =>
                (meetsQualification(user, j) || meetsAge(user, j)) &&
                !(meetsQualification(user, j) && meetsAge(user, j)) &&
                meetsStateCriteria(user, j) &&
                meetsTechnicalCriteria(j)
            );
            allPartial.push(...partial);
        }
        
        // Build fallback: upcoming exams (closing soon)
        const upcoming = jobs.filter(j =>
            j.form_status === 'UPCOMING' &&
            meetsTechnicalCriteria(j)
        );
        fallbackJobs.push(...upcoming);
        
        // FALLBACK SYSTEM: If partial filtering returns 0, use upcoming exams
        let finalResult = allPartial;
        if (finalResult.length === 0) {
            console.log(`[partial] No partial match jobs for user ${req.user.id}, using fallback (${fallbackJobs.length} jobs)`);
            // Sort fallback by application_start_date ASC (soonest first)
            finalResult = fallbackJobs.sort((a, b) => {
                const dateA = new Date(a.application_start_date);
                const dateB = new Date(b.application_start_date);
                return dateA - dateB;
            }).slice(0, 50); // Limit to 50 for performance
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(finalResult);
    } catch (err) {
        console.error('GET /api/jobs/partial error:', err);
        return res.status(500).json({ error: 'Failed to fetch partial jobs', details: err.message });
    }
});

// GET /api/jobs/liked
router.get('/liked', auth, async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        const likedRows = (await db.execute({ sql: 'SELECT job_id FROM liked_jobs WHERE user_id = ? ORDER BY created_at DESC', args: [req.user.id] })).rows;
        if (!likedRows.length) return res.json([]);
        const ids = likedRows.map(r => r.job_id);
        const placeholders = ids.map(() => '?').join(',');
        const jobs = (await db.execute({ sql: `SELECT * FROM jobs WHERE id IN (${placeholders})`, args: ids })).rows;
        return res.json(jobs.map(job => withStatus(job, todayStr)));
    } catch (err) {
        console.error('GET /api/jobs/liked error:', err);
        return res.status(500).json({ error: 'Failed to fetch liked jobs', details: err.message });
    }
});

// GET /api/jobs/live - Get all live (currently accepting applications) exams
router.get('/live', async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        
        // Fetch all jobs through parallel batching
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
        
        const countRes = await db.execute('SELECT COUNT(*) as count FROM jobs');
        const total = Number(countRes.rows[0]?.count || countRes.rows[0]?.total || 18000);
        
        const limit = 1000;
        const totalPages = Math.ceil(total / limit);
        const fetchPromises = [];
        for (let i = 0; i < totalPages; i++) {
            fetchPromises.push(
                db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date ASC LIMIT ${limit} OFFSET ${i * limit}`)
                  .then(r => r.rows || [])
                  .catch(() => [])
            );
        }
        
        const results = await Promise.all(fetchPromises);
        const allRows = results.flat();
        
        const jobs = allRows.map(job => withStatus(job, todayStr));
        const liveJobs = jobs.filter(j => j.form_status === 'LIVE');
        
        // FALLBACK: If no live jobs, return recently closed exams
        if (liveJobs.length === 0) {
            console.log('[live] No live jobs found, returning recently closed as fallback');
            const fallback = jobs.filter(j => j.form_status === 'RECENTLY_CLOSED')
                .sort((a, b) => new Date(b.application_end_date) - new Date(a.application_end_date))
                .slice(0, 20);
            res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            return res.json(fallback);
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(liveJobs);
    } catch (err) {
        console.error('GET /api/jobs/live error:', err);
        return res.status(500).json({ error: 'Failed to fetch live jobs', details: err.message });
    }
});

// GET /api/jobs/upcoming - Get all upcoming exams
router.get('/upcoming', async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
        
        const countRes = await db.execute('SELECT COUNT(*) as count FROM jobs');
        const total = Number(countRes.rows[0]?.count || countRes.rows[0]?.total || 18000);
        
        const limit = 1000;
        const totalPages = Math.ceil(total / limit);
        const fetchPromises = [];
        for (let i = 0; i < totalPages; i++) {
            fetchPromises.push(
                db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_start_date ASC LIMIT ${limit} OFFSET ${i * limit}`)
                  .then(r => r.rows || [])
                  .catch(() => [])
            );
        }
        
        const results = await Promise.all(fetchPromises);
        const allRows = results.flat();
        
        const jobs = allRows.map(job => withStatus(job, todayStr));
        const upcomingJobs = jobs.filter(j => j.form_status === 'UPCOMING');
        
        // FALLBACK: If no upcoming jobs, return live exams
        if (upcomingJobs.length === 0) {
            console.log('[upcoming] No upcoming jobs found, returning live as fallback');
            const fallback = jobs.filter(j => j.form_status === 'LIVE')
                .sort((a, b) => new Date(a.application_end_date) - new Date(b.application_end_date))
                .slice(0, 20);
            res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            return res.json(fallback);
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(upcomingJobs);
    } catch (err) {
        console.error('GET /api/jobs/upcoming error:', err);
        return res.status(500).json({ error: 'Failed to fetch upcoming jobs', details: err.message });
    }
});

// GET /api/jobs/recommendations - Get AI recommendations based on applied exams
router.get('/recommendations', auth, async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        
        // Get user's applied exams
        const appliedResult = await db.execute({
            sql: `SELECT j.* FROM applied_jobs a JOIN jobs j ON a.job_id = j.id WHERE a.user_id = ?`,
            args: [req.user.id]
        });
        const appliedExams = appliedResult.rows;
        const appliedIds = new Set(appliedExams.map(e => e.id));
        
        // If no applied exams, return LIVE non-technical exams as recommendations
        if (appliedExams.length === 0) {
            console.log('[recommendations] No applied exams, returning default recommendations');
            const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link';
            const result = await db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date ASC`);
            const jobs = result.rows.map(job => withStatus(job, todayStr));
            const defaultRecs = jobs
                .filter(j => j.form_status === 'LIVE' && meetsTechnicalCriteria(j))
                .slice(0, 20);
            return res.json(defaultRecs);
        }
        
        // Build syllabus profile from applied exams
        const combinedSyllabus = appliedExams.map(e => e.syllabus || e.structured_syllabus_json || '').join(' ').toLowerCase();
        const categories = [...new Set(appliedExams.map(e => e.job_category))];
        
        // Fetch all candidate exams (not applied)
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, application_start_date, application_end_date, salary_min, salary_max, job_category, state, states, vacancies, official_application_link, syllabus, structured_syllabus_json';
        const allJobs = (await db.execute(`SELECT ${selectFields} FROM jobs`)).rows;
        const candidateJobs = allJobs
            .filter(j => !appliedIds.has(j.id))
            .map(job => withStatus(job, todayStr));
        
        // Score each candidate based on syllabus overlap and category match
        const scoredJobs = candidateJobs.map(job => {
            let score = 0;
            
            // Category match bonus
            if (categories.includes(job.job_category)) score += 30;
            
            // Syllabus keyword overlap
            const jobSyllabus = (job.syllabus || job.structured_syllabus_json || '').toLowerCase();
            if (combinedSyllabus && jobSyllabus) {
                const words1 = new Set(combinedSyllabus.split(/\W+/).filter(w => w.length > 3));
                const words2 = new Set(jobSyllabus.split(/\W+/).filter(w => w.length > 3));
                if (words1.size > 0 && words2.size > 0) {
                    const intersection = [...words1].filter(x => words2.has(x)).length;
                    const overlap = intersection / Math.min(words1.size, words2.size);
                    score += Math.round(overlap * 70); // Up to 70 points for overlap
                }
            }
            
            // Status bonus (LIVE exams get priority)
            if (job.form_status === 'LIVE') score += 20;
            else if (job.form_status === 'UPCOMING') score += 10;
            
            return { ...job, recommendation_score: score };
        });
        
        // Sort by score and return top recommendations
        const recommendations = scoredJobs
            .filter(j => j.recommendation_score > 0)
            .sort((a, b) => b.recommendation_score - a.recommendation_score)
            .slice(0, 30);
        
        // FALLBACK: If scoring yields nothing, return same-category LIVE exams
        if (recommendations.length === 0) {
            console.log('[recommendations] No scored recommendations, using category fallback');
            const fallback = candidateJobs
                .filter(j => categories.includes(j.job_category) && j.form_status === 'LIVE')
                .slice(0, 20);
            return res.json(fallback);
        }
        
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.json(recommendations);
    } catch (err) {
        console.error('GET /api/jobs/recommendations error:', err);
        return res.status(500).json({ error: 'Failed to fetch recommendations', details: err.message });
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
    const jobId = req.params.id;
    const userId = req.user.id;
    const db = getDb();
    const job = (await db.execute({ sql: 'SELECT id, job_name FROM jobs WHERE id = ?', args: [jobId] })).rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    try {
        await ensureVercelUser(db, req.user);
        await db.execute({
            sql: 'INSERT INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT (user_id, job_id) DO NOTHING',
            args: [generateId(), userId, jobId]
        });
        await db.execute({
            sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
            args: [generateId(), userId, jobId, 'You saved: ' + job.job_name]
        });
        return res.json({ liked: true });
    } catch (err) {
        console.error('Like error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/jobs/:id/like
router.delete('/:id/like', auth, async (req, res) => {
    const db = getDb();
    await ensureVercelUser(db, req.user);
    await db.execute({ sql: 'DELETE FROM liked_jobs WHERE user_id = ? AND job_id = ?', args: [req.user.id, req.params.id] });
    return res.json({ liked: false });
});

// GET /api/jobs/:id/liked-status
router.get('/:id/liked-status', auth, async (req, res) => {
    const db = getDb();
    const row = (await db.execute({ sql: 'SELECT id FROM liked_jobs WHERE user_id = ? AND job_id = ?', args: [req.user.id, req.params.id] })).rows[0];
    return res.json({ liked: !!row });
});

// POST /api/jobs/admin — add a job
router.post('/admin', auth, async (req, res) => {
    try {
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
