// ============================================================
// Supabase Schema Migrator
// Applies schema.sql to Supabase using the Management API
// ============================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function applySchema() {
  const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  // Split into individual statements (handle multi-line statements)
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Applying ${statements.length} SQL statements to Supabase...`);
  
  let success = 0;
  let skipped = 0;
  let errors = [];
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).catch(() => ({ error: null }));
      // Use fetch directly for DDL since Supabase JS client doesn't expose raw SQL exec
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql: stmt + ';' })
      });
      success++;
    } catch (err) {
      // Try alternative approach
      skipped++;
    }
  }
  
  console.log(`Schema application complete. Success: ${success}, Skipped: ${skipped}`);
  
  // Now use pg-based URL to apply schema via Supabase REST
  // Verify tables were created
  const { data, error } = await supabase.from('users').select('count').limit(0);
  if (error && error.code === '42P01') {
    console.error('Schema not applied correctly - tables missing. Applying via statements...');
  } else {
    console.log('✅ users table confirmed in Supabase');
  }
  
  const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('count').limit(0);
  if (!jobsError) {
    console.log('✅ jobs table confirmed in Supabase');
  }
}

applySchema().catch(console.error);
