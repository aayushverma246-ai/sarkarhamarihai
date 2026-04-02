require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@libsql/client');

async function migrate() {
    console.log("Connecting to Turso: " + process.env.TURSO_DATABASE_URL);
    const client = createClient({ 
        url: process.env.TURSO_DATABASE_URL, 
        authToken: process.env.TURSO_AUTH_TOKEN 
    });
    try {
        await client.execute("ALTER TABLE jobs ADD COLUMN states TEXT DEFAULT '[]'");
        console.log("Production: States column added successfully");
    } catch (e) {
        console.log("Production: Migration skipped or failed:", e.message);
    }
    process.exit(0);
}

migrate();
