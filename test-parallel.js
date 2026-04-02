const { getDb } = require('./backend/src/db');
require('dotenv').config({path: '.env'});

async function test() {
  const db = getDb();
  console.log("Fetching jobs from db using parallel mode...");
  try {
     const start = Date.now();
     const countRes = await db.execute('SELECT COUNT(*) as count FROM jobs');
     const total = Number(countRes.rows[0]?.count || countRes.rows[0]?.exact || 18000);
     const limit = 1000;
     const totalPages = Math.ceil(total / limit);
     console.log(`Discovered ${total} jobs. Fetching in ${totalPages} pages...`);
     
     const fetchPromises = [];
     for (let i = 0; i < totalPages; i++) {
        fetchPromises.push(
            db.execute(`SELECT id FROM jobs ORDER BY application_end_date DESC LIMIT ${limit} OFFSET ${i * limit}`)
                .then(r => r.rows || [])
        );
     }
     
     const results = await Promise.all(fetchPromises);
     const allRows = results.flat();
     console.log(`Fetched ${allRows.length} jobs in ${Date.now() - start}ms`);
  } catch (e) {
     console.error(e);
  }
}
test();
