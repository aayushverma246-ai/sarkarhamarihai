/**
 * scripts/setup_cache.js
 *
 * Automatically creates the `ai_recommendation_cache` table on Supabase.
 * Uses the connection details from `.env`.
 */
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';

const sql = `
  CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_recommendation_cache_updated ON ai_recommendation_cache(updated_at DESC);
`;

async function run() {
  console.log('=== Checking and Creating Caching Tables ===');

  // Try direct Postgres connection pool
  const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] || 'ztbgunartkntrqxxsdpc';
  const connectionString = process.env.SUPABASE_DB_URL || `postgresql://postgres:${DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`;

  console.log(`Connecting to: postgresql://postgres:****@db.${ref}.supabase.co:5432/postgres`);

  try {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    
    await pool.query(sql);
    console.log('✅ Success: ai_recommendation_cache table verified/created successfully via pg pool.');
    await pool.end();
    process.exit(0);
  } catch (pgErr) {
    console.warn('⚠️ Direct PostgreSQL pool failed, trying REST/RPC fallback...', pgErr.message);

    if (!SERVICE_KEY) {
      console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in env. Cannot run fallback.');
      process.exit(1);
    }

    try {
      // Try pg-meta SQL query endpoint
      const response = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (response.ok) {
        console.log('✅ Success: ai_recommendation_cache table verified/created successfully via pg-meta.');
        process.exit(0);
      }
      
      const responseText = await response.text();
      console.error('❌ SQL endpoint failed:', responseText);

      // Try RPC exec_sql endpoint
      const response2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_query: sql }),
      });

      if (response2.ok) {
        console.log('✅ Success: ai_recommendation_cache table verified/created successfully via RPC.');
        process.exit(0);
      }

      console.error('❌ RPC fallback failed. Please copy the SQL below and run it manually in the Supabase SQL Editor:');
      console.log('--------------------------------------------------');
      console.log(sql.trim());
      console.log('--------------------------------------------------');
      process.exit(1);
    } catch (fallbackErr) {
      console.error('❌ Cache setup completely failed:', fallbackErr.message);
      process.exit(1);
    }
  }
}

run();
