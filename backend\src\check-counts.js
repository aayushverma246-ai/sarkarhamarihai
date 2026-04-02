const { getDb } = require('./db');
require('dotenv').config();

async function run() {
    try {
        const db = getDb();
        const counts = await db.execute('SELECT form_status, COUNT(*) as count FROM jobs GROUP BY form_status');
        console.log('--- Status Counts ---');
        console.log(JSON.stringify(counts.rows, null, 2));

        const likedCount = await db.execute('SELECT COUNT(*) as count FROM liked_jobs');
        console.log('Liked Jobs Count:', likedCount.rows[0].count);

        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        console.log(`Current local todayStr: ${todayStr}`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
