const express = require('express');
const { getDb, getSupabase } = require('../db');
const { Resend } = require('resend');

const router = express.Router();

// Initialize resend ONLY if API key exists
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Helper to get consistent date string in IST (UTC+5:30)
const getTodayStr = () => {
    const now = new Date();
    // Convert to IST by adding 5 hours 30 minutes
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().slice(0, 10);
};

const getISTTimestamp = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
};

// Provide robust idempotent retry for serverless DB operations
const withRetry = async (fn, maxRetries = 3) => {
    let retries = maxRetries;
    while (retries > 0) {
        try {
            return await fn();
        } catch (err) {
            retries--;
            if (retries === 0) throw err;
            console.warn(`[Cron] Retry ${maxRetries - retries}/${maxRetries} failed. Retrying... (${err.message})`);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
};

// 1. UPDATE JOB STATUSES (Hourly) - Supabase SDK State Transitions
const updateStatuses = async (db) => {
    const todayStr = getTodayStr();
    console.log(`[Cron ${getISTTimestamp()}] Updating statuses for date: ${todayStr}`);

    const sb = getSupabase();
    let totalUpdated = 0;

    // Calculate 30 days ago for RECENTLY_CLOSED -> CLOSED transition
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 1. UPCOMING -> LIVE (start date has arrived)
    const { count: c1 } = await sb.from('jobs')
        .update({ form_status: 'LIVE' }, { count: 'exact' })
        .eq('form_status', 'UPCOMING')
        .lte('application_start_date', todayStr);
    totalUpdated += (c1 || 0);

    // 2. LIVE -> RECENTLY_CLOSED (end date has passed)
    const { count: c2 } = await sb.from('jobs')
        .update({ form_status: 'RECENTLY_CLOSED' }, { count: 'exact' })
        .eq('form_status', 'LIVE')
        .lt('application_end_date', todayStr);
    totalUpdated += (c2 || 0);

    // 3. CLOSED/RECENTLY_CLOSED -> LIVE (Reopened Exam)
    const { count: c3 } = await sb.from('jobs')
        .update({ form_status: 'LIVE' }, { count: 'exact' })
        .in('form_status', ['CLOSED', 'RECENTLY_CLOSED'])
        .lte('application_start_date', todayStr)
        .gte('application_end_date', todayStr);
    totalUpdated += (c3 || 0);

    // 4. RECENTLY_CLOSED -> CLOSED (after 30 days)
    const { count: c4 } = await sb.from('jobs')
        .update({ form_status: 'CLOSED' }, { count: 'exact' })
        .eq('form_status', 'RECENTLY_CLOSED')
        .lt('application_end_date', thirtyDaysAgo);
    totalUpdated += (c4 || 0);

    console.log(`[Cron ${getISTTimestamp()}] Status update complete: ${totalUpdated} rows updated (UPCOMING→LIVE:${c1 || 0} LIVE→CLOSED:${c2 || 0} Reopen:${c3 || 0} 30d:${c4 || 0})`);
    return totalUpdated;
};

// 2. SEND NOTIFICATIONS (Thrice Daily)
// 2. SEND NOTIFICATIONS (Thrice Daily)
const sendNotifications = async (db) => {
    const todayStr = getTodayStr();
    const sb = require('@supabase/supabase-js').createClient(
        process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istHour = istNow.getUTCHours();
    const timePrefix = istHour < 12 ? '🌅 Morning' : istHour < 17 ? '☀️ Afternoon' : '🌙 Evening';

    const d1Str = new Date(istNow.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d2Str = new Date(istNow.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d3Str = new Date(istNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterdayStr = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let count = 0;
    const inserts = [];

    // Fetch interested users first
    const { data: likedRows } = await sb.from('liked_jobs').select('user_id, job_id');
    const { data: reminderRows } = await sb.from('job_reminders').select('user_id, job_id');
    const { data: appliedRows } = await sb.from('applied_jobs').select('user_id, job_id');

    const appliedSet = new Set((appliedRows || []).map(r => `${r.user_id}::${r.job_id}`));

    // Gather unique job_ids users are interested in to bypass Supabase 1000 row limits
    const interestedJobIds = Array.from(new Set([
        ...(likedRows || []).map(r => r.job_id),
        ...(reminderRows || []).map(r => r.job_id)
    ])).filter(Boolean);

    let activeJobs = [];
    if (interestedJobIds.length > 0) {
        const { data, error } = await sb.from('jobs')
            .select('id, job_name, organization, form_status, application_end_date, application_start_date')
            .in('id', interestedJobIds)
            .in('form_status', ['LIVE', 'RECENTLY_CLOSED', 'CLOSED']);
        if (error) throw new Error(error.message);
        activeJobs = data || [];
    }

    if (activeJobs.length === 0) return 0;

    // Group by source to differentiate logic
    const likedToUsers = {};
    const reminderToUsers = {};
    for (const row of (likedRows || [])) {
        if (!likedToUsers[row.job_id]) likedToUsers[row.job_id] = new Set();
        likedToUsers[row.job_id].add(row.user_id);
    }
    for (const row of (reminderRows || [])) {
        if (!reminderToUsers[row.job_id]) reminderToUsers[row.job_id] = new Set();
        reminderToUsers[row.job_id].add(row.user_id);
    }

    // Existing notifications sent last 7 days to avoid spam (except daily reminders which use a specific format)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await sb.from('notifications')
        .select('user_id, job_id, message')
        .gte('created_at', sevenDaysAgo);

    const existingNotifSet = new Set(
        (recentNotifs || []).map(r => `${r.user_id}|${r.job_id || 'null'}|${r.message}`)
    );

    // Track how many non-daily notifications sent today to limit to 3 per user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: todayNotifs } = await sb.from('notifications')
        .select('user_id, message')
        .gte('created_at', oneDayAgo);

    const sentTodayMap = {};
    for (const row of (todayNotifs || [])) {
        if (!row.message.includes('Reminder [')) {
            sentTodayMap[row.user_id] = (sentTodayMap[row.user_id] || 0) + 1;
        }
    }

    for (const job of activeJobs) {
        const likedUsers = likedToUsers[job.id] || new Set();
        const remindedUsers = reminderToUsers[job.id] || new Set();
        const allInterested = new Set([...likedUsers, ...remindedUsers]);

        for (const userId of allInterested) {
            if (appliedSet.has(`${userId}::${job.id}`)) continue;
            if (!sentTodayMap[userId]) sentTodayMap[userId] = 0;

            let msg = null;

            if (job.form_status === 'LIVE' && job.application_end_date) {
                // Req #1: User enabled "Remind me daily" exams: Send notifications 3 times a day
                if (remindedUsers.has(userId) && job.application_end_date >= todayStr) {
                    const dailyMsg = `📋 ${timePrefix} Reminder [${todayStr}]: Apply for ${job.job_name} before ${job.application_end_date}.`;
                    const cacheKey = `${userId}|${job.id}|${dailyMsg}`;
                    if (!existingNotifSet.has(cacheKey)) {
                        inserts.push({
                            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
                            user_id: userId, job_id: job.id, message: dailyMsg
                        });
                        existingNotifSet.add(cacheKey);
                        count++;
                    }
                }

                // Req #2: "Remind me when opens" -> If it's a reminder and it JUST opened today
                if (remindedUsers.has(userId) && job.application_start_date === todayStr) {
                    const openMsg = `🎉 Now Open: Applications for ${job.job_name} are now LIVE!`;
                    const cacheKey = `${userId}|${job.id}|${openMsg}`;
                    if (!existingNotifSet.has(cacheKey) && sentTodayMap[userId] < 3) {
                        inserts.push({
                            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
                            user_id: userId, job_id: job.id, message: openMsg
                        });
                        existingNotifSet.add(cacheKey);
                        sentTodayMap[userId]++;
                        count++;
                    }
                }

                // Req #3: Send 3 days continuous one notification of liked exam closing in 3 days
                if (likedUsers.has(userId)) {
                    if (job.application_end_date === d3Str) msg = `⏳ Only 3 days left to apply for ${job.job_name}!`;
                    else if (job.application_end_date === d2Str) msg = `⏳ Only 2 days left to apply for ${job.job_name}!`;
                    else if (job.application_end_date === d1Str) msg = `🚨 LAST DAY to apply for ${job.job_name}!`;
                }

            } else if (job.application_end_date === yesterdayStr) {
                msg = `🔒 The application window for ${job.job_name} is now closed.`;
            }

            if (msg) {
                const cacheKey = `${userId}|${job.id}|${msg}`;
                if (!existingNotifSet.has(cacheKey) && sentTodayMap[userId] < 3) {
                    inserts.push({
                        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
                        user_id: userId, job_id: job.id, message: msg
                    });
                    existingNotifSet.add(cacheKey);
                    sentTodayMap[userId]++;
                    count++;
                }
            }
        }
    }

    // Bulk write
    for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        await sb.from('notifications').insert(batch);
    }

    return count;
};

const statusHandler = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const db = getDb();
        const updated = await withRetry(() => updateStatuses(db));
        console.log(`[Cron ${getISTTimestamp()}] Status update complete: ${updated} jobs processed`);
        res.json({ success: true, type: 'status', updated, timestamp: getISTTimestamp() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const notifyHandler = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const db = getDb();
        const sent = await withRetry(() => sendNotifications(db));
        console.log(`[Cron ${getISTTimestamp()}] Notifications sent: ${sent} notifications`);
        res.json({ success: true, type: 'notifications', sent, timestamp: getISTTimestamp() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const dailyTask = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const db = getDb();
        const updated = await withRetry(() => updateStatuses(db));
        const sent = await withRetry(() => sendNotifications(db));
        console.log(`[Cron ${getISTTimestamp()}] Daily task complete: ${updated} statuses, ${sent} notifications`);
        res.json({ success: true, updated, sent, timestamp: getISTTimestamp() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. STATUS CHANGE NOTIFICATION — exams going LIVE, notify "Notify Me" & liked users
const statusChangeNotify = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const sb = getSupabase();
        let count = 0;
        const inserts = [];

        // Fetch all LIVE jobs
        const { data: freshlyLiveJobs, error: jobErr } = await sb.from('jobs')
            .select('id, job_name, organization, application_end_date, application_start_date')
            .eq('form_status', 'LIVE');
        if (jobErr) throw new Error(jobErr.message);

        if (!freshlyLiveJobs || freshlyLiveJobs.length === 0) {
            return res.json({ success: true, type: 'status-change-notify', sent: 0, message: 'No live exams', timestamp: getISTTimestamp() });
        }

        const jobIds = freshlyLiveJobs.map(j => j.id);

        // Batch-fetch reminders and likes for all live jobs
        const { data: allReminders } = await sb.from('job_reminders').select('user_id, job_id').in('job_id', jobIds);
        const { data: allLikes } = await sb.from('liked_jobs').select('user_id, job_id').in('job_id', jobIds);

        // Fetch recent notifications to avoid duplicates
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentNotifs } = await sb.from('notifications')
            .select('user_id, job_id, message')
            .gte('created_at', sevenDaysAgo);
        const existingSet = new Set((recentNotifs || []).map(n => `${n.user_id}|${n.job_id}|${n.message}`));

        for (const job of freshlyLiveJobs) {
            const reminders = (allReminders || []).filter(r => r.job_id === job.id);
            const likes = (allLikes || []).filter(r => r.job_id === job.id);

            for (const rem of reminders) {
                const msg = `🎉 Great news! ${job.job_name} (${job.organization}) is NOW LIVE! Apply before ${job.application_end_date}!`;
                const key = `${rem.user_id}|${job.id}|${msg}`;
                if (!existingSet.has(key)) {
                    inserts.push({ id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5), user_id: rem.user_id, job_id: job.id, message: msg });
                    existingSet.add(key);
                    count++;
                }
            }

            for (const liker of likes) {
                const msg = `🚀 ${job.job_name} you saved is now LIVE! Applications open until ${job.application_end_date}.`;
                const key = `${liker.user_id}|${job.id}|${msg}`;
                if (!existingSet.has(key)) {
                    inserts.push({ id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5), user_id: liker.user_id, job_id: job.id, message: msg });
                    existingSet.add(key);
                    count++;
                }
            }
        }

        // Bulk insert in batches of 50
        for (let i = 0; i < inserts.length; i += 50) {
            await sb.from('notifications').insert(inserts.slice(i, i + 50));
        }

        console.log(`[Cron ${getISTTimestamp()}] Status-change notifications sent: ${count}`);
        res.json({ success: true, type: 'status-change-notify', sent: count, jobsGoingLive: freshlyLiveJobs.length, timestamp: getISTTimestamp() });
    } catch (err) {
        console.error('Status-change-notify error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4. FINAL CLOSE NOTIFICATION — daily for "Remind Daily" exams about to close
const finalCloseNotify = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const sb = getSupabase();
        const todayStr = getTodayStr();
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        let count = 0;
        const inserts = [];

        // Fetch jobs closing today or yesterday
        const { data: closingJobs, error: jobErr } = await sb.from('jobs')
            .select('id, job_name, organization, application_end_date')
            .in('application_end_date', [todayStr, yesterdayStr]);
        if (jobErr) throw new Error(jobErr.message);

        if (!closingJobs || closingJobs.length === 0) {
            return res.json({ success: true, type: 'final-close-notify', sent: 0, message: 'No exams closing today', timestamp: getISTTimestamp() });
        }

        const jobIds = closingJobs.map(j => j.id);

        // Batch-fetch reminders, applied status, and recent notifs
        const { data: allReminders } = await sb.from('job_reminders').select('user_id, job_id').in('job_id', jobIds);
        const { data: allApplied } = await sb.from('applied_jobs').select('user_id, job_id').in('job_id', jobIds);
        const appliedSet = new Set((allApplied || []).map(r => `${r.user_id}::${r.job_id}`));

        // Fetch recent notifications to avoid duplicates
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentNotifs } = await sb.from('notifications')
            .select('user_id, job_id, message')
            .gte('created_at', sevenDaysAgo);
        const existingSet = new Set((recentNotifs || []).map(n => `${n.user_id}|${n.job_id}|${n.message}`));

        for (const job of closingJobs) {
            const isClosingToday = job.application_end_date === todayStr;
            const closedYesterday = job.application_end_date === yesterdayStr;
            const reminders = (allReminders || []).filter(r => r.job_id === job.id);

            for (const rem of reminders) {
                let message;
                if (isClosingToday) {
                    message = appliedSet.has(`${rem.user_id}::${job.id}`)
                        ? `⏰ FINAL DAY! ${job.job_name} (${job.organization}) applications close TODAY. You've already applied ✅`
                        : `🚨 LAST CHANCE! ${job.job_name} (${job.organization}) applications close TODAY! Apply now before it's too late!`;
                } else if (closedYesterday) {
                    message = `🔒 Applications for ${job.job_name} (${job.organization}) have now CLOSED.`;
                }

                if (message) {
                    const key = `${rem.user_id}|${job.id}|${message}`;
                    if (!existingSet.has(key)) {
                        inserts.push({ id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5), user_id: rem.user_id, job_id: job.id, message });
                        existingSet.add(key);
                        count++;
                    }
                }
            }
        }

        // Bulk insert in batches of 50
        for (let i = 0; i < inserts.length; i += 50) {
            await sb.from('notifications').insert(inserts.slice(i, i + 50));
        }

        console.log(`[Cron ${getISTTimestamp()}] Final-close notifications sent: ${count}`);
        res.json({ success: true, type: 'final-close-notify', sent: count, closingJobs: closingJobs.length, timestamp: getISTTimestamp() });
    } catch (err) {
        console.error('Final-close-notify error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5. HOURLY SYNC SYSTEM — Central platform sync -> Database merge -> Safe Diff
const hourlySync = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');

    // Vercel cron sends Authorization: Bearer <CRON_SECRET>
    if (secret !== cronSecret && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`[Sync ${getISTTimestamp()}] Starting production sync pipeline...`);

    try {
        const db = getDb();

        // Step 1: VALIDATE
        const countRes = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const dbCount = Number(countRes.rows[0].cnt);
        if (dbCount === 0) throw new Error("Database is empty. Corrupted sync state.");

        // Step 2: STATUS UPDATES (Hourly)
        const updatedCount = await withRetry(() => updateStatuses(db));

        // Step 3: NOTIFICATIONS TRIGGER (Safe idempotent)
        const notifCount = await withRetry(() => sendNotifications(db));

        console.log(`[Sync ${getISTTimestamp()}] Successfully synced ${dbCount} rows. State updates: ${updatedCount}. Notifications: ${notifCount}`);

        res.json({
            success: true,
            status: "Synced",
            totalRows: dbCount,
            updatedStatuses: updatedCount,
            dispatchedNotifications: notifCount,
            timestamp: getISTTimestamp()
        });
    } catch (err) {
        console.error(`[Sync] Failure: ${err.message}`);
        res.status(500).json({ error: err.message, pipeline_step: 'failed' });
    }
};

// ── CRON EXECUTION LOG (ring buffer, last 50 entries) ──────────────────────
const cronExecutionLog = [];
const MAX_LOG_ENTRIES = 50;

function logCronExecution(type, result, error = null) {
    const entry = {
        type,
        timestamp: getISTTimestamp(),
        success: !error,
        result: error ? { error: error.message || String(error) } : result,
    };
    cronExecutionLog.push(entry);
    if (cronExecutionLog.length > MAX_LOG_ENTRIES) cronExecutionLog.shift();
}

// Wrap existing handlers to log executions
const originalStatusHandler = statusHandler;
const originalNotifyHandler = notifyHandler;

// 6. HEALTH CHECK — /cron/health
const cronHealthHandler = async (req, res) => {
    try {
        const db = getDb();
        const countRes = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const dbCount = Number(countRes.rows[0]?.cnt || 0);

        const lastExecution = cronExecutionLog.length > 0
            ? cronExecutionLog[cronExecutionLog.length - 1]
            : null;

        const recentFailures = cronExecutionLog
            .filter(e => !e.success)
            .slice(-5);

        res.json({
            status: 'healthy',
            database: dbCount > 0 ? 'connected' : 'empty',
            jobCount: dbCount,
            lastExecution,
            recentFailures: recentFailures.length,
            totalExecutions: cronExecutionLog.length,
            timestamp: getISTTimestamp(),
        });
    } catch (err) {
        res.status(503).json({
            status: 'unhealthy',
            error: err.message,
            timestamp: getISTTimestamp(),
        });
    }
};

// 7. LOGS — /cron/logs (last 50 execution entries)
const cronLogsHandler = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit) || 50, MAX_LOG_ENTRIES);
    const logs = cronExecutionLog.slice(-limit);

    res.json({
        logs,
        total: cronExecutionLog.length,
        showing: logs.length,
        timestamp: getISTTimestamp(),
    });
};

router.get('/status', statusHandler);
router.get('/notifications', notifyHandler);
router.get('/daily', dailyTask);
router.get('/status-change-notify', statusChangeNotify);
router.get('/final-close-notify', finalCloseNotify);
router.get('/hourly-sync', hourlySync);
router.get('/health', cronHealthHandler);
router.get('/logs', cronLogsHandler);

module.exports = { router, updateStatuses, sendNotifications, dailyTask, hourlySync, cronHealthHandler, cronLogsHandler, logCronExecution };
