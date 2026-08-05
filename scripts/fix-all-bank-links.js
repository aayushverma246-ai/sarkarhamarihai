'use strict';
/**
 * fix-all-bank-links.js — Correct links for all public sector banks in the database
 * 
 * Uses JavaScript-based matching to prevent SQL wildcard overlaps (e.g. Bank of India matching State Bank of India).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BANK_WEBSITES = [
  {
    keywords: ['state bank of india', 'sbi'],
    webUrl: 'https://www.sbi.co.in',
    appUrl: 'https://www.sbi.co.in/careers',
    notifUrl: 'https://www.sbi.co.in/careers'
  },
  {
    keywords: ['punjab national bank', 'pnb'],
    webUrl: 'https://www.pnbindia.in',
    appUrl: 'https://www.pnbindia.in/active-jobs.html',
    notifUrl: 'https://www.pnbindia.in/active-jobs.html'
  },
  {
    keywords: ['union bank of india'],
    webUrl: 'https://www.unionbankofindia.co.in',
    appUrl: 'https://www.unionbankofindia.co.in/english/recruitment.aspx',
    notifUrl: 'https://www.unionbankofindia.co.in/english/recruitment.aspx'
  },
  {
    keywords: ['canara bank'],
    webUrl: 'https://canarabank.com',
    appUrl: 'https://canarabank.com/careers.aspx',
    notifUrl: 'https://canarabank.com/careers.aspx'
  },
  {
    keywords: ['bank of baroda', 'bob'],
    webUrl: 'https://www.bankofbaroda.in',
    appUrl: 'https://www.bankofbaroda.in/careers',
    notifUrl: 'https://www.bankofbaroda.in/careers'
  },
  {
    keywords: ['indian bank'],
    webUrl: 'https://www.indianbank.in',
    appUrl: 'https://www.indianbank.in/departments/recruitment-careers/',
    notifUrl: 'https://www.indianbank.in/departments/recruitment-careers/'
  },
  {
    // Evaluated last to avoid matching "State Bank of India" or "Union Bank of India"
    keywords: ['bank of india', 'boi'],
    webUrl: 'https://www.bankofindia.co.in',
    appUrl: 'https://www.bankofindia.co.in/careers',
    notifUrl: 'https://www.bankofindia.co.in/careers'
  },
  {
    keywords: ['uco bank'],
    webUrl: 'https://www.ucobank.com',
    appUrl: 'https://www.ucobank.com/english/career.aspx',
    notifUrl: 'https://www.ucobank.com/english/career.aspx'
  },
  {
    keywords: ['central bank of india'],
    webUrl: 'https://www.centralbankofindia.co.in',
    appUrl: 'https://www.centralbankofindia.co.in/en/careers',
    notifUrl: 'https://www.centralbankofindia.co.in/en/careers'
  },
  {
    keywords: ['indian overseas bank', 'iob'],
    webUrl: 'https://www.iob.in',
    appUrl: 'https://www.iob.in/Careers',
    notifUrl: 'https://www.iob.in/Careers'
  },
  {
    keywords: ['bank of maharashtra'],
    webUrl: 'https://bankofmaharashtra.in',
    appUrl: 'https://bankofmaharashtra.in/careers',
    notifUrl: 'https://bankofmaharashtra.in/careers'
  },
  {
    keywords: ['punjab & sind bank'],
    webUrl: 'https://punjabandsindbank.co.in',
    appUrl: 'https://punjabandsindbank.co.in/content/recruitment',
    notifUrl: 'https://punjabandsindbank.co.in/content/recruitment'
  }
];

function getCorrectBankMapping(orgName, jobName) {
  const nameLower = (jobName || '').toLowerCase();
  const orgLower = (orgName || '').toLowerCase();
  const combined = `${nameLower} ${orgLower}`;

  // Check specific banks first (e.g. State Bank of India, Union Bank of India)
  // before checking Bank of India
  for (const mapping of BANK_WEBSITES) {
    // If it's the general "bank of india" mapping, verify it doesn't contain "state" or "union"
    const isBOI = mapping.keywords.includes('bank of india') || mapping.keywords.includes('boi');
    if (isBOI) {
      if (combined.includes('state bank') || combined.includes('union bank')) {
        continue; // skip BOI mapping for state/union banks
      }
    }

    for (const kw of mapping.keywords) {
      if (combined.includes(kw)) {
        return mapping;
      }
    }
  }
  return null;
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       VERIFYING & REPAIRING ALL PUBLIC SECTOR BANK LINKS     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Fetch all potential bank jobs
  const { data: jobs, error } = await sb.from('jobs')
    .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
    .eq('job_category', 'Banking');

  if (error) {
    console.error('Error fetching banking jobs:', error.message);
    process.exit(1);
  }

  console.log(`Found ${jobs.length} banking category jobs in the database.`);

  let totalUpdated = 0;
  for (const job of jobs) {
    const mapping = getCorrectBankMapping(job.organization, job.job_name);
    if (mapping) {
      const needsUpdate = 
        job.official_website_link !== mapping.webUrl ||
        job.official_application_link !== mapping.appUrl ||
        job.official_notification_link !== mapping.notifUrl;

      if (needsUpdate) {
        const { error: updErr } = await sb.from('jobs')
          .update({
            official_website_link: mapping.webUrl,
            official_application_link: mapping.appUrl,
            official_notification_link: mapping.notifUrl
          })
          .eq('id', job.id);

        if (updErr) {
          console.error(`  ❌ Error updating ${job.job_name}:`, updErr.message);
        } else {
          console.log(`  ✅ Restored: "${job.job_name}" -> ${mapping.webUrl}`);
          totalUpdated++;
        }
      }
    } else {
      console.log(`  ⚠️  No mapping found for bank: "${job.job_name}"`);
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total PSU Bank links healed: ${totalUpdated}`);
  console.log(`═══════════════════════════════════════════`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
