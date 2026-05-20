'use strict';
/**
 * audit-logger.js — Structured Audit Logging & Monitoring
 * 
 * Provides centralized logging for all verification operations:
 *   - Per-operation structured logs
 *   - Field-level mismatch tracking
 *   - Daily summary report generation
 *   - Alert system for critical mismatches
 *   - Metrics aggregation (success rate, latency, failure counts)
 * 
 * Stores logs in Supabase `verification_logs` and `verification_mismatches` tables.
 * Falls back to in-memory ring buffer if DB writes fail.
 */

const crypto = require('crypto');

// ── In-memory ring buffers (fallback + fast access) ───────────────────────────
const MAX_LOG_ENTRIES = 200;
const MAX_MISMATCH_ENTRIES = 500;
const MAX_ALERT_ENTRIES = 50;

const _operationLogs = [];
const _mismatchLogs = [];
const _alerts = [];
const _metrics = {
  totalVerifications: 0,
  totalSyncs: 0,
  totalMismatches: 0,
  totalErrors: 0,
  totalRecordsProcessed: 0,
  lastRunTimestamp: null,
  lastRunDurationMs: 0,
  avgDurationMs: 0,
  successRate: 100,
  _durations: [],    // last 50 durations for avg
};

// ── Helper: Generate unique ID ────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

// ── Helper: IST timestamp ─────────────────────────────────────────────────────
function getISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

// ── Operation Logging ─────────────────────────────────────────────────────────

/**
 * Log a verification/sync operation
 * @param {object} entry
 * @param {string} entry.runId - Run identifier
 * @param {string} entry.operation - 'verify' | 'sync' | 'validate' | 'full_cycle'
 * @param {string} entry.source - Data source name
 * @param {number} entry.totalRecords - Records processed
 * @param {number} entry.verified - Records verified successfully
 * @param {number} entry.mismatches - Records with mismatches
 * @param {number} entry.synced - Records synced
 * @param {number} entry.errors - Error count
 * @param {object} entry.details - Additional details
 * @param {number} entry.durationMs - Operation duration
 */
async function logOperation(entry, db = null) {
  const log = {
    id: generateId(),
    run_id: entry.runId || generateId(),
    operation: entry.operation || 'unknown',
    source: entry.source || 'system',
    total_records: entry.totalRecords || 0,
    verified: entry.verified || 0,
    mismatches: entry.mismatches || 0,
    synced: entry.synced || 0,
    errors: entry.errors || 0,
    details: entry.details || {},
    duration_ms: entry.durationMs || 0,
    created_at: new Date().toISOString(),
    timestamp_ist: getISTTimestamp(),
  };

  // Update in-memory buffer
  _operationLogs.push(log);
  if (_operationLogs.length > MAX_LOG_ENTRIES) _operationLogs.shift();

  // Update metrics
  _updateMetrics(log);

  // Persist to DB if available
  if (db) {
    try {
      await db.execute({
        sql: `INSERT INTO verification_logs (id, run_id, operation, source, total_records, verified, mismatches, synced, errors, details, duration_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          log.id, log.run_id, log.operation, log.source,
          log.total_records, log.verified, log.mismatches, log.synced,
          log.errors, JSON.stringify(log.details), log.duration_ms,
        ],
      });
    } catch (err) {
      console.warn('[AuditLogger] DB write failed (non-fatal):', err.message);
    }
  }

  return log;
}

// ── Mismatch Logging ──────────────────────────────────────────────────────────

/**
 * Log a field-level mismatch
 */
async function logMismatch(entry, db = null) {
  const mismatch = {
    id: generateId(),
    run_id: entry.runId || 'unknown',
    record_id: entry.recordId || 'unknown',
    field_name: entry.fieldName || 'unknown',
    expected_value: entry.expectedValue != null ? String(entry.expectedValue).substring(0, 500) : null,
    actual_value: entry.actualValue != null ? String(entry.actualValue).substring(0, 500) : null,
    severity: entry.severity || 'warning',
    resolved: false,
    created_at: new Date().toISOString(),
    timestamp_ist: getISTTimestamp(),
  };

  // In-memory buffer
  _mismatchLogs.push(mismatch);
  if (_mismatchLogs.length > MAX_MISMATCH_ENTRIES) _mismatchLogs.shift();
  _metrics.totalMismatches++;

  // Check for alert conditions
  _checkAlertConditions(mismatch);

  // Persist to DB
  if (db) {
    try {
      await db.execute({
        sql: `INSERT INTO verification_mismatches (id, run_id, record_id, field_name, expected_value, actual_value, severity, resolved)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mismatch.id, mismatch.run_id, mismatch.record_id,
          mismatch.field_name, mismatch.expected_value,
          mismatch.actual_value, mismatch.severity, false,
        ],
      });
    } catch (err) {
      // Non-fatal — already logged in memory
    }
  }

  return mismatch;
}

