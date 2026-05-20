'use strict';
const { BaseScraper } = require('./base-scraper');

/**
 * UPSC Scraper — upsc.gov.in
 * Scrapes active examinations and recruitment notifications
 */
class UPSCScraper extends BaseScraper {
  constructor() {
    super('UPSC', { timeout: 10000 });
    this.urls = [
      'https://upsc.gov.in/examinations/active-examinations',
      'https://upsc.gov.in/recruitment/recruitment-test',
    ];
  }

  async scrape() {
    const exams = [];

    for (const url of this.urls) {
      const html = await this.fetch(url);
      if (!html) continue;

      // Parse exam notifications from UPSC page
      // UPSC pages typically have tables with exam names and dates
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      for (const row of rows) {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        if (cells.length < 2) continue;

        const nameRaw = cells[0].replace(/<[^>]+>/g, '').trim();
        if (!nameRaw || nameRaw.length < 5 || /^S\.?\s*No|^Sl/i.test(nameRaw)) continue;

        // Extract links
        const linkMatch = row.match(/href="([^"]*?)"/i);
        const link = linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://upsc.gov.in${linkMatch[1]}`) : 'https://upsc.gov.in';

        // Extract dates if present
        const dateMatches = row.match(/\d{2}[./-]\d{2}[./-]\d{4}/g) || [];

        exams.push(this.buildExam({
          job_name: `UPSC ${nameRaw} ${new Date().getFullYear()}`,
          organization: 'Union Public Service Commission',
          job_category: 'UPSC',
          official_website_link: 'https://upsc.gov.in',
          official_notification_link: link,
          official_application_link: 'https://upsconline.nic.in',
          qualification_required: 'Graduation (Varies by post)',
          minimum_age: 21,
          maximum_age: 32,
          selection_process: 'Stage 1: Preliminary Exam → GS I & CSAT Stage 2: Main Exam → Descriptive Papers Stage 3: Interview → Personality Test',
          application_start_date: dateMatches[0] ? this.parseDate(dateMatches[0]) : null,
          application_end_date: dateMatches[1] ? this.parseDate(dateMatches[1]) : null,
          state: 'All India',
        }));
      }
    }

    // Always include core UPSC exams even if scraping fails
    const coreExams = [
      'Civil Services (IAS/IPS/IFS)', 'CDS I', 'CDS II', 'NDA I', 'NDA II',
      'CAPF AC', 'Engineering Services (ESE)', 'Indian Forest Service',
      'EPFO EO/AO', 'SO/Steno Grade D CSSS', 'Geologist Exam',
      'CMS (Combined Medical Services)', 'CISF AC (LDCE)', 'IES/ISS',
    ];

    for (const name of coreExams) {
      const exists = exams.some(e => e.job_name.includes(name.split(' ')[0]));
      if (!exists) {
        exams.push(this.buildExam({
          job_name: `UPSC ${name} ${new Date().getFullYear()}`,
          organization: 'Union Public Service Commission',
          job_category: 'UPSC',
          official_website_link: 'https://upsc.gov.in',
          official_application_link: 'https://upsconline.nic.in',
          selection_process: 'Stage 1: Preliminary/Written Exam Stage 2: Main Exam Stage 3: Interview/Personality Test',
          state: 'All India',
          form_status: 'UPCOMING',
        }));
      }
    }

    return { exams, errors: this.errors };
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[./-]/);
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  }
}

module.exports = { name: 'UPSC', scrape: () => new UPSCScraper().scrape() };
