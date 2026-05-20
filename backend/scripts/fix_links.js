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

// ── Central body mapping (key is a word-boundary regex pattern) ──────────────
const CENTRAL_RULES = [
  // Multi-word patterns first (more specific)
  { re: /\bupsc\b/i, url: 'https://upsc.gov.in' },
  { re: /\bssc\b/i, url: 'https://ssc.nic.in' },
  { re: /\bibps\b/i, url: 'https://ibps.in' },
  { re: /\bsbi\b/i, url: 'https://sbi.co.in/web/careers' },
  { re: /\brbi\b/i, url: 'https://rbi.org.in/Scripts/Careers.aspx' },
  { re: /\brrb\b|\brailway/i, url: 'https://indianrailways.gov.in' },
  { re: /\bnta\b/i, url: 'https://nta.ac.in' },
  { re: /\bugc\s*net\b/i, url: 'https://ugcnet.nta.ac.in' },
  { re: /\bcuet\b/i, url: 'https://cuet.nta.ac.in' },
  { re: /\bgate\b/i, url: 'https://gate2025.iitr.ac.in' },
  { re: /\bneet\b/i, url: 'https://neet.nta.nic.in' },
  { re: /\bjee\b/i, url: 'https://jeemain.nta.ac.in' },
  { re: /\bdrdo\b/i, url: 'https://drdo.gov.in' },
  { re: /\bisro\b/i, url: 'https://isro.gov.in' },
  { re: /\bcsir\b/i, url: 'https://csir.res.in' },
  { re: /\bicar\b/i, url: 'https://icar.org.in' },
  { re: /\bnabard\b/i, url: 'https://nabard.org' },
  { re: /\blic\b(?!\w)/i, url: 'https://licindia.in' },  // "LIC" but not "police", "licence"
  { re: /\bepfo\b/i, url: 'https://epfindia.gov.in' },
  { re: /\besic\b/i, url: 'https://esic.gov.in' },
  { re: /\bongc\b/i, url: 'https://ongcindia.com' },
  { re: /\bbhel\b/i, url: 'https://bhel.com' },
  { re: /\bntpc\b/i, url: 'https://ntpc.co.in' },
  { re: /\bsail\b/i, url: 'https://sail.co.in' },
  { re: /\bhal\b(?!\w)/i, url: 'https://hal-india.co.in' },  // "HAL" but not "shall", "marshal"
  { re: /\bbel\b(?!\w)/i, url: 'https://bel-india.in' },
  { re: /\bgail\b/i, url: 'https://gailonline.com' },
  { re: /\biocl\b/i, url: 'https://iocl.com' },
  { re: /\bhpcl\b/i, url: 'https://hindustanpetroleum.com' },
  { re: /\bbpcl\b/i, url: 'https://bharatpetroleum.in' },
  { re: /\bcoal india\b/i, url: 'https://coalindia.in' },
  { re: /\bnhpc\b/i, url: 'https://nhpcindia.com' },
  { re: /\boil india\b/i, url: 'https://oil-india.com' },
  { re: /\bnpcil\b/i, url: 'https://npcil.nic.in' },
  { re: /\bbsf\b/i, url: 'https://bsf.gov.in' },
  { re: /\bcrpf\b/i, url: 'https://crpf.gov.in' },
  { re: /\bcisf\b/i, url: 'https://cisf.gov.in' },
  { re: /\bitbp\b/i, url: 'https://itbpolice.nic.in' },
  { re: /\bassam rifles\b/i, url: 'https://assamrifles.gov.in' },
  { re: /\bnda\b/i, url: 'https://upsc.gov.in' },
  { re: /\bcds\b/i, url: 'https://upsc.gov.in' },
  { re: /\bcapf\b/i, url: 'https://upsc.gov.in' },
  { re: /\bindian army\b/i, url: 'https://joinindianarmy.nic.in' },
  { re: /\bindian navy\b/i, url: 'https://joinindiannavy.gov.in' },
  { re: /\bair force\b/i, url: 'https://indianairforce.nic.in' },
  { re: /\bcoast guard\b/i, url: 'https://joinindiancoastguard.cdac.in' },
  { re: /\bfci\b/i, url: 'https://fci.gov.in' },
  { re: /\baai\b/i, url: 'https://aai.aero' },
  { re: /\bdmrc\b|delhi metro/i, url: 'https://delhimetrorail.com' },
  { re: /\bnhai\b/i, url: 'https://nhai.gov.in' },
  { re: /\bpostal\b|\bindia post\b/i, url: 'https://indiapost.gov.in' },
  { re: /\bincome tax\b/i, url: 'https://incometaxindia.gov.in' },
  { re: /\bcustoms\b|\bcbic\b/i, url: 'https://cbic.gov.in' },
  { re: /\bcbi\b/i, url: 'https://cbi.gov.in' },
  { re: /\bsupreme court\b/i, url: 'https://sci.gov.in' },
  { re: /\bhigh court\b/i, url: 'https://main.sci.gov.in' },
  { re: /\bdistrict court\b/i, url: 'https://districts.ecourts.gov.in' },
  { re: /\bkendriya vidyalaya\b|\bkvs\b/i, url: 'https://kvsangathan.nic.in' },
  { re: /\bnavodaya\b|\bnvs\b/i, url: 'https://navodaya.gov.in' },
  { re: /\bctet\b/i, url: 'https://ctet.nic.in' },
  { re: /\bdsssb\b/i, url: 'https://dsssb.delhi.gov.in' },
  { re: /\bsebi\b/i, url: 'https://sebi.gov.in' },
  { re: /\buidai\b/i, url: 'https://uidai.gov.in' },
  { re: /\bcbse\b/i, url: 'https://cbse.gov.in' },
  { re: /\baiims\b/i, url: 'https://aiimsexams.ac.in' },
  // Police-specific patterns
  { re: /\bstate police\b|\bpolice constable\b|\bpolice si\b|\bsub.inspector\b.*police/i, url: '' }, // handled by state
  { re: /\bpanchayat\b/i, url: 'https://panchayat.gov.in' },
  { re: /\bmunicipal\b/i, url: '' }, // handled by state
  { re: /\banganwadi\b/i, url: '' }, // handled by state
];

