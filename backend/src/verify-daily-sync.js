const { getDb } = require('./db');
require('dotenv').config();

async function verify() {
    try {
        const db = getDb();
        console.log('--- Verification Start: Daily Sync ---');

        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        console.log(`Current simulated local date: ${todayStr}`);

        // 1. Manually set a few jobs to wrong statuses to see if they get fixed
        console.log('Setting test jobs to incorrect statuses...');
        const testJobs = (await db.execute('SELECT id, application_start_date, application_end_date FROM jobs LIMIT 10')).rows;
        for (const job of testJobs) {
            await db.execute({
                sql: "UPDATE jobs SET form_status = 'UPCOMING' WHERE id = ?",
                args: [job.id]
            });
        }

        // 2. Trigger cron logic
        console.log('Triggering daily automation (cron-check-live)...');
        const cronHandler = require('../../api/cron-check-live');
        const mockReq = { headers: { authorization: `Bearer ${process.env.CRON_SECRET || 'sarkar_cron_key_v1'}` }, query: {} };
        const mockRes = {
            status: (code) => ({ json: (data) => console.log(`Cron Response (${code}):`, JSON.stringify(data)) })
        };
        await cronHandler(mockReq, mockRes);

        // 3. Verify statuses
        console.log('Checking if statuses were updated correctly...');
        const updatedJobs = (await db.execute('SELECT id, job_name, application_start_date, application_end_date, form_status FROM jobs LIMIT 10')).rows;
        let successCount = 0;
        for (const job of updatedJobs) {
            let expected = 'CLOSED';
            const s = job.application_start_date;
            const e = job.application_end_date;

            if (todayStr < s) expected = 'UPCOMING';
            else if (todayStr <= e) expected = 'LIVE';
            else {
                const endDateObj = new Date(e + 'T23:59:59Z');
                const diffDays = Math.floor((now - endDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) expected = 'RECENTLY_CLOSED';
            }

            if (job.form_status === expected) {
                successCount++;
                console.log(`[OK] ${job.job_name.slice(0, 20)}...: ${job.form_status}`);
            } else {
                console.log(`[MISMATCH] ${job.job_name.slice(0, 20)}...: Expected ${expected}, got ${job.form_status} (Dates: ${s} to ${e})`);
            }
        }

        console.log(`\nFinal Score: ${successCount}/10 matches.`);
        if (successCount === 10) {
            console.log('SUCCESS: Daily status automation is working!');
        } else {
            console.error('FAILURE: Status automation failed for some jobs.');
        }

        console.log('--- Verification End ---');
    } catch (e) {
        console.error('Verification error:', e);
    } finally {
        process.exit(0);
    }
}

verify();
