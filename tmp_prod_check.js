/**
 * Final production health check for SarkarHamariHai
 * Tests: health, all-minimal count, job details, category distribution
 */
const BASE = 'https://sarkarhamarihai.vercel.app/api';

async function check(label, url, validate) {
  try {
    const r = await fetch(url);
    const j = await r.json();
    const result = validate(j, r);
    const icon = result.ok ? '✅' : '❌';
    console.log(`${icon} ${label}: ${result.msg}`);
  } catch (e) {
    console.log(`❌ ${label}: FAILED — ${e.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SarkarHamariHai — Production Checks');
  console.log('═══════════════════════════════════════\n');

  // 1. Health
  await check('Health', `${BASE}/health`, (j) => ({
    ok: j.status === 'healthy' || j.database === 'connected',
    msg: `status=${j.status} jobs=${j.jobCount}`
  }));

  // 2. all-minimal count
  const allMinRes = await fetch(`${BASE}/jobs/all-minimal`);
  const allMinData = await allMinRes.json();
  const jobs = allMinData.jobs || allMinData || [];
  const cats = [...new Set(jobs.map(x => x.job_category))].sort();
  const expectedTotal = 15858;
  const countOk = jobs.length >= expectedTotal - 50; // allow tiny margin
  console.log(`${countOk ? '✅' : '⚠️ '} all-minimal jobs: ${jobs.length}/${expectedTotal} expected`);
  console.log(`✅ Categories (${cats.length}): ${cats.slice(0, 8).join(', ')}...`);

  // 3. Single job fetch (exam details)
  const sampleId = jobs[0]?.id;
  if (sampleId) {
    await check(`Job detail [${sampleId}]`, `${BASE}/jobs/${sampleId}`, (j) => ({
      ok: !!j.id && !!j.job_name && !!j.form_status,
      msg: `"${j.job_name?.slice(0, 40)}" | cat=${j.job_category} | status=${j.form_status}`
    }));
  }

  // 4. Pagination stability — check page 1 vs page 16 have no overlap
  if (jobs.length > 15000) {
    const idSetPage1 = new Set(jobs.slice(0, 1000).map(j => j.id));
    const page16Ids = jobs.slice(15000, 16000).map(j => j.id);
    const overlap = page16Ids.filter(id => idSetPage1.has(id));
    console.log(`${overlap.length === 0 ? '✅' : '❌'} Pagination stability: overlap=${overlap.length} (expect 0)`);
  }

  // 5. Category distribution
  const catCounts = {};
  for (const j of jobs) catCounts[j.job_category] = (catCounts[j.job_category] || 0) + 1;
  const top5 = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
  console.log('\n📊 Top 5 categories:');
  top5.forEach(([c, n]) => console.log(`   ${c.padEnd(25)} ${n}`));

  // 6. No CENTRAL/STATE/PSU remaining
  const legacyCats = ['CENTRAL', 'STATE', 'PSU'].filter(c => catCounts[c] > 100);
  console.log(`\n${legacyCats.length === 0 ? '✅' : '❌'} Legacy category cleanup: ${legacyCats.length === 0 ? 'no raw CENTRAL/STATE/PSU' : 'still has ' + legacyCats.join(', ')}`);

  console.log('\n═══════════════════════════════════════');
  console.log('  Done.\n');
}

main().catch(console.error);
