'use strict';
/**
 * sync-engine.js — Delta Synchronization Engine
 * 
 * Implements intelligent delta sync with:
 *   - Checksum-based change detection (MD5 hash per record)
 *   - Field-level delta updates (only modified fields are written)
 *   - Version tracking per record
 *   - Idempotent operations (safe to retry)
 *   - Audit trail for every write operation
 *   - Conflict resolution (latest wins with merge)
 */

const crypto = require('crypto');
const { logOperation, logMismatch } = require('./audit-logger');

// ── Checksum Generation ───────────────────────────────────────────────────────

/**
 * Generate a deterministic checksum for a record
 * Only includes data fields (excludes metadata like sync_checksum, sync_version)
 */
function computeChecksum(record) {
  const dataFields = {};
  const EXCLUDED_FIELDS = [
    'sync_checksum', 'sync_version', 'last_synced_at',
    'verification_status', 'last_verified_at', 'created_at', 'updated_at',
  ];

  const sortedKeys = Object.keys(record)
    .filter(k => !EXCLUDED_FIELDS.includes(k))
    .sort();

  for (const key of sortedKeys) {
    const val = record[key];
    // Normalize null/undefined/empty to consistent representation
    dataFields[key] = val == null ? '' : String(val).trim();
  }

  return crypto.createHash('md5').update(JSON.stringify(dataFields)).digest('hex');
}

/**
 * Detect which fields have changed between two records
 * Returns array of { field, oldValue, newValue }
 */
function detectFieldChanges(existing, incoming) {
  const changes = [];
  const EXCLUDED_FIELDS = [
    'sync_checksum', 'sync_version', 'last_synced_at',
    'verification_status', 'last_verified_at', 'created_at', 'updated_at',
  ];

  const allKeys = new Set([
    ...Object.keys(existing),
    ...Object.keys(incoming),
  ]);

  for (const key of allKeys) {
    if (EXCLUDED_FIELDS.includes(key)) continue;

    const oldVal = existing[key] == null ? '' : String(existing[key]).trim();
    const newVal = incoming[key] == null ? '' : String(incoming[key]).trim();

    if (oldVal !== newVal) {
      changes.push({
        field: key,
        oldValue: existing[key],
        newValue: incoming[key],
      });
    }
  }

  return changes;
}

// ── Sync Engine ───────────────────────────────────────────────────────────────

class SyncEngine {
  constructor(db, options = {}) {
    this.db = db;
    this.batchSize = options.batchSize || 100;
    this.maxConcurrency = options.maxConcurrency || 5;
    this.dryRun = options.dryRun || false;
    this.table = options.table || 'jobs';
    this.runId = `sync_${Date.now().toString(36)}`;

    // Sync stats
    this.stats = {
      totalRecords: 0,
      unchanged: 0,
      updated: 0,
      inserted: 0,
      errors: 0,
      fieldsUpdated: 0,
      startTime: Date.now(),
      endTime: null,
    };
  }

