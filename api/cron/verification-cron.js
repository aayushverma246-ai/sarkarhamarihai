'use strict';
/**
 * /api/cron/verification-cron.js — Vercel-compatible cron endpoint
 * 
 * Runs within 90s time budget. Rotates through verification tasks:
 *   - Cycle 0: Full verification
 *   - Cycle 1: Incremental verification
 *   - Cycle 2: Stale record detection
 * 
 * Called by cron-job.org or Vercel cron.
 */

const { getDb, initDb } = require('../../backend/src/db');
const { VerificationEngine } = require('../../backend/src/engines/verification-engine');
const { logOperation } = require('../../backend/src/engines/audit-logger');

let dbInitialized = false;
let _cycleCounter = 0;

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const MAX_MS = 80000;

  try {
    if (!dbInitialized) {
      await initDb();
      dbInitialized = true;
    }

    const db = getDb();
    const engine = new VerificationEngine(db, { timeBudgetMs: MAX_MS });

    // Determine which task to run this cycle
    const cycle = _cycleCounter % 4;
    _cycleCounter++;

    let result;
    let taskName;

    switch (cycle) {
      case 0:
        taskName = 'full_verification';
        result = await engine.runFullVerification();
        break;
      case 1:
        taskName = 'incremental_verification';
        result = await engine.runIncrementalVerification(300);
        break;
      case 2:
        taskName = 'stale_detection';
        result = await engine.detectStaleRecords(200);
        break;
      case 3:
        taskName = 'scraping_verification';
        result = await engine.runScrapingVerification(6); // Scrape the 6 most stale active exams per cron cycle
        break;
    }

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      task: taskName,
      cycle: _cycleCounter - 1,
      nextTask: ['full_verification', 'incremental_verification', 'stale_detection', 'scraping_verification'][_cycleCounter % 4],
      result,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[VerificationCron] Fatal:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
      elapsed_ms: Date.now() - startTime,
    });
  }
};
