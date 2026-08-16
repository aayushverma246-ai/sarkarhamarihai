'use strict';
/**
 * base-scraper.js — Base class for all scrapers
 * Provides common fetch + parse + error handling patterns
 */
const axios = require('axios');

class BaseScraper {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      timeout: 8000,
      maxRedirects: 3,
      ...config,
    };
    this.errors = [];
  }

  /**
   * Fetch a URL with proper headers and error handling
   */
  async fetch(url) {
    try {
      const resp = await axios.get(url, {
        timeout: this.config.timeout,
        maxRedirects: this.config.maxRedirects,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        },
        validateStatus: (status) => status < 500,
      });
      return resp.data;
    } catch (err) {
      this.errors.push(`Fetch ${url}: ${err.message}`);
      return null;
    }
  }

  /**
   * Build a standardized exam record
   */
  buildExam(fields) {
    const now = new Date();
    const year = now.getFullYear();
    const id = require('crypto').createHash('md5')
      .update(`${fields.job_name || ''}|${fields.organization || ''}|${year}`)
      .digest('hex').substring(0, 16);

    // Default dates: if no dates provided, set to upcoming window
    const defaultStart = new Date(); defaultStart.setDate(defaultStart.getDate() + 30);
    const defaultEnd = new Date(); defaultEnd.setDate(defaultEnd.getDate() + 60);
    const fmtDate = (d) => d.toISOString().split('T')[0];

    const { resolveLink, isGenericUrl } = require('../engines/link-resolver');
    let website = fields.official_website_link || '';
    let apply = fields.official_application_link || '';
    let notif = fields.official_notification_link || '';

    // If website is generic or empty, resolve it
    if (!website || isGenericUrl(website)) {
      const lookup = resolveLink(fields.organization, fields.job_name, fields.state);
      if (lookup) {
        website = lookup;
      } else {
        website = website && !isGenericUrl(website) ? website : '';
      }
    }
    // If apply is generic or empty, resolve it, fallback to website
    if (!apply || isGenericUrl(apply)) {
      const lookup = resolveLink(fields.organization, fields.job_name, fields.state);
      if (lookup) {
        apply = lookup;
      } else {
        apply = apply && !isGenericUrl(apply) ? apply : website;
      }
    }
    // If notif is generic or empty, resolve it, fallback to website
    if (!notif || isGenericUrl(notif)) {
      const lookup = resolveLink(fields.organization, fields.job_name, fields.state);
      if (lookup) {
        notif = lookup;
      } else {
        notif = notif && !isGenericUrl(notif) ? notif : website;
      }
    }

    return {
      id,
      job_name: fields.job_name || '',
      organization: fields.organization || '',
      qualification_required: fields.qualification_required || 'Refer Official Notification',
      allows_final_year_students: fields.allows_final_year || 0,
      minimum_age: fields.minimum_age || 18,
      maximum_age: fields.maximum_age || 35,
      application_start_date: fields.application_start_date || fmtDate(defaultStart),
      application_end_date: fields.application_end_date || fmtDate(defaultEnd),
      salary_min: fields.salary_min || 0,
      salary_max: fields.salary_max || 0,
      job_category: fields.job_category || 'Central Government',
      official_website_link: website,
      official_application_link: apply,
      official_notification_link: notif,
      syllabus: fields.syllabus || '',
      selection_process: fields.selection_process || '',
      form_status: fields.form_status || 'UPCOMING',
      state: fields.state || 'All India',
      states: fields.states || 'All India',
      exam_name_hi: fields.exam_name_hi || '',
      exam_name_ta: fields.exam_name_ta || '',
      exam_name_bn: fields.exam_name_bn || '',
      discovery_source: 'scraper',
      last_verified_at: new Date().toISOString(),
    };
  }

  /**
   * Override in subclass: scrape() must return { exams: [...], errors: [...] }
   */
  async scrape() {
    throw new Error(`${this.name}: scrape() not implemented`);
  }
}

module.exports = { BaseScraper };
