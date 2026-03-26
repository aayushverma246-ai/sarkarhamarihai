const { getDb } = require('./backend/src/db');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env' });

async function checkNotifications() {
    try {
        const db = getDb();
        
        // Check last 20 notifications
        const notifications = (await db.execute('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20')).rows;
        let output = '--- Recent Notifications ---\n';
        output += JSON.stringify(notifications, null, 2) + '\n';
        
        const counts = {};
        notifications.forEach(n => {
            const msg = n.message || '';
            let type = 'Other';
            if (msg.includes('now LIVE')) type = 'Live Alert';
            else if (msg.includes('3 days left')) type = 'Deadline Reminder';
            else if (msg.includes('now closed')) type = 'Close Alert';
            else if (msg.includes('You saved:')) type = 'Save Confirmation';
            
            counts[type] = (counts[type] || 0) + 1;
        });
        output += '--- Notification Types (Recent 20) ---\n';
        output += JSON.stringify(counts, null, 2) + '\n';

        fs.writeFileSync('notif_results.txt', output);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('notif_results.txt', 'Error: ' + e.message + '\n' + e.stack);
        process.exit(1);
    }
}

checkNotifications();
