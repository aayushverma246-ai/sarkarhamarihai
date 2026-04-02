require('dotenv').config({ path: __dirname + '/backend/.env' });
const { createClient } = require('@libsql/client/http');

async function recoverData() {
    console.log("Starting DB Forensic Recovery...");

    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    const usersRes = await db.execute("SELECT id FROM users");
    const users = usersRes.rows.map(r => r.id);

    const jobsRes = await db.execute("SELECT id, job_name FROM jobs");
    const jobs = jobsRes.rows;

    const notifRes = await db.execute("SELECT id, user_id, message FROM notifications");
    const notifications = notifRes.rows;

    let recoveredApplied = 0;
    let recoveredLiked = 0;

    for (const notif of notifications) {
        const msg = notif.message || "";
        const userId = notif.user_id;

        // Find the matching job_name in the message
        let matchedJob = null;
        for (const job of jobs) {
            if (msg.includes(job.job_name)) {
                matchedJob = job;
                break;
            }
        }

        if (!matchedJob) continue;

        const jobId = matchedJob.id;

        // Reconstruct applied_jobs
        if (msg.toLowerCase().includes('applied')) {
            try {
                await db.execute({
                    sql: "INSERT INTO applied_jobs (id, user_id, job_id) VALUES (lower(hex(randomblob(16))), ?, ?)",
                    args: [userId, jobId]
                });
                recoveredApplied++;
                console.log(`Recovered APPLIED: ${matchedJob.job_name} for user ${userId}`);
            } catch (err) { } // Ignore UNIQUE constraint errors if already recovered
        }

        // Reconstruct liked_jobs (assume any study plan or general intent means it was liked/saved)
        try {
            await db.execute({
                sql: "INSERT INTO liked_jobs (id, user_id, job_id) VALUES (lower(hex(randomblob(16))), ?, ?)",
                args: [userId, jobId]
            });
            recoveredLiked++;
        } catch (err) { } // Ignore UNIQUE constraint errors
    }

    console.log(`\nRecovery Complete!`);
    console.log(`Restored Applied Jobs: ${recoveredApplied}`);
    console.log(`Restored Saved Jobs: ${recoveredLiked}`);
}

recoverData().catch(console.error);
