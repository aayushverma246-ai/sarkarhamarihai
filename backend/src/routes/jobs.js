const express = require('express');
const router = express.Router();
const { getDb, ensureVercelUser } = require('../db');
const auth = require('../middleware/auth');

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Compute form_status from dates (using IST to avoid timezone flickering)
function computeFormStatus(job) {
    const today = new Date();
    // Offset for IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    // Get YYYY-MM-DD in IST
    const todayStr = istDate.toISOString().split('T')[0];
    const start = job.application_start_date;
    const end = job.application_end_date;

    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';

    const endDate = new Date(end + 'T00:00:00Z'); // Exact day midnight UTC
    const istMidnight = new Date(istDate.toISOString().split('T')[0] + 'T00:00:00Z');
    const diffDays = Math.round((istMidnight.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

function withStatus(job) {
    const isVerified = Boolean(job.job_name && job.organization && job.official_application_link?.length > 5);
    // Determine a pseudo last_updated or use real one if exists
    const lastUpdated = job.created_at || new Date().toISOString().split('T')[0];

    let parsedStates = [];
    try {
        parsedStates = job.states ? JSON.parse(job.states) : [];
    } catch (_) {
        parsedStates = [];
    }

    return { 
        ...job, 
        states: parsedStates,
        form_status: computeFormStatus(job), 
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

// GET /api/jobs
router.get('/', async (req, res) => {
    const db = getDb();
    const allJobs = (await db.execute('SELECT * FROM jobs')).rows.map(withStatus);
    const { status } = req.query;
    // Allow CDN/edge to cache the job list for 60s; serve stale for up to 2 min while revalidating
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    if (status) {
        const s = status.toUpperCase();
        if (s === 'CLOSED') {
            return res.json(allJobs.filter(j => j.form_status === 'CLOSED' || j.form_status === 'RECENTLY_CLOSED'));
        }
        return res.json(allJobs.filter(j => j.form_status === s));
    }
    return res.json(allJobs);
});

// GET /api/jobs/eligible
router.get('/eligible', auth, async (req, res) => {
    const db = getDb();
    const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0] || req.user;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const jobs = (await db.execute('SELECT * FROM jobs')).rows.map(withStatus);
    return res.json(jobs.filter(j =>
        meetsQualification(user, j) &&
        meetsAge(user, j) &&
        meetsStateCriteria(user, j) &&
        meetsTechnicalCriteria(j)
    ));
});

// GET /api/jobs/partial
router.get('/partial', auth, async (req, res) => {
    const db = getDb();
    const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0] || req.user;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const jobs = (await db.execute('SELECT * FROM jobs')).rows.map(withStatus);
    return res.json(jobs.filter(j =>
        (meetsQualification(user, j) || meetsAge(user, j)) &&
        !(meetsQualification(user, j) && meetsAge(user, j)) &&
        meetsStateCriteria(user, j) &&
        meetsTechnicalCriteria(j)
    ));
});

// GET /api/jobs/liked
router.get('/liked', auth, async (req, res) => {
    const db = getDb();
    const likedRows = (await db.execute({ sql: 'SELECT job_id FROM liked_jobs WHERE user_id = ? ORDER BY created_at DESC', args: [req.user.id] })).rows;
    if (!likedRows.length) return res.json([]);
    const ids = likedRows.map(r => r.job_id);
    const placeholders = ids.map(() => '?').join(',');
    const jobs = (await db.execute({ sql: `SELECT * FROM jobs WHERE id IN (${placeholders})`, args: ids })).rows;
    return res.json(jobs.map(withStatus));
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
    const db = getDb();
    const job = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [req.params.id] })).rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(withStatus(job));
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
            sql: 'INSERT OR IGNORE INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?)',
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
            sql: `INSERT OR REPLACE INTO jobs (
                id, job_name, organization, qualification_required, allows_final_year_students,
                minimum_age, maximum_age, application_start_date, application_end_date,
                salary_min, salary_max, job_category, official_application_link, state, states
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        return res.status(201).json(withStatus(job));
    } catch (err) {
        console.error('Add job error:', err);
        return res.status(500).json({ error: 'Server error adding job' });
    }
});

module.exports = router;
