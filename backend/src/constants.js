/**
 * constants.js — Single Source of Truth for SarkarHamariHai
 * 
 * ALL canonical categories, states, and validation logic lives here.
 * Both backend routes and the data audit system reference this module.
 */
'use strict';

// ── CANONICAL JOB CATEGORIES ──────────────────────────────────────────────────
// These are the official Indian government exam/job categories.
// Every job in the DB must map to exactly one of these.
const CANONICAL_CATEGORIES = [
  'Agriculture',
  'Banking',
  'Central Government',
  'Cooperative',
  'Defence',
  'Engineering',
  'Entrance Exam',
  'Forest & Environment',
  'Healthcare',
  'Insurance',
  'Judiciary',
  'Police',
  'PSU',
  'Railways',
  'Research & Science',
  'Shipping & Ports',
  'SSC',
  'State Government',
  'State PSCs',
  'Teaching',
  'Telecom',
  'UPSC',
];

// Normalization map: variant spellings → canonical name
const CATEGORY_NORMALIZATION = {
  // UPSC variants
  'upsc': 'UPSC',
  'civil services': 'UPSC',
  'ias': 'UPSC',
  'ips': 'UPSC',
  'ifs': 'UPSC',
  // SSC variants
  'ssc': 'SSC',
  'staff selection': 'SSC',
  'staff selection commission': 'SSC',
  // Banking
  'banking': 'Banking',
  'ibps': 'Banking',
  'sbi': 'Banking',
  'rbi': 'Banking',
  'nabard': 'Banking',
  'bank': 'Banking',
  // Railways
  'railways': 'Railways',
  'railway': 'Railways',
  'rrb': 'Railways',
  'indian railways': 'Railways',
  // Defence
  'defence': 'Defence',
  'defense': 'Defence',
  'nda': 'Defence',
  'cds': 'Defence',
  'afcat': 'Defence',
  'army': 'Defence',
  'navy': 'Defence',
  'air force': 'Defence',
  // State PSCs
  'state pscs': 'State PSCs',
  'state psc': 'State PSCs',
  'psc': 'State PSCs',
  'bpsc': 'State PSCs',
  'uppsc': 'State PSCs',
  'mppsc': 'State PSCs',
  'rpsc': 'State PSCs',
  'kpsc': 'State PSCs',
  'appsc': 'State PSCs',
  'tspsc': 'State PSCs',
  'opsc': 'State PSCs',
  'jpsc': 'State PSCs',
  'cgpsc': 'State PSCs',
  'hpsc': 'State PSCs',
  'ppsc': 'State PSCs',
  'wbpsc': 'State PSCs',
  'ukpsc': 'State PSCs',
  'gpsc': 'State PSCs',
  // Teaching
  'teaching': 'Teaching',
  'teaching & education': 'Teaching',
  'education': 'Teaching',
  'ctet': 'Teaching',
  'ugc net': 'Teaching',
  'tet': 'Teaching',
  // Engineering
  'engineering': 'Engineering',
  'gate': 'Engineering',
  // Healthcare / Medical
  'healthcare': 'Healthcare',
  'medical': 'Healthcare',
  'nursing': 'Healthcare',
  'aiims': 'Healthcare',
  // Police
  'police': 'Police',
  'police & security': 'Police',
  'constable': 'Police',
  'sub inspector': 'Police',
  // Judiciary
  'judiciary': 'Judiciary',
  'judiciary & law': 'Judiciary',
  'court': 'Judiciary',
  // Insurance
  'insurance': 'Insurance',
  'lic': 'Insurance',
  // PSU
  'psu': 'PSU',
  'public sector': 'PSU',
  // Research & Science
  'research & science': 'Research & Science',
  'research': 'Research & Science',
  'science': 'Research & Science',
  'csir': 'Research & Science',
  // Others that map
  'central government': 'Central Government',
  'central govt': 'Central Government',
  'state government': 'State Government',
  'state govt': 'State Government',
  'agriculture': 'Agriculture',
  'cooperative': 'Cooperative',
  'entrance exam': 'Entrance Exam',
  'entrance exams': 'Entrance Exam',
  'forest & environment': 'Forest & Environment',
  'forest': 'Forest & Environment',
  'environment': 'Forest & Environment',
  'shipping & ports': 'Shipping & Ports',
  'shipping': 'Shipping & Ports',
  'ports': 'Shipping & Ports',
  'telecom': 'Telecom',
  'bsnl': 'Telecom',
  'mtnl': 'Telecom',
  // Variant spellings from seed data
  'medical': 'Healthcare',
  'law': 'Judiciary',
  'legal': 'Judiciary',
  'railway': 'Railways',
  'metro': 'Railways',
  'central govt': 'Central Government',
  'central': 'Central Government',
  'state services': 'State Government',
  'state pcs': 'State PSCs',
  'apprenticeships': 'Central Government',
  'scholarships': 'Central Government',
  'police & security': 'Police',
  'teaching & education': 'Teaching',
  'judiciary & law': 'Judiciary',
  // Catch-all legacy
  'others': 'Central Government',
  'other': 'Central Government',
  'misc': 'Central Government',
};

