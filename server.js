const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const { initDb } = require('./backend/src/db');
const { seedDatabase } = require('./backend/src/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable gzip compression for all static assets and API JSON responses for peak speed
const compression = require('compression');
app.use(compression());

// CORS Configuration
app.use(cors({ origin: '*' }));
app.use(express.json());

// Basic Request Logging & Lazy DB Init
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await initDb();
            dbInitialized = true;
        } catch (err) {
            console.error('Lazy DB Init Failed:', err);
        }
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
const { router: cronRouter, dailyTask } = require('./backend/src/routes/cron');
app.get('/api/cron/daily', dailyTask);

// Seed endpoint - triggers database population
app.get('/api/seed', async (req, res) => {
    const secret = req.query.secret || req.headers['x-seed-secret'];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        console.log('Starting database seed...');
        await seedDatabase();
        const db = require('./backend/src/db').getDb();
        const result = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const jobCount = result.rows[0]?.cnt || 0;
        res.json({
            success: true,
            message: 'Database seeded successfully',
            jobCount,
            ts: new Date().toISOString()
        });
    } catch (err) {
        console.error('Seed error:', err);
        res.status(500).json({ error: 'Seed failed', details: err.message });
    }
});

// Category standardization endpoint - stepped for Vercel timeout limits
// Call with ?step=1, ?step=2, etc. to process in phases
app.get('/api/fix-categories', async (req, res) => {
    const secret = req.query.secret || req.headers['x-seed-secret'];
    if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const step = parseInt(req.query.step) || 1;
    try {
        const db = require('./backend/src/db').getDb();

        const allRules = {
            1: [
                ['%upsc%', 'UPSC'], ['%ias%', 'UPSC'], ['%ips%', 'UPSC'],
                ['%ssc %', 'SSC'], ['%staff selection%', 'SSC'], ['%selection post%', 'SSC'],
                ['%railway%', 'Railway'], ['%rrb%', 'Railway'], ['%loco pilot%', 'Railway'], ['%track maintainer%', 'Railway'],
                ['%bank%', 'Banking'], ['%ibps%', 'Banking'], ['%rbi %', 'Banking'], ['%nabard%', 'Banking'],
            ],
            2: [
                ['%police%', 'Police & Security'], ['%constable%', 'Police & Security'], ['%sub inspector%', 'Police & Security'],
                ['%capf%', 'Police & Security'], ['%crpf%', 'Police & Security'], ['%bsf%', 'Police & Security'],
                ['%cisf%', 'Police & Security'], ['%itbp%', 'Police & Security'],
                ['%defence%', 'Defence'], ['%army%', 'Defence'], ['%navy%', 'Defence'], ['%air force%', 'Defence'],
                ['%dockyard%', 'Defence'], ['%ordnance%', 'Defence'], ['%bro %', 'Defence'], ['%gref%', 'Defence'],
                ['%drdo%', 'Defence'], ['%nda %', 'Defence'], ['%cds %', 'Defence'],
            ],
            3: [
                ['%teacher%', 'Teaching & Education'], ['%tet %', 'Teaching & Education'], ['%ctet%', 'Teaching & Education'],
                ['%tgt%', 'Teaching & Education'], ['%pgt%', 'Teaching & Education'], ['%school%', 'Teaching & Education'],
                ['%university%', 'Teaching & Education'], ['%iit %', 'Teaching & Education'], ['%nit %', 'Teaching & Education'],
                ['%iim %', 'Teaching & Education'], ['%anganwadi%', 'Teaching & Education'], ['%mid-day%', 'Teaching & Education'],
                ['%court%', 'Judiciary & Law'], ['%judiciary%', 'Judiciary & Law'], ['%nyayalaya%', 'Judiciary & Law'],
                ['%lok sabha%', 'Judiciary & Law'], ['%rajya sabha%', 'Judiciary & Law'],
                ['%forest%', 'Forest & Environment'], ['%wildlife%', 'Forest & Environment'],
            ],
            4: [
                ['%health%', 'Healthcare'], ['%nurse%', 'Healthcare'], ['%nhm%', 'Healthcare'],
                ['%hospital%', 'Healthcare'], ['%aiims%', 'Healthcare'], ['%medical%', 'Healthcare'], ['%asha %', 'Healthcare'],
                ['%insurance%', 'Insurance'], ['%lic %', 'Insurance'], ['%esic%', 'Insurance'],
                ['%csir%', 'Research & Science'], ['%icar%', 'Research & Science'], ['%scientist%', 'Research & Science'],
                ['%telecom%', 'Telecom'], ['%bsnl%', 'Telecom'],
                ['%shipping%', 'Shipping & Ports'], ['%cochin shipyard%', 'Shipping & Ports'],
                ['%agriculture%', 'Agriculture'], ['%dairy%', 'Agriculture'], ['%cooperative%', 'Agriculture'],
                ['%jee %', 'Entrance Exam'], ['%neet%', 'Entrance Exam'], ['%gate %', 'Entrance Exam'],
                ['%cuet%', 'Entrance Exam'], ['%clat%', 'Entrance Exam'],
                ['%ongc%', 'PSU'], ['%bhel%', 'PSU'], ['%sail%', 'PSU'], ['%iocl%', 'PSU'],
                ['%oil india%', 'PSU'], ['%gail%', 'PSU'], ['%coal%', 'PSU'], ['%power grid%', 'PSU'],
            ],
            5: [
                ['%psc%', 'State Government'], ['%patwari%', 'State Government'], ['%lekhpal%', 'State Government'],
                ['%panchayat%', 'State Government'], ['%zilla%', 'State Government'], ['%municipal%', 'State Government'],
                ['%electricity%', 'State Government'], ['%transport%', 'State Government'],
                ['%vidhan sabha%', 'State Government'], ['%district%', 'State Government'],
                ['%safai%', 'State Government'], ['%rozgar%', 'State Government'], ['%revenue%', 'State Government'],
            ],
        };

        const rules = allRules[step] || [];
        let totalUpdated = 0;

        for (const [pattern, newCat] of rules) {
            const r = await db.execute({
                sql: `UPDATE jobs SET job_category = ? WHERE (job_category = 'CENTRAL' OR job_category = 'STATE') AND (LOWER(job_name) LIKE ? OR LOWER(organization) LIKE ?)`,
                args: [newCat, pattern, pattern]
            });
            totalUpdated += r.rowsAffected;
        }

        // On step 6: final cleanup
        if (step === 6) {
            const r1 = await db.execute("UPDATE jobs SET job_category = 'Central Government' WHERE job_category = 'CENTRAL'");
            const r2 = await db.execute("UPDATE jobs SET job_category = 'State Government' WHERE job_category = 'STATE'");
            totalUpdated += r1.rowsAffected + r2.rowsAffected;
            await db.execute({ sql: "INSERT INTO seed_meta (key, value) VALUES ('seed_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", args: ['17'] });
        }

        const after = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY job_category');

        res.json({
            success: true,
            step,
            nextStep: step < 6 ? step + 1 : 'DONE',
            totalUpdated,
            categories: after.rows,
            ts: new Date().toISOString()
        });
    } catch (err) {
        console.error('Fix categories error:', err);
        res.status(500).json({ error: 'Fix failed', step, details: err.message });
    }
});


// Inline health check removed - now served via routes/health.js

// Quick test endpoint - returns first 10 jobs directly
app.get('/api/test-jobs', async (req, res) => {
    try {
        const db = require('./backend/src/db').getDb();
        const result = await db.execute('SELECT id, job_name, organization FROM jobs LIMIT 10');
        res.json({ count: result.rows.length, jobs: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

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
app.use('/api/exam', require('./backend/src/routes/exam')); // NEW Exam dynamic stats routes
app.use('/api/health', require('./backend/src/routes/health')); // Robust DB monitors
app.use('/api/audit', require('./backend/src/routes/audit')); // Data audit system
app.use('/api/verifier', require('./backend/src/routes/verifier')); // Dynamic Data Verifier System

// Serve static frontend (from dist/ array) with high-performance production cache-control
app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '30d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            // HTML files must always revalidate with the server to prevent version sync lag
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
            // Hash-compiled assets (CSS, JS, media files) can be heavily cached safely
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        }
    }
}));

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
        // Fast init ONLY (skips migrations/seeding in prod)
        await initDb();

        // Removed: seedDatabase(); // SEEDING MUST BE MANUAL (npm run seed)
        // This fixes the 'Authenticating...' hang caused by 15,000 job updates on every cold start.

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
