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
app.use('/api/exam', require('./routes/exam')); // NEW Exam dynamic stats routes
app.use('/api/audit', require('./routes/audit')); // Data audit system

// Temporary migration route for schema execution on Vercel
app.get('/api/migrate-schema', async (req, res) => {
    if (req.query.key !== 'Aayush@192005') return res.status(401).send('Unauthorized');
    const { Pool } = require('pg');
    const pool = new Pool({
        host: '2406:da1a:6b0:f61d:c397:360b:9292:434b', // Force IPv6
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'Aayush@192005',
        ssl: { rejectUnauthorized: false }
    });
    try {
        const sql = `
        CREATE TABLE IF NOT EXISTS roadmaps (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          roadmap_content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS tracker_plans (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          wake_time TEXT NOT NULL,
          sleep_time TEXT NOT NULL,
          planned_hours REAL NOT NULL DEFAULT 0,
          completed_hours REAL NOT NULL DEFAULT 0,
          productivity_score INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'planned',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tracker_sessions (
          id TEXT PRIMARY KEY,
          plan_id TEXT NOT NULL REFERENCES tracker_plans(id) ON DELETE CASCADE,
          exam_target_id TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          session_type TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          is_completed INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS tracker_user_stats (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          current_streak INTEGER NOT NULL DEFAULT 0,
          longest_streak INTEGER NOT NULL DEFAULT 0,
          total_study_hours REAL NOT NULL DEFAULT 0,
          overall_readiness_score INTEGER NOT NULL DEFAULT 0,
          target_probability REAL NOT NULL DEFAULT 0,
          last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tracker_user_targets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          exam_name TEXT NOT NULL,
          exam_date TEXT,
          syllabus_completed_pct REAL NOT NULL DEFAULT 0,
          target_probability REAL NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        `;
        await pool.query(sql);
        res.send('Schema applied successfully');
    } catch (e) {
        res.status(500).send(e.message);
    } finally {
        await pool.end();
    }
});

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