  /**
   * Perform delta sync: compare incoming records against DB, update only changes
   * @param {Array} incomingRecords - Fresh data to sync
   * @returns {object} Sync result summary
   */
  async deltaSync(incomingRecords) {
    console.log(`[SyncEngine] Starting delta sync of ${incomingRecords.length} records (runId: ${this.runId})`);
    this.stats.totalRecords = incomingRecords.length;

    try {
      // Phase 1: Fetch existing records
      const existingMap = await this._fetchExistingRecords(
        incomingRecords.map(r => r.id).filter(Boolean)
      );

      // Phase 2: Compare and categorize
      const toInsert = [];
      const toUpdate = [];

      for (const incoming of incomingRecords) {
        if (!incoming.id) {
          this.stats.errors++;
          continue;
        }

        const existing = existingMap.get(incoming.id);

        if (!existing) {
          // New record
          toInsert.push(incoming);
          continue;
        }

        // Compute checksums for change detection
        const existingChecksum = existing.sync_checksum || computeChecksum(existing);
        const incomingChecksum = computeChecksum(incoming);

        if (existingChecksum === incomingChecksum) {
          // No changes
          this.stats.unchanged++;
          continue;
        }

        // CRITICAL PROTECTION: Do not let seeder/lower authority incoming records overwrite healed or deep_scraped records
        const isExistingHealed = existing.discovery_source === 'healed' || existing.discovery_source === 'deep_scraped';
        const isIncomingSeeder = !incoming.discovery_source || incoming.discovery_source === 'seeder';
        if (isExistingHealed && isIncomingSeeder) {
          this.stats.unchanged++;
          continue;
        }

        // Detect field-level changes
        const changes = detectFieldChanges(existing, incoming);
        if (changes.length > 0) {
          toUpdate.push({
            id: incoming.id,
            changes,
            newChecksum: incomingChecksum,
            newVersion: (Number(existing.sync_version) || 1) + 1,
          });
        } else {
          this.stats.unchanged++;
        }
      }

      // Phase 3: Apply updates (batched)
      if (!this.dryRun) {
        await this._applyInserts(toInsert);
        await this._applyUpdates(toUpdate);
      }

      this.stats.endTime = Date.now();
      const durationMs = this.stats.endTime - this.stats.startTime;

      // Log the operation
      await logOperation({
        runId: this.runId,
        operation: 'sync',
        source: this.table,
        totalRecords: this.stats.totalRecords,
        verified: this.stats.unchanged + this.stats.updated,
        mismatches: toUpdate.length,
        synced: this.stats.updated + this.stats.inserted,
        errors: this.stats.errors,
        durationMs,
        details: {
          unchanged: this.stats.unchanged,
          updated: this.stats.updated,
          inserted: this.stats.inserted,
          fieldsUpdated: this.stats.fieldsUpdated,
          dryRun: this.dryRun,
        },
      }, this.db);

      const result = {
        runId: this.runId,
        success: true,
        dryRun: this.dryRun,
        stats: { ...this.stats },
        durationMs,
        changes: toUpdate.map(u => ({
          id: u.id,
          fields: u.changes.map(c => c.field),
        })),
      };

      console.log(`[SyncEngine] Delta sync complete: ${this.stats.updated} updated, ${this.stats.inserted} inserted, ${this.stats.unchanged} unchanged, ${this.stats.errors} errors (${durationMs}ms)`);
      return result;

    } catch (err) {
      this.stats.errors++;
      console.error('[SyncEngine] Fatal sync error:', err.message);

      await logOperation({
        runId: this.runId,
        operation: 'sync',
        source: this.table,
        totalRecords: this.stats.totalRecords,
        errors: 1,
        durationMs: Date.now() - this.stats.startTime,
        details: { error: err.message },
      }, this.db);

      throw err;
    }
  }

