require('dotenv').config({ path: './backend/.env' });
const { getDb } = require('./backend/src/db');

async function migrate() {
    const db = getDb();
    try {
        await db.execute("ALTER TABLE jobs ADD COLUMN states TEXT DEFAULT '[]'");
        console.log("States column added successfully");
    } catch (e) {
        console.log("Migration skipped or failed:", e.message);
    }
    process.exit(0);
}

migrate();
