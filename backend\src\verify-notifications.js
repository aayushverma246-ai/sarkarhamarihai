const { getDb } = require('./db');
const { createClient } = require('@libsql/client');
require('dotenv').config();

async function verify() {
    try {
        const db = getDb();
        console.log('--- Verification Start ---');

        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];
        console.log(`Current simulated date: ${todayDate}`);

        // 1. Find a job closing on 2026-02-27
        const targetDate = '2026-02-27';
        const jobRow = await db.execute({
            sql: "SELECT id, job_name FROM jobs WHERE application_end_date = ? LIMIT 1",
            args: [targetDate]
        });

        if (jobRow.rows.length === 0) {
            console.error('No job found closing on:', targetDate);
        } else {
            const job = jobRow.rows[0];
            console.log(`Found deadline job: ${job.job_name} (ID: ${job.id})`);

            // 2. Find or create a test user
            const testUserId = 'test-user-123';
            await db.execute({
                sql: "INSERT OR IGNORE INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)",
                args: [testUserId, 'test@example.com', 'hash', 'Test User']
            });
            console.log('Ensured test user exists.');

            // 3. Like the job
            await db.execute({
                sql: "INSERT OR IGNORE INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?)",
                args: ['like-' + Date.now(), testUserId, job.id]
            });
            console.log('Job liked by test user.');

            // 4. Trigger cron logic (simulated)
            console.log('Triggering cron-check-live logic...');
            const cronHandler = require('../../api/cron-check-live');
            const mockReq = { headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'sarkar_cron_key_v1'}` }, query: {} };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log(`Cron Response (${code}):`, JSON.stringify(data)) })
            };
            await cronHandler(mockReq, mockRes);

            // 5. Check if notification was created
            const notifRow = await db.execute({
                sql: "SELECT * FROM notifications WHERE user_id = ? AND job_id = ? AND message LIKE '%closes on%' ORDER BY created_at DESC LIMIT 1",
                args: [testUserId, job.id]
            });

            if (notifRow.rows.length > 0) {
                console.log('SUCCESS: Deadline notification found!');
                console.log('Message:', notifRow.rows[0].message);
            } else {
                console.error('FAILURE: No deadline notification found.');
            }
        }

        // 6. Test LIVE notification
        console.log('\n--- Testing LIVE Notification ---');
        // Find a job that is LIVE today
        const liveJobRow = await db.execute({
            sql: "SELECT id, job_name FROM jobs WHERE application_start_date <= ? AND application_end_date >= ? LIMIT 1",
            args: [todayDate, todayDate]
        });

        if (liveJobRow.rows.length > 0) {
            const liveJob = liveJobRow.rows[0];
            const testUserId = 'test-user-123';
            console.log(`Found live job: ${liveJob.job_name} (ID: ${liveJob.id})`);

            await db.execute({
                sql: "INSERT OR IGNORE INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?)",
                args: ['like-live-' + Date.now(), testUserId, liveJob.id]
            });
            console.log('Live job liked by test user.');

            const cronHandler = require('../../api/cron-check-live');
            const mockReq = { headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'sarkar_cron_key_v1'}` }, query: {} };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log(`Cron Response (${code}):`, JSON.stringify(data)) })
            };
            await cronHandler(mockReq, mockRes);

            const liveNotifRow = await db.execute({
                sql: "SELECT * FROM notifications WHERE user_id = ? AND job_id = ? AND message LIKE '🚀%' ORDER BY created_at DESC LIMIT 1",
                args: [testUserId, liveJob.id]
            });

            if (liveNotifRow.rows.length > 0) {
                console.log('SUCCESS: LIVE notification found!');
                console.log('Message:', liveNotifRow.rows[0].message);
            } else {
                console.error('FAILURE: No LIVE notification found.');
            }
        } else {
            console.error('No live jobs found for today.');
        }

        console.log('--- Verification End ---');
    } catch (e) {
        console.error('Verification error:', e);
    } finally {
        process.exit(0);
    }
}

verify();
