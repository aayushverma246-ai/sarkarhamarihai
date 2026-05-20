'use strict';
/**
 * validation-rules.js — Modular Validation Rules Engine
 * 
 * Provides a pluggable system for validating data records with:
 *   - Schema validation (required fields, types)
 *   - Regex / pattern validation
 *   - Range checks (numeric, date)
 *   - Referential integrity checks
 *   - Cross-field dependency validation
 *   - Custom rule injection per dataset
 * 
 * Each rule returns: { valid: boolean, field: string, message: string, severity: 'info'|'warning'|'critical' }
 */

const {
  CANONICAL_CATEGORIES,
  CANONICAL_STATES,
  normalizeCategory,
  normalizeState,
} = require('../constants');

// ── Rule Registry ─────────────────────────────────────────────────────────────
const _ruleRegistry = new Map();
const _datasetRules = new Map(); // dataset-specific rule overrides

/**
 * Register a validation rule globally
 * @param {string} name - Unique rule name
 * @param {object} rule - { category, severity, validate: (record, context) => { valid, field, message } }
 */
function registerRule(name, rule) {
  if (!rule.validate || typeof rule.validate !== 'function') {
    throw new Error(`Rule '${name}' must have a validate function`);
  }
  _ruleRegistry.set(name, {
    name,
    category: rule.category || 'custom',
    severity: rule.severity || 'warning',
    enabled: rule.enabled !== false,
    validate: rule.validate,
  });
}

/**
 * Register rules specific to a dataset/category
 */
function registerDatasetRules(dataset, ruleNames) {
  _datasetRules.set(dataset, ruleNames);
}

/**
 * Get all registered rule names
 */
function getRegisteredRules() {
  return Array.from(_ruleRegistry.keys());
}

// ── Built-in Rules ────────────────────────────────────────────────────────────

// 1. COMPLETENESS RULES
registerRule('required_id', {
  category: 'completeness',
  severity: 'critical',
  validate: (record) => {
    if (!record.id || String(record.id).trim().length === 0) {
      return { valid: false, field: 'id', message: 'Missing required field: id' };
    }
    return { valid: true };
  },
});

registerRule('required_job_name', {
  category: 'completeness',
  severity: 'critical',
  validate: (record) => {
    if (!record.job_name || String(record.job_name).trim().length < 3) {
      return { valid: false, field: 'job_name', message: 'Missing or too short job_name (min 3 chars)' };
    }
    return { valid: true };
  },
});

registerRule('required_organization', {
  category: 'completeness',
  severity: 'critical',
  validate: (record) => {
    if (!record.organization || String(record.organization).trim().length < 2) {
      return { valid: false, field: 'organization', message: 'Missing or too short organization (min 2 chars)' };
    }
    return { valid: true };
  },
});

registerRule('required_dates', {
  category: 'completeness',
  severity: 'critical',
  validate: (record) => {
    const errors = [];
    if (!record.application_start_date) {
      errors.push({ valid: false, field: 'application_start_date', message: 'Missing application_start_date' });
    }
    if (!record.application_end_date) {
      errors.push({ valid: false, field: 'application_end_date', message: 'Missing application_end_date' });
    }
    if (errors.length > 0) return errors[0]; // Return first error
    return { valid: true };
  },
});

registerRule('required_category', {
  category: 'completeness',
  severity: 'warning',
  validate: (record) => {
    if (!record.job_category || String(record.job_category).trim().length === 0) {
      return { valid: false, field: 'job_category', message: 'Missing job_category' };
    }
    return { valid: true };
  },
});

registerRule('required_application_link', {
  category: 'completeness',
  severity: 'warning',
  validate: (record) => {
    if (!record.official_application_link || String(record.official_application_link).length < 5) {
      return { valid: false, field: 'official_application_link', message: 'Missing or invalid official_application_link' };
    }
    return { valid: true };
  },
});

registerRule('required_qualification', {
  category: 'completeness',
  severity: 'info',
  validate: (record) => {
    if (!record.qualification_required || record.qualification_required === 'Not Specified') {
      return { valid: false, field: 'qualification_required', message: 'Missing qualification_required' };
    }
    return { valid: true };
  },
});

// 2. TYPE CHECK RULES
registerRule('type_numeric_age', {
  category: 'type_check',
  severity: 'warning',
  validate: (record) => {
    if (record.minimum_age != null && isNaN(Number(record.minimum_age))) {
      return { valid: false, field: 'minimum_age', message: `minimum_age is not a number: ${record.minimum_age}` };
    }
    if (record.maximum_age != null && isNaN(Number(record.maximum_age))) {
      return { valid: false, field: 'maximum_age', message: `maximum_age is not a number: ${record.maximum_age}` };
    }
    return { valid: true };
  },
});

