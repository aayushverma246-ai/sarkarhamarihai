require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
  await initDb();
  const db = getDb();
  const res = await db.execute("SELECT discovery_source, count(*) as cnt FROM jobs GROUP BY discovery_source ORDER BY cnt DESC");
  console.log("Jobs grouped by discovery_source:");
  res.rows.forEach(r => {
    console.log(`- Source: "${r.discovery_source}" | Count: ${r.cnt}`);
  });
}

run().catch(console.error);
