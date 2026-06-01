const { getDb } = require('../db');
const axios = require('axios');

/**
 * Sends FCM push notification to all registered devices of a user.
 * Fails gracefully if the user_devices table is not migrated yet.
 */
async function sendPushNotification(userId, title, body, data = {}) {
    const db = getDb();
    try {
        // Query active device tokens for the user
        const result = await db.execute({
            sql: 'SELECT device_token, device_type FROM user_devices WHERE user_id = ?',
            args: [userId]
        });

        const devices = result.rows || [];
        if (devices.length === 0) {
            console.log(`[Push Service] No registered devices for user ${userId}.`);
            return;
        }

        const fcmServerKey = process.env.FCM_SERVER_KEY;

        console.log(`[Push Service] Found ${devices.length} registered devices for user ${userId}. Sending pushes...`);

        const pushPromises = devices.map(async (device) => {
            const token = device.device_token;
            console.log(`[Push Service] [Pending] Push to ${device.device_type} token: ${token.substring(0, 10)}... | Msg: "${body}"`);

            if (!fcmServerKey) {
                // Graceful development logger:
                console.warn(`[Push Service] FCM_SERVER_KEY not configured. Skipping active push delivery but mock logged successfully.`);
                return;
            }

            try {
                // Post to legacy FCM API endpoint
                const res = await axios.post('https://fcm.googleapis.com/fcm/send', {
                    to: token,
                    notification: {
                        title,
                        body,
                        sound: 'default'
                    },
                    data: {
                        ...data,
                        title,
                        body
                    }
                }, {
                    headers: {
                        'Authorization': `key=${fcmServerKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                console.log(`[Push Service] FCM success response:`, res.data);
            } catch (err) {
                console.error(`[Push Service] FCM error for token ${token.substring(0, 10)}... :`, err.message);
            }
        });

        await Promise.all(pushPromises);

    } catch (err) {
        // Safe database fallback
        if (err.message?.includes('does not exist') || err.message?.includes('no such table')) {
            console.warn('[Push Service] user_devices table is missing in database. Skipping native push notifications.');
            console.warn('[Push Service] Execute this DDL in Supabase SQL Editor:');
            console.warn(`
              CREATE TABLE IF NOT EXISTS user_devices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                device_token TEXT NOT NULL UNIQUE,
                device_type TEXT NOT NULL DEFAULT 'android',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
            `);
            return;
        }
        console.error('[Push Service] Error in sendPushNotification:', err);
    }
}

/**
 * Sends a push notification to multiple users.
 * Expects an array of objects: { userId, title, body, data }
 */
async function sendBulkPushNotifications(notifications) {
    if (!Array.isArray(notifications) || notifications.length === 0) return;
    console.log(`[Push Service] Batch processing ${notifications.length} push notifications...`);
    const promises = notifications.map(n => sendPushNotification(n.userId, n.title, n.body, n.data));
    await Promise.all(promises);
}

module.exports = {
    sendPushNotification,
    sendBulkPushNotifications
};
