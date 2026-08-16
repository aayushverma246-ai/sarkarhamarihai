'use strict';
/**
 * data-source-manager.js — Plug-and-Play Data Source Abstraction
 * 
 * Provides:
 *   - Source registry: register/unregister data sources dynamically
 *   - Adapters: DatabaseSource, ApiSource, ScraperSource
 *   - Health checking per source
 *   - Source rotation with circuit breaker integration
 *   - Parallel fetching across multiple sources
 */

const { CircuitBreaker, retryWithBackoff } = require('./scraper-core');

// ── Source Registry ───────────────────────────────────────────────────────────

const _sources = new Map();
const _breaker = new CircuitBreaker(3, 6 * 60 * 60 * 1000); // 3 failures, 6h cooldown

/**
 * Register a data source
 * @param {string} name - Unique source name
 * @param {object} source - Source adapter implementing { fetch(), healthCheck(), getName() }
 */
function registerSource(name, source) {
  if (!source.fetch || typeof source.fetch !== 'function') {
    throw new Error(`Source '${name}' must implement fetch() method`);
  }
  _sources.set(name, {
    ...source,
    name,
    registered_at: new Date().toISOString(),
    lastFetch: null,
    lastHealthCheck: null,
    healthy: true,
    fetchCount: 0,
    errorCount: 0,
  });
  console.log(`[DataSourceManager] Registered source: ${name}`);
}

/**
 * Unregister a data source
 */
function unregisterSource(name) {
  _sources.delete(name);
}

/**
 * Get all registered source names
 */
function getSourceNames() {
  return Array.from(_sources.keys());
}

/**
 * Get detailed status for all sources
 */
function getSourceStatus() {
  const status = {};
  for (const [name, source] of _sources) {
    status[name] = {
      name,
      healthy: source.healthy,
      lastFetch: source.lastFetch,
      lastHealthCheck: source.lastHealthCheck,
      fetchCount: source.fetchCount,
      errorCount: source.errorCount,
      circuitOpen: _breaker.isOpen(name),
      registered_at: source.registered_at,
    };
  }
  return status;
}

// ── Fetch from Source ──────────────────────────────────────────────────────────

/**
 * Fetch records from a specific source with retry and circuit breaker
 * @param {string} name - Source name
 * @param {object} options - Fetch options passed to the source adapter
 * @returns {{ records: Array, source: string, elapsed: number }}
 */
async function fetchFromSource(name, options = {}) {
  const source = _sources.get(name);
  if (!source) {
    throw new Error(`Source '${name}' not registered`);
  }

  if (_breaker.isOpen(name)) {
    console.log(`[DataSourceManager] Circuit OPEN for ${name}, skipping`);
    return { records: [], source: name, elapsed: 0, skipped: true };
  }

  const start = Date.now();
  try {
    const records = await retryWithBackoff(() => source.fetch(options), 2, 1000);
    _breaker.recordSuccess(name);
    source.lastFetch = new Date().toISOString();
    source.fetchCount++;
    source.healthy = true;

    const elapsed = Date.now() - start;
    console.log(`[DataSourceManager] ${name}: fetched ${records.length} records (${elapsed}ms)`);
    return { records, source: name, elapsed };

  } catch (err) {
    _breaker.recordFailure(name);
    source.errorCount++;
    source.healthy = false;

    console.error(`[DataSourceManager] ${name} FAILED: ${err.message}`);
    return { records: [], source: name, elapsed: Date.now() - start, error: err.message };
  }
}

/**
 * Fetch from all registered sources (parallel with concurrency limit)
 * @param {object} options - Fetch options
 * @param {number} maxConcurrency - Max parallel fetches
 * @returns {Array<{ records, source, elapsed }>}
 */
async function fetchFromAllSources(options = {}, maxConcurrency = 3) {
  const names = Array.from(_sources.keys());
  const results = [];

  // Process in batches for concurrency control
  for (let i = 0; i < names.length; i += maxConcurrency) {
    const batch = names.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map(name => fetchFromSource(name, options))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          records: [],
          source: 'unknown',
          elapsed: 0,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }
  }

  return results;
}

