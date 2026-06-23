require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
  await initDb();
  const db = getDb();
  const res = await db.execute("SELECT id, job_name, organization, job_category, application_start_date, application_end_date FROM jobs WHERE job_category = 'UPSC'");
  console.log(`Found ${res.rows.length} jobs in UPSC category:`);
  res.rows.forEach(r => {
    console.log(`- ID: ${r.id} | Name: "${r.job_name}" | Org: "${r.organization}" | Dates: ${r.application_start_date} to ${r.application_end_date}`);
  });
}

run().catch(console.error);
