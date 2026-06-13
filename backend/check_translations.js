const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { getDb } = require('./src/db');

async function main() {
  const db = getDb();
  try {
    const r1 = await db.execute("SELECT COUNT(DISTINCT job_name) as cnt FROM jobs");
    const uniqueNames = r1.rows[0]?.cnt || 0;
    console.log(`Unique Job Names count: ${uniqueNames}`);
    
    // Get a sample of unique job names
    const r2 = await db.execute("SELECT DISTINCT job_name FROM jobs LIMIT 10");
    console.log("Sample names:", r2.rows.map(r => r.job_name));
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
