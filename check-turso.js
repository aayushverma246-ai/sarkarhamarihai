const { createClient } = require('@libsql/client');
require('dotenv').config({ path: './backend/.env' });

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function check() {
    try {
        console.log("URL:", process.env.TURSO_DATABASE_URL);
        const res = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        console.log("Turso Job Count:", res.rows[0].cnt);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}
check();
