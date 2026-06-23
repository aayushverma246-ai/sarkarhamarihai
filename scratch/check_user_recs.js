'use strict';
require('dotenv').config();
const { getDb } = require('../backend/src/db');
const { getRecommendations } = require('../backend/src/services/gemini_recommender');

async function run() {
  const db = getDb();
  
  // Get the most active users or the last user who logged in
  const usersRes = await db.execute('SELECT id, email, full_name, state, qualification_type, age FROM users ORDER BY created_at DESC LIMIT 5');
  console.log('--- RECENT USERS ---');
  for (const user of usersRes.rows) {
    const appliedRes = await db.execute('SELECT COUNT(*) as cnt FROM applied_jobs WHERE user_id = ?', [user.id]);
    console.log(`User: ${user.full_name} (${user.email}) | ID: ${user.id} | Applied count: ${appliedRes.rows[0].cnt}`);
  }

  // Find users who have applied to exams
  const activeUserRes = await db.execute(
    'SELECT DISTINCT aj.user_id FROM applied_jobs aj JOIN users u ON aj.user_id = u.id LIMIT 5'
  );
  if (activeUserRes.rows.length === 0) {
    console.log('No users with applied exams found in users table!');
    process.exit(0);
  }

  for (const row of activeUserRes.rows) {
    const userId = row.user_id;
    const userProfileRes = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userProfileRes.rows[0];
    if (!user) continue;
    
    const appliedExamsRes = await db.execute(
      'SELECT j.id, j.job_name, j.syllabus, j.job_category FROM applied_jobs aj JOIN jobs j ON aj.job_id = j.id WHERE aj.user_id = ?',
      [userId]
    );
    const sourceIds = appliedExamsRes.rows.map(r => r.id);

    console.log(`\n========================================`);
    console.log(`Analyzing recommendations for user: ${user.full_name} (${user.email})`);
    console.log(`Applied exams (${sourceIds.length}):`, appliedExamsRes.rows.map(r => r.job_name));

    if (sourceIds.length > 0) {
      console.log('Calculating recommendations...');
      const recs = await getRecommendations(sourceIds, userId, { page: 1 });
      console.log(`Recommendations Count (Page 1 Data):`, recs.data.length);
      console.log(`Total Matches:`, recs.totalMatches);
      if (recs.data.length > 0) {
        console.log('Sample matches (first 5):');
        recs.data.slice(0, 5).forEach((r, idx) => {
          console.log(`  ${idx+1}. Name: ${r.job_name} | Overlap: ${r.similarity}%`);
        });
      }
    }
  }

  process.exit(0);
}

run();
