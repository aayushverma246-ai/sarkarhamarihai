const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GENERIC_DOMAINS = [
  'india.gov.in', 'careers.india.gov.in', 'apprenticeshipindia.org',
  'metro.gov.in', 'mha.gov.in', 'andaman.gov.in', 'indianbanksassociation.org'
];

const WHITELISTED_DOMAINS = [
  'epfindia.gov.in', 'airindia.gov.in', 'coalindia.in',
];

function isGenericUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (WHITELISTED_DOMAINS.some(w => lower.includes(w))) return false;
  return GENERIC_DOMAINS.some(d => lower.includes(d));
}

async function run() {
  let allJobs = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await sb.from('jobs')
      .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allJobs.push(...data);
    if (data.length < 1000) break;
  }
  
  let count = 0;
  for (const job of allJobs) {
    let flagged = false;
    const fields = {};
    for (const f of ['official_website_link', 'official_application_link', 'official_notification_link']) {
      if (isGenericUrl(job[f])) {
        flagged = true;
        fields[f] = job[f];
      }
    }
    if (flagged) {
      count++;
      console.log(`- [${job.id}] Job: "${job.job_name}" | Org: "${job.organization}"`);
      console.log(`  Flagged Fields:`, fields);
    }
  }
  console.log(`\nTotal flagged jobs: ${count}`);
  process.exit(0);
}

run().catch(console.error);
