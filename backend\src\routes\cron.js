const express = require('express');
const { getDb } = require('../db');
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

// 1. UPDATE JOB STATUSES (Hourly) - Vercel Optimized State Transitions
const updateStatuses = async (db) => {
    const todayStr = getTodayStr();
    console.log(`[Cron ${getISTTimestamp()}] Updating statuses for date: ${todayStr}`);

    // ONLY update jobs that must transition state today
    const queries = [
        // UPCOMING -> LIVE
        {
            sql: "UPDATE jobs SET form_status = 'LIVE' WHERE form_status = 'UPCOMING' AND application_start_date <= ?",
            args: [todayStr]
        },
        // LIVE -> RECENTLY_CLOSED
        {
            sql: "UPDATE jobs SET form_status = 'RECENTLY_CLOSED' WHERE form_status = 'LIVE' AND application_end_date < ?",
            args: [todayStr]
        },
        // CLOSED -> LIVE (Reopened Exam)
        {
            sql: "UPDATE jobs SET form_status = 'LIVE' WHERE form_status IN ('CLOSED', 'RECENTLY_CLOSED') AND application_start_date <= ? AND application_end_date >= ?",
            args: [todayStr, todayStr]
        },
        // RECENTLY_CLOSED ->> CLOSED (after 30 days using PostgreSQL date arithmetic)
        {
            sql: "UPDATE jobs SET form_status = 'CLOSED' WHERE form_status = 'RECENTLY_CLOSED' AND application_end_date::date < (CURRENT_DATE - INTERVAL '30 days')",
            args: []
        }
    ];

    // Execute each query sequentially (PostgreSQL doesn't have batch API)
    const res = [];
    for (const q of queries) {
      res.push(await db.execute(q));
    }
    const totalUpdated = res.reduce((acc, r) => acc + (r.rowsAffected || 0), 0);
    console.log(`[Cron ${getISTTimestamp()}] Vector update complete: ${totalUpdated} rows updated`);
    return totalUpdated;
};

