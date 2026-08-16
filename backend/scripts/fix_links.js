/**
 * fix_links.js v2 — Uses word-boundary matching to avoid false positives.
 * Directly uses Supabase JS SDK.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { resolveLink, isGenericUrl } = require('../src/engines/link-resolver');

async function fixAllLinks() {
  console.log('=== SarkarHamariHai Link Fixer v2 (word-boundary) ===');
  console.log('Fetching ALL jobs from Supabase...');

  let allJobs = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('jobs')
      .select('id, job_name, state, organization, official_website_link')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    console.log(`  Fetched page ${page + 1}: ${data.length} records (total: ${allJobs.length})`);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\nTotal jobs: ${allJobs.length}`);

  // Find all jobs that need fixing:
  //   - currently have a wrong link from the previous run (e.g., licindia for police jobs)
  //   - still have generic/empty links
  let updatedCount = 0;
  const updateBatch = [];

  for (const job of allJobs) {
    const currentLink = job.official_website_link || '';
    const newLink = resolveLink(job.organization, job.job_name, job.state);

    // Update if: the link is wrong OR empty/generic AND we have a better one
    const isCurrentWrong =
      currentLink === 'https://licindia.in' ||
      currentLink === 'https://hal-india.co.in' ||
      currentLink === 'https://bel-india.in' ||
      currentLink === 'https://mha.gov.in' ||
      currentLink === 'https://mea.gov.in' ||
      currentLink === 'https://main.sci.gov.in' ||
      currentLink === 'https://india.gov.in' ||
      currentLink === '' ||
      isGenericUrl(currentLink);

    const isGenericState = /^https?:\/\/[a-z]+\.gov\.in\/?$/.test(currentLink) && !currentLink.includes('psc') && !currentLink.includes('nic');

    if ((isCurrentWrong || isGenericState) && newLink && newLink !== currentLink) {
      updateBatch.push({ id: job.id, link: newLink, name: job.job_name });
    }
  }

  console.log(`\n--- v2 Fix Plan ---`);
  console.log(`  Jobs to re-fix: ${updateBatch.length}`);

  // Apply updates in batches of 50
  const BATCH = 50;
  for (let i = 0; i < updateBatch.length; i += BATCH) {
    const batch = updateBatch.slice(i, i + BATCH);
    const promises = batch.map(item =>
      sb.from('jobs').update({
        official_website_link: item.link,
        official_application_link: item.link,
        official_notification_link: item.link,
      }).eq('id', item.id)
    );
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    updatedCount += batch.length - errors.length;
    if (errors.length > 0) {
      errors.forEach(e => console.error('  ERR:', e.error.message));
    }
    process.stdout.write(`\r  Updated ${updatedCount}/${updateBatch.length}...`);
  }

  console.log(`\n\n✅ Done! Re-fixed ${updatedCount} job links.`);

  // Verification: spot-check known problem patterns
  console.log('\n--- Spot-Check Verification ---');
  const checks = [
    { pattern: 'Police', field: 'job_name' },
    { pattern: 'Panchayat', field: 'job_name' },
    { pattern: 'High Court', field: 'job_name' },
    { pattern: 'CRPF', field: 'job_name' },
    { pattern: 'UPSC', field: 'job_name' },
    { pattern: 'SSC', field: 'job_name' },
  ];

  for (const chk of checks) {
    const { data } = await sb
      .from('jobs')
      .select('job_name, official_website_link, state')
      .ilike(chk.field, `%${chk.pattern}%`)
      .limit(3);

    for (const j of (data || [])) {
      const link = j.official_website_link || '(empty)';
      console.log(`  [${chk.pattern}] ${j.job_name.substring(0, 45).padEnd(45)} → ${link}`);
    }
  }
}

fixAllLinks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
