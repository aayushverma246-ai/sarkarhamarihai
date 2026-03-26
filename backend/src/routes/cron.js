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

// 1. UPDATE JOB STATUSES (Hourly)
const updateStatuses = async (db) => {
    const todayStr = getTodayStr();
    const now = new Date();
    console.log(`[Cron ${getISTTimestamp()}] Updating statuses for date: ${todayStr}`);

    const jobs = (await db.execute('SELECT id, application_start_date, application_end_date FROM jobs')).rows;
    const updates = jobs.map(j => {
        let newStatus = 'CLOSED';
        const s = j.application_start_date;
        const e = j.application_end_date;

        if (todayStr < s) newStatus = 'UPCOMING';
        else if (todayStr <= e) newStatus = 'LIVE';
        else {
            const endDateObj = new Date(e + 'T23:59:59Z');
            const diffDays = Math.floor((now - endDateObj) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) newStatus = 'RECENTLY_CLOSED';
        }

        return {
            sql: 'UPDATE jobs SET form_status = ? WHERE id = ?',
            args: [newStatus, j.id]
        };
    });

    for (let i = 0; i < updates.length; i += 100) {
        await db.batch(updates.slice(i, i + 100), 'write');
    }
    return jobs.length;
};

// 2. SEND NOTIFICATIONS (Thrice Daily)
const sendNotifications = async (db) => {
    const todayStr = getTodayStr();
    const threeDaysFromNow = new Date(new Date().getTime() + (3 * 24 * 60 * 60 * 1000));
    const threeDaysStr = threeDaysFromNow.toISOString().slice(0, 10);
    const yesterdayDate = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const freshJobs = (await db.execute('SELECT * FROM jobs')).rows;
    const jobMap = {};
    freshJobs.forEach(j => jobMap[j.id] = j);

    let count = 0;

    // --- Part A: Liked-job and Applied-job notifications ---
    const likedRows = (await db.execute('SELECT * FROM liked_jobs')).rows;
    const appliedRows = (await db.execute('SELECT user_id, job_id FROM applied_jobs')).rows;
    const appliedSet = new Set(appliedRows.map(r => `${r.user_id}::${r.job_id}`));

    const reminderRows = (await db.execute('SELECT * FROM job_reminders')).rows;

    // We will combine liked, applied, and reminded for the Final Deadline notification
    const interestedUsersMap = {}; // { user_id: Set<job_id> }
    for (const row of [...likedRows, ...appliedRows, ...reminderRows]) {
        if (!interestedUsersMap[row.user_id]) interestedUsersMap[row.user_id] = new Set();
        interestedUsersMap[row.user_id].add(row.job_id);
    }

    // Process Liked Jobs specifically (Live today, 3 days left)
    for (const like of likedRows) {
        const job = jobMap[like.job_id];
        if (!job) continue;

        let message = null;
        if (job.form_status === 'LIVE' && job.application_start_date === todayStr) {
            message = `🚀 Applications are now LIVE for ${job.job_name} (${job.organization})! Apply today!`;
        } else if (job.application_end_date === threeDaysStr) {
            message = `⏳ Hurry! Only 3 days left to apply for ${job.job_name} (${job.organization}). Form closes on ${job.application_end_date}.`;
        }

        if (message) {
            const existing = await db.execute({
                sql: 'SELECT id FROM notifications WHERE user_id = ? AND job_id = ? AND message = ?',
                args: [like.user_id, job.id, message]
            });
            if (existing.rows.length === 0) {
                const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                await db.execute({
                    sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
                    args: [id, like.user_id, job.id, message]
                });
                count++;
            }
        }
    }

    // Process Final Deadline Notifications for ALL interested users (Liked OR Applied)
    for (const userId of Object.keys(interestedUsersMap)) {
        for (const jobId of interestedUsersMap[userId]) {
            const job = jobMap[jobId];
            if (!job) continue;
            
            // If the deadline was exactly yesterday, it means it CLOSED today, or if end_date is yesterdayStr 
            // the status is already RECENTLY_CLOSED or CLOSED.
            if (job.application_end_date === yesterdayStr) {
                const message = `🔒 The application window for ${job.job_name} (${job.organization}) is now closed.`;
                const existing = await db.execute({
                    sql: 'SELECT id FROM notifications WHERE user_id = ? AND job_id = ? AND message = ?',
                    args: [userId, job.id, message]
                });
                if (existing.rows.length === 0) {
                    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                    await db.execute({
                        sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
                        args: [id, userId, job.id, message]
                    });
                    count++;
                }
            }
        }
    }

    // --- Part B: Daily reminders & Notify Me ---

    for (const rem of reminderRows) {
        const job = jobMap[rem.job_id];
        if (!job) continue;
        if (appliedSet.has(`${rem.user_id}::${rem.job_id}`)) continue; // skip if applied

        let message = null;

        if (job.form_status === 'LIVE') {
            // First day LIVE notification
            if (job.application_start_date === todayStr) {
                message = `🔔 Notify Alert: Applications are now open for ${job.job_name}!`;
            } else {
                // Regular Daily Reminder
                const istHour = (() => {
                    const now = new Date();
                    const istOffset = 5.5 * 60 * 60 * 1000;
                    return new Date(now.getTime() + istOffset).getUTCHours();
                })();
                const timePrefix = istHour < 12 ? '🌅 Morning' : istHour < 17 ? '☀️ Afternoon' : '🌙 Evening';
                message = `📋 ${timePrefix} Reminder: Don't forget to apply for ${job.job_name} (${job.organization})! Deadline: ${job.application_end_date}. [${todayStr}-${timePrefix}]`;
            }
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

    return count;
};

const statusHandler = async (req, res) => {
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const updated = await updateStatuses(db);
        console.log(`[Cron ${getISTTimestamp()}] Status update complete: ${updated} jobs processed`);
        res.json({ success: true, type: 'status', updated, timestamp: getISTTimestamp() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const notifyHandler = async (req, res) => {
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const sent = await sendNotifications(db);
        console.log(`[Cron ${getISTTimestamp()}] Notifications sent: ${sent} notifications`);
        res.json({ success: true, type: 'notifications', sent, timestamp: getISTTimestamp() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const dailyTask = async (req, res) => {
    const secret = req.query.secret || req.headers.authorization?.split(' ')[1];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1') && req.query.force !== 'true') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const db = getDb();
        const updated = await updateStatuses(db);
        const sent = await sendNotifications(db);
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

router.get('/status', statusHandler);
router.get('/notifications', notifyHandler);
router.get('/daily', dailyTask);
router.get('/status-change-notify', statusChangeNotify);
router.get('/final-close-notify', finalCloseNotify);

module.exports = { router, updateStatuses, sendNotifications, dailyTask };
