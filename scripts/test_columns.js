'use strict';
require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

(async () => {
    try {
        await initDb();
        const db = getDb();
        console.log('Querying database columns for jobs...');
        const res = await db.execute(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'jobs'
        `);
        console.log('Columns in jobs table:');
        res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
        process.exit(0);
    } catch (e) {
        console.error('Failed to get columns:', e);
        process.exit(1);
    }
})();
