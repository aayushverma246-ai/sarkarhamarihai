'use strict';
require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
    await initDb();
    const db = getDb();
    console.log("--- STARTING STATE CIVIL SERVICES RECLASSIFICATION ---");

    // 1. Reclassify all state civil services jobs that are currently tagged as UPSC
    // We target rows where job_category = 'UPSC' but organization is NOT 'UPSC' and name does NOT start with 'UPSC'
    console.log("Reclassifying State PSC jobs currently tagged as UPSC...");
    const updateRes = await db.execute({
        sql: `UPDATE jobs 
              SET job_category = 'State PSCs', 
                  last_verified_at = NOW() 
              WHERE job_category = 'UPSC' 
                AND organization != 'UPSC' 
                AND organization != 'Union Public Service Commission'
                AND NOT (job_name LIKE 'UPSC %')`
    });

    console.log(`Successfully reclassified ${updateRes.rowsAffected || 0} jobs to 'State PSCs'.`);

    // 2. Query counts to verify
    console.log("\nVerifying remaining UPSC jobs...");
    const upscRes = await db.execute("SELECT id, job_name, organization, job_category FROM jobs WHERE job_category = 'UPSC'");
    console.log(`Found ${upscRes.rows.length} jobs remaining in UPSC category:`);
    upscRes.rows.forEach(r => {
        console.log(`- ID: ${r.id} | Name: "${r.job_name}" | Org: "${r.organization}"`);
    });

    if (upscRes.rows.length === 19) {
        console.log("\n🟢 SUCCESS: Exactly 19 verified UPSC exams remain in the UPSC category!");
    } else {
        console.warn(`\n⚠️ WARNING: Found ${upscRes.rows.length} UPSC exams (expected 19).`);
    }

    process.exit(0);
}

run().catch(err => {
    console.error("Reclassification failed:", err);
    process.exit(1);
});
