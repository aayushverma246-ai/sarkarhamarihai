'use strict';
/**
 * scraper-core.js — Production-grade scraper orchestrator
 * 
 * Features:
 *   - Circuit breaker: marks source inactive after 3 consecutive failures
 *   - Exponential backoff retry (1s → 2s → 4s)
 *   - Time-budget aware: stops before Vercel timeout
 *   - Per-source error isolation: one crash never kills the pipeline
 *   - Structured logging to scraper_logs table
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor(maxFailures = 3, cooldownMs = 24 * 60 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.cooldownMs = cooldownMs;
    this.failures = {};      // { sourceName: count }
    this.lastFailure = {};   // { sourceName: timestamp }
  }

  isOpen(sourceName) {
    const count = this.failures[sourceName] || 0;
    if (count >= this.maxFailures) {
      const lastFail = this.lastFailure[sourceName] || 0;
      if (Date.now() - lastFail < this.cooldownMs) {
        return true; // circuit is open, skip this source
      }
      // Cooldown expired, reset
      this.failures[sourceName] = 0;
    }
    return false;
  }

  recordFailure(sourceName) {
    this.failures[sourceName] = (this.failures[sourceName] || 0) + 1;
    this.lastFailure[sourceName] = Date.now();
  }

  recordSuccess(sourceName) {
    this.failures[sourceName] = 0;
  }

  getStatus() {
    return { failures: { ...this.failures }, lastFailure: { ...this.lastFailure } };
  }
}

// ── Retry with Backoff ────────────────────────────────────────────────────────
async function retryWithBackoff(fn, maxRetries = 2, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ── Scraper Runner ────────────────────────────────────────────────────────────
class ScraperRunner {
  constructor(options = {}) {
    this.timeBudgetMs = options.timeBudgetMs || 75000; // 75s (leave margin for Vercel's 90s)
    this.startTime = Date.now();
    this.breaker = new CircuitBreaker(3, 6 * 60 * 60 * 1000); // 6h cooldown
    this.results = [];
    this.sb = getSb();
  }

  hasTimeBudget() {
    return (Date.now() - this.startTime) < this.timeBudgetMs;
  }

  elapsed() {
    return Date.now() - this.startTime;
  }

  /**
   * Run all scraper modules sequentially, respecting circuit breaker + time budget
   */
  async runAll(scraperModules) {
    const runId = `run_${Date.now()}`;
    console.log(`[ScraperRunner] Starting run ${runId} with ${scraperModules.length} scrapers`);

    for (const scraper of scraperModules) {
      if (!this.hasTimeBudget()) {
        console.log(`[ScraperRunner] Time budget exhausted after ${this.elapsed()}ms, stopping.`);
        break;
      }

      const sourceName = scraper.name || 'unknown';

      // Circuit breaker check
      if (this.breaker.isOpen(sourceName)) {
        console.log(`[ScraperRunner] ⚡ Circuit OPEN for ${sourceName}, skipping.`);
        this.results.push({ source: sourceName, status: 'circuit_open', exams: 0, errors: 0 });
        continue;
      }

      try {
        console.log(`[ScraperRunner] Scraping ${sourceName}...`);
        const result = await retryWithBackoff(() => scraper.scrape(), 2, 1000);

        this.breaker.recordSuccess(sourceName);
        const examCount = (result.exams || []).length;
        const errCount = (result.errors || []).length;

        this.results.push({
          source: sourceName,
          status: 'success',
          exams: examCount,
          errors: errCount,
          errorDetails: result.errors || [],
        });

        console.log(`[ScraperRunner] ✅ ${sourceName}: ${examCount} exams, ${errCount} errors`);
      } catch (err) {
        this.breaker.recordFailure(sourceName);
        this.results.push({
          source: sourceName,
          status: 'failed',
          exams: 0,
          errors: 1,
          errorDetails: [err.message],
        });
        console.error(`[ScraperRunner] ❌ ${sourceName} FAILED: ${err.message}`);
        // DO NOT THROW — continue to next scraper
      }
    }

    // Log this run
    await this.logRun(runId);

    return {
      runId,
      elapsed: this.elapsed(),
      scrapers: this.results,
      circuitBreaker: this.breaker.getStatus(),
    };
  }

  /**
   * Collect all scraped exams from results
   */
  getAllExams() {
    const exams = [];
    for (const r of this.results) {
      if (r.status === 'success' && r._exams) {
        exams.push(...r._exams);
      }
    }
    return exams;
  }

  async logRun(runId) {
    try {
      await this.sb.from('scraper_logs').insert({
        run_id: runId,
        started_at: new Date(this.startTime).toISOString(),
        finished_at: new Date().toISOString(),
        elapsed_ms: this.elapsed(),
        results: this.results,
        circuit_breaker: this.breaker.getStatus(),
      });
    } catch (err) {
      console.error('[ScraperRunner] Failed to log run:', err.message);
      // Don't crash — logging failure is non-fatal
    }
  }
}

module.exports = { ScraperRunner, CircuitBreaker, retryWithBackoff, getSb };
