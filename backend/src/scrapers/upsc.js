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
      {
        name: 'Civil Services (IAS/IPS/IFS)',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 32,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Preliminary Examination (Objective MCQ Type) → GS Paper I & GS Paper II (CSAT) Stage 2: Main Examination (Descriptive Written Test) → 9 Papers Stage 3: Personality Test (Interview) → Final Evaluation.'
      },
      {
        name: 'CAPF Assistant Commandant',
        qualification: 'Graduation',
        minAge: 20,
        maxAge: 25,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Written Examination (Paper I: General Ability & Intelligence, Paper II: General Studies, Essay & Comprehension) Stage 2: Physical Standards/Physical Efficiency Tests & Medical Standards Tests Stage 3: Personality Test/Interview.'
      },
      {
        name: 'CDS I',
        qualification: 'Graduation',
        minAge: 19,
        maxAge: 25,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.'
      },
      {
        name: 'CDS II',
        qualification: 'Graduation',
        minAge: 19,
        maxAge: 25,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.'
      },
      {
        name: 'CISF AC (LDCE)',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 35,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Written Examination (Paper I: Professional Skills & General Ability, Paper II: Essay & Comprehension) Stage 2: Physical Standards/Efficiency & Medical Tests Stage 3: Personality Test / Interview.'
      },
      {
        name: 'Combined Medical Services CMS',
        qualification: 'MBBS',
        minAge: 21,
        maxAge: 32,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Computer Based Written Examination (Paper I & Paper II) Stage 2: Personality Test (Interview) Stage 3: Document Verification & Medical Standards.'
      },
      {
        name: 'Drug Inspector',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 44900,
        salaryMax: 142400,
        selectionProcess: 'Stage 1: Written test / Recruitment Test (Objective MCQ) Stage 2: Interview / Personality Test Stage 3: Document Verification.'
      },
      {
        name: 'Enforcement Officer/Accounts Officer',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 47600,
        salaryMax: 151100,
        selectionProcess: 'Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.'
      },
      {
        name: 'Engineering Services (ESE)',
        qualification: 'Engineering Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Engineering Services Preliminary Examination (Objective) Stage 2: Engineering Services Main Examination (Descriptive) Stage 3: Personality Test (Interview).'
      },
      {
        name: 'EPFO EO/AO',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 47600,
        salaryMax: 151100,
        selectionProcess: 'Stage 1: Recruitment Test (Pen & Paper OMR Based MCQ) Stage 2: Interview.'
      },
      {
        name: 'Geologist/Geoscientist',
        qualification: 'Post Graduation',
        minAge: 21,
        maxAge: 32,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Combined Geo-Scientist Preliminary Examination (Objective) Stage 2: Combined Geo-Scientist Main Examination (Descriptive) Stage 3: Personality Test (Interview).'
      },
      {
        name: 'IES/ISS Economics Statistics',
        qualification: 'Post Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Written Examination (Descriptive Papers) Stage 2: Viva-Voce (Personality Test).'
      },
      {
        name: 'Indian Forest Service IFoS',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 32,
        salaryMin: 56100,
        salaryMax: 177500,
        selectionProcess: 'Stage 1: Civil Services Preliminary Exam Stage 2: Indian Forest Service Main Exam (Written Descriptive) Stage 3: Interview/Personality Test.'
      },
      {
        name: 'NDA & NA I',
        qualification: 'Class 12',
        minAge: 16,
        maxAge: 19,
        salaryMin: 56100,
        salaryMax: 94100,
        selectionProcess: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
      },
      {
        name: 'NDA & NA II',
        qualification: 'Class 12',
        minAge: 16,
        maxAge: 19,
        salaryMin: 56100,
        salaryMax: 94100,
        selectionProcess: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
      },
      {
        name: 'NDA III',
        qualification: 'Class 12',
        minAge: 16,
        maxAge: 19,
        salaryMin: 56100,
        salaryMax: 94100,
        selectionProcess: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
      },
      {
        name: 'SO/Steno Grade D CSSS',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 50,
        salaryMin: 47600,
        salaryMax: 151100,
        selectionProcess: 'Stage 1: Written Examination (Objective/Descriptive) Stage 2: Evaluation of Service Records.'
      },
      {
        name: 'Assistant Director Scientific Officer',
        qualification: 'Post Graduation',
        minAge: 21,
        maxAge: 35,
        salaryMin: 47600,
        salaryMax: 151100,
        selectionProcess: 'Stage 1: Recruitment Test Stage 2: Interview.'
      },
      {
        name: 'Asst Director Cost Accounts',
        qualification: 'Graduation',
        minAge: 21,
        maxAge: 30,
        salaryMin: 47600,
        salaryMax: 151100,
        selectionProcess: 'Stage 1: Recruitment Test Stage 2: Interview.'
      }
    ];
 
    for (const exam of coreExams) {
      const exists = exams.some(e => e.job_name.includes(exam.name.split(' ')[0]));
      if (!exists) {
        exams.push(this.buildExam({
          job_name: `UPSC ${exam.name} ${new Date().getFullYear()}`,
          organization: 'Union Public Service Commission',
          job_category: 'UPSC',
          official_website_link: 'https://upsc.gov.in',
          official_application_link: 'https://upsconline.nic.in',
          qualification_required: exam.qualification,
          minimum_age: exam.minAge,
          maximum_age: exam.maxAge,
          salary_min: exam.salaryMin,
          salary_max: exam.salaryMax,
          selection_process: exam.selectionProcess,
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
