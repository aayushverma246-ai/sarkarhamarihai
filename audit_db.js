require('dotenv').config({ path: './backend/.env' });
const { getDb } = require('./backend/src/db');

async function audit() {
    try {
        const db = getDb();
        
        // Check schema
        console.log("--- TABLE INFO ---");
        const columns = await db.execute("PRAGMA table_info(jobs)");
        console.log(JSON.stringify(columns.rows, null, 2));

        // Check distinct states
        console.log("\n--- DISTINCT STATES ---");
        const distinct = await db.execute("SELECT DISTINCT state FROM jobs");
        console.log(JSON.stringify(distinct.rows, null, 2));

        // Check for any potential hidden multi-state data in job_name or organization
        console.log("\n--- MULTI-STATE SAMPLES ---");
        const multi = await db.execute("SELECT job_name, state FROM jobs WHERE job_name LIKE '%,%' LIMIT 10");
        console.log(JSON.stringify(multi.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

audit();