// State PSC / government portals
const STATE_MAP = {
  'maharashtra': 'https://mpsc.gov.in',
  'uttar pradesh': 'https://uppsc.up.nic.in',
  'tamil nadu': 'https://tnpsc.gov.in',
  'kerala': 'https://keralapsc.gov.in',
  'karnataka': 'https://kpsc.kar.nic.in',
  'gujarat': 'https://gpsc.gujarat.gov.in',
  'rajasthan': 'https://rpsc.rajasthan.gov.in',
  'bihar': 'https://bpsc.bih.nic.in',
  'west bengal': 'https://wbpsc.gov.in',
  'andhra pradesh': 'https://psc.ap.gov.in',
  'telangana': 'https://tspsc.gov.in',
  'madhya pradesh': 'https://mppsc.mp.gov.in',
  'odisha': 'https://opsc.gov.in',
  'punjab': 'https://ppsc.gov.in',
  'haryana': 'https://hpsc.gov.in',
  'himachal pradesh': 'https://hppsc.hp.gov.in',
  'jharkhand': 'https://jpsc.gov.in',
  'chhattisgarh': 'https://psc.cg.gov.in',
  'assam': 'https://apsc.nic.in',
  'meghalaya': 'https://meghalaya.gov.in',
  'tripura': 'https://tpsc.tripura.gov.in',
  'manipur': 'https://mpscmanipur.gov.in',
  'mizoram': 'https://mpsc.mizoram.gov.in',
  'nagaland': 'https://npsc.nagaland.gov.in',
  'arunachal pradesh': 'https://appsc.gov.in',
  'sikkim': 'https://spsc.sikkim.gov.in',
  'goa': 'https://gpsc.goa.gov.in',
  'uttarakhand': 'https://ukpsc.gov.in',
  'jammu': 'https://jkpsc.nic.in',
  'kashmir': 'https://jkpsc.nic.in',
  'puducherry': 'https://recruitment.puducherry.gov.in',
  'chandigarh': 'https://chandigarh.gov.in',
  'delhi': 'https://dsssb.delhi.gov.in',
  'lakshadweep': 'https://lakshadweep.gov.in',
  'andaman': 'https://andaman.gov.in',
  'dadra': 'https://dnh.gov.in',
  'nagar haveli': 'https://dnh.gov.in',
  'ladakh': 'https://ladakh.gov.in',
};

function resolveLink(jobName, state, organization) {
  const n = (jobName || '').toLowerCase();
  const s = (state || '').toLowerCase();
  const o = (organization || '').toLowerCase();
  const combined = `${n} ${o}`;

  // 1. Try central body match with word-boundary regex
  for (const rule of CENTRAL_RULES) {
    if (rule.re.test(combined)) {
      if (rule.url) return rule.url;
      // Empty url means "fall through to state"
      break;
    }
  }

  // 2. Try state match (from state field first, then from job name/org)
  for (const [key, url] of Object.entries(STATE_MAP)) {
    if (s.includes(key)) return url;
  }
  for (const [key, url] of Object.entries(STATE_MAP)) {
    if (combined.includes(key)) return url;
  }

  // 3. Fallback
  return '';
}

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
    const newLink = resolveLink(job.job_name, job.state, job.organization);

    // Update if: the link is wrong OR empty/generic AND we have a better one
    const isCurrentWrong =
      currentLink === 'https://licindia.in' ||
      currentLink === 'https://hal-india.co.in' ||
      currentLink === 'https://bel-india.in' ||
      currentLink === 'https://mha.gov.in' ||
      currentLink === 'https://mea.gov.in' ||
      currentLink === 'https://main.sci.gov.in' ||
      currentLink === 'https://india.gov.in' ||
      currentLink === '';

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
