const { createClient } = require('@libsql/client');
const path = require('path');

async function check() {
    const dbPath = path.resolve('backend/data/sarkar.db').replace(/\\/g, '/');
    const db = createClient({ url: 'file:' + dbPath });
    try {
        const res = await db.execute('SELECT count(*) as count FROM jobs WHERE structured_syllabus_json IS NOT NULL AND structured_syllabus_json != ""');
        console.log('Ready rows:', res.rows[0].count);
        
        const res2 = await db.execute('SELECT count(*) as count FROM jobs');
        console.log('Total rows:', res2.rows[0].count);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
