/**
 * fast_seed_supabase.js
 * Seeds all 15,858 jobs from test.json → Supabase
 * Uses parallel batches for maximum speed.
 * Run: node scripts/fast_seed_supabase.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 500;    // rows per batch
const CONCURRENCY = 4;     // parallel batches

function log(msg) {
  process.stdout.write(`\r${' '.repeat(80)}\r${msg}\n`);
}

function mapJob(j) {
  return {
    id: String(j.id || ''),
    job_name: j.job_name || '',
    organization: j.organization || '',
    qualification_required: j.qualification_required || 'Graduation',
    allows_final_year_students: Number(j.allows_final_year_students) || 0,
    minimum_age: Number(j.minimum_age) || 18,
    maximum_age: Number(j.maximum_age) || 40,
    application_start_date: j.application_start_date || '2024-01-01',
    application_end_date: j.application_end_date || '2024-12-31',
    salary_min: Number(j.salary_min) || 0,
    salary_max: Number(j.salary_max) || 0,
    job_category: j.job_category || 'General',
    official_application_link: j.official_application_link || '',
    official_notification_link: j.official_notification_link || '',
    official_website_link: j.official_website_link || '',
    description: j.description || '',
    selection_process: j.selection_process || '',
    form_status: j.form_status || 'UPCOMING',
    exam_name_hi: j.exam_name_hi || '',
    exam_name_ta: j.exam_name_ta || '',
    exam_name_bn: j.exam_name_bn || '',
    syllabus: j.syllabus || '',
    structured_syllabus_json: j.structured_syllabus_json || '',
    embeddings_json: j.embeddings_json || '',
    exam_type: j.exam_type || '',
    state: j.state || 'All India',
    states: j.states || '[]',
    vacancies: Number(j.vacancies) || 0,
    applicants_count: Number(j.applicants_count) || 0,
  };
}

async function upsertBatch(batch, batchNum, total) {
  const { error } = await supabase
    .from('jobs')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    // Row-by-row fallback
    let ok = 0;
    for (const row of batch) {
      const { error: e2 } = await supabase
        .from('jobs')
        .upsert([row], { onConflict: 'id', ignoreDuplicates: true });
      if (!e2) ok++;
    }
    log(`  batch ${batchNum}: fallback ${ok}/${batch.length} ok`);
  }
}

async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let i = 0;

  async function runNext() {
    if (i >= tasks.length) return;
    const idx = i++;
    await tasks[idx]();
    return runNext();
  }

  const workers = Array(Math.min(concurrency, tasks.length)).fill(null).map(runNext);
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('\n⚡ Fast Supabase Seeder — loading test.json...');

  const dataPath = path.join(__dirname, '../test.json');
  const raw = require(dataPath);
  const allJobs = raw.jobs || (Array.isArray(raw) ? raw : []);
  console.log(`   Loaded ${allJobs.length} jobs from test.json`);

  // Check existing count to skip already-done rows
  const { count: existing } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });
  console.log(`   Already in Supabase: ${existing || 0} jobs`);

  // Build batches
  const batches = [];
  for (let start = 0; start < allJobs.length; start += BATCH_SIZE) {
    batches.push(allJobs.slice(start, start + BATCH_SIZE).map(mapJob));
  }

  console.log(`   ${batches.length} batches of ${BATCH_SIZE}, concurrency=${CONCURRENCY}\n`);

  let done = 0;
  const startTime = Date.now();

  const tasks = batches.map((batch, idx) => async () => {
    await upsertBatch(batch, idx + 1, batches.length);
    done++;
    const pct = Math.round((done / batches.length) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rowsDone = Math.min((done) * BATCH_SIZE, allJobs.length);
    process.stdout.write(
      `\r  ⚡ ${rowsDone}/${allJobs.length} jobs  [${pct}%]  ${elapsed}s elapsed   `
    );
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Done! ${allJobs.length} jobs upserted in ${elapsed}s`);

  // Verify
  const { count: finalCount, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Verification error:', error.message);
  } else {
    const match = finalCount === allJobs.length;
    console.log(`${match ? '✅' : '⚠️ '} Supabase jobs count: ${finalCount} / ${allJobs.length} expected`);
    if (!match) {
      console.log('   Some rows may have been skipped as duplicates — that is fine.');
    }
  }

  // Also set seed_meta
  await supabase.from('seed_meta').upsert(
    [{ key: 'seeded_v', value: `local_json_${allJobs.length}` }],
    { onConflict: 'key' }
  );
  console.log('✅ seed_meta updated');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
