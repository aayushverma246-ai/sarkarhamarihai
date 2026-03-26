const { createClient } = require('@libsql/client');
require('dotenv').config();

async function debug() {
    try {
        console.log('--- DEBUG START ---');
        const client = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN
        });

        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        console.log(`Current local date: ${todayStr}`);

        const jobs = (await client.execute('SELECT id, job_name, application_start_date, application_end_date FROM jobs')).rows;
        console.log(`Analyzing ${jobs.length} jobs...`);

        const statusUpdates = jobs.map(j => {
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

        const liveCount = statusUpdates.filter(u => u.args[0] === 'LIVE').length;
        const closedCount = statusUpdates.filter(u => u.args[0] === 'CLOSED').length;
        const upcomingCount = statusUpdates.filter(u => u.args[0] === 'UPCOMING').length;
        const recentlyClosedCount = statusUpdates.filter(u => u.args[0] === 'RECENTLY_CLOSED').length;

        console.log(`Calculated Statuses:
          LIVE: ${liveCount}
          UPCOMING: ${upcomingCount}
          CLOSED: ${closedCount}
          RECENTLY_CLOSED: ${recentlyClosedCount}
        `);

        console.log('Starting batch update...');
        let totalUpdated = 0;
        for (let i = 0; i < statusUpdates.length; i += 100) {
            const batch = statusUpdates.slice(i, i + 100);
            await client.batch(batch, 'write');
            totalUpdated += batch.length;
            console.log(`  Updated ${totalUpdated}/${statusUpdates.length}...`);
        }

        console.log('Verification: checking status of Job ID 1...');
        const verifyJob = await client.execute({ sql: 'SELECT form_status FROM jobs WHERE id = ?', args: ['1'] });
        console.log(`Job ID 1 status in DB: ${verifyJob.rows[0].form_status}`);

        console.log('--- DEBUG END ---');
    } catch (e) {
        console.error('DEBUG ERROR:', e);
    } finally {
        process.exit(0);
    }
}
debug();
