'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');

(async () => {
    try {
        const db = getDb();
        console.log('Querying database columns for ai_recommendations...');
        const res = await db.execute(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ai_recommendations'
        `);
        console.log('Columns:');
        res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
        process.exit(0);
    } catch (e) {
        console.error('Failed to get columns:', e);
        process.exit(1);
    }
})();
