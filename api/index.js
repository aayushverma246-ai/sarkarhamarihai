const path = require('path');

let app, initDb, seedDatabase;
let initError = null;

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
    app = require('../server.js');
    const dbMods = require('../backend/src/db');
    initDb = dbMods.initDb;
    const seedMods = require('../backend/src/seed');
    seedDatabase = seedMods.seedDatabase;
} catch (err) {
    initError = err;
}

let dbInitialized = false;

module.exports = async (req, res) => {
    if (initError) {
        return res.status(500).json({ error: "INIT_ERROR", message: initError.message, stack: initError.stack });
    }

    if (req.url === '/api/health') {
        return res.json({
            status: 'gateway_v6_stable',
            ts: new Date().toISOString()
        });
    }

    // Top-level Cron (Gateway)
    if (req.url.startsWith('/api/cron/')) {
        const { dailyTask, updateStatuses, sendNotifications } = require('../backend/src/routes/cron');
        if (!dbInitialized) {
            await initDb();
            await seedDatabase();
            dbInitialized = true;
        }

        const { getDb } = require('../backend/src/db');
        const db = getDb();

        if (req.url.startsWith('/api/cron/daily')) {
            return dailyTask(req, res);
        }
        if (req.url.startsWith('/api/cron/status')) {
            try {
                const updated = await updateStatuses(db);
                return res.json({ success: true, type: 'status', updated });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }
        if (req.url.startsWith('/api/cron/notifications')) {
            try {
                const sent = await sendNotifications(db);
                return res.json({ success: true, type: 'notifications', sent });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }
    }

    if (!dbInitialized) {
        await initDb();
        await seedDatabase();
        dbInitialized = true;
    }
    return app(req, res);
};
