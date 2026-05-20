'use strict';
/**
 * verification-engine.js — Central Verification Orchestrator
 * Ties together: DataSourceManager, ValidationRules, SyncEngine, AuditLogger
 */
const { validateBatch, validateRecord } = require('./validation-rules');
const { SyncEngine, computeChecksum } = require('./sync-engine');
const { logOperation, logMismatch, logMismatchBatch, generateDailySummary, getMetrics } = require('./audit-logger');
const { computeFormStatus } = require('./validator');
const { getSourceStatus, fetchFromAllSources, DatabaseSource, registerSource } = require('./data-source-manager');

class VerificationEngine {
  constructor(db, options = {}) {
    this.db = db;
    this.batchSize = options.batchSize || 500;
    this.timeBudgetMs = options.timeBudgetMs || 80000;
    this.startTime = null;
    this.runId = null;
    this._dbSource = new DatabaseSource(db, 'jobs', { name: 'primary_db' });
    try { registerSource('primary_db', this._dbSource); } catch (e) { /* already registered */ }
  }

  hasTimeBudget() { return !this.startTime || (Date.now() - this.startTime) < this.timeBudgetMs; }
  elapsed() { return this.startTime ? Date.now() - this.startTime : 0; }

  /** Full verification: fetch all → validate → fix statuses → update checksums */
  async runFullVerification() {
    this.startTime = Date.now();
    this.runId = `vf_${Date.now().toString(36)}`;
    const report = { runId: this.runId, type: 'full', phases: {}, totalRecords: 0, validRecords: 0, invalidRecords: 0, mismatchCount: 0, statusUpdates: 0, checksumUpdates: 0, errors: [] };

    try {
      // Phase 1: Fetch
      const allRecords = [];
      let offset = 0;
      while (this.hasTimeBudget()) {
        const r = await this.db.execute(`SELECT * FROM jobs ORDER BY id LIMIT ${this.batchSize} OFFSET ${offset}`);
        if (!r.rows || r.rows.length === 0) break;
        allRecords.push(...r.rows);
        offset += this.batchSize;
        if (r.rows.length < this.batchSize) break;
      }
      report.totalRecords = allRecords.length;
      report.phases.fetch = { records: allRecords.length, elapsed: this.elapsed() };

      // Phase 2: Validate
      const vr = validateBatch(allRecords);
      report.validRecords = vr.validRecords;
      report.invalidRecords = vr.invalidRecords;
      report.phases.validate = { avgScore: vr.avgScore, valid: vr.validRecords, invalid: vr.invalidRecords };

      // Collect mismatches
      const mismatches = [];
      for (const [id, res] of vr.results) {
        for (const issue of [...res.errors, ...res.warnings]) {
          mismatches.push({ runId: this.runId, recordId: id, fieldName: issue.field, expectedValue: `rule:${issue.rule}`, actualValue: issue.message, severity: issue.severity });
        }
      }
      if (mismatches.length > 0 && this.hasTimeBudget()) await logMismatchBatch(mismatches.slice(0, 200), this.db);
      report.mismatchCount = mismatches.length;

      // Phase 3: Fix form_status
      for (const rec of allRecords) {
        if (!this.hasTimeBudget()) break;
        if (!rec.application_start_date || !rec.application_end_date) continue;
        const correct = computeFormStatus(rec.application_start_date, rec.application_end_date);
        if (correct !== rec.form_status) {
          try { await this.db.execute({ sql: "UPDATE jobs SET form_status = ? WHERE id = ?", args: [correct, rec.id] }); report.statusUpdates++; } catch (e) { report.errors.push(e.message); }
        }
      }

      // Phase 4: Checksums
      for (const rec of allRecords) {
        if (!this.hasTimeBudget()) break;
        const cs = computeChecksum(rec);
        if (cs !== rec.sync_checksum) {
          try { await this.db.execute({ sql: "UPDATE jobs SET sync_checksum = ?, verification_status = 'verified', last_synced_at = datetime('now') WHERE id = ?", args: [cs, rec.id] }); report.checksumUpdates++; } catch (e) { /* non-fatal */ }
        }
      }

      report.durationMs = this.elapsed();
      report.success = true;
      await logOperation({ runId: this.runId, operation: 'full_cycle', source: 'primary_db', totalRecords: report.totalRecords, verified: report.validRecords, mismatches: report.mismatchCount, synced: report.statusUpdates + report.checksumUpdates, errors: report.errors.length, durationMs: report.durationMs, details: report.phases }, this.db);
      console.log(`[Verifier] Full: ${report.totalRecords} records, ${report.validRecords} valid, ${report.mismatchCount} mismatches (${report.durationMs}ms)`);
      return report;
    } catch (err) {
      report.success = false; report.error = err.message; report.durationMs = this.elapsed();
      await logOperation({ runId: this.runId, operation: 'full_cycle', source: 'primary_db', totalRecords: report.totalRecords, errors: 1, durationMs: report.durationMs, details: { error: err.message } }, this.db);
      return report;
    }
  }

