require('dotenv').config({ path: './backend/.env' });
const { getDb } = require('./backend/src/db');

async function verify() {
    const db = getDb();
    try {
        const res = await db.execute("SELECT states FROM jobs LIMIT 10");
        console.log("States sample:", JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error("Verification failed:", e.message);
    }
    process.exit(0);
}

verify();
