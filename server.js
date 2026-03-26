const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const { initDb } = require('./backend/src/db');
const { seedDatabase } = require('./backend/src/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
app.use(cors({ origin: '*' }));
app.use(express.json());

// Basic Request Logging
app.use((req, res, next) => {
    if (req.path !== '/api/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

// --- TEMP OCR BYPASS ---
app.get('/dump-ui', (req, res) => res.sendFile(__dirname + '/local-dump.html'));
app.post('/dump/:type', express.text({ type: '*/*' }), (req, res) => {
    require('fs').writeFileSync(__dirname + `/backend/dump_${req.params.type}.txt`, req.body);
    console.log(`[OCR BYPASS] Successfully intercepted and saved flawless ${req.params.type}!`);
    res.send('OK');
});
// -----------------------

// Direct API Routes (Top Priority)
const { router: cronRouter, updateStatuses, sendNotifications, dailyTask } = require('./backend/src/routes/cron');
app.get('/api/cron/status', async (req, res) => {
    const { getDb } = require('./backend/src/db');
    const db = getDb();
    const updated = await updateStatuses(db);
    res.json({ success: true, type: 'status', updated });
});
app.get('/api/cron/notifications', async (req, res) => {
    const { getDb } = require('./backend/src/db');
    const db = getDb();
    const sent = await sendNotifications(db);
    res.json({ success: true, type: 'notifications', sent });
});
app.get('/api/cron/daily', dailyTask);
// Health Check
app.get('/api/health', (req, res) => res.json({
    status: 'monolithic_v5_final_automation_ready_AI_TRACKER_PROBE_v1',
    ts: new Date().toISOString()
}));

// API Router Mounts
app.use('/api/auth', require('./backend/src/routes/auth'));
app.use('/api/jobs', require('./backend/src/routes/jobs'));
app.use('/api/roadmap', require('./backend/src/routes/roadmap')); // Fixed: /api/roadmap/:id/roadmap
app.use('/api/notifications', require('./backend/src/routes/notifications'));
app.use('/api/apply', require('./backend/src/routes/apply'));
app.use('/api/syllabus', require('./backend/src/routes/syllabus'));
app.use('/api/cron', cronRouter);
app.use('/api/tracker', require('./backend/src/routes/tracker')); // ADDED: Tracker API Routes
app.use('/api/ai', require('./backend/src/routes/ai')); // NEW AI rebuild route

// Serve static frontend (from dist/ array)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router (SPA)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize DB and start server
async function start() {
    try {
        await initDb();
        await seedDatabase();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Export app for platform integrations
module.exports = app;

// Only bind to port if run directly
if (require.main === module) {
    start();
}