  /** Incremental: verify only stale/unverified records */
  async runIncrementalVerification(limit = 200) {
    this.startTime = Date.now();
    this.runId = `vi_${Date.now().toString(36)}`;
    const report = { runId: this.runId, type: 'incremental', totalRecords: 0, verified: 0, mismatches: 0, statusUpdates: 0, errors: [] };
    try {
      const r = await this.db.execute(`SELECT * FROM jobs ORDER BY last_synced_at ASC NULLS FIRST LIMIT ${limit}`);
      const records = r.rows || [];
      report.totalRecords = records.length;

      for (const rec of records) {
        if (!this.hasTimeBudget()) break;
        const v = validateRecord(rec);
        if (!v.valid) { report.mismatches++; for (const e of v.errors) { await logMismatch({ runId: this.runId, recordId: rec.id, fieldName: e.field, actualValue: e.message, severity: 'critical' }, this.db); } }
        if (rec.application_start_date && rec.application_end_date) {
          const correct = computeFormStatus(rec.application_start_date, rec.application_end_date);
          if (correct !== rec.form_status) { await this.db.execute({ sql: "UPDATE jobs SET form_status = ? WHERE id = ?", args: [correct, rec.id] }); report.statusUpdates++; }
        }
        const cs = computeChecksum(rec);
        await this.db.execute({ sql: "UPDATE jobs SET sync_checksum = ?, verification_status = 'verified', last_synced_at = datetime('now') WHERE id = ?", args: [cs, rec.id] });
        report.verified++;
      }
      report.durationMs = this.elapsed(); report.success = true;
      await logOperation({ runId: this.runId, operation: 'verify', source: 'primary_db', totalRecords: report.totalRecords, verified: report.verified, mismatches: report.mismatches, durationMs: report.durationMs }, this.db);
      console.log(`[Verifier] Incremental: ${report.verified}/${report.totalRecords} verified (${report.durationMs}ms)`);
      return report;
    } catch (err) { report.success = false; report.error = err.message; report.durationMs = this.elapsed(); return report; }
  }

  /** Detect records with incorrect form_status */
  async detectStaleRecords(limit = 100) {
    this.startTime = Date.now();
    const report = { type: 'stale_detection', staleRecords: [], fixed: 0 };
    const r = await this.db.execute(`SELECT id, job_name, form_status, application_start_date, application_end_date FROM jobs LIMIT ${limit}`);
    for (const rec of (r.rows || [])) {
      if (!rec.application_start_date || !rec.application_end_date) continue;
      const correct = computeFormStatus(rec.application_start_date, rec.application_end_date);
      if (correct !== rec.form_status) {
        report.staleRecords.push({ id: rec.id, jobName: rec.job_name, current: rec.form_status, correct });
        await this.db.execute({ sql: "UPDATE jobs SET form_status = ? WHERE id = ?", args: [correct, rec.id] });
        report.fixed++;
      }
    }
    report.durationMs = this.elapsed(); report.success = true;
    return report;
  }

  /** Aggregated dashboard data */
  async getDashboardData() {
    const metrics = getMetrics();
    const sourceStatus = getSourceStatus();
    const summary = generateDailySummary();
    let dbStats = {};
    try {
      const total = await this.db.execute('SELECT COUNT(*) as cnt FROM jobs');
      const verified = await this.db.execute("SELECT COUNT(*) as cnt FROM jobs WHERE verification_status = 'verified'");
      const catDist = await this.db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC');
      const statusDist = await this.db.execute('SELECT form_status, COUNT(*) as cnt FROM jobs GROUP BY form_status ORDER BY cnt DESC');
      dbStats = { totalRecords: Number(total.rows[0]?.cnt || 0), verifiedRecords: Number(verified.rows[0]?.cnt || 0), categoryDistribution: catDist.rows || [], statusDistribution: statusDist.rows || [] };
    } catch (e) { dbStats = { error: e.message }; }
    return { metrics, sourceStatus, summary, dbStats, timestamp: new Date().toISOString() };
  }
}

module.exports = { VerificationEngine };
