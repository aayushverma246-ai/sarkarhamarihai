require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function sanitize() {
  await initDb();
  const db = getDb();
  console.log("--- STARTING DATABASE SANITIZATION ENGINE ---");

  // 1. Sanitize generic salary ranges
  console.log("Resetting generic 18,000 - 56,900 salaries to 0 for re-verification...");
  try {
    const salRes = await db.execute({
      sql: "UPDATE jobs SET salary_min = ?, salary_max = ?, last_verified_at = ?, discovery_source = ? WHERE salary_min = ? AND salary_max = ?",
      args: [0, 0, null, 'stale', 18000, 56900]
    });
    console.log(`  [SUCCESS] Sanitized ${salRes.rowsAffected || 0} salary rows.`);
  } catch (err) {
    console.error("  [FAILED] Salary sanitization error:", err.message);
  }

  // 2. Sanitize generic age limits
  console.log("Resetting generic 18 - 35 age limits to 0 for re-verification...");
  try {
    const ageRes = await db.execute({
      sql: "UPDATE jobs SET minimum_age = ?, maximum_age = ?, last_verified_at = ?, discovery_source = ? WHERE minimum_age = ? AND maximum_age = ?",
      args: [0, 0, null, 'stale', 18, 35]
    });
    console.log(`  [SUCCESS] Sanitized ${ageRes.rowsAffected || 0} age rows.`);
  } catch (err) {
    console.error("  [FAILED] Age sanitization error:", err.message);
  }

  // 3. Sanitize generic qualifications
  console.log("Resetting generic 'Refer Official Notification' qualifications to empty string...");
  try {
    const qualRes = await db.execute({
      sql: "UPDATE jobs SET qualification_required = ?, last_verified_at = ?, discovery_source = ? WHERE qualification_required = ?",
      args: ['', null, 'stale', 'Refer Official Notification']
    });
    console.log(`  [SUCCESS] Sanitized ${qualRes.rowsAffected || 0} qualification rows.`);
  } catch (err) {
    console.error("  [FAILED] Qualification sanitization error:", err.message);
  }

  console.log("--- DATABASE SANITIZATION COMPLETED ---");
  process.exit(0);
}

sanitize().catch(console.error);
