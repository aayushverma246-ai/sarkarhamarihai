'use strict';
/**
 * deduplicator.js — Fingerprint-based deduplication engine
 * 
 * Generates a normalized fingerprint for each exam to detect duplicates
 * across multiple sources. Merges intelligently: keeps richer data.
 */

const crypto = require('crypto');

/**
 * Normalize an organization name for consistent fingerprinting.
 */
function normalizeOrg(org) {
  if (!org) return '';
  let o = org.toLowerCase().trim();
  
  // Strip common words/suffixes
  o = o.replace(/\bpublic\s+service\s+commission\b/g, 'psc');
  o = o.replace(/\bstate\s+government\b/g, 'government');
  
  // Mapping of common long names to abbreviation
  if (o.includes('union psc') || o.includes('union public') || o === 'upsc') return 'upsc';
  if (o.includes('staff selection') || o === 'ssc') return 'ssc';
  if (o.includes('national testing') || o === 'nta') return 'nta';
  if (o.includes('railway recruitment') || o === 'rrb') return 'rrb';
  if (o.includes('state bank of india') || o === 'sbi') return 'sbi';
  if (o.includes('reserve bank of india') || o === 'rbi') return 'rbi';
  if (o.includes('intelligence bureau') || o === 'ib') return 'ib';
  if (o.includes('central reserve police') || o === 'crpf') return 'crpf';
  if (o.includes('border security force') || o === 'bsf') return 'bsf';
  if (o.includes('central industrial security') || o === 'cisf') return 'cisf';
  if (o.includes('indo-tibetan border') || o.includes('indotibetan border') || o === 'itbp') return 'itbp';
  if (o.includes('sashastra seema') || o === 'ssb') return 'ssb';
  
  // State PSC mappings
  if (o.includes('andhra pradesh psc') || o === 'appsc') return 'appsc';
  if (o.includes('arunachal pradesh psc')) return 'appsc';
  if (o.includes('assam psc') || o === 'apsc') return 'apsc';
  if (o.includes('bihar psc') || o === 'bpsc') return 'bpsc';
  if (o.includes('chhattisgarh psc') || o === 'cgpsc') return 'cgpsc';
  if (o.includes('delhi subordinate') || o === 'dsssb') return 'dsssb';
  if (o.includes('gujarat psc') || o === 'gpsc') return 'gpsc';
  if (o.includes('harrison psc') || o === 'hpsc') return 'hpsc'; // Wait, let's keep hpsc mapping standard
  if (o.includes('haryana psc') || o === 'hpsc') return 'hpsc';
  if (o.includes('himachal pradesh psc') || o === 'hppsc') return 'hppsc';
  if (o.includes('jharkhand psc') || o === 'jpsc') return 'jpsc';
  if (o.includes('karnataka psc') || o === 'kpsc') return 'kpsc';
  if (o.includes('kerala psc') || o === 'kpsc') return 'kpsc';
  if (o.includes('madhya pradesh psc') || o === 'mppsc') return 'mppsc';
  if (o.includes('maharashtra psc') || o === 'mpsc') return 'mpsc';
  if (o.includes('nagaland psc') || o === 'npsc') return 'npsc';
  if (o.includes('odisha psc') || o === 'opsc') return 'opsc';
  if (o.includes('punjab psc') || o === 'ppsc') return 'ppsc';
  if (o.includes('rajasthan psc') || o === 'rpsc') return 'rpsc';
  if (o.includes('sikkim psc') || o === 'spsc') return 'spsc';
  if (o.includes('tamil nadu psc') || o === 'tnpsc') return 'tnpsc';
  if (o.includes('telangana psc') || o === 'tspsc' || o === 'tgpsc') return 'tspsc';
  if (o.includes('tripura psc') || o === 'tpsc') return 'tpsc';
  if (o.includes('uttar pradesh psc') || o === 'uppsc') return 'uppsc';
  if (o.includes('uttarakhand psc') || o === 'ukpsc') return 'ukpsc';
  if (o.includes('west bengal psc') || o === 'wbpsc') return 'wbpsc';
  if (o.includes('jammu & kashmir psc') || o.includes('jammu and kashmir psc') || o === 'jkpsc') return 'jkpsc';
  
  return o.replace(/[^a-z0-9]/g, '');
}

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
  const org = normalizeOrg(exam.organization || '');
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

  const genericDomains = [
    'india.gov.in', 'careers.india.gov.in', 'apprenticeshipindia.org',
    'metro.gov.in', 'mha.gov.in', 'dnh.gov.in', 'andaman.gov.in',
    'indianbanksassociation.org'
  ];

  const isGeneric = (url) => {
    if (!url) return true;
    const lower = url.toLowerCase();
    return genericDomains.some(d => lower.includes(d));
  };

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

    // Shield: Protect specific/cleared links from being overwritten by generic fallback links
    if (['official_website_link', 'official_application_link', 'official_notification_link'].includes(field)) {
      if (existVal === '' || (existVal && !isGeneric(existVal))) {
        if (!incVal || isGeneric(incVal)) {
          continue; // Keep the specific or cleared link
        }
      }
    }

    // Shield: Protect specific selection process from being overwritten by short/generic/empty text
    if (field === 'selection_process' && existVal && existVal.trim().length > 15) {
      if (!incVal || incVal.trim().length <= 15) {
        continue; // Keep the richer selection process
      }
    }

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
