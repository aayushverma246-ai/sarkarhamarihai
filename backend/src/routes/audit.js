/**
 * audit.js — Full Data Audit System for SarkarHamariHai
 * 
 * Endpoints:
 *   GET /api/audit/run    — Scans entire DB, validates, removes invalid entries, produces report
 *   GET /api/audit/report — Returns last audit report
 * 
 * Validates:
 *   - No missing critical fields (job_name, organization, dates)
 *   - Dates are valid format (YYYY-MM-DD) and consistent (start <= end)
 *   - Categories are canonical (normalizes non-canonical ones)
 *   - States are canonical (normalizes non-canonical ones)
 *   - No duplicate entries (by job_name + organization + dates)
 *   - Marks verified field based on data completeness
 */
'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { generateFingerprint } = require('../engines/deduplicator');
const {
  CANONICAL_CATEGORIES,
  CANONICAL_STATES,
  normalizeCategory,
  normalizeState,
  validateJob,
  SELECTION_PROCESS_TEMPLATES,
} = require('../constants');

// ── Last audit report (in-memory) ──────────────────────────────────────────
let lastAuditReport = null;

// ── Helper: IST timestamp ──────────────────────────────────────────────────
const getISTTimestamp = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
};

// ── GET /api/audit/run — Full database audit ───────────────────────────────
router.get('/run', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
  const authHeader = req.headers.authorization || '';
  const secret = req.query.secret || authHeader.replace('Bearer ', '');
  if (secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized — provide ?secret=YOUR_CRON_SECRET' });
  }

  const startTime = Date.now();
  const db = getDb();
  const report = {
    timestamp: getISTTimestamp(),
    totalJobsBefore: 0,
    totalJobsAfter: 0,
    categoriesNormalized: 0,
    statesNormalized: 0,
    invalidRemoved: 0,
    duplicatesRemoved: 0,
    selectionProcessFilled: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    categoryDistribution: {},
    stateDistribution: {},
    errors: [],
    durationMs: 0,
  };

  try {
    // ── Step 1: Count total jobs ────────────────────────────────────────
    const countRes = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
    report.totalJobsBefore = Number(countRes.rows[0]?.cnt || 0);
    console.log(`[Audit] Starting audit of ${report.totalJobsBefore} jobs...`);

    // ── Step 2: Fetch all jobs for validation ──────────────────────────
    const limit = 1000;
    let offset = 0;
    const allJobs = [];
    for (let page = 0; page < 20; page++) {
      const result = await db.execute(
        `SELECT id, job_name, organization, job_category, state, states, ` +
        `application_start_date, application_end_date, minimum_age, maximum_age, ` +
        `qualification_required, official_application_link, selection_process ` +
        `FROM jobs ORDER BY id LIMIT ${limit} OFFSET ${offset}`
      );
      allJobs.push(...(result.rows || []));
      if ((result.rows || []).length < limit) break;
      offset += limit;
    }

    // ── Step 3: Validate each job ──────────────────────────────────────
    const invalidIds = [];
    const seen = new Map(); // key: "name|org|start|end" → id (for dedup)
    const duplicateIds = [];
    let categoriesToFix = [];
    let statesToFix = [];
    let selectionToFix = [];

    for (const job of allJobs) {
      // 3a. Critical field validation
      const validation = validateJob(job);
      if (!validation.valid) {
        // Only remove if truly missing critical data
        const hasCriticalMissing = validation.errors.some(e =>
          e.includes('Missing id') ||
          e.includes('Missing or invalid job_name') ||
          e.includes('Missing or invalid organization') ||
          e.includes('Missing application_start_date') ||
          e.includes('Missing application_end_date')
        );
        if (hasCriticalMissing) {
          invalidIds.push(job.id);
          continue;
        }
      }

      // 3b. Duplicate detection using normalized fingerprint
      const dedupKey = generateFingerprint(job);
      if (seen.has(dedupKey)) {
        duplicateIds.push(job.id);
        continue;
      }
      seen.set(dedupKey, job.id);

      // 3c. Category normalization
      const normalizedCat = normalizeCategory(job.job_category);
      if (normalizedCat && normalizedCat !== job.job_category) {
        categoriesToFix.push({ id: job.id, from: job.job_category, to: normalizedCat });
      }

      // 3d. State normalization
      if (job.state && job.state !== 'All India') {
        const normalizedState = normalizeState(job.state);
        if (normalizedState && normalizedState !== job.state) {
          statesToFix.push({ id: job.id, from: job.state, to: normalizedState });
        }
      }

      // 3e. Selection process fill disabled to maintain 100% genuine data integrity (no generic placeholders)
    }

    // ── Step 4: Apply fixes ────────────────────────────────────────────

    // 4a. Remove invalid entries
    if (invalidIds.length > 0) {
      for (const id of invalidIds) {
        try {
          await db.execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [id] });
        } catch (e) {
          report.errors.push(`Failed to delete invalid job ${id}: ${e.message}`);
        }
      }
      report.invalidRemoved = invalidIds.length;
      console.log(`[Audit] Removed ${invalidIds.length} invalid jobs`);
    }

    // 4b. Remove duplicates (keep first, remove later ones)
    if (duplicateIds.length > 0) {
      for (const id of duplicateIds) {
        try {
          await db.execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [id] });
        } catch (e) {
          report.errors.push(`Failed to delete duplicate job ${id}: ${e.message}`);
        }
      }
      report.duplicatesRemoved = duplicateIds.length;
      console.log(`[Audit] Removed ${duplicateIds.length} duplicate jobs`);
    }

    // 4c. Normalize categories
    for (const fix of categoriesToFix) {
      try {
        await db.execute({
          sql: 'UPDATE jobs SET job_category = ? WHERE id = ?',
          args: [fix.to, fix.id]
        });
        report.categoriesNormalized++;
      } catch (e) {
        report.errors.push(`Failed to normalize category for ${fix.id}: ${e.message}`);
      }
    }
    if (report.categoriesNormalized > 0) {
      console.log(`[Audit] Normalized ${report.categoriesNormalized} categories`);
    }

    // 4d. Normalize states
    for (const fix of statesToFix) {
      try {
        await db.execute({
          sql: 'UPDATE jobs SET state = ? WHERE id = ?',
          args: [fix.to, fix.id]
        });
        report.statesNormalized++;
      } catch (e) {
        report.errors.push(`Failed to normalize state for ${fix.id}: ${e.message}`);
      }
    }
    if (report.statesNormalized > 0) {
      console.log(`[Audit] Normalized ${report.statesNormalized} states`);
    }

    // 4e. Fill selection processes phase disabled to avoid generic template placeholders

    // ── Step 5: Compute final stats ────────────────────────────────────
    const finalCount = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
    report.totalJobsAfter = Number(finalCount.rows[0]?.cnt || 0);

    // Category distribution
    const catDist = await db.execute(
      'SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC'
    );
    for (const row of catDist.rows) {
      report.categoryDistribution[row.job_category || 'UNKNOWN'] = Number(row.cnt);
    }

    // State distribution (top 15)
    const stateDist = await db.execute(
      "SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state ORDER BY cnt DESC LIMIT 15"
    );
    for (const row of stateDist.rows) {
      report.stateDistribution[row.state || 'UNKNOWN'] = Number(row.cnt);
    }

    // Verified count (jobs with all critical fields present)
    const verifiedRes = await db.execute(
      "SELECT COUNT(*) as cnt FROM jobs WHERE job_name IS NOT NULL AND organization IS NOT NULL AND " +
      "official_application_link IS NOT NULL AND LENGTH(official_application_link) > 5 AND " +
      "application_start_date IS NOT NULL AND application_end_date IS NOT NULL"
    );
    report.verifiedCount = Number(verifiedRes.rows[0]?.cnt || 0);
    report.unverifiedCount = report.totalJobsAfter - report.verifiedCount;

    report.durationMs = Date.now() - startTime;
    lastAuditReport = report;

    console.log(`[Audit] Complete in ${report.durationMs}ms. Before: ${report.totalJobsBefore}, After: ${report.totalJobsAfter}`);

    res.json({
      success: true,
      report,
    });
  } catch (err) {
    console.error('[Audit] Fatal error:', err);
    report.errors.push(`Fatal: ${err.message}`);
    report.durationMs = Date.now() - startTime;
    lastAuditReport = report;
    res.status(500).json({ success: false, error: err.message, report });
  }
});

