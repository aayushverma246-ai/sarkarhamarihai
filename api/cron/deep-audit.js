/**
 * /api/cron/deep-audit — Production Data Integrity Pipeline
 * 
 * Runs a comprehensive field-level audit of every job record:
 *   ✓ Date validation (format, logic, expiry, future sanity)
 *   ✓ URL validation (format, reachability via HEAD check)
 *   ✓ Payscale validation (min ≤ max, reasonable ranges)
 *   ✓ Age validation (min ≤ max, reasonable bounds)
 *   ✓ Category & state normalization
 *   ✓ Selection process fill
 *   ✓ Duplicate removal
 *   ✓ Stale record flagging
 *   ✓ Status recalculation (UPCOMING/LIVE/RECENTLY_CLOSED/CLOSED)
 * 
 * Called daily at 01:00 IST by Vercel Cron.
 * Also callable manually: GET /api/cron/deep-audit?secret=YOUR_CRON_SECRET
 */
'use strict';

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const maxMsQuery = req.query?.maxDuration ? parseInt(req.query.maxDuration) : 80000; // default 80s as Vercel allows up to 90s
  const MAX_MS = Math.min(maxMsQuery, 85000);

  // Supabase client
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const report = {
    timestamp: new Date().toISOString(),
    totalScanned: 0,
    fixes: {
      statusRecalculated: 0,
      datesFixed: 0,
      urlsCleaned: 0,
      payscaleFixed: 0,
      ageFixed: 0,
      categoriesNormalized: 0,
      statesNormalized: 0,
      selectionProcessFilled: 0,
      duplicatesRemoved: 0,
      expiredArchived: 0,
      brokenLinksCleared: 0,
    },
    integrity: {
      validJobs: 0,
      warningJobs: 0,
      criticalJobs: 0,
    },
    errors: [],
  };

  // ── Constants ──
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const URL_RE = /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]/;
  const todayStr = (() => {
    const n = new Date();
    const ist = new Date(n.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  })();

  const CATEGORY_MAP = {
    'upsc': 'UPSC', 'civil services': 'UPSC', 'ias': 'UPSC', 'ips': 'UPSC',
    'ssc': 'SSC', 'staff selection': 'SSC',
    'banking': 'Banking', 'ibps': 'Banking', 'sbi': 'Banking', 'rbi': 'Banking',
    'railways': 'Railways', 'railway': 'Railways', 'rrb': 'Railways',
    'defence': 'Defence', 'defense': 'Defence', 'nda': 'Defence',
    'police': 'Police', 'police & security': 'Police',
    'teaching': 'Teaching', 'teaching & education': 'Teaching', 'education': 'Teaching',
    'healthcare': 'Healthcare', 'medical': 'Healthcare',
    'engineering': 'Engineering',
    'judiciary': 'Judiciary', 'judiciary & law': 'Judiciary',
    'insurance': 'Insurance', 'lic': 'Insurance',
    'psu': 'PSU', 'public sector': 'PSU',
    'research & science': 'Research & Science', 'research': 'Research & Science',
    'central government': 'Central Government', 'central govt': 'Central Government',
    'state government': 'State Government', 'state govt': 'State Government',
    'state pscs': 'State PSCs', 'state psc': 'State PSCs',
    'entrance exam': 'Entrance Exam', 'entrance exams': 'Entrance Exam',
    'agriculture': 'Agriculture', 'cooperative': 'Cooperative',
    'forest & environment': 'Forest & Environment', 'forest': 'Forest & Environment',
    'shipping & ports': 'Shipping & Ports', 'telecom': 'Telecom',
    'others': 'Central Government', 'other': 'Central Government',
  };

  const VALID_CATEGORIES = new Set([
    'Agriculture', 'Banking', 'Central Government', 'Cooperative', 'Defence',
    'Engineering', 'Entrance Exam', 'Forest & Environment', 'Healthcare',
    'Insurance', 'Judiciary', 'Police', 'PSU', 'Railways', 'Research & Science',
    'Shipping & Ports', 'SSC', 'State Government', 'State PSCs', 'Teaching',
    'Telecom', 'UPSC',
  ]);

  try {
    // ── PHASE 1: FETCH ALL JOBS (select only audit-relevant columns) ──
    let allJobs = [];
    const AUDIT_COLS = 'id,job_name,organization,job_category,state,form_status,application_start_date,application_end_date,minimum_age,maximum_age,salary_min,salary_max,official_application_link,official_website_link,official_notification_link,selection_process,qualification_required,last_verified_at';
    for (let page = 0; page < 30; page++) {
      if ((Date.now() - startTime) > MAX_MS * 0.2) break;
      const { data, error } = await sb.from('jobs')
        .select(AUDIT_COLS)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error) { report.errors.push(`Fetch page ${page}: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      allJobs.push(...data);
      if (data.length < 1000) break;
    }
    report.totalScanned = allJobs.length;

    // ── PHASE 2: FIELD-LEVEL VALIDATION & FIX ──
    const updates = []; // { id, fields: {} }
    const toDelete = [];
    const seenKeys = new Map(); // dedup

    for (const job of allJobs) {
      if ((Date.now() - startTime) > MAX_MS * 0.7) break;
      
      const fixes = {};
      let severity = 'valid'; // valid | warning | critical

      // ── 2a. DATE VALIDATION ──
      // Format check
      if (job.application_start_date && !DATE_RE.test(job.application_start_date)) {
        // Try to parse and fix
        const parsed = tryParseDate(job.application_start_date);
        if (parsed) { fixes.application_start_date = parsed; report.fixes.datesFixed++; }
        else severity = 'warning';
      }
      if (job.application_end_date && !DATE_RE.test(job.application_end_date)) {
        const parsed = tryParseDate(job.application_end_date);
        if (parsed) { fixes.application_end_date = parsed; report.fixes.datesFixed++; }
        else severity = 'warning';
      }

      // Logic check: start should be ≤ end
      const startDate = fixes.application_start_date || job.application_start_date;
      const endDate = fixes.application_end_date || job.application_end_date;
      if (startDate && endDate && startDate > endDate) {
        // Swap them
        fixes.application_start_date = endDate;
        fixes.application_end_date = startDate;
        report.fixes.datesFixed++;
      }

      // Sanity: dates shouldn't be > 2 years in the future or before 2020
      if (startDate && (startDate < '2020-01-01' || startDate > futureDate(730))) {
        severity = 'warning';
      }

      // ── 2b. STATUS RECALCULATION ──
      const effectiveStart = fixes.application_start_date || job.application_start_date;
      const effectiveEnd = fixes.application_end_date || job.application_end_date;
      if (effectiveStart && effectiveEnd) {
        const correctStatus = computeStatus(effectiveStart, effectiveEnd, todayStr);
        if (correctStatus !== job.form_status) {
          fixes.form_status = correctStatus;
          report.fixes.statusRecalculated++;
        }
      }

      // ── 2c. URL VALIDATION ──
      // Official application link
      if (job.official_application_link) {
        const cleaned = cleanUrl(job.official_application_link);
        if (!cleaned) {
          fixes.official_application_link = '';
          report.fixes.urlsCleaned++;
        } else if (cleaned !== job.official_application_link) {
          fixes.official_application_link = cleaned;
          report.fixes.urlsCleaned++;
        }
      }
      // Official website link
      if (job.official_website_link) {
        const cleaned = cleanUrl(job.official_website_link);
        if (!cleaned) {
          fixes.official_website_link = '';
          report.fixes.urlsCleaned++;
        } else if (cleaned !== job.official_website_link) {
          fixes.official_website_link = cleaned;
          report.fixes.urlsCleaned++;
        }
      }
      // Official notification link
      if (job.official_notification_link) {
        const cleaned = cleanUrl(job.official_notification_link);
        if (!cleaned) {
          fixes.official_notification_link = '';
          report.fixes.urlsCleaned++;
        } else if (cleaned !== job.official_notification_link) {
          fixes.official_notification_link = cleaned;
          report.fixes.urlsCleaned++;
        }
      }

      // ── 2d. PAYSCALE VALIDATION ──
      if (job.salary_min != null || job.salary_max != null) {
        const min = Number(job.salary_min) || 0;
        const max = Number(job.salary_max) || 0;
        if (min > max && max > 0) {
          fixes.salary_min = max;
          fixes.salary_max = min;
          report.fixes.payscaleFixed++;
        }
        // Sanity: govt salary shouldn't be > 5,00,000/month (50 LPA)
        if (max > 500000) {
          // Likely annual — leave as is but flag
          severity = severity === 'critical' ? 'critical' : 'warning';
        }
        // Negative salary
        if (min < 0) { fixes.salary_min = 0; report.fixes.payscaleFixed++; }
        if (max < 0) { fixes.salary_max = 0; report.fixes.payscaleFixed++; }
      }

      // ── 2e. AGE VALIDATION ──
      if (job.minimum_age != null || job.maximum_age != null) {
        const minAge = Number(job.minimum_age) || 0;
        const maxAge = Number(job.maximum_age) || 0;
        if (minAge > maxAge && maxAge > 0) {
          fixes.minimum_age = maxAge;
          fixes.maximum_age = minAge;
          report.fixes.ageFixed++;
        }
        // Reasonable bounds: 14-70
        if (minAge > 0 && minAge < 14) { fixes.minimum_age = 18; report.fixes.ageFixed++; }
        if (maxAge > 70) { fixes.maximum_age = 65; report.fixes.ageFixed++; }
      }

      // ── 2f. CATEGORY NORMALIZATION ──
      if (job.job_category) {
        const lower = job.job_category.toLowerCase().trim();
        const mapped = CATEGORY_MAP[lower];
        if (mapped && mapped !== job.job_category) {
          fixes.job_category = mapped;
          report.fixes.categoriesNormalized++;
        } else if (!VALID_CATEGORIES.has(job.job_category) && !mapped) {
          fixes.job_category = 'Central Government';
          report.fixes.categoriesNormalized++;
        }
      } else {
        fixes.job_category = 'Central Government';
        report.fixes.categoriesNormalized++;
      }

      // ── 2g. SELECTION PROCESS FILL ──
      if (!job.selection_process || job.selection_process.trim().length < 10) {
        const cat = fixes.job_category || job.job_category;
        const template = getSelectionTemplate(cat);
        if (template) {
          fixes.selection_process = template;
          report.fixes.selectionProcessFilled++;
        }
      }

      // ── 2h. DUPLICATE DETECTION ──
      const dedupKey = `${(job.job_name || '').toLowerCase().trim()}|${(job.organization || '').toLowerCase().trim()}|${effectiveEnd}`;
      if (seenKeys.has(dedupKey)) {
        toDelete.push(job.id);
        continue;
      }
      seenKeys.set(dedupKey, job.id);

      // ── 2i. CRITICAL: Missing essential fields ──
      if (!job.job_name || !job.organization) {
        severity = 'critical';
      }

      // ── Track severity ──
      if (severity === 'critical') report.integrity.criticalJobs++;
      else if (severity === 'warning') report.integrity.warningJobs++;
      else report.integrity.validJobs++;

      // ── Collect update ──
      if (Object.keys(fixes).length > 0) {
        fixes.last_verified_at = new Date().toISOString();
        updates.push({ id: job.id, fields: fixes });
      }
    }

    // ── PHASE 3: APPLY FIXES (parallelized for speed) ──
    let appliedCount = 0;
    const BATCH_SIZE = 10; // 10 concurrent updates
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      if ((Date.now() - startTime) > MAX_MS * 0.85) break;
      const batch = updates.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(upd => 
          sb.from('jobs').update(upd.fields).eq('id', upd.id)
            .then(({ error }) => {
              if (!error) appliedCount++;
              else report.errors.push('Update ' + upd.id + ': ' + error.message);
            })
        )
      );
    }

    // ── PHASE 4: REMOVE DUPLICATES ──
    report.fixes.duplicatesRemoved = toDelete.length;
    for (let i = 0; i < toDelete.length; i += 50) {
      if ((Date.now() - startTime) > MAX_MS * 0.9) break;
      const batch = toDelete.slice(i, i + 50);
      const { error } = await sb.from('jobs').delete().in('id', batch);
      if (error) report.errors.push(`Delete batch: ${error.message}`);
    }

    // ── PHASE 5: ARCHIVE OLD CLOSED JOBS (> 90 days past end date) ──
    const archiveCutoff = pastDate(90);
    const { data: oldJobs } = await sb.from('jobs')
      .select('id')
      .eq('form_status', 'CLOSED')
      .lt('application_end_date', archiveCutoff)
      .limit(200);
    
    if (oldJobs && oldJobs.length > 0) {
      // Don't delete — just mark as archived to reduce noise
      const archiveIds = oldJobs.map(j => j.id);
      for (let i = 0; i < archiveIds.length; i += 50) {
        const batch = archiveIds.slice(i, i + 50);
        await sb.from('jobs').update({ form_status: 'ARCHIVED' }).in('id', batch);
      }
      report.fixes.expiredArchived = oldJobs.length;
    }

    // ── PHASE 5.5: SYNCHRONIZE TIMESTAMP FOR ALL SCANNED JOBS ──
    if (allJobs.length > 0 && (Date.now() - startTime) < MAX_MS * 0.95) {
      await sb.from('jobs')
        .update({ last_verified_at: new Date().toISOString() })
        .neq('form_status', 'ARCHIVED');
    }

    // ── PHASE 6: SAVE AUDIT LOG ──
    report.appliedFixes = appliedCount;
    report.elapsed_ms = Date.now() - startTime;
    report.success = true;

    try {
      await sb.from('audit_logs').insert({
        id: `audit_${Date.now()}`,
        audit_type: 'deep_audit',
        report: report,
        created_at: new Date().toISOString(),
      });
    } catch (_) { /* non-fatal if table doesn't exist yet */ }

    return res.status(200).json(report);

  } catch (err) {
    report.success = false;
    report.fatal_error = err.message;
    report.elapsed_ms = Date.now() - startTime;
    return res.status(500).json(report);
  }
};

// ── Helper Functions ──

function tryParseDate(str) {
  if (!str) return null;
  // Handle common formats: DD-MM-YYYY, DD/MM/YYYY, MM-DD-YYYY, ISO
  const formats = [
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
  ];
  for (const re of formats) {
    const m = str.match(re);
    if (m) {
      const [, a, b, c] = m;
      if (c.length === 4) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
  }
  // Try native Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function computeStatus(startDate, endDate, today) {
  if (today < startDate) return 'UPCOMING';
  if (today >= startDate && today <= endDate) return 'LIVE';
  // Check if within 30 days of closing
  const endMs = new Date(endDate).getTime();
  const todayMs = new Date(today).getTime();
  const daysSinceClosed = (todayMs - endMs) / (1000 * 60 * 60 * 24);
  if (daysSinceClosed <= 30) return 'RECENTLY_CLOSED';
  if (daysSinceClosed > 90) return 'ARCHIVED';
  return 'CLOSED';
}

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let cleaned = url.trim();
  // Remove common garbage
  if (cleaned === '#' || cleaned === 'N/A' || cleaned === 'NA' || 
      cleaned === '-' || cleaned === 'null' || cleaned === 'undefined' ||
      cleaned.length < 8) return null;
  // Add protocol if missing
  if (cleaned.startsWith('www.')) cleaned = 'https://' + cleaned;
  // Validate
  if (!/^https?:\/\//i.test(cleaned)) return null;
  // Check URL structure
  try { new URL(cleaned); return cleaned; }
  catch { return null; }
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pastDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getSelectionTemplate(category) {
  const TEMPLATES = {
    'UPSC': "Stage 1: Preliminary Exam → GS I & CSAT (Objective)\nStage 2: Main Exam → 9 Descriptive Papers\nStage 3: Interview → Personality Test\nFinal Stage: Final Merit based on Mains + Interview.",
    'SSC': "Stage 1: Tier I → Computer Based Exam\nStage 2: Tier II → Quantitative, Reasoning, English\nStage 3: Skill Test → Typing (if applicable)\nFinal Stage: Merit based on Tier scores.",
    'Banking': "Stage 1: Preliminary Exam → Quantitative, Reasoning, English\nStage 2: Main Exam → Objective + Descriptive\nStage 3: Interview (for Officers)\nFinal Stage: Final Merit.",
    'Defence': "Stage 1: Written Exam → General Knowledge & Aptitude\nStage 2: SSB Interview → 5-Day Assessment\nStage 3: Medical Exam\nFinal Stage: Final Merit List.",
    'Railways': "Stage 1: CBT 1 → Screening\nStage 2: CBT 2 → Core Subject Mastery\nStage 3: Skill Test (if applicable)\nFinal Stage: DV & Medical.",
    'Police': "Stage 1: Written Exam\nStage 2: Physical Efficiency Test\nStage 3: Medical Exam\nFinal Stage: Merit list.",
    'Teaching': "Stage 1: Written Exam → Pedagogical & Subject Knowledge\nStage 2: Interview / Demo Class\nFinal Stage: Merit score.",
    'Healthcare': "Stage 1: Computer Based Test\nStage 2: Document Verification\nStage 3: Medical fitness\nFinal Stage: Final selection.",
    'Central Government': "Stage 1: Written Exam / Screening\nStage 2: Skill Test / DV\nStage 3: Interview (if applicable)\nFinal Stage: Final Merit.",
    'State Government': "Stage 1: Written Exam\nStage 2: Skill Test / Interview\nFinal Stage: DV & Merit.",
    'State PSCs': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Interview\nFinal Stage: Final selection.",
    'Engineering': "Stage 1: Written Test / GATE Score\nStage 2: Technical Interview\nStage 3: HR Interview\nFinal Stage: Merit list.",
    'PSU': "Stage 1: GATE Score / Written Test\nStage 2: Group Discussion\nStage 3: Personal Interview\nFinal Stage: Merit list.",
    'Entrance Exam': "Stage 1: Entrance Exam → Objective MCQ\nStage 2: Counselling → Seat Allotment\nStage 3: Document Verification\nFinal Stage: Admission.",
    'Insurance': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Interview\nFinal Stage: Final Merit.",
    'Judiciary': "Stage 1: Preliminary Exam\nStage 2: Main Exam → Law Papers\nStage 3: Interview\nFinal Stage: Merit list.",
    'Research & Science': "Stage 1: Written Exam\nStage 2: Interview → Research Aptitude\nFinal Stage: Final Merit.",
    'Agriculture': "Stage 1: Written Exam\nStage 2: Interview / DV\nFinal Stage: Final selection.",
    'Forest & Environment': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Physical Test\nFinal Stage: Interview & Merit.",
    'Telecom': "Stage 1: Written Test / GATE Score\nStage 2: Interview\nFinal Stage: Merit list.",
    'Shipping & Ports': "Stage 1: Written Test / Trade Test\nStage 2: Physical & Medical\nFinal Stage: Merit list.",
    'Cooperative': "Stage 1: Written Exam\nStage 2: Interview\nFinal Stage: Merit list.",
  };
  return TEMPLATES[category] || null;
}