registerRule('type_numeric_salary', {
  category: 'type_check',
  severity: 'info',
  validate: (record) => {
    if (record.salary_min != null && isNaN(Number(record.salary_min))) {
      return { valid: false, field: 'salary_min', message: `salary_min is not a number: ${record.salary_min}` };
    }
    if (record.salary_max != null && isNaN(Number(record.salary_max))) {
      return { valid: false, field: 'salary_max', message: `salary_max is not a number: ${record.salary_max}` };
    }
    return { valid: true };
  },
});

// 3. PATTERN RULES
registerRule('pattern_date_format', {
  category: 'pattern',
  severity: 'critical',
  validate: (record) => {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (record.application_start_date && !dateRe.test(record.application_start_date)) {
      return { valid: false, field: 'application_start_date', message: `Invalid date format: ${record.application_start_date} (expected YYYY-MM-DD)` };
    }
    if (record.application_end_date && !dateRe.test(record.application_end_date)) {
      return { valid: false, field: 'application_end_date', message: `Invalid date format: ${record.application_end_date} (expected YYYY-MM-DD)` };
    }
    return { valid: true };
  },
});

registerRule('pattern_url_format', {
  category: 'pattern',
  severity: 'warning',
  validate: (record) => {
    const urlRe = /^https?:\/\/.+/i;
    if (record.official_application_link && !urlRe.test(record.official_application_link)) {
      return { valid: false, field: 'official_application_link', message: `Invalid URL format: ${record.official_application_link}` };
    }
    if (record.official_website_link && !urlRe.test(record.official_website_link)) {
      return { valid: false, field: 'official_website_link', message: `Invalid URL format: ${record.official_website_link}` };
    }
    return { valid: true };
  },
});

registerRule('pattern_email_format', {
  category: 'pattern',
  severity: 'info',
  validate: (record) => {
    // Only validate if email field exists (for user records)
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      return { valid: false, field: 'email', message: `Invalid email format: ${record.email}` };
    }
    return { valid: true };
  },
});

// 4. RANGE RULES
registerRule('range_age', {
  category: 'range',
  severity: 'warning',
  validate: (record) => {
    const minAge = Number(record.minimum_age);
    const maxAge = Number(record.maximum_age);
    if (!isNaN(minAge) && (minAge < 14 || minAge > 65)) {
      return { valid: false, field: 'minimum_age', message: `minimum_age out of range [14-65]: ${minAge}` };
    }
    if (!isNaN(maxAge) && (maxAge < 16 || maxAge > 70)) {
      return { valid: false, field: 'maximum_age', message: `maximum_age out of range [16-70]: ${maxAge}` };
    }
    return { valid: true };
  },
});

registerRule('range_salary', {
  category: 'range',
  severity: 'info',
  validate: (record) => {
    const salMin = Number(record.salary_min);
    const salMax = Number(record.salary_max);
    if (!isNaN(salMin) && salMin < 0) {
      return { valid: false, field: 'salary_min', message: `salary_min cannot be negative: ${salMin}` };
    }
    if (!isNaN(salMax) && salMax > 5000000) {
      return { valid: false, field: 'salary_max', message: `salary_max suspiciously high: ${salMax}` };
    }
    return { valid: true };
  },
});

registerRule('range_date_valid', {
  category: 'range',
  severity: 'warning',
  validate: (record) => {
    if (record.application_start_date) {
      const d = new Date(record.application_start_date);
      if (isNaN(d.getTime())) {
        return { valid: false, field: 'application_start_date', message: `Unparseable date: ${record.application_start_date}` };
      }
      const year = d.getFullYear();
      if (year < 2020 || year > 2035) {
        return { valid: false, field: 'application_start_date', message: `Date year out of range [2020-2035]: ${year}` };
      }
    }
    return { valid: true };
  },
});

// 5. CONSISTENCY RULES (Cross-field dependencies)
registerRule('consistency_date_order', {
  category: 'consistency',
  severity: 'critical',
  validate: (record) => {
    if (record.application_start_date && record.application_end_date) {
      if (record.application_start_date > record.application_end_date) {
        return {
          valid: false,
          field: 'application_start_date,application_end_date',
          message: `Start date (${record.application_start_date}) is after end date (${record.application_end_date})`,
        };
      }
    }
    return { valid: true };
  },
});

registerRule('consistency_age_order', {
  category: 'consistency',
  severity: 'warning',
  validate: (record) => {
    const minAge = Number(record.minimum_age);
    const maxAge = Number(record.maximum_age);
    if (!isNaN(minAge) && !isNaN(maxAge) && minAge > 0 && maxAge > 0 && minAge > maxAge) {
      return {
        valid: false,
        field: 'minimum_age,maximum_age',
        message: `minimum_age (${minAge}) exceeds maximum_age (${maxAge})`,
      };
    }
    return { valid: true };
  },
});

