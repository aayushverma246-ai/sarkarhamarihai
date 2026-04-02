const { initDb, getDb } = require('./src/db');

async function cleanup() {
    await initDb();
    const db = getDb();
    
    // Delete Test Exam
    await db.execute("DELETE FROM jobs WHERE job_name LIKE '%Multi-State Test Exam%' OR job_category = 'Test'");

    // Delete simulated District data
    await db.execute("DELETE FROM jobs WHERE job_name LIKE '%District 1 %' OR job_name LIKE '%District 2 %' OR job_name LIKE '%District 3 %' OR job_name LIKE '%District 4 %' OR job_name LIKE '%District 5 %' OR job_name LIKE '%District 6 %' OR job_name LIKE '%District 7 %' OR job_name LIKE '%District 8 %' OR job_name LIKE '%District 9 %' OR job_name LIKE '%District 10 %' OR job_name LIKE '%District 11 %' OR job_name LIKE '%District 12 %' OR job_name LIKE '%District 13 %' OR job_name LIKE '%District 14 %' OR job_name LIKE '%District 15 %' OR job_name LIKE '%District 16 %' OR job_name LIKE '%District 17 %' OR job_name LIKE '%District 18 %' OR job_name LIKE '%District 19 %' OR job_name LIKE '%District 20 %' OR job_name LIKE '%District 21 %' OR job_name LIKE '%District 22 %'");

    console.log("Cleanup complete");
    process.exit(0);
}

cleanup().catch(e => { console.error(e); process.exit(1); });