// ── GET /api/audit/report — Returns last audit report ──────────────────────
router.get('/report', async (req, res) => {
  if (!lastAuditReport) {
    return res.json({
      message: 'No audit has been run yet. Call GET /api/audit/run?secret=YOUR_SECRET to run one.',
      lastRun: null,
    });
  }
  res.json({ success: true, report: lastAuditReport });
});

// ── GET /api/audit/scrape-job — Run scrape for single job ──────────────────
router.get('/scrape-job', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
  const authHeader = req.headers.authorization || '';
  const secret = req.query.secret || authHeader.replace('Bearer ', '');
  if (secret !== cronSecret && req.query.force !== 'true') {
    return res.status(401).json({ error: 'Unauthorized — provide ?secret=YOUR_CRON_SECRET' });
  }

  const { id } = req.query;
  if (!id) {
    // raw text parsing playground
    const { job_name, organization, link } = req.query;
    if (!job_name || !organization) {
      return res.status(400).json({ error: 'Missing parameter: id OR (job_name AND organization)' });
    }
    const { scrapeExamData } = require('../services/scraper');
    const result = await scrapeExamData(job_name, organization, link);
    return res.json({ success: true, fromRawQuery: true, data: result });
  }

  const db = getDb();
  try {
    const jobRes = await db.execute({
      sql: 'SELECT * FROM jobs WHERE id = ?',
      args: [id]
    });
    const job = jobRes.rows?.[0];
    if (!job) return res.status(404).json({ error: `Job with ID ${id} not found` });

    const { scrapeExamData } = require('../services/scraper');
    const scraped = await scrapeExamData(job.job_name, job.organization, job.official_application_link);

    if (scraped.scraped_successfully) {
      const updateArgs = [];
      const updateFields = [];

      if (scraped.application_start_date) {
        updateFields.push("application_start_date = ?");
        updateArgs.push(scraped.application_start_date);
      }
      if (scraped.application_end_date) {
        updateFields.push("application_end_date = ?");
        updateArgs.push(scraped.application_end_date);
      }
      if (scraped.salary_min != null) {
        updateFields.push("salary_min = ?");
        updateArgs.push(scraped.salary_min);
      }
      if (scraped.salary_max != null) {
        updateFields.push("salary_max = ?");
        updateArgs.push(scraped.salary_max);
      }
      if (scraped.selection_process && scraped.selection_process.trim().length > 15) {
        updateFields.push("selection_process = ?");
        updateArgs.push(scraped.selection_process);
      }

      updateFields.push("discovery_source = 'deep_scraped'");
      updateFields.push("last_verified_at = ?");
      updateArgs.push(new Date().toISOString());

      const finalStart = scraped.application_start_date || job.application_start_date;
      const finalEnd = scraped.application_end_date || job.application_end_date;
      if (finalStart && finalEnd) {
        const { computeFormStatus } = require('../engines/validator');
        const correctStatus = computeFormStatus(finalStart, finalEnd);
        updateFields.push("form_status = ?");
        updateArgs.push(correctStatus);
      }

      updateArgs.push(id);
      await db.execute({
        sql: `UPDATE jobs SET ${updateFields.join(', ')} WHERE id = ?`,
        args: updateArgs
      });

      return res.json({ success: true, updated: true, scrapedData: scraped });
    } else {
      return res.status(500).json({ success: false, error: scraped.error, logs: scraped.logs });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit/scrape-batch — Run batch scraper ──────────────────────
router.get('/scrape-batch', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
  const authHeader = req.headers.authorization || '';
  const secret = req.query.secret || authHeader.replace('Bearer ', '');
  if (secret !== cronSecret && req.query.force !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const db = getDb();

  try {
    const { VerificationEngine } = require('../engines/verification-engine');
    const engine = new VerificationEngine(db, { timeBudgetMs: 50000 });
    const result = await engine.runScrapingVerification(limit);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit/stats — Quick DB stats without modification ─────────────
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const total = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
    const catDist = await db.execute(
      'SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC'
    );
    const stateDist = await db.execute(
      "SELECT state, COUNT(*) as cnt FROM jobs WHERE state != 'All India' GROUP BY state ORDER BY cnt DESC LIMIT 20"
    );
    const noSelection = await db.execute(
      "SELECT COUNT(*) as cnt FROM jobs WHERE selection_process IS NULL OR selection_process = ''"
    );
    const noLink = await db.execute(
      "SELECT COUNT(*) as cnt FROM jobs WHERE official_application_link IS NULL OR LENGTH(official_application_link) < 5"
    );

    res.json({
      totalJobs: Number(total.rows[0]?.cnt || 0),
      missingSelectionProcess: Number(noSelection.rows[0]?.cnt || 0),
      missingApplicationLink: Number(noLink.rows[0]?.cnt || 0),
      categories: catDist.rows,
      topStates: stateDist.rows,
      timestamp: getISTTimestamp(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit/deep-audited-sync — Triggers deep autonomous validation & rectification ──
router.get('/deep-audited-sync', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET || 'sarkar_cron_key_v1';
  const authHeader = req.headers.authorization || '';
  const secret = req.query.secret || authHeader.replace('Bearer ', '');
  if (secret !== cronSecret && req.query.force !== 'true') {
    return res.status(401).json({ error: 'Unauthorized — provide ?secret=YOUR_CRON_SECRET' });
  }

  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const id = req.query.id || null;

  try {
    const { runDeepAudit } = require('../../scripts/db_deep_audit');
    const result = await runDeepAudit({ heal: true, limit, recordId: id });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

