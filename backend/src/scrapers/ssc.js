'use strict';
const { BaseScraper } = require('./base-scraper');

/**
 * SSC Scraper — ssc.nic.in
 */
class SSCScraper extends BaseScraper {
  constructor() { super('SSC', { timeout: 10000 }); }

  async scrape() {
    const exams = [];
    const html = await this.fetch('https://ssc.nic.in');

    if (html) {
      // SSC's main page has a notice board with latest notifications
      const notices = html.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi) || [];
      for (const notice of notices) {
        const href = (notice.match(/href="([^"]*)"/) || [])[1] || '';
        const text = notice.replace(/<[^>]+>/g, '').trim();
        if (text.length > 10 && /exam|recruitment|notification|vacancy|advt/i.test(text)) {
          const link = href.startsWith('http') ? href : `https://ssc.nic.in${href}`;
          exams.push(this.buildExam({
            job_name: `SSC ${text.substring(0, 80)} ${new Date().getFullYear()}`,
            organization: 'Staff Selection Commission',
            job_category: 'SSC',
            official_website_link: 'https://ssc.nic.in',
            official_notification_link: link,
            official_application_link: 'https://ssc.nic.in',
            state: 'All India',
          }));
        }
      }
    }

    // Core SSC exams that must always exist
    const core = [
      { name: 'CGL - Tax Assistant', qual: 'Graduation', sel: 'Tier I → Tier II → Tier III → Skill Test' },
      { name: 'CGL - Auditor', qual: 'Graduation', sel: 'Tier I → Tier II → Tier III → Skill Test' },
      { name: 'CHSL - LDC/DEO', qual: '12th Pass', sel: 'Tier I → Tier II → Typing Test' },
      { name: 'MTS & Havaldar', qual: '10th Pass', sel: 'Paper I → Paper II → PET/PST' },
      { name: 'CPO SI/ASI', qual: 'Graduation', sel: 'Paper I → PET/PST → Paper II → Medical' },
      { name: 'Stenographer Grade C & D', qual: '12th Pass', sel: 'CBE → Skill Test (Stenography)' },
      { name: 'Junior Engineer (Civil)', qual: 'Diploma/B.Tech', sel: 'Paper I → Paper II' },
      { name: 'Junior Engineer (Electrical)', qual: 'Diploma/B.Tech', sel: 'Paper I → Paper II' },
      { name: 'Junior Engineer (Mechanical)', qual: 'Diploma/B.Tech', sel: 'Paper I → Paper II' },
      { name: 'GD Constable', qual: '10th Pass', sel: 'CBE → PET/PST → Medical → DV' },
      { name: 'Head Constable', qual: '12th Pass', sel: 'CBE → PET/PST → Medical' },
      { name: 'Selection Post Phase XII', qual: 'Varies', sel: 'CBE → Document Verification' },
    ];

    for (const c of core) {
      exams.push(this.buildExam({
        job_name: `SSC ${c.name} ${new Date().getFullYear()}`,
        organization: 'Staff Selection Commission',
        job_category: 'SSC',
        qualification_required: c.qual,
        selection_process: c.sel,
        official_website_link: 'https://ssc.nic.in',
        official_application_link: 'https://ssc.nic.in',
        minimum_age: 18, maximum_age: 32,
        state: 'All India',
      }));
    }

    return { exams, errors: this.errors };
  }
}

module.exports = { name: 'SSC', scrape: () => new SSCScraper().scrape() };
