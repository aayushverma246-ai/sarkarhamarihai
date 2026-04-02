const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('--- CLEANING SELECTION PROCEDURES ---\n');

  // We wipe data that is highly likely to be placeholder/fake.
  const badPatterns = [
    'Placeholder', 'N/A', 'NA', 'None', '-', '--', 'TBD', 'To be decided', 'To be announced', 'TBA'
  ];

  let totalUpdated = 0;

  for (const pattern of badPatterns) {
    try {
      const result = await db.execute({
        sql: `UPDATE jobs SET selection_process = NULL WHERE LOWER(selection_process) = ?`,
        args: [pattern.toLowerCase()]
      });
      if (result.rowsAffected > 0) {
        totalUpdated += result.rowsAffected;
        console.log(`  Cleaned exact match '${pattern}': ${result.rowsAffected} rows`);
      }
    } catch (e) {
      console.error(`  ERROR '${pattern}': ${e.message}`);
    }
  }

  // Also clean strings shorter than 5 characters like ".", "a", "1."
  try {
     const resultLens = await db.execute(`UPDATE jobs SET selection_process = NULL WHERE length(selection_process) < 5`);
     if (resultLens.rowsAffected > 0) {
       totalUpdated += resultLens.rowsAffected;
       console.log(`  Cleaned length < 5: ${resultLens.rowsAffected} rows`);
     }
  } catch(e) { console.error('Error on lengths', e.message); }

  console.log(`\nTotal junk procedures stripped: ${totalUpdated}`);
  console.log('\n✅ SELECTION PROCEDURE CLEANUP COMPLETE');
}

main().catch(console.error);
