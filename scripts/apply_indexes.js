const { getPool, getDb } = require('../backend/src/db');

async function applyIndexes() {
  console.log('Applying critical Supabase indexes...');
  const pool = getPool();
  if(!pool) {
    console.warn('SUPABASE_DB_URL not set for pg pool. Cannot apply raw DDL indexes.');
    return;
  }

  const queries = [
    `CREATE INDEX IF NOT EXISTS idx_jobs_form_status ON jobs(form_status);`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_job_category ON jobs(job_category);`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_job_state ON jobs(job_state);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_job ON liked_jobs(user_id, job_id);`,
    `CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_job ON applied_jobs(user_id, job_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sync_state_key ON sync_state(key);`
  ];

  for(const q of queries) {
    try {
      await pool.query(q);
      console.log('Executed:', q);
    } catch(e) {
       console.error('Error on query:', q, e.message);
    }
  }

  console.log('Indexes checked/applied successfully.');
  process.exit(0);
}

applyIndexes();
