/**
 * /api/cron/hourly-update — Self-healing scraping pipeline
 * 
 * Runs scrapers in rotation (2-3 per invocation to fit in 90s).
 * Uses a cursor in scraper_queue to track which scrapers ran last.
 * Called hourly by cron-job.org.
 */
'use strict';

const { getSb } = require('../../backend/src/engines/scraper-core');
const { deduplicateBatch } = require('../../backend/src/engines/deduplicator');
const { parseEligibility } = require('../../backend/src/engines/eligibility');
const { computeFormStatus } = require('../../backend/src/engines/validator');

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const sb = getSb();
  const report = { phases: {}, errors: [] };
  const maxMsQuery = req.query?.maxDuration ? parseInt(req.query.maxDuration) : 80000; // default 80s as Vercel allows up to 90s
  const MAX_MS = Math.min(maxMsQuery, 85000);

  try {
    // ── Determine which scrapers to run this cycle ──
    const allScrapers = require('../../backend/src/scrapers/index');
    
    // Get rotation cursor from scraper_queue
    let offset = 0;
    const { data: cursor } = await sb.from('scraper_queue').select('*').eq('source_name', '_cursor').single();
    if (cursor) {
      offset = (cursor.consecutive_failures || 0) % allScrapers.length;
    }
    
    // Pick 3 scrapers for this run (rotates through all over multiple hours)
    const BATCH_SIZE = 3;
    const selectedScrapers = [];
    for (let i = 0; i < BATCH_SIZE && i < allScrapers.length; i++) {
      selectedScrapers.push(allScrapers[(offset + i) % allScrapers.length]);
    }
    const nextOffset = (offset + BATCH_SIZE) % allScrapers.length;

    // Update cursor
    await sb.from('scraper_queue').upsert({ 
      source_name: '_cursor', 
      consecutive_failures: nextOffset,
      last_run_at: new Date().toISOString()
    }, { onConflict: 'source_name' });

    // ── PHASE 1: SCRAPE ──
    let allExams = [];
    for (const mod of selectedScrapers) {
      if ((Date.now() - startTime) > MAX_MS * 0.4) break;
      try {
        const result = await mod.scrape();
        allExams.push(...(result.exams || []));
        report.errors.push(...(result.errors || []).map(e => `${mod.name}: ${e}`));
      } catch (e) {
        report.errors.push(`${mod.name}: FATAL: ${e.message}`);
      }
    }
    report.phases.scrape = { 
      scrapers_run: selectedScrapers.map(s => s.name),
      total_scraped: allExams.length 
    };

    // ── PHASE 2: VALIDATE ──
    const validated = [];
    for (const exam of allExams) {
      if (!exam.job_name || exam.job_name.length < 5 || !exam.organization) continue;
      if (exam.application_start_date && exam.application_end_date) {
        exam.form_status = computeFormStatus(exam.application_start_date, exam.application_end_date);
      }
      const elig = parseEligibility(exam.job_name, exam.qualification_required, exam.minimum_age, exam.maximum_age, exam.job_category);
      exam.eligibility_json = JSON.stringify(elig);
      exam.last_verified_at = new Date().toISOString();
      validated.push(exam);
    }
    report.phases.validate = { validated: validated.length };

    // ── PHASE 3: DEDUPLICATE ──
    let existingJobs = [];
    for (let p = 0; p < 20; p++) {
      if ((Date.now() - startTime) > MAX_MS * 0.6) break;
      const { data } = await sb.from('jobs')
        .select('id, job_name, organization, qualification_required, application_start_date, application_end_date, salary_min, salary_max, official_website_link, syllabus, selection_process, minimum_age, maximum_age, form_status, discovery_source, last_verified_at')
        .range(p * 1000, (p + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      existingJobs.push(...data);
      if (data.length < 1000) break;
    }

    const { newExams, updatedExams, duplicates } = await deduplicateBatch(validated, existingJobs);
    report.phases.dedup = { new: newExams.length, updated: updatedExams.length, duplicates: duplicates.length };

    // ── PHASE 4: UPSERT ──
    let insertedCount = 0, updatedCount = 0;
    for (let i = 0; i < newExams.length; i += 50) {
      if ((Date.now() - startTime) > MAX_MS * 0.85) break;
      const batch = newExams.slice(i, i + 50);
      const { error } = await sb.from('jobs').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) insertedCount += batch.length;
      else report.errors.push(`Insert: ${error.message}`);
    }
    for (const exam of updatedExams) {
      if ((Date.now() - startTime) > MAX_MS * 0.9) break;
      const { id, ...data } = exam;
      const { error } = await sb.from('jobs').update(data).eq('id', id);
      if (!error) updatedCount++; else report.errors.push(`Update ${id}: ${error.message}`);
    }
    report.phases.upsert = { inserted: insertedCount, updated: updatedCount };

    // ── PHASE 5: VERIFY STALE ──
    if ((Date.now() - startTime) < MAX_MS * 0.95) {
      const { data: stale } = await sb.from('jobs')
        .select('id, application_start_date, application_end_date, form_status')
        .order('last_verified_at', { ascending: true }).limit(30);
      let verified = 0;
      for (const job of (stale || [])) {
        if ((Date.now() - startTime) > MAX_MS) break;
        const upd = { last_verified_at: new Date().toISOString() };
        if (job.application_start_date && job.application_end_date) {
          const ns = computeFormStatus(job.application_start_date, job.application_end_date);
          if (ns !== job.form_status) upd.form_status = ns;
        }
        await sb.from('jobs').update(upd).eq('id', job.id);
        verified++;
      }
      report.phases.verify = { verified };
    }

    // ── PHASE 6: LOG ──
    report.elapsed_ms = Date.now() - startTime;
    report.success = true;
    try {
      await sb.from('scraper_logs').insert({
        run_id: `pipe_${Date.now()}`, started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(), elapsed_ms: report.elapsed_ms, results: report,
      });
    } catch (logErr) { /* non-fatal */ }

    return res.status(200).json(report);
  } catch (err) {
    report.success = false; report.fatal_error = err.message;
    report.elapsed_ms = Date.now() - startTime;
    return res.status(500).json(report);
  }
};
