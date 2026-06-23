'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');

(async () => {
    try {
        const db = getDb();
        const userRes = await db.execute('SELECT id, email, full_name FROM users LIMIT 1');
        const user = userRes.rows[0];
        if (!user) {
            console.log('No user found');
            process.exit(0);
        }
        console.log('User:', user.full_name, 'ID:', user.id);
        const appliedRes = await db.execute({
            sql: 'SELECT * FROM applied_jobs WHERE user_id = ?',
            args: [user.id]
        });
        console.log('Applied jobs count:', appliedRes.rows.length);
        console.log('Applied jobs:', appliedRes.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
