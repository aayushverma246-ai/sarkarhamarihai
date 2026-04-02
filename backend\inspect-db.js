require('dotenv').config();
const { createClient } = require('@libsql/client');
const fs = require('fs');

async function inspect() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        const out = {};
        const tables = ['roadmaps', 'notifications'];
        for (const table of tables) {
            const res = await client.execute(`PRAGMA table_info(${table})`);
            out[table] = res.rows;
        }
        fs.writeFileSync('db-schema.json', JSON.stringify(out, null, 2));
        console.log('DONE');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

inspect();
