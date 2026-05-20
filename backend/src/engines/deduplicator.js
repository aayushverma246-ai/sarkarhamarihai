'use strict';
/**
 * deduplicator.js — Fingerprint-based deduplication engine
 * 
 * Generates a normalized fingerprint for each exam to detect duplicates
 * across multiple sources. Merges intelligently: keeps richer data.
 */

const crypto = require('crypto');

/**
 * Normalize a string for fingerprinting (lowercase, strip special chars, collapse spaces)
 */
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a unique fingerprint hash for an exam
 * Uses: normalized exam name + organization + year
 */
function generateFingerprint(exam) {
  const name = normalize(exam.job_name || exam.exam_name || '');
  const org = normalize(exam.organization || '');
  const year = (exam.job_name || '').match(/20\d{2}/)?.[0] || new Date().getFullYear().toString();
  
  const raw = `${name}|${org}|${year}`;
  return crypto.createHash('md5').update(raw).digest('hex').substring(0, 16);
}

/**
 * Check if two exams are likely the same
 */
function isSameExam(a, b) {
  return generateFingerprint(a) === generateFingerprint(b);
}

/**
 * Calculate data richness score (more fields filled = higher score)
 */
function richnessScore(exam) {
  let score = 0;
  if (exam.job_name) score += 1;
  if (exam.organization) score += 1;
  if (exam.qualification_required && exam.qualification_required !== 'Not Specified') score += 2;
  if (exam.application_start_date) score += 2;
  if (exam.application_end_date) score += 2;
  if (exam.salary_min > 0) score += 1;
  if (exam.salary_max > 0) score += 1;
  if (exam.official_website_link && exam.official_website_link !== '') score += 2;
  if (exam.syllabus && exam.syllabus.length > 20) score += 2;
  if (exam.selection_process && exam.selection_process.length > 20) score += 2;
  if (exam.minimum_age > 0) score += 1;
  if (exam.maximum_age > 0) score += 1;
  return score;
}

/**
 * Merge two exam records, keeping the richer data for each field
 */
function mergeExams(existing, incoming) {
  const merged = { ...existing };

  // For each field, prefer non-empty incoming over empty existing
  const fields = [
    'qualification_required', 'application_start_date', 'application_end_date',
    'salary_min', 'salary_max', 'official_website_link', 'official_application_link',
    'official_notification_link', 'syllabus', 'selection_process',
    'minimum_age', 'maximum_age', 'form_status'
  ];

  for (const field of fields) {
    const existVal = existing[field];
    const incVal = incoming[field];

    // Prefer incoming if existing is empty/null/default
    if ((!existVal || existVal === '' || existVal === 'Not Specified' || existVal === 0) && incVal) {
      merged[field] = incVal;
    }
    // Prefer incoming if it has more content (longer string)
    if (typeof existVal === 'string' && typeof incVal === 'string' && incVal.length > existVal.length) {
      merged[field] = incVal;
    }
  }

  // Always update last_verified_at
  merged.last_verified_at = new Date().toISOString();
  merged.discovery_source = incoming.discovery_source || existing.discovery_source || 'scraper';

  return merged;
}

/**
 * Deduplicate a batch of scraped exams against existing DB records
 * Returns: { newExams: [...], updatedExams: [...], duplicates: [...] }
 */
async function deduplicateBatch(scrapedExams, existingExams) {
  const existingMap = new Map();
  for (const ex of existingExams) {
    const fp = generateFingerprint(ex);
    existingMap.set(fp, ex);
  }

  const newExams = [];
  const updatedExams = [];
  const duplicates = [];

  for (const scraped of scrapedExams) {
    const fp = generateFingerprint(scraped);

    if (existingMap.has(fp)) {
      const existing = existingMap.get(fp);
      const existScore = richnessScore(existing);
      const scrapedScore = richnessScore(scraped);

      if (scrapedScore > existScore) {
        // Incoming has richer data — merge
        const merged = mergeExams(existing, scraped);
        updatedExams.push({ id: existing.id, ...merged });
      } else {
        duplicates.push({ fingerprint: fp, name: scraped.job_name });
      }
    } else {
      newExams.push(scraped);
    }
  }

  return { newExams, updatedExams, duplicates };
}

module.exports = {
  generateFingerprint,
  isSameExam,
  richnessScore,
  mergeExams,
  deduplicateBatch,
  normalize,
};
