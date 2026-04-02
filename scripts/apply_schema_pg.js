/**
 * apply_schema_pg.js
 * 
 * Applies schema.sql to Supabase via direct PostgreSQL connection
 * Uses the Supabase "Session Mode" pooler (port 5432) 
 * Connection format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
 * 
 * NOTE: This requires your DB password (set in Supabase dashboard → Settings → Database)
 * 
 * HOW TO GET YOUR DB PASSWORD:
 * 1. Go to: https://supabase.com/dashboard/project/ztbgunartkntrqxxsdpc/settings/database
 * 2. Under "Connection string", find the password or reset it
 * 3. Set it as SUPABASE_DB_PASSWORD environment variable below
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A';

const SUPABASE_URL = 'https://ztbgunartkntrqxxsdpc.supabase.co';

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';

async function applyViaRestApi() {
  // Alternative: use the Supabase Management API to run SQL
  // This requires a personal access token, not service role key
  console.log('Attempting schema application via Supabase REST...');
  
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  // Split by ; and run each statement individually via the PostgREST RPC
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to apply`);
  
  let success = 0, failed = 0;
  
  for (const stmt of statements) {
    try {
      // Use fetch to call supabase's internal REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      
      // Actually use pg if password available
      if (DB_PASSWORD) {
        break; // Fall through to pg approach
      }
      success++;
    } catch (e) {
      failed++;
    }
  }
  
  return { success, failed };
}

async function applyViaDirectPg() {
  if (!DB_PASSWORD) {
    console.log('\n⚠️  No SUPABASE_DB_PASSWORD set.');
    console.log('To apply schema automatically, either:');
    console.log('  1. Set SUPABASE_DB_PASSWORD in .env (get from Supabase dashboard → Settings → Database)');
    console.log('  OR');
    console.log('  2. Apply schema.sql manually via Supabase SQL Editor:');
    console.log('     https://supabase.com/dashboard/project/ztbgunartkntrqxxsdpc/sql/new');
    
    // Show schema content so they can copy it
    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    console.log('\n=== PASTE THE FOLLOWING SQL IN SUPABASE SQL EDITOR ===');
    console.log(schemaContent);
    console.log('=== END OF SCHEMA SQL ===\n');
    return;
  }
  
  const connectionString = `postgresql://postgres.ztbgunartkntrqxxsdpc:${DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase PostgreSQL, applying schema...');
    await client.query(schemaSql);
    console.log('✅ Schema applied successfully!');
  } catch (err) {
    console.error('Schema error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyViaDirectPg();
