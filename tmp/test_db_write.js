const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('=== Turso Database Write Diagnostic ===\n');
  console.log('URL:', process.env.TURSO_DATABASE_URL);
  
  // 1. List tables
  console.log('\n1. Listing tables...');
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables.rows.map(r => Object.values(r)[0]));

  // 2. Check schema of jobs
  console.log('\n2. Checking jobs schema...');
  const schema = await db.execute("PRAGMA table_info(jobs)");
  console.log('Columns:', schema.rows.map(r => r.name || r[1]));

  // 3. Test a read
  console.log('\n3. Testing read...');
  const sample = await db.execute('SELECT * FROM jobs LIMIT 1');
  console.log('Sample row keys:', Object.keys(sample.rows[0]));
  console.log('Sample job_category:', sample.rows[0].job_category);

  // 4. Test a write with AbortController timeout
  console.log('\n4. Testing single write (60s timeout)...');
  const start = Date.now();
  
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    console.log('TIMEOUT: Write aborted after 60s');
  }, 60000);
  
  try {
    const writeResult = await db.execute({
      sql: 'UPDATE jobs SET job_category = ? WHERE id = ?',
      args: [sample.rows[0].job_category || 'Others', sample.rows[0].id]
    });
    clearTimeout(timeout);
    console.log('WRITE SUCCESS in', Date.now() - start, 'ms');
    console.log('Rows affected:', writeResult.rowsAffected);
  } catch (writeErr) {
    clearTimeout(timeout);
    console.error('WRITE FAILED after', Date.now() - start, 'ms:', writeErr.message);
  }

  console.log('\n=== Diagnostic Complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
