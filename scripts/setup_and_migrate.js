/**
 * setup_and_migrate.js
 *
 * ONE-COMMAND setup for Supabase:
 *   1. Applies the full schema via Supabase Management API (no DB password needed)
 *   2. Migrates all data from Turso → Supabase
 *   3. Verifies row counts
 *
 * Run: node scripts/setup_and_migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient: createTursoClient } = require('@libsql/client/http');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ── Credentials ───────────────────────────────────────────────────────────────
const TURSO_URL = (process.env.TURSO_DATABASE_URL || 'libsql://sarkar-new-aayush-verma-19.aws-ap-south-1.turso.io')
  .replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL e.g. ztbgunartkntrqxxsdpc
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}
if (!TURSO_TOKEN) {
  console.error('❌ TURSO_AUTH_TOKEN not set in .env');
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────
const turso = createTursoClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ── Logger ────────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] ${msg}`);
}

// ── Schema Application via Management API ─────────────────────────────────────
async function applySchemaViaManagementApi() {
  log('📋 Applying schema via Supabase Management API...');

  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Supabase Management API endpoint for executing SQL
  const endpoint = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: schemaSql }),
    });

    if (resp.ok) {
      log('✅ Schema applied via Management API');
      return true;
    }

    const body = await resp.text();
    log(`ℹ️  Management API response (${resp.status}): ${body.substring(0, 200)}`);
  } catch (e) {
    log(`ℹ️  Management API not reachable: ${e.message}`);
  }

  return false;
}

// ── Schema Application via pg Pool (fallback) ─────────────────────────────────
async function applySchemaViaPg() {
  const { Pool } = require('pg');
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbPassword) {
    log('⚠️  SUPABASE_DB_PASSWORD not set. Trying Management API only...');
    return false;
  }

  const pool = new Pool({
    connectionString: `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  try {
    const client = await pool.connect();
    try {
      log('📋 Applying schema via direct pg connection...');
      await client.query(schemaSql);
      log('✅ Schema applied via pg connection');
      return true;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    log(`⚠️  Direct pg schema error: ${err.message}`);
    await pool.end().catch(() => {});
    return false;
  }
}

// ── Check if tables exist ─────────────────────────────────────────────────────
async function tablesExist() {
  const { data, error } = await supabase.from('jobs').select('id').limit(1);
  return !error;
}

// ── Turso helper ──────────────────────────────────────────────────────────────
async function tursoQuery(sql, args = []) {
  const result = await turso.execute({ sql, args });
  return result.rows || [];
}

// ── Supabase upsert in batches ────────────────────────────────────────────────
async function supabaseUpsert(table, rows, conflictCol = 'id') {
  if (!rows || rows.length === 0) return 0;

  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictCol, ignoreDuplicates: false });

    if (error) {
      // Try row-by-row fallback
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from(table)
          .upsert([row], { onConflict: conflictCol, ignoreDuplicates: true });
        if (!rowErr || rowErr.message.includes('duplicate')) inserted++;
        else console.error(`  [${table}] row error: ${rowErr.message.substring(0, 100)}`);
      }
    } else {
      inserted += batch.length;
    }

    const pct = Math.min(i + BATCH, rows.length);
    process.stdout.write(`\r  → ${table}: ${pct}/${rows.length}`);
  }
  process.stdout.write('\n');
  return inserted;
}

// ── Table migrators ───────────────────────────────────────────────────────────
async function migrateUsers() {
  log('👥 Migrating users...');
  const rows = await tursoQuery('SELECT * FROM users');
  log(`   Found ${rows.length} users in Turso`);
  const mapped = rows.map(u => ({
    id: String(u.id),
    email: u.email || '',
    password_hash: u.password_hash || '',
    full_name: u.full_name || '',
    age: Number(u.age) || 0,
    category: u.category || '',
    state: u.state || '',
    qualification_type: u.qualification_type || '',
    qualification_status: u.qualification_status || '',
    current_year: Number(u.current_year) || 0,
    current_semester: Number(u.current_semester) || 0,
    expected_graduation_year: Number(u.expected_graduation_year) || 0,
    created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
  }));
  const n = await supabaseUpsert('users', mapped, 'id');
  log(`   ✅ ${n} users migrated`);
  return rows.length;
}

async function tursoQueryWithRetry(sql, args = [], maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await turso.execute({ sql, args });
      return result.rows || [];
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const waitMs = attempt * 3000;
      log(`   ⚠️  Turso error (attempt ${attempt}/${maxRetries}): ${e.message.substring(0, 80)}`);
      log(`   Retrying in ${waitMs / 1000}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

async function migrateJobs() {
  log('💼 Migrating jobs (15k+ rows)...');
  const BATCH_SIZE = 200; // Smaller batches to avoid Turso timeouts

  // Resume: check how many jobs are already in Supabase
  const { count: existingCount } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
  let offset = existingCount || 0;
  let total = offset;

  if (offset > 0) {
    log(`   ⏩ Resuming from offset ${offset} (${offset} jobs already in Supabase)`);
  }

  while (true) {
    let rows;
    try {
      rows = await tursoQueryWithRetry(`SELECT * FROM jobs LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    } catch (e) {
      log(`   ❌ Turso failed after retries at offset ${offset}: ${e.message}`);
      log(`   Stopping here — re-run script to resume from offset ${offset}`);
      break;
    }

    if (rows.length === 0) break;

    const mapped = rows.map(j => ({
      id: String(j.id),
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
    }));

    await supabaseUpsert('jobs', mapped, 'id');
    total += rows.length;
    offset += BATCH_SIZE;

    log(`   Progress: ${total} jobs migrated so far`);
    if (rows.length < BATCH_SIZE) break;
  }

  log(`   ✅ ${total} jobs total in Supabase`);
  return total;
}

async function migrateSimpleTable(table, mapper, conflictCol = 'id') {
  try {
    const rows = await tursoQuery(`SELECT * FROM ${table}`);
    log(`📦 ${table}: ${rows.length} rows`);
    if (rows.length === 0) return 0;
    const mapped = rows.map(mapper);
    const n = await supabaseUpsert(table, mapped, conflictCol);
    log(`   ✅ ${n} rows migrated`);
    return rows.length;
  } catch (e) {
    log(`   ⚠️  ${table}: ${e.message} (skipping)`);
    return 0;
  }
}

async function migrateAllUserTables() {
  // liked_jobs
  await migrateSimpleTable('liked_jobs', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    job_id: String(r.job_id),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // applied_jobs
  await migrateSimpleTable('applied_jobs', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    job_id: String(r.job_id),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // job_reminders
  await migrateSimpleTable('job_reminders', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    job_id: String(r.job_id),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // notifications
  await migrateSimpleTable('notifications', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    job_id: r.job_id ? String(r.job_id) : null,
    message: r.message || '',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // roadmaps
  await migrateSimpleTable('roadmaps', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    job_id: String(r.job_id),
    roadmap_content: typeof r.roadmap_content === 'string' ? r.roadmap_content : JSON.stringify(r.roadmap_content),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // tracker_user_stats
  await migrateSimpleTable('tracker_user_stats', r => ({
    user_id: String(r.user_id),
    current_streak: Number(r.current_streak) || 0,
    longest_streak: Number(r.longest_streak) || 0,
    total_study_hours: Number(r.total_study_hours) || 0,
    overall_readiness_score: Number(r.overall_readiness_score) || 0,
    target_probability: Number(r.target_probability) || 0,
    last_updated: r.last_updated ? new Date(r.last_updated).toISOString() : new Date().toISOString(),
  }), 'user_id');

  // tracker_user_targets
  await migrateSimpleTable('tracker_user_targets', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    exam_name: r.exam_name || '',
    exam_date: r.exam_date || null,
    syllabus_completed_pct: Number(r.syllabus_completed_pct) || 0,
    target_probability: Number(r.target_probability) || 0,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // tracker_plans
  await migrateSimpleTable('tracker_plans', r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    date: r.date || '',
    wake_time: r.wake_time || '',
    sleep_time: r.sleep_time || '',
    planned_hours: Number(r.planned_hours) || 0,
    completed_hours: Number(r.completed_hours) || 0,
    productivity_score: Number(r.productivity_score) || 0,
    status: r.status || 'planned',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));

  // tracker_sessions
  await migrateSimpleTable('tracker_sessions', r => ({
    id: String(r.id),
    plan_id: String(r.plan_id),
    exam_target_id: r.exam_target_id ? String(r.exam_target_id) : null,
    start_time: r.start_time || '',
    end_time: r.end_time || '',
    session_type: r.session_type || 'study',
    title: r.title || '',
    is_completed: Number(r.is_completed) || 0,
  }));

  // seed_meta
  await migrateSimpleTable('seed_meta', r => ({ key: r.key, value: String(r.value) }), 'key');
}

// ── Verification ──────────────────────────────────────────────────────────────
async function verify() {
  log('\n=== VERIFICATION ===');
  const tables = [
    'users', 'jobs', 'liked_jobs', 'applied_jobs',
    'job_reminders', 'notifications', 'roadmaps',
    'tracker_plans', 'tracker_sessions', 'tracker_user_stats', 'tracker_user_targets',
  ];

  let allOk = true;
  for (const table of tables) {
    try {
      const tursoRows = await tursoQuery(`SELECT COUNT(*) as cnt FROM ${table}`).catch(() => [{ cnt: '?' }]);
      const tursoCount = tursoRows[0]?.cnt ?? '?';

      const { count: sbCount, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        log(`  ❌ ${table}: Supabase error — ${error.message}`);
        allOk = false;
        continue;
      }

      const match = String(tursoCount) === String(sbCount);
      log(`  ${match ? '✅' : '⚠️ '} ${table}: Turso=${tursoCount} | Supabase=${sbCount}${!match ? ' ← MISMATCH' : ''}`);
      if (!match) allOk = false;
    } catch (e) {
      log(`  ⚠️  ${table}: ${e.message}`);
    }
  }
  return allOk;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 SarkarHamariHai: Automated Supabase Setup + Migration');
  console.log('==========================================================\n');

  // Step 1: Check Turso
  log('Testing Turso connection...');
  try {
    const cnt = await tursoQuery('SELECT COUNT(*) as cnt FROM jobs');
    log(`✅ Turso connected: ${cnt[0]?.cnt || 0} jobs`);
  } catch (e) {
    console.error('❌ Turso connection failed:', e.message);
    process.exit(1);
  }

  // Step 2: Apply schema
  const alreadyExists = await tablesExist();
  if (alreadyExists) {
    log('✅ Supabase tables already exist, skipping schema apply');
  } else {
    log('🔧 Tables not found, applying schema...');

    // Try Management API first (no password needed)
    let schemaOk = await applySchemaViaManagementApi();

    // Fallback to direct pg if Management API fails
    if (!schemaOk) {
      schemaOk = await applySchemaViaPg();
    }

    if (!schemaOk) {
      // Recheck — maybe schema was partially applied
      const nowExists = await tablesExist();
      if (!nowExists) {
        log('\n❌ Could not apply schema automatically.');
        log('   Please apply it manually:');
        log(`   → https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        log('   → Paste contents of supabase/schema.sql and click Run');
        log('   → Then re-run: node scripts/setup_and_migrate.js\n');
        process.exit(1);
      }
    }

    // Wait a moment for schema to propagate
    await new Promise(r => setTimeout(r, 2000));
    const confirmed = await tablesExist();
    log(confirmed ? '✅ Schema confirmed in Supabase' : '⚠️  Could not confirm tables yet, proceeding anyway...');
  }

  // Step 3: Migrate data
  const startTime = Date.now();
  log('\n📦 Starting data migration...');

  await migrateUsers();
  await migrateJobs();
  await migrateAllUserTables();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n✅ Migration complete in ${elapsed}s`);

  // Step 4: Verify
  const ok = await verify();

  console.log('\n' + '='.repeat(50));
  if (ok) {
    console.log('🎉 ALL DONE — Supabase is fully set up!');
  } else {
    console.log('⚠️  Migration done but some counts differ (see above)');
  }
  console.log('\n📋 Next steps:');
  console.log('  1. Push env vars to Vercel: npx vercel env pull (or set in dashboard)');
  console.log('  2. Deploy: npx vercel --prod');
  console.log('  3. Test: node test_vercel.js');
  console.log('='.repeat(50) + '\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
