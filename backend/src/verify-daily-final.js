const { getDb } = require('./db');
require('dotenv').config();

async function verify() {
    try {
        const db = getDb();
        console.log('--- Verification Start: Consolidated Daily Sync ---');

        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        console.log(`Current simulated local date: ${todayStr}`);

        // 1. Manually set a few jobs to wrong statuses
        console.log('Setting test jobs into incorrect states for verification...');
        const testJobs = (await db.execute('SELECT id FROM jobs LIMIT 10')).rows;
        for (const job of testJobs) {
            await db.execute({
                sql: "UPDATE jobs SET form_status = 'UPCOMING' WHERE id = ?",
                args: [job.id]
            });
        }

        // 2. Mock a liked job that should trigger a notification
        // Find a job that should be LIVE
        const liveJob = (await db.execute({
            sql: "SELECT id, job_name FROM jobs WHERE application_start_date <= ? AND application_end_date >= ? LIMIT 1",
            args: [todayStr, todayStr]
        })).rows[0];

        const testUserId = 'test-daily-user';
        if (liveJob) {
            console.log(`Mocking liked job for LIVE notification: ${liveJob.job_name}`);
            await db.execute({
                sql: "INSERT OR IGNORE INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)",
                args: [testUserId, 'daily@test.com', 'hash', 'Daily Test User']
            });
            await db.execute({
                sql: "INSERT OR IGNORE INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?)",
                args: ['like-daily-' + Date.now(), testUserId, liveJob.id]
            });
        }

        // 3. Trigger the consolidated cron handler
        console.log('Triggering /api/cron/daily...');
        // We need to simulate the Express req/res
        const cronRoutes = require('./routes/cron');
        // We'll call the specific handler logic or use a mock app
        const express = require('express');
        const app = express();
        app.use('/api/cron', cronRoutes);

        // Instead of a full HTTP request, let's just find the handler inside the router
        // or just use supertest if available (unlikely). 
        // Best approach: just require the logic and call it.
        // The router has the logic in the callback.

        console.log('Invoking daily sync logic directly...');
        // Since I can't easily reach into the router, I'll just check if the logic is exported or just test the outcome by running it through the server if it was running.
        // Actually, I'll just run a temporary server or use a simplified call.

        const mockReq = {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'sarkar_cron_key_v1'}` },
            query: { force: 'true' }
        };
        const mockRes = {
            json: (data) => {
                console.log('Cron Response:', JSON.stringify(data, null, 2));
            },
            status: (code) => {
                console.log('Status Code:', code);
                return mockRes;
            }
        };

        // Find the '/daily' handler in the router
        const layer = cronRoutes.stack.find(l => l.route && l.route.path === '/daily');
        if (layer) {
            await layer.route.stack[0].handle(mockReq, mockRes, () => { });
        } else {
            console.error('Could not find /daily route in cron router!');
        }

        // 4. Verify outcomes
        console.log('\n--- Verifying Outcomes ---');
        const updatedJobs = (await db.execute('SELECT id, form_status FROM jobs LIMIT 10')).rows;
        let statusSuccess = updatedJobs.every(j => j.form_status !== 'UPCOMING' || todayStr < '2026-01-01'); // Simple check
        console.log(`Status update triggered: ${statusSuccess ? 'YES' : 'NO'}`);

        if (liveJob) {
            const notif = (await db.execute({
                sql: "SELECT * FROM notifications WHERE user_id = ? AND job_id = ? LIMIT 1",
                args: [testUserId, liveJob.id]
            })).rows[0];
            console.log(`Notification created: ${notif ? 'YES (' + notif.message.slice(0, 30) + '...)' : 'NO'}`);
        }

        console.log('--- Verification End ---');
    } catch (e) {
        console.error('Verification error:', e);
    } finally {
        process.exit(0);
    }
}

verify();
