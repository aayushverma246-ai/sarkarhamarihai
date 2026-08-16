const path = require('path');

let app, initDb;
let initError = null;

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
    app = require('../server.js');
    const dbMods = require('../backend/src/db');
    initDb = dbMods.initDb;
    // NOTE: seed module is NOT loaded here — it builds 15,879 job objects
    // at require() time which causes Vercel cold start timeout.
    // It is lazy-loaded only when /api/seed or /api/seed-step is called.
} catch (err) {
    initError = err;
}

let dbInitialized = false;

module.exports = async (req, res) => {
    if (initError) {
        return res.status(500).json({ error: "INIT_ERROR", message: initError.message, stack: initError.stack });
    }

    // Parse query string for seed secret
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    
    if (req.url === '/api/health' || url.pathname === '/api/health') {
        const { getDb } = require('../backend/src/db');
        try {
            if (!dbInitialized) {
                await initDb();
                dbInitialized = true;
            }
            const db = getDb();
            const result = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
            const jobCount = result.rows[0]?.cnt || 0;
            return res.json({
                status: 'gateway_v8_lazy_seed',
                database: 'connected',
                jobCount,
                ts: new Date().toISOString()
            });
        } catch (err) {
            return res.status(500).json({
                status: 'unhealthy',
                database: 'error',
                error: err.message,
                ts: new Date().toISOString()
            });
        }
    }

    // Seed endpoint — DISABLED in production to prevent external crons from
    // re-seeding the database. Seeding is only done via local CLI scripts.
    if (url.pathname === '/api/seed') {
        return res.status(403).json({
            error: 'Seed endpoint disabled in production',
            message: 'Database seeding is managed via local CLI scripts only. Use `npm run seed` locally.',
            timestamp: new Date().toISOString()
        });
    }


    // Lightweight data fix endpoint — runs SQL directly, no seed module needed
    if (url.pathname === '/api/fix-data') {
        const secret = url.searchParams.get('secret') || req.headers['x-seed-secret'];
        if (secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!dbInitialized) {
            await initDb(true);
            dbInitialized = true;
        }
        const { getDb } = require('../backend/src/db');
        const db = getDb();
        const action = url.searchParams.get('action');
        try {
            if (action === 'fix-categories') {
                // Expand categories from old 'Others'/'Medical'/'Engineering' to proper granular ones
                const updates = [
                    ["UPDATE jobs SET job_category='Agriculture' WHERE (organization LIKE '%NABARD%' OR organization LIKE '%ICAR%' OR job_name LIKE '%Agriculture%' OR job_name LIKE '%Dairy%') AND job_category IN ('Others','Banking')", 'Agriculture'],
                    ["UPDATE jobs SET job_category='Central Government' WHERE (organization LIKE '%Ministry%' OR organization LIKE '%Central%' OR job_name LIKE '%Central Govt%') AND job_category='Others'", 'Central Government'],
                    ["UPDATE jobs SET job_category='Cooperative' WHERE (organization LIKE '%Cooperative%' OR job_name LIKE '%Cooperative%') AND job_category='Others'", 'Cooperative'],
                    ["UPDATE jobs SET job_category='Forest & Environment' WHERE (organization LIKE '%Forest%' OR job_name LIKE '%Forest%' OR job_name LIKE '%Wildlife%' OR job_name LIKE '%Environment%') AND job_category IN ('Others','UPSC')", 'Forest & Environment'],
                    ["UPDATE jobs SET job_category='Healthcare' WHERE job_category='Medical'", 'Healthcare (from Medical)'],
                    ["UPDATE jobs SET job_category='Healthcare' WHERE (job_name LIKE '%Medical%' OR job_name LIKE '%Nursing%' OR job_name LIKE '%Health%' OR job_name LIKE '%AIIMS%' OR job_name LIKE '%Hospital%') AND job_category='Others'", 'Healthcare additional'],
                    ["UPDATE jobs SET job_category='Research & Science' WHERE (organization LIKE '%Research%' OR organization LIKE '%CSIR%' OR organization LIKE '%DRDO%' OR job_name LIKE '%Research%' OR job_name LIKE '%Scientific%' OR job_name LIKE '%Scientist%') AND job_category='Others'", 'Research & Science'],
                    ["UPDATE jobs SET job_category='Shipping & Ports' WHERE (organization LIKE '%Shipping%' OR organization LIKE '%Port%' OR organization LIKE '%Shipyard%' OR job_name LIKE '%Shipping%') AND job_category='Others'", 'Shipping & Ports'],
                    ["UPDATE jobs SET job_category='Telecom' WHERE (organization LIKE '%BSNL%' OR organization LIKE '%MTNL%' OR organization LIKE '%Telecom%' OR job_name LIKE '%Telecom%') AND job_category IN ('Others','Engineering')", 'Telecom'],
                ];
                const results = [];
                for (const [sql, label] of updates) {
                    const r = await db.execute(sql);
                    results.push({ label, affected: r.rowsAffected });
                }
                const catCount = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC');
                return res.json({ success: true, action: 'fix-categories', updates: results, categories: catCount.rows });
            } else if (action === 'apply-indexes') {
                // Apply performance indexes directly from API (useful in production)
                const indexStatements = [
                    "CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id)",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_composite_end ON jobs(application_end_date DESC, job_category)",
                    "CREATE INDEX IF NOT EXISTS idx_liked_user_created ON liked_jobs(user_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_applied_user_created ON applied_jobs(user_id, created_at DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(job_category)",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_app_end_date ON jobs(application_end_date DESC)",
                ];
                const idxResults = [];
                for (const sql of indexStatements) {
                    try {
                        await db.execute(sql);
                        idxResults.push({ sql: sql.substring(0, 80), status: 'ok' });
                    } catch (e) {
                        idxResults.push({ sql: sql.substring(0, 80), status: 'error', error: e.message });
                    }
                }
                return res.json({ success: true, action: 'apply-indexes', results: idxResults });
            } else if (action === 'fix-selection') {
                // Add selection procedures where missing
                const SP = {
                    UPSC: "Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.",
                    SSC: "Stage 1: Tier I → Computer Based Exam Stage 2: Tier II → Quantitative, Reasoning, English Stage 3: Skill Test → Typing (if applicable) Final Stage: Merit based on Tier scores. No Interview.",
                    Banking: "Stage 1: Preliminary Exam → Quantitative, Reasoning, English Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview (for Officers) Final Stage: Final Merit.",
                    Defence: "Stage 1: Written Exam → General Knowledge & Aptitude Stage 2: SSB Interview → 5-Day Personality Assessment Stage 3: Medical Exam → Physical Fitness Final Stage: Final Merit List.",
                    Railways: "Stage 1: CBT 1 → Screening Stage 2: CBT 2 → Core Subject Mastery Stage 3: Skill Test → Typing/Aptitude (if applicable) Final Stage: DV & Medical.",
                    Police: "Stage 1: Written Exam → Law & Reasoning Stage 2: Physical Efficiency Test Stage 3: Medical Exam Final Stage: Merit list.",
                    Teaching: "Stage 1: Written Exam → Pedagogical & Subject Knowledge Stage 2: Interview / Demo Class (if applicable) Final Stage: Selection based on merit score.",
                    PSU: "Stage 1: GATE Score / Written Test Stage 2: Group Discussion Stage 3: Personal Interview Final Stage: Merit list based on all rounds.",
                    Insurance: "Stage 1: Preliminary Exam → Reasoning, Quantitative, English Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview Final Stage: Final Merit.",
                    Judiciary: "Stage 1: Preliminary Exam → Law & General Knowledge Stage 2: Main Exam → Descriptive Law Papers Stage 3: Interview → Viva-voce Final Stage: Merit list.",
                    'State PSCs': "Stage 1: Preliminary Exam → Objective screening Stage 2: Main Exam → Descriptive papers Stage 3: Interview → Personality assessment Final Stage: Final selection.",
                    'Entrance Exams': "Stage 1: Entrance Exam → Objective MCQ Stage 2: Counselling → Seat Allotment based on Rank Stage 3: Document Verification Final Stage: Admission based on Rank + Preference.",
                    'Central Government': "Stage 1: Written Exam / Screening Test Stage 2: Skill Test / Document Verification Stage 3: Personal Interview (if applicable) Final Stage: Final Merit.",
                    Healthcare: "Stage 1: Computer Based Test (CBT) Stage 2: Document Verification Stage 3: Medical fitness check Final Stage: Final selection.",
                    Engineering: "Stage 1: Written Test / GATE Score Stage 2: Technical Interview Stage 3: HR Interview Final Stage: Merit list.",
                    'Research & Science': "Stage 1: Written Exam → Advanced Technical/Subject Domain Stage 2: Personal Interview → Research Aptitude Final Stage: Final Merit.",
                };
                const results = [];
                for (const [cat, sp] of Object.entries(SP)) {
                    const r = await db.execute({ sql: "UPDATE jobs SET selection_process = ? WHERE job_category = ? AND (selection_process IS NULL OR selection_process = '')", args: [sp, cat] });
                    results.push({ category: cat, affected: r.rowsAffected });
                }
                return res.json({ success: true, action: 'fix-selection', updates: results });
            } else if (action === 'stats') {
                const catCount = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC');
                const total = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
                const noSel = await db.execute("SELECT COUNT(*) as cnt FROM jobs WHERE selection_process IS NULL OR selection_process = ''");
                return res.json({ total: total.rows[0].cnt, noSelectionProcess: noSel.rows[0].cnt, categories: catCount.rows });
            } else {
                return res.json({ error: 'Use ?action=fix-categories, fix-selection, apply-indexes, or stats' });
            }
        } catch (err) {
            console.error('fix-data error:', err);
            return res.status(500).json({ error: err.message, action });
        }
    }


    // Top-level Cron (Gateway)
    if (req.url.startsWith('/api/cron/')) {
        const cronMod = require('../backend/src/routes/cron');
        const { router: cronRouter, dailyTask, updateStatuses, sendNotifications, hourlySync, cronHealthHandler, cronLogsHandler } = cronMod;
        if (!dbInitialized) {
            await initDb();
            dbInitialized = true;
        }

        const { getDb } = require('../backend/src/db');
        const db = getDb();
        const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsed.pathname;

        if (pathname === '/api/cron/daily') {
            return dailyTask(req, res);
        }
        // Schema migrations are managed securely via offline CLI scripts in production.
        if (pathname === '/api/cron/hourly-update') {
            return require('./cron/hourly-update')(req, res);
        }
        if (pathname === '/api/cron/healer') {
            return require('./cron/healer')(req, res);
        }
        if (pathname === '/api/cron/discovery') {
            return require('./cron/discovery')(req, res);
        }
        if (pathname === '/api/cron/verify') {
            return require('./cron/verification-cron')(req, res);
        }
        if (pathname === '/api/cron/deep-audit') {
            return require('./cron/deep-audit')(req, res);
        }
        if (pathname === '/api/cron/refresh') {
            return require('./cron/refresh')(req, res);
        }
        if (pathname === '/api/cron/hourly-sync') {
            return hourlySync(req, res);
        }
        if (pathname === '/api/cron/health') {
            return cronHealthHandler(req, res);
        }
        if (pathname === '/api/cron/logs') {
            return cronLogsHandler(req, res);
        }
        if (pathname === '/api/cron/status') {
            const secret = parsed.searchParams.get('secret') || '';
            const authHeader = req.headers?.authorization || '';
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            try {
                const updated = await updateStatuses(db);
                return res.json({ success: true, type: 'status', updated, ts: new Date().toISOString() });
            } catch (err) { return res.status(500).json({ error: err.message }); }
        }
        if (pathname === '/api/cron/notifications') {
            const secret = parsed.searchParams.get('secret') || '';
            const authHeader = req.headers?.authorization || '';
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            try {
                const sent = await sendNotifications(db);
                return res.json({ success: true, type: 'notifications', sent, ts: new Date().toISOString() });
            } catch (err) {
                console.error('[Cron Notif Error]', err);
                return res.status(500).json({ error: err.message, stack: (err.stack || '').substring(0, 500) });
            }
        }
        // status-change-notify and final-close-notify — delegate to express router
        return app(req, res);
    }

    if (!dbInitialized) {
        await initDb();
        dbInitialized = true;
    }
    return app(req, res);
};