// 2. SEND NOTIFICATIONS (Thrice Daily)
const sendNotifications = async (db) => {
    const todayStr = getTodayStr();
    
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    
    // Strict date string generation for precision
    const d1Str = new Date(istNow.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d2Str = new Date(istNow.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d3Str = new Date(istNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterdayStr = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let count = 0;
    const updates = [];
    const dailyReminders = [];

    // Optimize: Fetch ONLY jobs that are active triggers (closing in 1,2,3 days, closed yesterday)
    const activeJobs = (await db.execute({
        sql: `SELECT id, job_name, organization, form_status, application_end_date 
              FROM jobs 
              WHERE application_end_date IN (?, ?, ?, ?)`
              , args: [d1Str, d2Str, d3Str, yesterdayStr]
    })).rows;

    if (activeJobs.length === 0) return 0;

    const jobIds = activeJobs.map(j => j.id);

    // Now, only fetch liked_jobs, reminders, and applied_jobs matching THESE jobs
    const jobPlaceholders = jobIds.map(() => '?').join(',');
    
    // Memory bounded queries
    const interestedUsers = (await db.execute({
        sql: `
            SELECT user_id, job_id, 'liked' as source FROM liked_jobs WHERE job_id IN (${jobPlaceholders})
            UNION
            SELECT user_id, job_id, 'reminder' as source FROM job_reminders WHERE job_id IN (${jobPlaceholders})
        `,
        args: [...jobIds, ...jobIds]
    })).rows;

    if (interestedUsers.length === 0) return 0;

    // Cache applied statuses mapped to Set of "user_id::job_id"
    const appliedRows = (await db.execute({
        sql: `SELECT user_id, job_id FROM applied_jobs WHERE job_id IN (${jobPlaceholders})`,
        args: jobIds
    })).rows;
    const appliedSet = new Set(appliedRows.map(r => `${r.user_id}::${r.job_id}`));

    // Group users by job
    const jobToUsers = {};
    for (const row of interestedUsers) {
        if (!jobToUsers[row.job_id]) jobToUsers[row.job_id] = new Set();
        jobToUsers[row.job_id].add(row.user_id);
    }

    // Existing notifications sent last 7 days to avoid spam
    const existingNotifSet = new Set(
        (await db.execute({ 
            sql: "SELECT COALESCE(user_id::text, '') || '|' || COALESCE(job_id::text, '') || '|' || COALESCE(message, '') as hash FROM notifications WHERE created_at >= NOW() - INTERVAL '7 days'"
        })).rows.map(r => r.hash).filter(Boolean)
    );

    // Track how many sent today to limit to 3 per user
    const sentTodayMap = {};
    const recentNotifs = (await db.execute({
        sql: "SELECT user_id, COUNT(*) as cnt FROM notifications WHERE created_at >= NOW() - INTERVAL '1 day' AND message NOT LIKE '%Reminder:%' GROUP BY user_id"
    })).rows;
    
    for (const row of recentNotifs) {
        sentTodayMap[row.user_id] = Number(row.cnt);
    }

    for (const job of activeJobs) {
        const usersForJob = jobToUsers[job.id] || new Set();

        for (const userId of usersForJob) {
            if (appliedSet.has(`${userId}::${job.id}`)) continue;
            if (!sentTodayMap[userId]) sentTodayMap[userId] = 0;

            if (job.form_status === 'LIVE' && job.application_end_date) {
                let closingMsg = null;
                if (job.application_end_date === d3Str) closingMsg = `⏳ Only 3 days left to apply for ${job.job_name}!`;
                else if (job.application_end_date === d2Str) closingMsg = `⏳ Only 2 days left to apply for ${job.job_name}!`;
                else if (job.application_end_date === d1Str) closingMsg = `🚨 LAST DAY to apply for ${job.job_name}!`;
                
                if (closingMsg) {
                    const cacheKey = `${userId}|${job.id}|${closingMsg}`;
                    if (!existingNotifSet.has(cacheKey) && sentTodayMap[userId] < 3) {
                        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                        updates.push({ sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)', args: [id, userId, job.id, closingMsg] });
                        existingNotifSet.add(cacheKey);
                        sentTodayMap[userId]++;
                        count++;
                    }
                } else if (job.application_end_date > d3Str) {
                     dailyReminders.push({ userId, job });
                }
            } else if (job.application_end_date === yesterdayStr) {
                 let msg = `🔒 The application window for ${job.job_name} is now closed.`;
                 const cacheKey = `${userId}|${job.id}|${msg}`;
                 if (!existingNotifSet.has(cacheKey) && sentTodayMap[userId] < 3) {
                     const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                     updates.push({ sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)', args: [id, userId, job.id, msg] });
                     existingNotifSet.add(cacheKey);
                     sentTodayMap[userId]++;
                     count++;
                 }
            }
        }
    }

    // Phase 2: Daily Reminders
    const istHour = istNow.getUTCHours();
    const timePrefix = istHour < 12 ? '🌅 Morning' : istHour < 17 ? '☀️ Afternoon' : '🌙 Evening';

    for (const { userId, job } of dailyReminders) {
        if (sentTodayMap[userId] >= 10) continue; // Allow up to 10 total general notifications

        // Include todayStr so the existingNotifSet (7-day window) doesn't block daily repeat
        const message = `📋 ${timePrefix} Reminder [${todayStr}]: Apply for ${job.job_name} before ${job.application_end_date}.`;
        const cacheKey = `${userId}|${job.id}|${message}`; 

        if (!existingNotifSet.has(cacheKey)) {
             const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
             updates.push({ sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)', args: [id, userId, job.id, message] });
             existingNotifSet.add(cacheKey);
             count++;
        }
    }

    // Bulk write
    for (const upd of updates) {
        await db.execute(upd);
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

// 3. STATUS CHANGE NOTIFICATION — exams going LIVE from UPCOMING/CLOSED, notify "Notify Me" users
const statusChangeNotify = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
    const authHeader = req.headers.authorization || '';
    const secret = req.query.secret || authHeader.replace('Bearer ', '');
    if (secret !== cronSecret && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const todayStr = getTodayStr();
        let count = 0;

        const freshlyLiveJobs = (await db.execute({
            sql: "SELECT id, job_name, organization, application_end_date, application_start_date FROM jobs WHERE form_status = 'LIVE'",
            args: []
        })).rows;

        if (freshlyLiveJobs.length === 0) {
            return res.json({ success: true, type: 'status-change-notify', sent: 0, message: 'No exams going live today', timestamp: getISTTimestamp() });
        }

        // For each freshly live job, find users who have it in job_reminders
        for (const job of freshlyLiveJobs) {
            const reminders = (await db.execute({
                sql: 'SELECT user_id FROM job_reminders WHERE job_id = ?',
                args: [job.id]
            })).rows;

            for (const rem of reminders) {
                const message = `🎉 Great news! ${job.job_name} (${job.organization}) is NOW LIVE! Applications have opened today. Apply before ${job.application_end_date}!`;
                const existing = await db.execute({
                    sql: 'SELECT id FROM notifications WHERE user_id = ? AND job_id = ? AND message = ?',
                    args: [rem.user_id, job.id, message]
                });
                if (existing.rows.length === 0) {
                    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                    await db.execute({
                        sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
                        args: [id, rem.user_id, job.id, message]
                    });
                    count++;
                }
            }

            // Also notify users who liked this job
            const likers = (await db.execute({
                sql: 'SELECT user_id FROM liked_jobs WHERE job_id = ?',
                args: [job.id]
            })).rows;

            for (const liker of likers) {
                const message = `🚀 ${job.job_name} you saved is now LIVE! Applications open until ${job.application_end_date}.`;
                const existing = await db.execute({
                    sql: 'SELECT id FROM notifications WHERE user_id = ? AND job_id = ? AND message = ?',
                    args: [liker.user_id, job.id, message]
                });
                if (existing.rows.length === 0) {
                    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                    await db.execute({
                        sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
                        args: [id, liker.user_id, job.id, message]
                    });
                    count++;
                }
            }
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
        const db = getDb();
        const todayStr = getTodayStr();
        const yesterdayDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
        const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
        let count = 0;

        const closingJobs = (await db.execute({
            sql: "SELECT id, job_name, organization, application_end_date FROM jobs WHERE application_end_date = ? OR application_end_date = ?",
            args: [todayStr, yesterdayStr]
        })).rows;

        if (closingJobs.length === 0) {
            return res.json({ success: true, type: 'final-close-notify', sent: 0, message: 'No exams closing today', timestamp: getISTTimestamp() });
        }

        for (const job of closingJobs) {
            const isClosingToday = job.application_end_date === todayStr;
            const closedYesterday = job.application_end_date === yesterdayStr;

            // Find users who have reminders for this job
            const reminders = (await db.execute({
                sql: 'SELECT user_id FROM job_reminders WHERE job_id = ?',
                args: [job.id]
            })).rows;

            // Also check applied users who haven't applied yet (reminded but not applied)
            const appliedUsers = new Set(
                (await db.execute({ sql: 'SELECT user_id FROM applied_jobs WHERE job_id = ?', args: [job.id] })).rows.map(r => r.user_id)
            );

            for (const rem of reminders) {
                let message;
                if (isClosingToday) {
                    message = appliedUsers.has(rem.user_id) 
                        ? `⏰ FINAL DAY! ${job.job_name} (${job.organization}) applications close TODAY. You've already applied ✅`
                        : `🚨 LAST CHANCE! ${job.job_name} (${job.organization}) applications close TODAY! Apply now before it's too late!`;
                } else if (closedYesterday) {
                    message = `🔒 Applications for ${job.job_name} (${job.organization}) have now CLOSED.`;
                }

                if (message) {
                    const existing = await db.execute({
                        sql: 'SELECT id FROM notifications WHERE user_id = ? AND job_id = ? AND message = ?',
                        args: [rem.user_id, job.id, message]
                    });
                    if (existing.rows.length === 0) {
                        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                        await db.execute({
                            sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
                            args: [id, rem.user_id, job.id, message]
                        });
                        count++;
                    }
                }
            }
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
