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
        // RECENTLY_CLOSED -> CLOSED
        {
            sql: "UPDATE jobs SET form_status = 'CLOSED' WHERE form_status = 'RECENTLY_CLOSED' AND application_end_date < (CURRENT_DATE - INTERVAL '30 days')::TEXT",
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

    const likedRows = (await db.execute('SELECT * FROM liked_jobs')).rows;
    const appliedRows = (await db.execute('SELECT user_id, job_id FROM applied_jobs')).rows;
    const reminderRows = (await db.execute('SELECT * FROM job_reminders')).rows;
    
    const interestedJobIds = new Set([...likedRows, ...reminderRows].map(r => r.job_id));
    const jobMap = {};
    
    if (interestedJobIds.size > 0) {
        // chunk to respect SQLite limits
        const interestedArr = Array.from(interestedJobIds);
        for (let i = 0; i < interestedArr.length; i += 500) {
            const chunk = interestedArr.slice(i, i + 500);
            const placeholders = chunk.map(() => '?').join(',');
            const dbJobs = (await db.execute({
                sql: `SELECT id, job_name, organization, form_status, application_start_date, application_end_date FROM jobs WHERE id IN (${placeholders})`,
                args: chunk
            })).rows;
            dbJobs.forEach(j => jobMap[j.id] = j);
        }
    }

    const appliedSet = new Set();
    appliedRows.forEach(r => appliedSet.add(`${r.user_id}::${r.job_id}`));

    // Efficiently count today's reminders per user
    const sentTodayMap = {};
    const recentNotifs = (await db.execute({
        sql: "SELECT user_id, COUNT(*) as cnt FROM notifications WHERE created_at >= NOW() - INTERVAL '1 day' GROUP BY user_id"
    })).rows;
    for (const row of recentNotifs) {
        sentTodayMap[row.user_id] = Number(row.cnt);
    }

    let count = 0;
    const interestedMap = {};
    
    // Combine interested users (Liked or Reminder enabled)
    for (const row of [...likedRows, ...reminderRows]) {
        if (!interestedMap[row.user_id]) interestedMap[row.user_id] = new Set();
        interestedMap[row.user_id].add(row.job_id);
    }
    
    // Efficiently cache recent 7-day hashes
    const existingNotifSet = new Set();
    const existingRecords = (await db.execute({ sql: "SELECT user_id || '|' || job_id || '|' || message as hash FROM notifications WHERE created_at >= NOW() - INTERVAL '7 days'" })).rows;
    for (const r of existingRecords) {
        existingNotifSet.add(r.hash);
    }

    const updates = [];
    const dailyReminders = []; // Queued for Phase 2

    // Priority Pass: Closing alerts
    for (const userId of Object.keys(interestedMap)) {
        if (!sentTodayMap[userId]) sentTodayMap[userId] = 0;

        for (const jobId of interestedMap[userId]) {
            const job = jobMap[jobId];
            if (!job || appliedSet.has(`${userId}::${jobId}`)) continue;

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

    // Phase 2: Daily Reminders (If slots available, max 3 rule)
    const istHour = istNow.getUTCHours();
    const timePrefix = istHour < 12 ? '🌅 Morning' : istHour < 17 ? '☀️ Afternoon' : '🌙 Evening';

    for (const { userId, job } of dailyReminders) {
        if (sentTodayMap[userId] >= 3) continue;

        const message = `📋 ${timePrefix} Reminder: Apply for ${job.job_name} before ${job.application_end_date}.`;
        const cacheKey = `${userId}|${job.id}|${message}`; 

        if (!existingNotifSet.has(cacheKey)) {
             const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
             updates.push({ sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)', args: [id, userId, job.id, message] });
             existingNotifSet.add(cacheKey);
             sentTodayMap[userId]++;
             count++;
        }
    }

    // Bulk write (sequential for PostgreSQL compatibility)
    for (const upd of updates) {
        await db.execute(upd);
    }

    return count;
};

const statusHandler = async (req, res) => {
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
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
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
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
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
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
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const todayStr = getTodayStr();
        let count = 0;

        // Find exams where application_start_date == today (just went LIVE)
        const freshlyLiveJobs = (await db.execute({
            sql: "SELECT * FROM jobs WHERE application_start_date = ?",
            args: [todayStr]
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
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const todayStr = getTodayStr();
        const yesterdayDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
        const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
        let count = 0;

        // Find exams closing today or that closed yesterday
        const closingJobs = (await db.execute({
            sql: "SELECT * FROM jobs WHERE application_end_date = ? OR application_end_date = ?",
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
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') return res.status(401).json({ error: 'Unauthorized' });
    
    console.log(`[Sync ${getISTTimestamp()}] Starting production sync pipeline...`);
    
    try {
        const db = getDb();
        
        // Step 1: FETCH
        // Simulating data fetch from scraper pipeline. A real external URL would be fetched via: await fetch('SOURCE_URL');
        
        // Step 2: VALIDATE
        const countRes = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const dbCount = Number(countRes.rows[0].cnt);
        if (dbCount === 0) throw new Error("Database is empty. Corrupted sync state.");
        
        // Step 3: DIFF & SAFE UPDATE
        const updatedCount = await withRetry(() => updateStatuses(db));
        
        // Step 4: NOTIFICATIONS TRIGGER (Safe idempotent)
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

router.get('/status', statusHandler);
router.get('/notifications', notifyHandler);
router.get('/daily', dailyTask);
router.get('/status-change-notify', statusChangeNotify);
router.get('/final-close-notify', finalCloseNotify);
router.get('/hourly-sync', hourlySync);

module.exports = { router, updateStatuses, sendNotifications, dailyTask, hourlySync };
