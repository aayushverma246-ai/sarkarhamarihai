'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── KNOWN GENERIC / PLACEHOLDER PATTERNS ──
const GENERIC_DOMAINS = [
  'india.gov.in', 'careers.india.gov.in', 'apprenticeshipindia.org',
  'metro.gov.in', 'mha.gov.in', 'andaman.gov.in', 'indianbanksassociation.org'
];

// Legitimate domains that contain 'india.gov.in' as substring but are NOT generic
const WHITELISTED_DOMAINS = [
  'epfindia.gov.in', 'airindia.gov.in', 'coalindia.in',
];

const PLACEHOLDER_SALARY_PAIRS = [
  [15000, 80000], [0, 0]
];

const VALID_CATEGORIES = new Set([
  'Agriculture', 'Banking', 'Central Government', 'Cooperative', 'Defence',
  'Engineering', 'Entrance Exam', 'Forest & Environment', 'Healthcare',
  'Insurance', 'Judiciary', 'Police', 'PSU', 'Railways', 'Research & Science',
  'Shipping & Ports', 'SSC', 'State Government', 'State PSCs', 'Teaching',
  'Telecom', 'UPSC',
]);

const VALID_STATUSES = new Set([
  'UPCOMING', 'LIVE', 'RECENTLY_CLOSED', 'CLOSED', 'ARCHIVED'
]);

// Deep-audit generic templates (from deep-audit.js getSelectionTemplate)
const DEEP_AUDIT_TEMPLATES = {
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
};

function isGenericUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Check whitelist first — these contain 'india.gov.in' as substring but are legit
  if (WHITELISTED_DOMAINS.some(w => lower.includes(w))) return false;
  return GENERIC_DOMAINS.some(d => lower.includes(d));
}

function isPlaceholderSalary(min, max) {
  return PLACEHOLDER_SALARY_PAIRS.some(([pMin, pMax]) => min === pMin && max === pMax);
}

function isGenericSelectionProcess(text) {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, ' ').trim();
  return Object.values(DEEP_AUDIT_TEMPLATES).some(t => 
    normalized === t.replace(/\s+/g, ' ').trim()
  );
}

