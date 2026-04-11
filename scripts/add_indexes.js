const { getDb } = require('../backend/src/db');
require('dotenv').config();

async function run() {
    try {
        const db = getDb();
        console.log('Ensuring critical indexes exist...');
        
        await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)');
        
        console.log('Indexes added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Failed to add indexes:', err);
        process.exit(1);
    }
}

run();