// ── Health Check ──────────────────────────────────────────────────────────────

/**
 * Check health of a specific source
 */
async function healthCheckSource(name) {
  const source = _sources.get(name);
  if (!source) return { name, healthy: false, error: 'Not registered' };

  try {
    if (source.healthCheck && typeof source.healthCheck === 'function') {
      const healthy = await source.healthCheck();
      source.healthy = healthy;
      source.lastHealthCheck = new Date().toISOString();
      return { name, healthy, lastCheck: source.lastHealthCheck };
    }

    // Default: try a small fetch
    const result = await source.fetch({ limit: 1 });
    const healthy = Array.isArray(result) && result.length >= 0;
    source.healthy = healthy;
    source.lastHealthCheck = new Date().toISOString();
    return { name, healthy, lastCheck: source.lastHealthCheck };
  } catch (err) {
    source.healthy = false;
    source.lastHealthCheck = new Date().toISOString();
    return { name, healthy: false, error: err.message, lastCheck: source.lastHealthCheck };
  }
}

/**
 * Check health of all sources
 */
async function healthCheckAll() {
  const names = Array.from(_sources.keys());
  const results = await Promise.allSettled(
    names.map(name => healthCheckSource(name))
  );

  return results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', healthy: false, error: r.reason?.message }
  );
}

// ── Built-in Source Adapters ──────────────────────────────────────────────────

/**
 * Database Source — reads records from a DB table
 */
class DatabaseSource {
  constructor(db, table = 'jobs', options = {}) {
    this.db = db;
    this.table = table;
    this.batchSize = options.batchSize || 1000;
    this.name = options.name || `db:${table}`;
  }

  getName() { return this.name; }

  async fetch(options = {}) {
    const limit = options.limit || 10000;
    const records = [];
    let offset = 0;

    while (records.length < limit) {
      const batchLimit = Math.min(this.batchSize, limit - records.length);
      const result = await this.db.execute(
        `SELECT * FROM ${this.table} ORDER BY id LIMIT ${batchLimit} OFFSET ${offset}`
      );
      const rows = result.rows || [];
      records.push(...rows);
      if (rows.length < batchLimit) break;
      offset += batchLimit;
    }

    return records;
  }

  async healthCheck() {
    try {
      const result = await this.db.execute(`SELECT COUNT(*) as cnt FROM ${this.table}`);
      return Number(result.rows[0]?.cnt) >= 0;
    } catch {
      return false;
    }
  }
}

/**
 * Scraper Source — wraps existing scraper modules
 */
class ScraperSource {
  constructor(scraperModule, options = {}) {
    this.scraper = scraperModule;
    this.name = options.name || scraperModule.name || 'scraper';
  }

  getName() { return this.name; }

  async fetch(options = {}) {
    const result = await this.scraper.scrape();
    return result.exams || [];
  }

  async healthCheck() {
    return true; // Scrapers are always "available" — they fail at scrape time
  }
}

/**
 * API Source — fetches from an HTTP endpoint
 */
class ApiSource {
  constructor(config) {
    this.url = config.url;
    this.headers = config.headers || {};
    this.method = config.method || 'GET';
    this.name = config.name || `api:${new URL(config.url).hostname}`;
    this.transform = config.transform || (data => data);
  }

  getName() { return this.name; }

  async fetch(options = {}) {
    const axios = require('axios');
    const response = await axios({
      method: this.method,
      url: this.url,
      headers: this.headers,
      timeout: options.timeout || 30000,
    });
    return this.transform(response.data);
  }

  async healthCheck() {
    try {
      const axios = require('axios');
      const response = await axios.head(this.url, {
        timeout: 5000,
        headers: this.headers,
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }
}

module.exports = {
  registerSource,
  unregisterSource,
  getSourceNames,
  getSourceStatus,
  fetchFromSource,
  fetchFromAllSources,
  healthCheckSource,
  healthCheckAll,
  DatabaseSource,
  ScraperSource,
  ApiSource,
};
