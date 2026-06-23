require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');
const { isJobVerified } = require('../backend/src/services/gemini_recommender');

async function run() {
  await initDb();
  const db = getDb();
  const res = await db.execute("SELECT id, job_name, organization, official_application_link, job_category FROM jobs WHERE job_category = 'UPSC'");
  console.log(`Found ${res.rows.length} jobs in UPSC category:`);
  res.rows.forEach(r => {
    const verified = isJobVerified(r);
    console.log(`- ID: ${r.id} | Name: "${r.job_name}" | Org: "${r.organization}" | Link: "${r.official_application_link}" | Verified: ${verified}`);
  });
}

run().catch(console.error);