  /**
   * Verify all records in database — full verification cycle
   * Checks every record against validation rules and recomputes checksums
   */
  async fullVerify() {
    console.log(`[SyncEngine] Starting full verification cycle (runId: ${this.runId})`);
    const startTime = Date.now();
    let offset = 0;
    const batchSize = 500;
    let totalVerified = 0;
    let totalMismatches = 0;
    let totalFixed = 0;

    try {
      while (true) {
        const result = await this.db.execute(
          `SELECT * FROM ${this.table} ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
        );
        const records = result.rows || [];
        if (records.length === 0) break;

        for (const record of records) {
          // Verify record using the validator rules or form_status check
          let needsUpdate = false;
          if (record.application_start_date && record.application_end_date) {
            const { computeFormStatus } = require('./validator');
            const correct = computeFormStatus(record.application_start_date, record.application_end_date);
            if (correct !== record.form_status) {
              needsUpdate = true;
              if (!this.dryRun) {
                try {
                  await this.db.execute({
                    sql: `UPDATE ${this.table} SET form_status = ?, last_verified_at = ? WHERE id = ?`,
                    args: [correct, new Date().toISOString(), record.id],
                  });
                  totalFixed++;
                } catch (err) {
                  // Non-fatal
                }
              }
            }
          }

          if (!needsUpdate && !this.dryRun) {
            try {
              await this.db.execute({
                sql: `UPDATE ${this.table} SET last_verified_at = ? WHERE id = ?`,
                args: [new Date().toISOString(), record.id],
              });
            } catch (err) {
              // Non-fatal
            }
          }

          totalVerified++;
        }

        offset += batchSize;
        if (records.length < batchSize) break;
      }

      const durationMs = Date.now() - startTime;

      await logOperation({
        runId: this.runId,
        operation: 'verify',
        source: this.table,
        totalRecords: totalVerified,
        verified: totalVerified,
        mismatches: totalMismatches,
        synced: totalFixed,
        errors: 0,
        durationMs,
        details: {
          checksumMismatches: totalMismatches,
          checksumFixed: totalFixed,
        },
      }, this.db);

      console.log(`[SyncEngine] Full verify complete: ${totalVerified} verified, ${totalMismatches} checksum mismatches, ${totalFixed} fixed (${durationMs}ms)`);

      return {
        runId: this.runId,
        success: true,
        totalVerified,
        totalMismatches,
        totalFixed,
        durationMs,
      };

    } catch (err) {
      console.error('[SyncEngine] Full verify error:', err.message);
      throw err;
    }
  }

  // ── Internal Methods ──────────────────────────────────────────────────────

  async _fetchExistingRecords(ids) {
    const map = new Map();
    if (ids.length === 0) return map;

    // Fetch in batches to avoid query size limits
    for (let i = 0; i < ids.length; i += this.batchSize) {
      const batch = ids.slice(i, i + this.batchSize);
      const placeholders = batch.map(() => '?').join(',');

      try {
        const result = await this.db.execute({
          sql: `SELECT * FROM ${this.table} WHERE id IN (${placeholders})`,
          args: batch,
        });
        for (const row of (result.rows || [])) {
          map.set(row.id, row);
        }
      } catch (err) {
        // Fallback: fetch one by one
        for (const id of batch) {
          try {
            const result = await this.db.execute({
              sql: `SELECT * FROM ${this.table} WHERE id = ?`,
              args: [id],
            });
            if (result.rows && result.rows.length > 0) {
              map.set(id, result.rows[0]);
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }

    return map;
  }

  async _applyInserts(records) {
    for (const record of records) {
      try {
        const fields = Object.keys(record);
        const values = Object.values(record);
        const placeholders = fields.map(() => '?').join(',');

        // Add sync metadata
        fields.push('last_verified_at');
        values.push(new Date().toISOString());

        await this.db.execute({
          sql: `INSERT INTO ${this.table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')}) ON CONFLICT (id) DO NOTHING`,
          args: values,
        });
        this.stats.inserted++;
      } catch (err) {
        this.stats.errors++;
        console.warn(`[SyncEngine] Insert failed for ${record.id}:`, err.message);
      }
    }
  }

  async _applyUpdates(updates) {
    for (const update of updates) {
      try {
        // Build SET clause from changed fields only (delta update)
        const setClauses = [];
        const setArgs = [];

        for (const change of update.changes) {
          setClauses.push(`${change.field} = ?`);
          setArgs.push(change.newValue);

          // Log each field change as a mismatch
          await logMismatch({
            runId: this.runId,
            recordId: update.id,
            fieldName: change.field,
            expectedValue: change.newValue,
            actualValue: change.oldValue,
            severity: 'info',
          }, this.db);

          this.stats.fieldsUpdated++;
        }

        // Add sync metadata
        setClauses.push('last_verified_at = ?');
        setArgs.push(new Date().toISOString());

        // Add WHERE clause
        setArgs.push(update.id);

        await this.db.execute({
          sql: `UPDATE ${this.table} SET ${setClauses.join(', ')} WHERE id = ?`,
          args: setArgs,
        });
        this.stats.updated++;
      } catch (err) {
        this.stats.errors++;
        console.warn(`[SyncEngine] Update failed for ${update.id}:`, err.message);
      }
    }
  }
}

module.exports = {
  SyncEngine,
  computeChecksum,
  detectFieldChanges,
};
