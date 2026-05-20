'use strict';
/**
 * scheduler.js — Cron-like Scheduling Engine
 * 
 * Configurable interval scheduling with retry, backoff, and execution tracking.
 * Supports: daily full verify, hourly delta sync, periodic stale checks.
 */

const { retryWithBackoff } = require('./scraper-core');

class Scheduler {
  constructor(options = {}) {
    this.tasks = new Map();
    this.executionLog = [];  // Ring buffer
    this.maxLogEntries = options.maxLogEntries || 100;
    this.running = false;
    this._intervals = [];
  }

  /**
   * Register a scheduled task
   * @param {string} name - Task name
   * @param {object} config
   * @param {Function} config.handler - Async function to execute
   * @param {number} config.intervalMs - Interval in milliseconds
   * @param {number} config.maxRetries - Max retry attempts (default: 3)
   * @param {boolean} config.enabled - Whether task is active (default: true)
   */
  registerTask(name, config) {
    this.tasks.set(name, {
      name,
      handler: config.handler,
      intervalMs: config.intervalMs,
      maxRetries: config.maxRetries || 3,
      enabled: config.enabled !== false,
      lastRun: null,
      lastResult: null,
      lastError: null,
      runCount: 0,
      errorCount: 0,
      consecutiveFailures: 0,
    });
    console.log(`[Scheduler] Registered task: ${name} (every ${this._formatInterval(config.intervalMs)})`);
  }

  /** Start all scheduled tasks */
  start() {
    if (this.running) return;
    this.running = true;
    console.log(`[Scheduler] Starting ${this.tasks.size} tasks...`);

    for (const [name, task] of this.tasks) {
      if (!task.enabled) continue;
      const interval = setInterval(() => this._executeTask(name), task.intervalMs);
      this._intervals.push(interval);
      // Run immediately on start
      this._executeTask(name);
    }
  }

  /** Stop all scheduled tasks */
  stop() {
    this.running = false;
    for (const interval of this._intervals) clearInterval(interval);
    this._intervals = [];
    console.log('[Scheduler] All tasks stopped.');
  }

  /** Execute a single task by name (for manual triggering / cron endpoints) */
  async executeTask(name) {
    return this._executeTask(name);
  }

  /** Get status of all tasks */
  getStatus() {
    const status = {};
    for (const [name, task] of this.tasks) {
      status[name] = {
        name, enabled: task.enabled,
        intervalMs: task.intervalMs,
        interval: this._formatInterval(task.intervalMs),
        lastRun: task.lastRun,
        runCount: task.runCount,
        errorCount: task.errorCount,
        consecutiveFailures: task.consecutiveFailures,
        lastError: task.lastError,
      };
    }
    return status;
  }

  /** Get execution log */
  getExecutionLog(limit = 50) {
    return this.executionLog.slice(-limit);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async _executeTask(name) {
    const task = this.tasks.get(name);
    if (!task || !task.enabled) return null;

    const startTime = Date.now();
    const entry = { task: name, startTime: new Date().toISOString(), success: false, result: null, error: null, durationMs: 0 };

    try {
      const result = await retryWithBackoff(() => task.handler(), task.maxRetries, 2000);
      task.lastRun = new Date().toISOString();
      task.lastResult = result;
      task.lastError = null;
      task.runCount++;
      task.consecutiveFailures = 0;
      entry.success = true;
      entry.result = typeof result === 'object' ? { success: result.success, type: result.type, totalRecords: result.totalRecords } : result;
    } catch (err) {
      task.lastRun = new Date().toISOString();
      task.lastError = err.message;
      task.errorCount++;
      task.consecutiveFailures++;
      entry.error = err.message;
      console.error(`[Scheduler] Task '${name}' failed (attempt ${task.consecutiveFailures}): ${err.message}`);
    }

    entry.durationMs = Date.now() - startTime;
    this.executionLog.push(entry);
    if (this.executionLog.length > this.maxLogEntries) this.executionLog.shift();
    return entry;
  }

  _formatInterval(ms) {
    if (ms >= 86400000) return `${Math.round(ms / 86400000)}d`;
    if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`;
    if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
    return `${ms}ms`;
  }
}

// ── Factory: Create pre-configured scheduler for the verification system ──────

function createVerificationScheduler(verificationEngine) {
  const scheduler = new Scheduler();

  scheduler.registerTask('daily_full_verify', {
    handler: () => verificationEngine.runFullVerification(),
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRetries: 2,
  });

  scheduler.registerTask('hourly_incremental', {
    handler: () => verificationEngine.runIncrementalVerification(200),
    intervalMs: 60 * 60 * 1000, // 1 hour
    maxRetries: 3,
  });

  scheduler.registerTask('stale_check', {
    handler: () => verificationEngine.detectStaleRecords(100),
    intervalMs: 5 * 60 * 1000, // 5 minutes
    maxRetries: 2,
  });

  return scheduler;
}

module.exports = { Scheduler, createVerificationScheduler };
