const { initDb } = require('./src/db');
require('dotenv').config();

async function run() {
    console.log('Starting DB migration...');
    try {
        await initDb();
        console.log('DB migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('DB migration failed:', err);
        process.exit(1);
    }
}

run();
