require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
    try {
        await initDb();
        const db = getDb();
        
        console.log("--- Querying UPSC Exams in Database ---");
        const res = await db.execute("SELECT id, job_name, qualification_required, form_status, job_category FROM jobs WHERE job_name LIKE '%UPSC%' OR organization LIKE '%Union Public Service%'");
        console.log(`Total UPSC exams found: ${res.rows.length}`);
        res.rows.forEach(r => {
            console.log(`- ID: ${r.id} | Name: "${r.job_name}" | Qual: "${r.qualification_required}" | Status: "${r.form_status}" | Cat: "${r.job_category}"`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