// ── CANONICAL INDIAN STATES & UNION TERRITORIES ──────────────────────────────
// Official list: 28 States + 8 Union Territories = 36 entries
const CANONICAL_STATES = [
  // 28 States
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // 8 Union Territories
  'Andaman & Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// State normalization map: old/variant names → canonical
const STATE_NORMALIZATION = {
  'andaman and nicobar islands': 'Andaman & Nicobar Islands',
  'andaman & nicobar': 'Andaman & Nicobar Islands',
  'a&n islands': 'Andaman & Nicobar Islands',
  'dadra and nagar haveli': 'Dadra & Nagar Haveli and Daman & Diu',
  'daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'dadra and nagar haveli and daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'dadra & nagar haveli': 'Dadra & Nagar Haveli and Daman & Diu',
  'daman & diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'jammu and kashmir': 'Jammu & Kashmir',
  'j&k': 'Jammu & Kashmir',
  'j & k': 'Jammu & Kashmir',
  'pondicherry': 'Puducherry',
  'orissa': 'Odisha',
  'uttaranchal': 'Uttarakhand',
  'nct of delhi': 'Delhi',
  'new delhi': 'Delhi',
  'delhi nct': 'Delhi',
  'all india': 'All India',
  'national': 'All India',
  'india': 'All India',
  'central': 'All India',
};

// Build lookup sets for O(1) validation
const CATEGORY_SET = new Set(CANONICAL_CATEGORIES.map(c => c.toLowerCase()));
const STATE_SET = new Set(CANONICAL_STATES.map(s => s.toLowerCase()));
STATE_SET.add('all india'); // Special value

// ── VALIDATION FUNCTIONS ──────────────────────────────────────────────────────

/**
 * Normalize a category string to its canonical form.
 * Returns the canonical category or null if unrecognized.
 */
function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();

  // Direct match against canonical set
  if (CATEGORY_SET.has(lower)) {
    return CANONICAL_CATEGORIES.find(c => c.toLowerCase() === lower) || null;
  }

  // Check normalization map
  if (CATEGORY_NORMALIZATION[lower]) {
    return CATEGORY_NORMALIZATION[lower];
  }

  // Partial match — check if any canonical category is a substring
  for (const canonical of CANONICAL_CATEGORIES) {
    if (lower.includes(canonical.toLowerCase())) return canonical;
  }

  return null;
}

/**
 * Normalize a state string to its canonical form.
 * Returns the canonical state or null if unrecognized.
 */
function normalizeState(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();

  // Direct match
  if (STATE_SET.has(lower)) {
    if (lower === 'all india') return 'All India';
    return CANONICAL_STATES.find(s => s.toLowerCase() === lower) || null;
  }

  // Check normalization map
  if (STATE_NORMALIZATION[lower]) {
    return STATE_NORMALIZATION[lower];
  }

  return null;
}

/**
 * Validate that a category is canonical. Returns boolean.
 */
function isValidCategory(cat) {
  return normalizeCategory(cat) !== null;
}

/**
 * Validate that a state is canonical. Returns boolean.
 */
function isValidState(state) {
  return normalizeState(state) !== null;
}