async function fetchAllJobs() {
  const COLS = 'id,job_name,organization,job_category,state,form_status,application_start_date,application_end_date,salary_min,salary_max,official_website_link,official_application_link,official_notification_link,selection_process,qualification_required';
  let allJobs = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await sb.from('jobs')
      .select(COLS)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allJobs.push(...data);
    console.log(`  Fetched page ${page + 1}: ${allJobs.length} records so far...`);
    if (data.length < 1000) break;
  }
  return allJobs;
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       FULL DATABASE VERIFICATION — sarkarhamarihai.app      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  const allJobs = await fetchAllJobs();
  console.log(`Total jobs in database: ${allJobs.length}\n`);

  // ── METRICS ──
  const issues = {
    genericUrls: [],
    brokenUrls: [],
    emptyNames: [],
    emptyOrgs: [],
    invalidCategories: [],
    invalidStatuses: [],
    placeholderSalaries: [],
    missingDates: [],
    futureDatesWrong: [],
    emptySelectionProcess: [],
    genericSelectionProcess: [],
    missingState: [],
    duplicateNames: [],
    andamanBadDomain: [],
  };

  const stats = {
    withSpecificWebsiteUrl: 0,
    withClearedWebsiteUrl: 0,
    withSpecificAppUrl: 0,
    withClearedAppUrl: 0,
    withSpecificNotifUrl: 0,
    withClearedNotifUrl: 0,
    withSpecificSelection: 0,
    withGenericSelection: 0,
    withEmptySelection: 0,
    withSpecificSalary: 0,
    withPlaceholderSalary: 0,
    withValidDates: 0,
    statusBreakdown: {},
    categoryBreakdown: {},
    stateBreakdown: {},
  };

  const seenNames = new Map();

  for (const job of allJobs) {
    // ── NAME & ORG ──
    if (!job.job_name || job.job_name.trim().length < 3) issues.emptyNames.push(job.id);
    if (!job.organization || job.organization.trim().length < 2) issues.emptyOrgs.push(job.id);

    // ── DUPLICATE CHECK ──
    const nameKey = `${(job.job_name || '').toLowerCase().trim()}|${(job.organization || '').toLowerCase().trim()}`;
    if (seenNames.has(nameKey)) {
      issues.duplicateNames.push({ id: job.id, name: job.job_name, org: job.organization, duplicateOf: seenNames.get(nameKey) });
    } else {
      seenNames.set(nameKey, job.id);
    }

    // ── URLS ──
    for (const field of ['official_website_link', 'official_application_link', 'official_notification_link']) {
      const url = job[field];
      const statKey = field.replace('official_', '').replace('_link', '');
      
      if (!url || url === '') {
        stats[`withCleared${statKey.charAt(0).toUpperCase() + statKey.slice(1)}Url`]++;
      } else if (isGenericUrl(url)) {
        issues.genericUrls.push({ id: job.id, field, url, name: job.job_name });
      } else if (url && !/^https?:\/\//i.test(url)) {
        issues.brokenUrls.push({ id: job.id, field, url });
      } else {
        stats[`withSpecific${statKey.charAt(0).toUpperCase() + statKey.slice(1)}Url`]++;
      }
      
      // Andaman bad domain check
      if (url && url.includes('andaman.gov.in') && !url.includes('andamannicobar.gov.in')) {
        issues.andamanBadDomain.push({ id: job.id, field, url });
      }
    }

    // ── SELECTION PROCESS ──
    if (!job.selection_process || job.selection_process.trim().length === 0) {
      issues.emptySelectionProcess.push(job.id);
      stats.withEmptySelection++;
    } else if (isGenericSelectionProcess(job.selection_process)) {
      stats.withGenericSelection++;
    } else {
      stats.withSpecificSelection++;
    }

    // ── SALARY ──
    const salMin = Number(job.salary_min) || 0;
    const salMax = Number(job.salary_max) || 0;
    if (isPlaceholderSalary(salMin, salMax) && job.job_category !== 'Entrance Exam') {
      issues.placeholderSalaries.push({ id: job.id, min: salMin, max: salMax, name: job.job_name });
      stats.withPlaceholderSalary++;
    } else {
      stats.withSpecificSalary++;
    }

    // ── CATEGORY ──
    if (!job.job_category || !VALID_CATEGORIES.has(job.job_category)) {
      issues.invalidCategories.push({ id: job.id, category: job.job_category, name: job.job_name });
    }
    stats.categoryBreakdown[job.job_category || 'NULL'] = (stats.categoryBreakdown[job.job_category || 'NULL'] || 0) + 1;

    // ── STATUS ──
    if (!job.form_status || !VALID_STATUSES.has(job.form_status)) {
      issues.invalidStatuses.push({ id: job.id, status: job.form_status });
    }
    stats.statusBreakdown[job.form_status || 'NULL'] = (stats.statusBreakdown[job.form_status || 'NULL'] || 0) + 1;

    // ── STATE ──
    if (!job.state || job.state.trim().length < 2) {
      issues.missingState.push({ id: job.id, name: job.job_name });
    }
    stats.stateBreakdown[job.state || 'NULL'] = (stats.stateBreakdown[job.state || 'NULL'] || 0) + 1;

    // ── DATES ──
    if (!job.application_start_date || !job.application_end_date) {
      issues.missingDates.push(job.id);
    } else {
      stats.withValidDates++;
    }
  }

  // ── PRINT REPORT ──
  console.log('═══════════════════════════════════════════');
  console.log('  CRITICAL ISSUES (must be zero)');
  console.log('═══════════════════════════════════════════');
  const printIssue = (label, arr) => {
    const icon = arr.length === 0 ? '✅' : '❌';
    console.log(`${icon} ${label}: ${arr.length}`);
    if (arr.length > 0 && arr.length <= 5) {
      arr.forEach(item => console.log(`   └─ ${JSON.stringify(item).slice(0, 120)}`));
    } else if (arr.length > 5) {
      arr.slice(0, 3).forEach(item => console.log(`   └─ ${JSON.stringify(item).slice(0, 120)}`));
      console.log(`   └─ ... and ${arr.length - 3} more`);
    }
  };

  printIssue('Generic URLs (india.gov.in etc)', issues.genericUrls);
  printIssue('Broken URL format', issues.brokenUrls);
  printIssue('Andaman bad domain (andaman.gov.in instead of andamannicobar)', issues.andamanBadDomain);
  printIssue('Missing job name', issues.emptyNames);
  printIssue('Missing organization', issues.emptyOrgs);
  printIssue('Invalid categories', issues.invalidCategories);
  printIssue('Invalid statuses', issues.invalidStatuses);
  printIssue('Placeholder salaries (15000/80000)', issues.placeholderSalaries);

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('  DATA QUALITY METRICS');
  console.log('═══════════════════════════════════════════');
  console.log(`📊 Selection Process:`);
  console.log(`   Specific/Genuine: ${stats.withSpecificSelection} (${(stats.withSpecificSelection/allJobs.length*100).toFixed(1)}%)`);
  console.log(`   Category Template: ${stats.withGenericSelection} (${(stats.withGenericSelection/allJobs.length*100).toFixed(1)}%)`);
  console.log(`   Empty: ${stats.withEmptySelection} (${(stats.withEmptySelection/allJobs.length*100).toFixed(1)}%)`);
  
  console.log(`\n📊 Salary Data:`);
  console.log(`   Specific: ${stats.withSpecificSalary} (${(stats.withSpecificSalary/allJobs.length*100).toFixed(1)}%)`);
  console.log(`   Placeholder/Zero: ${stats.withPlaceholderSalary} (${(stats.withPlaceholderSalary/allJobs.length*100).toFixed(1)}%)`);

  console.log(`\n📊 Dates:`);
  console.log(`   Valid start+end dates: ${stats.withValidDates} (${(stats.withValidDates/allJobs.length*100).toFixed(1)}%)`);
  console.log(`   Missing dates: ${issues.missingDates.length}`);

  console.log(`\n📊 Duplicates (same name+org): ${issues.duplicateNames.length}`);

  console.log(`\n📊 Status Breakdown:`);
  Object.entries(stats.statusBreakdown).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`   ${k}: ${v}`);
  });

  console.log(`\n📊 Category Breakdown:`);
  Object.entries(stats.categoryBreakdown).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`   ${k}: ${v}`);
  });

  console.log(`\n📊 Top 15 States:`);
  Object.entries(stats.stateBreakdown).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k,v]) => {
    console.log(`   ${k}: ${v}`);
  });

  // ── RANDOM SAMPLE OF 10 RECORDS ──
  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('  RANDOM SAMPLE (10 records for inspection)');
  console.log('═══════════════════════════════════════════');
  const shuffled = allJobs.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(10, shuffled.length); i++) {
    const j = shuffled[i];
    console.log(`\n─── Record ${i+1} ───`);
    console.log(`  Name: ${j.job_name}`);
    console.log(`  Org:  ${j.organization}`);
    console.log(`  Category: ${j.job_category} | State: ${j.state}`);
    console.log(`  Status: ${j.form_status}`);
    console.log(`  Dates: ${j.application_start_date} → ${j.application_end_date}`);
    console.log(`  Salary: ₹${j.salary_min} – ₹${j.salary_max}`);
    console.log(`  Website: ${j.official_website_link || '(empty)'}`);
    console.log(`  Apply:   ${j.official_application_link || '(empty)'}`);
    console.log(`  Notif:   ${j.official_notification_link || '(empty)'}`);
    console.log(`  Selection: ${(j.selection_process || '').slice(0, 80)}${(j.selection_process||'').length > 80 ? '...' : ''}`);
  }

  // ── OVERALL SCORE ──
  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('  OVERALL DATA INTEGRITY SCORE');
  console.log('═══════════════════════════════════════════');
  
  const criticalIssues = issues.genericUrls.length + issues.brokenUrls.length + 
    issues.andamanBadDomain.length + issues.emptyNames.length + issues.emptyOrgs.length +
    issues.invalidCategories.length + issues.invalidStatuses.length;
  
  const totalFields = allJobs.length * 10; // 10 key fields per record
  const goodFields = (stats.withSpecificSalary + stats.withSpecificSelection + stats.withGenericSelection + stats.withValidDates) +
    (stats.withSpecificWebsiteUrl + stats.withSpecificAppUrl + stats.withSpecificNotifUrl) +
    (allJobs.length - issues.emptyNames.length) + (allJobs.length - issues.emptyOrgs.length) +
    (allJobs.length - issues.invalidCategories.length);
  
  const score = ((goodFields / totalFields) * 100).toFixed(1);
  
  console.log(`\n  Critical Issues: ${criticalIssues}`);
  console.log(`  Data Completeness Score: ${score}%`);
  console.log(`  Total Records: ${allJobs.length}`);
  
  if (criticalIssues === 0) {
    console.log('\n  🎉 ALL CRITICAL CHECKS PASSED — Data is clean!');
  } else {
    console.log(`\n  ⚠️  ${criticalIssues} critical issues need attention.`);
  }
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
