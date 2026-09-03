'use strict';
/**
 * routes/verifier.js — REST API for the Dynamic Data Verifier System
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { VerificationEngine } = require('../engines/verification-engine');
const { SyncEngine } = require('../engines/sync-engine');
const { Scheduler, createVerificationScheduler } = require('../engines/scheduler');
const { getRecentLogs, getRecentMismatches, getAlerts, acknowledgeAlert, getSystemHealth, generateDailySummary, getMetrics } = require('../engines/audit-logger');
const { getSourceStatus, healthCheckAll } = require('../engines/data-source-manager');
const { getRegisteredRules } = require('../engines/validation-rules');

// Singletons (lazy init)
let _engine = null;
let _scheduler = null;

function getEngine() {
  if (!_engine) _engine = new VerificationEngine(getDb());
  return _engine;
}

function getScheduler() {
  if (!_scheduler) {
    _scheduler = createVerificationScheduler(getEngine());
  }
  return _scheduler;
}

const auth = require('../middleware/auth');

// Secure hybrid verifier auth middleware
async function secureVerifierAuth(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';

  // 1. Check if it's using the CRON_SECRET (either in query or header)
  if (cronSecret) {
    const secret = req.query.secret || (authHeader.startsWith('Bearer ') && authHeader.split(' ')[1] === cronSecret ? cronSecret : '');
    if (secret === cronSecret) {
      return next();
    }
  }

  // 2. Otherwise, check if it's a valid admin session using the standard auth middleware
  if (authHeader.startsWith('Bearer ')) {
    try {
      await auth(req, res, () => {});
      if (req.user && req.user.email === 'aayushverma246@gmail.com') {
        return next();
      }
    } catch (_) {
      // Fall through to 401
    }
  }

  return res.status(401).json({ error: 'Unauthorized — Admin access required' });
}

// GET /api/verifier/run — Trigger full verification cycle
router.get('/run', secureVerifierAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const report = await engine.runFullVerification();
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/incremental — Trigger incremental verification
router.get('/incremental', secureVerifierAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const limit = parseInt(req.query.limit) || 200;
    const report = await engine.runIncrementalVerification(limit);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/deep-scrape — Trigger deep scraping verification
router.get('/deep-scrape', secureVerifierAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const limit = parseInt(req.query.limit) || 10;
    const report = await engine.runScrapingVerification(limit);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/sync — Trigger delta sync with scraper data
router.get('/sync', secureVerifierAuth, async (req, res) => {
  try {
    const db = getDb();
    const syncEngine = new SyncEngine(db, { dryRun: req.query.dry === 'true' });
    // Fetch current DB records as the "incoming" source for checksum recomputation
    const result = await db.execute('SELECT * FROM jobs ORDER BY id LIMIT 2000');
    const syncResult = await syncEngine.fullVerify();
    res.json({ success: true, result: syncResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/stale — Detect and fix stale records
router.get('/stale', secureVerifierAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const limit = parseInt(req.query.limit) || 100;
    const report = await engine.detectStaleRecords(limit);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/status — Current verifier status + metrics
router.get('/status', secureVerifierAuth, async (req, res) => {
  try {
    const scheduler = getScheduler();
    res.json({
      health: getSystemHealth(),
      metrics: getMetrics(),
      scheduler: scheduler.getStatus(),
      sources: getSourceStatus(),
      rules: getRegisteredRules(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/report — Latest daily summary
router.get('/report', secureVerifierAuth, async (req, res) => {
  try {
    const summary = generateDailySummary();
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/logs — Verification audit logs
router.get('/logs', secureVerifierAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ logs: getRecentLogs(limit), total: getRecentLogs(200).length });
});

// GET /api/verifier/mismatches — Recent mismatches
router.get('/mismatches', secureVerifierAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  res.json({ mismatches: getRecentMismatches(limit) });
});

// GET /api/verifier/alerts — Active alerts
router.get('/alerts', secureVerifierAuth, async (req, res) => {
  const unackOnly = req.query.unacknowledged === 'true';
  res.json({ alerts: getAlerts(unackOnly) });
});

// POST /api/verifier/alerts/:id/acknowledge — Acknowledge an alert
router.post('/alerts/:id/acknowledge', secureVerifierAuth, async (req, res) => {
  const ok = acknowledgeAlert(req.params.id);
  res.json({ success: ok });
});

// GET /api/verifier/health — System health check
router.get('/health', async (req, res) => {
  try {
    const health = getSystemHealth();
    const sourceHealth = await healthCheckAll();
    res.json({ ...health, sources: sourceHealth });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// GET /api/verifier/dashboard-data — Aggregated dashboard metrics
router.get('/dashboard-data', secureVerifierAuth, async (req, res) => {
  try {
    const engine = getEngine();
    const data = await engine.getDashboardData();
    const scheduler = getScheduler();
    data.scheduler = scheduler.getStatus();
    data.recentLogs = getRecentLogs(20);
    data.recentMismatches = getRecentMismatches(20);
    data.alerts = getAlerts(true);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verifier/scheduler/start — Start the scheduler
router.get('/scheduler/start', secureVerifierAuth, async (req, res) => {
  const scheduler = getScheduler();
  scheduler.start();
  res.json({ success: true, message: 'Scheduler started', tasks: scheduler.getStatus() });
});

// GET /api/verifier/scheduler/stop — Stop the scheduler
router.get('/scheduler/stop', secureVerifierAuth, async (req, res) => {
  const scheduler = getScheduler();
  scheduler.stop();
  res.json({ success: true, message: 'Scheduler stopped' });
});

// GET /api/verifier/scheduler/logs — Scheduler execution log
router.get('/scheduler/logs', secureVerifierAuth, async (req, res) => {
  const scheduler = getScheduler();
  const limit = parseInt(req.query.limit) || 50;
  res.json({ logs: scheduler.getExecutionLog(limit) });
});

module.exports = router;
