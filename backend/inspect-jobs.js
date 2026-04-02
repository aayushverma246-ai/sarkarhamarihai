require('dotenv').config();
const { createClient } = require('@libsql/client');

async function inspect() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        const res = await client.execute(`PRAGMA table_info(jobs)`);
        console.log("=== JOBS SCHEMA ===");
        res.rows.forEach(r => console.log(`${r.name} (${r.type})`));
        console.log("===================");
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

inspect();
