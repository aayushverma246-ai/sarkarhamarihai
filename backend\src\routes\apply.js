const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const auth = require('../middleware/auth');
const router = express.Router();

function getSb() {
  return createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;
    if (!start || !end) return 'CLOSED';
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';
    const endDate = new Date(end);
    const todayDate = new Date(todayStr);
    const diffDays = Math.floor((todayDate - endDate) / (1000 * 60 * 60 * 24));
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

// GET /api/apply/applied — get all applied jobs for current user
router.get('/applied', auth, async (req, res) => {
    try {
        const { getDb } = require('../db');
        const db = getDb();
        const result = await db.execute({
            sql: `SELECT j.* FROM applied_jobs a JOIN jobs j ON a.job_id = j.id WHERE a.user_id = ? ORDER BY a.created_at DESC`,
            args: [req.user.id]
        });
        const jobs = result.rows || [];
        res.json(jobs.map(j => withStatus(j)));
    } catch (err) {
        console.error('GET /applied error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/apply/reminders — get all reminded jobs for current user
router.get('/reminders', auth, async (req, res) => {
    try {
        const { getDb } = require('../db');
        const db = getDb();
        const result = await db.execute({
            sql: `SELECT j.* FROM job_reminders r JOIN jobs j ON r.job_id = j.id WHERE r.user_id = ? ORDER BY r.created_at DESC`,
            args: [req.user.id]
        });
        const jobs = result.rows || [];
        res.json(jobs.map(j => withStatus(j)));
    } catch (err) {
        console.error('GET /reminders error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/apply/status/:job_id
router.get('/status/:job_id', auth, async (req, res) => {
    try {
        const sb = getSb();
        const { data } = await sb.from('applied_jobs')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('job_id', req.params.job_id)
            .limit(1);
        res.json({ applied: (data || []).length > 0 });
    } catch (err) {
        console.error('GET /status error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/apply/toggle — toggle applied status
router.post('/toggle', auth, async (req, res) => {
    try {
        const { job_id } = req.body;
        if (!job_id) return res.status(400).json({ error: 'job_id is required' });

        const sb = getSb();

        // Check if job exists
        const { data: jobData } = await sb.from('jobs')
            .select('id').eq('id', job_id).limit(1);
        if (!jobData || jobData.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check current status
        const { data: existing } = await sb.from('applied_jobs')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('job_id', job_id)
            .limit(1);

        let applied = false;
        if (existing && existing.length > 0) {
            // Remove applied
            await sb.from('applied_jobs')
                .delete()
                .eq('user_id', req.user.id)
                .eq('job_id', job_id);
            applied = false;
        } else {
            // Add applied
            const id = 'app_' + Math.random().toString(36).substring(2, 9);
            const { error } = await sb.from('applied_jobs')
                .insert({ id, user_id: req.user.id, job_id });
            if (error) {
                // Might be duplicate — that's fine
                if (error.code === '23505') {
                    applied = true;
                } else {
                    throw error;
                }
            } else {
                applied = true;
            }
        }

        // Invalidate recommendation cache in DB
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco:${req.user.id}:%`);

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            invalidateRecommendationsCache(req.user.id);
        } catch (e) {
            console.error('Failed to invalidate recommendations memory cache:', e);
        }

        res.json({ applied });
    } catch (err) {
        console.error('POST /toggle error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/apply/reminder/:job_id
router.get('/reminder/:job_id', auth, async (req, res) => {
    try {
        const sb = getSb();
        const { data } = await sb.from('job_reminders')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('job_id', req.params.job_id)
            .limit(1);
        res.json({ reminders_enabled: (data || []).length > 0 });
    } catch (err) {
        console.error('GET /reminder error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/apply/reminder/toggle
router.post('/reminder/toggle', auth, async (req, res) => {
    try {
        const { job_id } = req.body;
        if (!job_id) return res.status(400).json({ error: 'job_id is required' });

        const sb = getSb();

        // Check if job exists
        const { data: jobData } = await sb.from('jobs')
            .select('id').eq('id', job_id).limit(1);
        if (!jobData || jobData.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const { data: existing } = await sb.from('job_reminders')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('job_id', job_id)
            .limit(1);

        if (existing && existing.length > 0) {
            await sb.from('job_reminders')
                .delete()
                .eq('user_id', req.user.id)
                .eq('job_id', job_id);
            res.json({ reminders_enabled: false });
        } else {
            const id = 'rem_' + Math.random().toString(36).substring(2, 9);
            const { error } = await sb.from('job_reminders')
                .insert({ id, user_id: req.user.id, job_id });
            if (error) {
                if (error.code === '23505') return res.json({ reminders_enabled: true });
                throw error;
            }
            res.json({ reminders_enabled: true });
        }
    } catch (err) {
        console.error('POST /reminder/toggle error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/apply/applied-exam
router.delete('/applied-exam', auth, async (req, res) => {
    try {
        const { exam_id } = req.body;
        if (!exam_id) return res.status(400).json({ error: 'exam_id is required' });

        const sb = getSb();
        await sb.from('applied_jobs')
            .delete()
            .eq('user_id', req.user.id)
            .eq('job_id', exam_id);

        // Invalidate recommendation cache in DB
        await sb.from('ai_recommendation_cache')
            .delete()
            .like('key', `reco:${req.user.id}:%`);

        // Invalidate memory cache in backend service
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            invalidateRecommendationsCache(req.user.id);
        } catch (e) {
            console.error('Failed to invalidate recommendations memory cache:', e);
        }

        res.json({ success: true, message: 'Unmarked as applied' });
    } catch (err) {
        console.error('DELETE /applied-exam error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