/**
 * Log multiple mismatches in batch (for efficiency)
 */
async function logMismatchBatch(entries, db = null) {
  const results = [];
  for (const entry of entries) {
    results.push(await logMismatch(entry, db));
  }
  return results;
}

// ── Alert System ──────────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = {
  criticalMismatchCount: 10,     // Alert if >10 critical mismatches in one run
  errorRatePercent: 20,          // Alert if error rate exceeds 20%
  consecutiveFailures: 3,        // Alert after 3 consecutive failures
};

let _consecutiveFailures = 0;

function _checkAlertConditions(mismatch) {
  if (mismatch.severity === 'critical') {
    // Count critical mismatches in current run
    const criticalInRun = _mismatchLogs.filter(
      m => m.run_id === mismatch.run_id && m.severity === 'critical'
    ).length;

    if (criticalInRun >= ALERT_THRESHOLDS.criticalMismatchCount) {
      _raiseAlert('CRITICAL_MISMATCH_SURGE', {
        runId: mismatch.run_id,
        criticalCount: criticalInRun,
        message: `${criticalInRun} critical mismatches detected in run ${mismatch.run_id}`,
      });
    }
  }
}

function _raiseAlert(type, details) {
  const alert = {
    id: generateId(),
    type,
    severity: 'critical',
    details,
    acknowledged: false,
    created_at: new Date().toISOString(),
    timestamp_ist: getISTTimestamp(),
  };

  _alerts.push(alert);
  if (_alerts.length > MAX_ALERT_ENTRIES) _alerts.shift();

  console.error(`[ALERT] ${type}: ${details.message || JSON.stringify(details)}`);
  return alert;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function _updateMetrics(log) {
  if (log.operation === 'verify' || log.operation === 'full_cycle') {
    _metrics.totalVerifications++;
  }
  if (log.operation === 'sync') {
    _metrics.totalSyncs++;
  }
  _metrics.totalErrors += log.errors;
  _metrics.totalRecordsProcessed += log.total_records;
  _metrics.lastRunTimestamp = log.created_at;
  _metrics.lastRunDurationMs = log.duration_ms;

  // Track durations for average calculation
  _metrics._durations.push(log.duration_ms);
  if (_metrics._durations.length > 50) _metrics._durations.shift();
  _metrics.avgDurationMs = Math.round(
    _metrics._durations.reduce((a, b) => a + b, 0) / _metrics._durations.length
  );

  // Success rate
  const totalOps = _metrics.totalVerifications + _metrics.totalSyncs;
  if (totalOps > 0) {
    const errorOps = _operationLogs.filter(l => l.errors > 0).length;
    _metrics.successRate = Math.round(((totalOps - errorOps) / totalOps) * 100);
  }

  // Track consecutive failures
  if (log.errors > 0) {
    _consecutiveFailures++;
    if (_consecutiveFailures >= ALERT_THRESHOLDS.consecutiveFailures) {
      _raiseAlert('CONSECUTIVE_FAILURES', {
        count: _consecutiveFailures,
        message: `${_consecutiveFailures} consecutive operation failures detected`,
      });
    }
  } else {
    _consecutiveFailures = 0;
  }
}

// ── Summary Report Generation ─────────────────────────────────────────────────

/**
 * Generate a daily summary report from accumulated data
 */
function generateDailySummary() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const recentLogs = _operationLogs.filter(l => l.created_at >= oneDayAgo);
  const recentMismatches = _mismatchLogs.filter(m => m.created_at >= oneDayAgo);
  const recentAlerts = _alerts.filter(a => a.created_at >= oneDayAgo);

  // Mismatch breakdown by field
  const mismatchByField = {};
  const mismatchBySeverity = { critical: 0, warning: 0, info: 0 };
  for (const m of recentMismatches) {
    mismatchByField[m.field_name] = (mismatchByField[m.field_name] || 0) + 1;
    mismatchBySeverity[m.severity] = (mismatchBySeverity[m.severity] || 0) + 1;
  }

  // Operation breakdown
  const opBreakdown = {};
  let totalDuration = 0;
  for (const l of recentLogs) {
    opBreakdown[l.operation] = (opBreakdown[l.operation] || 0) + 1;
    totalDuration += l.duration_ms;
  }

  return {
    period: '24h',
    generatedAt: getISTTimestamp(),
    operations: {
      total: recentLogs.length,
      breakdown: opBreakdown,
      totalDurationMs: totalDuration,
      avgDurationMs: recentLogs.length > 0 ? Math.round(totalDuration / recentLogs.length) : 0,
    },
    records: {
      totalProcessed: recentLogs.reduce((a, l) => a + l.total_records, 0),
      totalVerified: recentLogs.reduce((a, l) => a + l.verified, 0),
      totalSynced: recentLogs.reduce((a, l) => a + l.synced, 0),
      totalErrors: recentLogs.reduce((a, l) => a + l.errors, 0),
    },
    mismatches: {
      total: recentMismatches.length,
      bySeverity: mismatchBySeverity,
      byField: mismatchByField,
      topFields: Object.entries(mismatchByField)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([field, count]) => ({ field, count })),
    },
    alerts: {
      total: recentAlerts.length,
      unacknowledged: recentAlerts.filter(a => !a.acknowledged).length,
      recent: recentAlerts.slice(-5),
    },
    health: {
      successRate: _metrics.successRate,
      consecutiveFailures: _consecutiveFailures,
      status: _consecutiveFailures >= 3 ? 'degraded' : _metrics.successRate < 80 ? 'warning' : 'healthy',
    },
  };
}

// ── Getters ───────────────────────────────────────────────────────────────────

function getMetrics() {
  return { ..._metrics, _durations: undefined };
}

function getRecentLogs(limit = 50) {
  return _operationLogs.slice(-limit);
}

function getRecentMismatches(limit = 100) {
  return _mismatchLogs.slice(-limit);
}

function getAlerts(unacknowledgedOnly = false) {
  if (unacknowledgedOnly) {
    return _alerts.filter(a => !a.acknowledged);
  }
  return [..._alerts];
}

function acknowledgeAlert(alertId) {
  const alert = _alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

function getSystemHealth() {
  return {
    status: _consecutiveFailures >= 3 ? 'degraded' : _metrics.successRate < 80 ? 'warning' : 'healthy',
    metrics: getMetrics(),
    pendingAlerts: _alerts.filter(a => !a.acknowledged).length,
    lastRun: _metrics.lastRunTimestamp,
    timestamp: getISTTimestamp(),
  };
}

module.exports = {
  logOperation,
  logMismatch,
  logMismatchBatch,
  generateDailySummary,
  getMetrics,
  getRecentLogs,
  getRecentMismatches,
  getAlerts,
  acknowledgeAlert,
  getSystemHealth,
  ALERT_THRESHOLDS,
};
