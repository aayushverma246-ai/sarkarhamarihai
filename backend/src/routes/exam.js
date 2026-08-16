const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { estimateLiveData } = require('../services/gemini');

// GET /api/exam/live-stats?id=...
// or GET /api/exam/live-stats/:id
router.get('/live-stats/:id?', async (req, res) => {
    try {
        const db = getDb();
        const targetId = req.params.id || req.query.id;

        let job;
        if (targetId) {
            job = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [targetId] })).rows[0];
        } else {
            job = (await db.execute('SELECT * FROM jobs LIMIT 1')).rows[0];
        }

        if (!job) return res.status(404).json({ error: 'Exam not found' });

        const stats = await estimateLiveData(job.job_name, job.organization);

        // Update DB
        await db.execute({
            sql: 'UPDATE jobs SET vacancies = ?, applicants_count = ? WHERE id = ?',
            args: [stats.vacancies, stats.applicants_count, job.id]
        });

        return res.json(stats);
    } catch (err) {
        console.error('Exam live stats API error:', err);
        return res.status(500).json({ error: 'Server error fetching live stats' });
    }
});

// GET /api/exam/:id
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const job = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [req.params.id] })).rows[0];
        if (!job) return res.status(404).json({ error: 'Exam not found' });

        return res.json(job);
    } catch (err) {
        console.error('Exam API error:', err);
        return res.status(500).json({ error: 'Server error fetching exam' });
    }
});

module.exports = router;
