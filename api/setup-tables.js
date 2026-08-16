// One-time setup endpoint — creates missing tables
// Uses Supabase Management API (db.sql endpoint)
module.exports = async (req, res) => {
  const secret = req.query.secret;
  if (secret !== 'sarkar_cron_key_v1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const sql = `
    CREATE TABLE IF NOT EXISTS applied_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    );
    CREATE TABLE IF NOT EXISTS liked_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    );
    CREATE TABLE IF NOT EXISTS job_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      title TEXT,
      message TEXT,
      read BOOLEAN DEFAULT FALSE,
      job_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS scraper_logs (
      id SERIAL PRIMARY KEY,
      source TEXT,
      status TEXT,
      jobs_found INT DEFAULT 0,
      jobs_inserted INT DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_applied_user ON applied_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_liked_user ON liked_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_user ON job_reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_recommendation_cache_updated ON ai_recommendation_cache(updated_at DESC);
  `;

  try {
    // Try pg pool first (if DB URL is available)
    if (process.env.SUPABASE_DB_URL) {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false },
      });
      await pool.query(sql);
      await pool.end();
      return res.json({ status: 'ok', method: 'pg', message: 'All tables created via pg' });
    }

    // Fallback: use fetch to Supabase SQL endpoint
    // Extract project ref from URL
    const ref = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] || 'ztbgunartkntrqxxsdpc';

    // Try the pg-meta SQL endpoint
    const sqlRes = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (sqlRes.ok) {
      const data = await sqlRes.json();
      return res.json({ status: 'ok', method: 'pg-meta', data });
    }

    // Try another path
    const sqlRes2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql_query: sql }),
    });

    if (sqlRes2.ok) {
      return res.json({ status: 'ok', method: 'rpc' });
    }

    // Last resort: individual table creation via multiple approaches
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check which tables exist
    const tables = ['applied_jobs', 'liked_jobs', 'job_reminders', 'notifications', 'scraper_logs', 'ai_recommendation_cache'];
    const checks = [];
    for (const t of tables) {
      const { error } = await sb.from(t).select('*').limit(0);
      checks.push({ table: t, exists: !error, error: error?.message?.substring(0, 80) });
    }

    return res.json({
      status: 'tables_missing',
      checks,
      message: 'Could not auto-create tables. Run SQL manually in Supabase SQL Editor.',
      sql_to_run: sql.trim(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 300) });
  }
};
