require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
    try {
        await initDb();
        const db = getDb();
        
        console.log("--- Querying Seed Metadata ---");
        const metaRes = await db.execute("SELECT * FROM seed_meta");
        console.log("Seed Meta Rows:", metaRes.rows);

        console.log("\n--- Querying Count by Category ---");
        const catRes = await db.execute("SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC");
        catRes.rows.forEach(r => {
            console.log(`- Category: "${r.job_category}" | Count: ${r.cnt}`);
        });

        console.log("\n--- Querying Count by Form Status ---");
        const statusRes = await db.execute("SELECT form_status, COUNT(*) as cnt FROM jobs GROUP BY form_status ORDER BY cnt DESC");
        statusRes.rows.forEach(r => {
            console.log(`- Status: "${r.form_status}" | Count: ${r.cnt}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
