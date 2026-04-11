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

      // 3b. Duplicate detection
      const dedupKey = `${(job.job_name || '').toLowerCase().trim()}|${(job.organization || '').toLowerCase().trim()}|${job.application_start_date}|${job.application_end_date}`;
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

      // 3e. Selection process fill
      if (!job.selection_process || job.selection_process.trim().length < 10) {
        const cat = normalizedCat || job.job_category;
        const template = SELECTION_PROCESS_TEMPLATES[cat];
        if (template) {
          selectionToFix.push({ id: job.id, category: cat });
        }
      }
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

    // 4e. Fill selection processes
    for (const fix of selectionToFix) {
      const template = SELECTION_PROCESS_TEMPLATES[fix.category];
      if (template) {
        try {
          await db.execute({
            sql: "UPDATE jobs SET selection_process = ? WHERE id = ? AND (selection_process IS NULL OR selection_process = '')",
            args: [template, fix.id]
          });
          report.selectionProcessFilled++;
        } catch (e) {
          report.errors.push(`Failed to fill selection process for ${fix.id}: ${e.message}`);
        }
      }
    }
    if (report.selectionProcessFilled > 0) {
      console.log(`[Audit] Filled ${report.selectionProcessFilled} selection processes`);
    }

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

module.exports = router;
