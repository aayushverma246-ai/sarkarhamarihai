// Check DB state and seed in micro-batches
require('dotenv').config({ path: require('path').join(__dirname, 'backend/.env') });
const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    const count = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
    console.log(`Current jobs: ${count.rows[0].cnt}`);
    
    const ver = await db.execute("SELECT value FROM seed_meta WHERE key='seed_version'");
    console.log(`Seed version: ${ver.rows[0]?.value || 'none'}`);
    
    if (Number(count.rows[0].cnt) > 0) {
      const cats = await db.execute('SELECT DISTINCT job_category FROM jobs ORDER BY job_category');
      console.log('Categories:');
      cats.rows.forEach(r => console.log(`  - ${r.job_category}`));
      
      const sample = await db.execute('SELECT id, job_name, job_category FROM jobs LIMIT 3');
      sample.rows.forEach(r => console.log(`  [${r.job_category}] ${r.job_name}`));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
