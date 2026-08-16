const express = require('express');
const router = express.Router();
const { getDb, getSupabase } = require('../db');
const auth = require('../middleware/auth');

// ── Server-side cache for notification counts (avoid DB hit on every page load) ──
const _notifCache = {};
function getNotifCached(key, ttlMs) {
    const e = _notifCache[key];
    if (e && Date.now() - e.ts < ttlMs) return e.data;
    return null;
}
function setNotifCached(key, data) {
    _notifCache[key] = { data, ts: Date.now() };
}

// GET /api/notifications/count
// Uses Supabase SDK count directly — instant, no JOIN, no REST parse overhead.
router.get('/count', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `notif_count:${userId}`;
        const cached = getNotifCached(cacheKey, 15000); // 15s cache
        if (cached !== null) return res.json({ count: cached });

        const sb = getSupabase();
        const { count, error } = await sb
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        const finalCount = count || 0;
        setNotifCached(cacheKey, finalCount);
        return res.json({ count: finalCount });
    } catch (err) {
        console.error('Failed to fetch notification count:', err);
        return res.json({ count: 0 }); // Fail gracefully
    }
});

// GET /api/notifications
// Two parallel SDK calls instead of one slow JOIN through REST fallback.
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sb = getSupabase();

        // Fetch notifications (no JOIN — pure table scan, indexed on user_id)
        const { data: notifs, error: notifErr } = await sb
            .from('notifications')
            .select('id, user_id, job_id, message, type, read, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (notifErr) throw new Error(notifErr.message);
        if (!notifs || notifs.length === 0) return res.json([]);

        // Fetch job names for the referenced jobs (parallel, no JOIN)
        const jobIds = [...new Set(notifs.map(n => n.job_id).filter(Boolean))];
        let jobNameMap = {};
        if (jobIds.length > 0) {
            const { data: jobs } = await sb
                .from('jobs')
                .select('id, job_name, exam_name_hi, exam_name_ta, exam_name_bn')
                .in('id', jobIds);
            if (jobs) {
                for (const j of jobs) {
                    jobNameMap[j.id] = {
                        job_name: j.job_name,
                        exam_name_hi: j.exam_name_hi,
                        exam_name_ta: j.exam_name_ta,
                        exam_name_bn: j.exam_name_bn,
                    };
                }
            }
        }

        // Merge and fix timestamps
        const result = notifs.map(n => {
            const jobInfo = n.job_id ? (jobNameMap[n.job_id] || {}) : {};
            const ts = n.created_at;
            const fixedTs = ts && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts;
            return { ...n, ...jobInfo, created_at: fixedTs };
        });

        return res.json(result);
    } catch (err) {
        console.error('Failed fetching notifications:', err);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// DELETE /api/notifications/all
router.delete('/all', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sb = getSupabase();
        const { error } = await sb.from('notifications').delete().eq('user_id', userId);
        if (error) throw new Error(error.message);

        // Invalidate count cache
        delete _notifCache[`notif_count:${userId}`];
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sb = getSupabase();
        const { error } = await sb
            .from('notifications')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', userId);
        if (error) throw new Error(error.message);

        // Invalidate count cache
        delete _notifCache[`notif_count:${userId}`];
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
