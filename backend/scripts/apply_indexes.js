require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSql(sql) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql })
    });
    const text = await response.text();
    if (!response.ok) {
        console.error('Failed to execute SQL:', sql);
        console.error('Response:', text);
    } else {
        console.log('Successfully executed:', sql);
    }
}

async function addIndexes() {
    console.log('Adding mandatory indexes...');
    
    const statements = [
        "CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(id);",
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
        "CREATE INDEX IF NOT EXISTS idx_jobs_id ON jobs(id);",
        "CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(job_category);",
        "CREATE INDEX IF NOT EXISTS idx_jobs_app_end_date ON jobs(application_end_date DESC);",
        "CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_applied_jobs_job_id ON applied_jobs(job_id);",
        "CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id ON liked_jobs(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_liked_jobs_job_id ON liked_jobs(job_id);"
    ];
    
    for (const stmt of statements) {
       await executeSql(stmt);
    }
    console.log('Done mapping indexes.');
}

addIndexes();