registerRule('consistency_salary_order', {
  category: 'consistency',
  severity: 'info',
  validate: (record) => {
    const salMin = Number(record.salary_min);
    const salMax = Number(record.salary_max);
    if (!isNaN(salMin) && !isNaN(salMax) && salMin > 0 && salMax > 0 && salMin > salMax) {
      return {
        valid: false,
        field: 'salary_min,salary_max',
        message: `salary_min (${salMin}) exceeds salary_max (${salMax})`,
      };
    }
    return { valid: true };
  },
});

registerRule('consistency_form_status', {
  category: 'consistency',
  severity: 'warning',
  validate: (record) => {
    const validStatuses = ['LIVE', 'UPCOMING', 'CLOSED', 'RECENTLY_CLOSED'];
    if (record.form_status && !validStatuses.includes(record.form_status)) {
      return {
        valid: false,
        field: 'form_status',
        message: `Invalid form_status: ${record.form_status}. Must be one of: ${validStatuses.join(', ')}`,
      };
    }
    return { valid: true };
  },
});

// 6. REFERENTIAL INTEGRITY RULES
registerRule('referential_category', {
  category: 'referential',
  severity: 'warning',
  validate: (record) => {
    if (record.job_category) {
      const normalized = normalizeCategory(record.job_category);
      if (!normalized) {
        return {
          valid: false,
          field: 'job_category',
          message: `Non-canonical category: '${record.job_category}' — not in allowed list`,
        };
      }
    }
    return { valid: true };
  },
});

registerRule('referential_state', {
  category: 'referential',
  severity: 'info',
  validate: (record) => {
    if (record.state && record.state !== 'All India') {
      const normalized = normalizeState(record.state);
      if (!normalized) {
        return {
          valid: false,
          field: 'state',
          message: `Non-canonical state: '${record.state}' — not in allowed list`,
        };
      }
    }
    return { valid: true };
  },
});

// ── Validation Runner ─────────────────────────────────────────────────────────

/**
 * Validate a single record against all applicable rules
 * @param {object} record - The data record to validate
 * @param {object} options - { dataset, categories, severities, ruleNames }
 * @returns {{ valid: boolean, errors: Array, warnings: Array, info: Array, score: number }}
 */
function validateRecord(record, options = {}) {
  const { dataset, categories, severities, ruleNames } = options;

  // Determine which rules to run
  let rulesToRun = Array.from(_ruleRegistry.values()).filter(r => r.enabled);

  // Filter by dataset-specific rules
  if (dataset && _datasetRules.has(dataset)) {
    const allowedNames = _datasetRules.get(dataset);
    rulesToRun = rulesToRun.filter(r => allowedNames.includes(r.name));
  }

  // Filter by categories
  if (categories && categories.length > 0) {
    rulesToRun = rulesToRun.filter(r => categories.includes(r.category));
  }

  // Filter by severity
  if (severities && severities.length > 0) {
    rulesToRun = rulesToRun.filter(r => severities.includes(r.severity));
  }

  // Filter by specific rule names
  if (ruleNames && ruleNames.length > 0) {
    rulesToRun = rulesToRun.filter(r => ruleNames.includes(r.name));
  }

  const errors = [];   // critical
  const warnings = []; // warning
  const info = [];     // info
  let totalRules = rulesToRun.length;
  let passedRules = 0;

  for (const rule of rulesToRun) {
    try {
      const result = rule.validate(record, { dataset });
      if (result.valid) {
        passedRules++;
      } else {
        const entry = {
          rule: rule.name,
          category: rule.category,
          severity: rule.severity,
          field: result.field || 'unknown',
          message: result.message || 'Validation failed',
        };

        switch (rule.severity) {
          case 'critical': errors.push(entry); break;
          case 'warning': warnings.push(entry); break;
          default: info.push(entry); break;
        }
      }
    } catch (err) {
      errors.push({
        rule: rule.name,
        category: 'system',
        severity: 'critical',
        field: 'unknown',
        message: `Rule execution error: ${err.message}`,
      });
    }
  }

  const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;

  return {
    valid: errors.length === 0,
    score,
    totalRules,
    passedRules,
    errors,
    warnings,
    info,
  };
}

/**
 * Validate a batch of records
 * @param {Array} records - Array of data records
 * @param {object} options - Same as validateRecord options
 * @returns {{ totalRecords, validRecords, invalidRecords, avgScore, results: Map<id, result> }}
 */
function validateBatch(records, options = {}) {
  const results = new Map();
  let validCount = 0;
  let totalScore = 0;

  for (const record of records) {
    const result = validateRecord(record, options);
    const key = record.id || `record_${results.size}`;
    results.set(key, result);
    if (result.valid) validCount++;
    totalScore += result.score;
  }

  return {
    totalRecords: records.length,
    validRecords: validCount,
    invalidRecords: records.length - validCount,
    avgScore: records.length > 0 ? Math.round(totalScore / records.length) : 100,
    results,
  };
}

module.exports = {
  registerRule,
  registerDatasetRules,
  getRegisteredRules,
  validateRecord,
  validateBatch,
};
