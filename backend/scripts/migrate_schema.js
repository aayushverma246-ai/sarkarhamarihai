require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const SQL = `
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eligibility_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS selection_process_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS links_status_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS discovery_source TEXT DEFAULT 'seeder';
CREATE INDEX IF NOT EXISTS idx_jobs_last_verified ON jobs(last_verified_at ASC);
`;

// Try the Supabase Management API (requires access token, not service role key)
// Since we don't have a management token, try PostgREST RPC approach by creating a function first.
// Alternative: Use the pg connection string if available.

// Approach: Use the Supabase REST /rest/v1/ endpoint to check if column exists,
// and if not, log instructions.

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function checkAndMigrate() {
  console.log('=== Schema Migration Check ===');
  console.log('Project:', projectRef);

  // Check if last_verified_at column exists by trying to select it
  const { data, error } = await sb
    .from('jobs')
    .select('last_verified_at')
    .limit(1);

  if (error && error.message.includes('last_verified_at')) {
    console.log('\n❌ Column last_verified_at does NOT exist yet.');
    console.log('\nYou need to run this SQL in your Supabase Dashboard SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    console.log('\n--- Copy and paste this SQL ---');
    console.log(SQL);
    console.log('--- End SQL ---');
    process.exit(1);
  } else if (error) {
    console.log('Unexpected error:', error.message);
    // Column might exist but query failed for other reason
  } else {
    console.log('✅ Column last_verified_at already exists!');
    const val = data && data[0] ? data[0].last_verified_at : 'N/A';
    console.log('  Sample value:', val);
  }

  // Check other columns
  const checks = ['eligibility_json', 'selection_process_json', 'links_status_json', 'discovery_source'];
  for (const col of checks) {
    const { error: err2 } = await sb.from('jobs').select(col).limit(1);
    if (err2 && err2.message.includes(col)) {
      console.log(`❌ Column ${col} does NOT exist.`);
    } else {
      console.log(`✅ Column ${col} exists.`);
    }
  }
}

checkAndMigrate().catch(console.error);
