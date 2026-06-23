require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
    try {
        await initDb();
        const db = getDb();
        
        console.log("--- Querying jobs containing 'Civil Services' ---");
        const res = await db.execute("SELECT id, job_name, organization FROM jobs WHERE job_name LIKE '%Civil Services%'");
        console.log(`Results found: ${res.rows.length}`);
        res.rows.forEach(r => {
            console.log(`- ID: ${r.id} | Name: "${r.job_name}" | Org: "${r.organization}"`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
