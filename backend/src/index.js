require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { seedDatabase } = require('./seed');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/roadmap', require('./routes/roadmap')); // Changed from /api/jobs to /api/roadmap
app.use('/api/apply', require('./routes/apply')); // Added apply routes
app.use('/api/cron', require('./routes/cron').router);     // Added cron routes
app.use('/api/syllabus', require('./routes/syllabus')); // Added syllabus matching route
app.use('/api/tracker', require('./routes/tracker')); // Tracker feature routes
app.use('/api/ai', require('./routes/ai')); // NEW AI rebuild route

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

// Initialize DB, seed, then start server
async function start() {
    try {
        console.log('  Initializing database...');
        await initDb();
        await seedDatabase();
        app.listen(PORT, () => {
            console.log(`\n  SarkarHamariHai API running at http://localhost:${PORT}`);
            console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
