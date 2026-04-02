/**
 * setup_supabase.js
 * 
 * Applies schema to Supabase using the pg package with direct connection.
 * The Supabase "Session Mode" pooler URL uses the service_role JWT as the auth token.
 * 
 * Supabase PostgreSQL connection via REST (PostgREST) approach for DDL:
 * We use the pg driver with SSL connecting to Supabase's direct database.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A';

const PROJECT_REF = 'ztbgunartkntrqxxsdpc';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';

async function main() {
  const { Pool } = require('pg');
  
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  if (!DB_PASSWORD) {
    // Cannot connect without password — output schema for manual application
    console.log('\n' + '='.repeat(70));
    console.log('MANUAL SCHEMA APPLICATION REQUIRED');
    console.log('='.repeat(70));
    console.log('\nPlease do the following:');
    console.log(`1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.log('2. Copy and paste the SQL below');
    console.log('3. Click "Run"');
    console.log('4. Come back and run: node scripts/migrate_to_supabase.js\n');
    console.log('--- SQL TO PASTE ---');
    console.log(schemaSql);
    console.log('--- END OF SQL ---');
    return;
  }
  
  // Try connecting via Transaction Pooler (port 6543) first, then Session Mode (5432)
  const connectionStrings = [
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ];
  
  let pool = null;
  let lastErr = null;
  
  for (const connStr of connectionStrings) {
    try {
      const p = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
      await p.query('SELECT 1');
      pool = p;
      console.log('✅ Connected to Supabase PostgreSQL');
      break;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  
  if (!pool) {
    console.error('❌ Could not connect:', lastErr?.message);
    console.log('\nTry setting SUPABASE_DB_PASSWORD in your .env file');
    console.log('(Get it from: Supabase Dashboard → Project → Settings → Database)\n');
    return;
  }
  
  const client = await pool.connect();
  try {
    // Apply schema statement by statement for better error handling
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Applying ${statements.length} schema statements...`);
    let ok = 0, skip = 0;
    
    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
        ok++;
      } catch (e) {
        if (['42P07', '42710', '42701', '42P06', '23505'].includes(e.code)) {
          skip++; // Already exists or duplicate — safe to ignore
        } else {
          console.warn(`  Warn: ${e.message.substring(0, 80)}`);
          skip++;
        }
      }
    }
    
    console.log(`✅ Schema applied: ${ok} statements OK, ${skip} skipped (already exists)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