/**
 * Validate a job object has all critical fields and field values are correct.
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
function validateJob(job) {
  const errors = [];
  const warnings = [];
  const URL_RE = /^https?:\/\/[a-zA-Z0-9]/;

  // ── Critical fields ──
  if (!job.id) errors.push('Missing id');
  if (!job.job_name || job.job_name.trim().length < 3) errors.push('Missing or invalid job_name');
  if (!job.organization || job.organization.trim().length < 2) errors.push('Missing or invalid organization');
  if (!job.application_start_date) errors.push('Missing application_start_date');
  if (!job.application_end_date) errors.push('Missing application_end_date');

  // ── Date format validation (YYYY-MM-DD) ──
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (job.application_start_date && !dateRe.test(job.application_start_date)) {
    errors.push('Invalid application_start_date format (expected YYYY-MM-DD)');
  }
  if (job.application_end_date && !dateRe.test(job.application_end_date)) {
    errors.push('Invalid application_end_date format (expected YYYY-MM-DD)');
  }

  // ── Date consistency: start must be before or equal to end ──
  if (job.application_start_date && job.application_end_date && job.application_start_date > job.application_end_date) {
    errors.push('application_start_date is after application_end_date');
  }

  // ── Date sanity: not before 2020, not > 3 years future ──
  if (job.application_start_date && dateRe.test(job.application_start_date)) {
    if (job.application_start_date < '2020-01-01') warnings.push('application_start_date is before 2020');
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 3);
    if (job.application_start_date > futureLimit.toISOString().slice(0, 10)) {
      warnings.push('application_start_date is > 3 years in the future');
    }
  }

  // ── Age validation ──
  if (job.minimum_age != null && job.maximum_age != null) {
    const minAge = Number(job.minimum_age);
    const maxAge = Number(job.maximum_age);
    if (minAge > maxAge) errors.push('minimum_age exceeds maximum_age');
    if (minAge > 0 && minAge < 14) warnings.push('minimum_age < 14 (unusually low)');
    if (maxAge > 70) warnings.push('maximum_age > 70 (unusually high)');
  }

  // ── Payscale validation ──
  if (job.salary_min != null || job.salary_max != null) {
    const salMin = Number(job.salary_min) || 0;
    const salMax = Number(job.salary_max) || 0;
    if (salMin > salMax && salMax > 0) errors.push('salary_min exceeds salary_max');
    if (salMin < 0) errors.push('salary_min is negative');
    if (salMax < 0) errors.push('salary_max is negative');
    if (salMax > 1000000) warnings.push('salary_max > 10L/month (verify if annual)');
  }

  // ── URL validation ──
  if (job.official_application_link && job.official_application_link.length > 5) {
    if (!URL_RE.test(job.official_application_link)) {
      warnings.push('official_application_link is not a valid URL');
    }
  }
  if (job.official_website_link && job.official_website_link.length > 5) {
    if (!URL_RE.test(job.official_website_link)) {
      warnings.push('official_website_link is not a valid URL');
    }
  }
  if (job.official_notification_link && job.official_notification_link.length > 5) {
    if (!URL_RE.test(job.official_notification_link)) {
      warnings.push('official_notification_link is not a valid URL');
    }
  }

  // ── Category validation ──
  if (job.job_category && !isValidCategory(job.job_category)) {
    warnings.push(`Non-canonical job_category: "${job.job_category}"`);
  }

  // ── State validation ──
  if (job.state && job.state !== 'All India' && !isValidState(job.state)) {
    warnings.push(`Non-canonical state: "${job.state}"`);
  }

  // ── Selection process completeness ──
  if (!job.selection_process || job.selection_process.trim().length < 10) {
    warnings.push('Missing or incomplete selection_process');
  }

  // ── Qualification ──
  if (!job.qualification_required || job.qualification_required.trim().length < 3) {
    warnings.push('Missing qualification_required');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── SELECTION PROCESS TEMPLATES ───────────────────────────────────────────────
const SELECTION_PROCESS_TEMPLATES = {
  'UPSC': "Stage 1: Preliminary Exam → GS I & CSAT (Objective)\nStage 2: Main Exam → 9 Descriptive Papers\nStage 3: Interview → Personality Test\nFinal Stage: Final Merit based on Mains + Interview.",
  'SSC': "Stage 1: Tier I → Computer Based Exam\nStage 2: Tier II → Quantitative, Reasoning, English\nStage 3: Skill Test → Typing (if applicable)\nFinal Stage: Merit based on Tier scores. No Interview.",
  'Banking': "Stage 1: Preliminary Exam → Quantitative, Reasoning, English\nStage 2: Main Exam → Objective + Descriptive\nStage 3: Interview (for Officers)\nFinal Stage: Final Merit.",
  'Defence': "Stage 1: Written Exam → General Knowledge & Aptitude\nStage 2: SSB Interview → 5-Day Personality Assessment\nStage 3: Medical Exam → Physical Fitness\nFinal Stage: Final Merit List.",
  'Railways': "Stage 1: CBT 1 → Screening\nStage 2: CBT 2 → Core Subject Mastery\nStage 3: Skill Test → Typing/Aptitude (if applicable)\nFinal Stage: DV & Medical.",
  'Police': "Stage 1: Written Exam → Law & Reasoning\nStage 2: Physical Efficiency Test\nStage 3: Medical Exam\nFinal Stage: Merit list.",
  'Teaching': "Stage 1: Written Exam → Pedagogical & Subject Knowledge\nStage 2: Interview / Demo Class (if applicable)\nFinal Stage: Selection based on merit score.",
  'PSU': "Stage 1: GATE Score / Written Test\nStage 2: Group Discussion\nStage 3: Personal Interview\nFinal Stage: Merit list based on all rounds.",
  'Insurance': "Stage 1: Preliminary Exam → Reasoning, Quantitative, English\nStage 2: Main Exam → Objective + Descriptive\nStage 3: Interview\nFinal Stage: Final Merit.",
  'Judiciary': "Stage 1: Preliminary Exam → Law & General Knowledge\nStage 2: Main Exam → Descriptive Law Papers\nStage 3: Interview → Viva-voce\nFinal Stage: Merit list.",
  'State PSCs': "Stage 1: Preliminary Exam → Objective screening\nStage 2: Main Exam → Descriptive papers\nStage 3: Interview → Personality assessment\nFinal Stage: Final selection.",
  'Entrance Exam': "Stage 1: Entrance Exam → Objective MCQ\nStage 2: Counselling → Seat Allotment based on Rank\nStage 3: Document Verification\nFinal Stage: Admission based on Rank + Preference.",
  'Central Government': "Stage 1: Written Exam / Screening Test\nStage 2: Skill Test / Document Verification\nStage 3: Personal Interview (if applicable)\nFinal Stage: Final Merit.",
  'Healthcare': "Stage 1: Computer Based Test (CBT)\nStage 2: Document Verification\nStage 3: Medical fitness check\nFinal Stage: Final selection.",
  'Engineering': "Stage 1: Written Test / GATE Score\nStage 2: Technical Interview\nStage 3: HR Interview\nFinal Stage: Merit list.",
  'Research & Science': "Stage 1: Written Exam → Advanced Technical/Subject Domain\nStage 2: Personal Interview → Research Aptitude\nFinal Stage: Final Merit.",
  'Agriculture': "Stage 1: Written Exam → Agricultural Sciences\nStage 2: Interview / Document Verification\nFinal Stage: Final selection.",
  'Cooperative': "Stage 1: Written Exam\nStage 2: Interview\nFinal Stage: Merit list.",
  'Forest & Environment': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Physical Test\nFinal Stage: Interview & Merit.",
  'Shipping & Ports': "Stage 1: Written Test / Trade Test\nStage 2: Physical & Medical Test\nFinal Stage: Merit list.",
  'State Government': "Stage 1: Written Exam\nStage 2: Skill Test / Interview\nFinal Stage: Document Verification & Merit.",
  'Telecom': "Stage 1: Written Test / GATE Score\nStage 2: Interview\nFinal Stage: Merit list.",
};

module.exports = {
  CANONICAL_CATEGORIES,
  CANONICAL_STATES,
  CATEGORY_NORMALIZATION,
  STATE_NORMALIZATION,
  SELECTION_PROCESS_TEMPLATES,
  normalizeCategory,
  normalizeState,
  isValidCategory,
  isValidState,
  validateJob,
};
