'use strict';
require('dotenv').config();
const { getDb } = require('../backend/src/db');

async function run() {
  const db = getDb();
  console.log('Truncating ai_recommendation_cache...');
  try {
    const res1 = await db.execute('DELETE FROM ai_recommendation_cache');
    console.log('Successfully cleared ai_recommendation_cache. Rows affected:', res1.rowsAffected);
  } catch (err) {
    console.error('Failed to clear ai_recommendation_cache:', err.message);
  }

  console.log('Truncating ai_recommendations...');
  try {
    const res2 = await db.execute('DELETE FROM ai_recommendations');
    console.log('Successfully cleared ai_recommendations. Rows affected:', res2.rowsAffected);
  } catch (err) {
    console.error('Failed to clear ai_recommendations:', err.message);
  }

  process.exit(0);
}

run();
