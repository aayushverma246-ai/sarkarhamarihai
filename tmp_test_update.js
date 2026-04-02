const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
    try {
        console.log('Testing single executed write on ID=1...');
        const r1 = await db.execute("UPDATE jobs SET job_category = 'Others' WHERE id = 1");
        console.log('Write 1 SUCCESS:', r1.rowsAffected);

        console.log('Testing batch of 5 writes...');
        const r2 = await db.batch([
            "UPDATE jobs SET job_category = 'Others' WHERE id = 1",
            "UPDATE jobs SET job_category = 'Others' WHERE id = 2",
            "UPDATE jobs SET job_category = 'Others' WHERE id = 3",
            "UPDATE jobs SET job_category = 'Others' WHERE id = 4",
            "UPDATE jobs SET job_category = 'Others' WHERE id = 5",
        ], 'write');
        console.log('Batch SUCCESS:', r2.map(r => r.rowsAffected));
    } catch (e) {
        console.error('FAIL:', e.message);
    }
}
main();
