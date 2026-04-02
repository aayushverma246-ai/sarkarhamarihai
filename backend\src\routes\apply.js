const express = require('express');
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Reuse the same status computation logic from jobs.js (IST timezone)
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
    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    const diffDays = todayDays - endDays;
    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}
function withStatus(job) {
    const todayStr = getTodayIST();
    let parsedStates = [];
    if (job.states && job.states !== '[]') {
        try { parsedStates = JSON.parse(job.states); } catch (_) {}
    }
    return { 
        ...job, 
        states: parsedStates,
        form_status: computeFormStatus(job, todayStr), 
        allows_final_year_students: !!job.allows_final_year_students 
    };
}

router.get('/applied', auth, async (req, res) => {
    try {
        const db = getDb();
        const todayStr = getTodayIST();
        // Step 1: Get applied job IDs (simple, no JOIN)
        const refs = (await db.execute({
            sql: 'SELECT job_id FROM applied_jobs WHERE user_id = ? ORDER BY created_at DESC',
            args: [req.user.id]
        })).rows;
        if (!refs.length) return res.json([]);
        const ids = refs.map(r => r.job_id);
        // Step 2: Fetch those jobs (IN clause, no JOIN required)
        const placeholders = ids.map(() => '?').join(',');
        const jobs = (await db.execute({ sql: `SELECT * FROM jobs WHERE id IN (${placeholders})`, args: ids })).rows;
        res.json(jobs.map(j => withStatus(j, todayStr)));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/status/:job_id', auth, async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute({
            sql: 'SELECT * FROM applied_jobs WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, req.params.job_id]
        });
        res.json({ applied: result.rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/toggle', auth, async (req, res) => {
    try {
        const { job_id } = req.body;
        if (!job_id) return res.status(400).json({ error: 'job_id is required' });

        const db = getDb();

        // Check if job exists
        const jobResult = await db.execute({
            sql: 'SELECT * FROM jobs WHERE id = ?',
            args: [job_id]
        });
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check current status
        const appliedResult = await db.execute({
            sql: 'SELECT * FROM applied_jobs WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, job_id]
        });

        const isApplied = appliedResult.rows.length > 0;

        if (isApplied) {
            // Remove applied
            await db.execute({
                sql: 'DELETE FROM applied_jobs WHERE user_id = ? AND job_id = ?',
                args: [req.user.id, job_id]
            });
            res.json({ applied: false });
        } else {
            // Add applied
            const id = 'app_' + Math.random().toString(36).substring(2, 9);
            await db.execute({
                sql: 'INSERT INTO applied_jobs (id, user_id, job_id) VALUES (?, ?, ?)',
                args: [id, req.user.id, job_id]
            });

            // AI is now handled strictly by the frontend calling /api/ai/recommendations
            res.json({ applied: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET Reminder status
router.get('/reminder/:job_id', auth, async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute({
            sql: 'SELECT * FROM job_reminders WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, req.params.job_id]
        });
        res.json({ reminders_enabled: result.rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST Toggle Reminder
router.post('/reminder/toggle', auth, async (req, res) => {
    try {
        const { job_id } = req.body;
        if (!job_id) return res.status(400).json({ error: 'job_id is required' });

        const db = getDb();

        const jobResult = await db.execute({
            sql: 'SELECT * FROM jobs WHERE id = ?',
            args: [job_id]
        });
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const reminderResult = await db.execute({
            sql: 'SELECT * FROM job_reminders WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, job_id]
        });

        const isReminding = reminderResult.rows.length > 0;

        if (isReminding) {
            await db.execute({
                sql: 'DELETE FROM job_reminders WHERE user_id = ? AND job_id = ?',
                args: [req.user.id, job_id]
            });
            res.json({ reminders_enabled: false });
        } else {
            const id = 'rem_' + Math.random().toString(36).substring(2, 9);
            await db.execute({
                sql: 'INSERT INTO job_reminders (id, user_id, job_id) VALUES (?, ?, ?)',
                args: [id, req.user.id, job_id]
            });
            res.json({ reminders_enabled: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/applied-exam
router.delete('/applied-exam', auth, async (req, res) => {
    try {
        const { exam_id } = req.body;
        if (!exam_id) return res.status(400).json({ error: 'exam_id is required' });

        const db = getDb();
        await db.execute({
            sql: 'DELETE FROM applied_jobs WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, exam_id]
        });

        res.json({ success: true, message: 'Unmarked as applied' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
