'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');
const { getRecommendations } = require('../backend/src/services/gemini_recommender');

(async () => {
    try {
        const db = getDb();
        console.log('Querying a user from the DB...');
        const userRes = await db.execute('SELECT id, email, full_name, age, qualification_type, category FROM users LIMIT 1');
        const user = userRes.rows[0];
        if (!user) {
            console.log('No user found in database!');
            process.exit(1);
        }
        console.log('Testing recommendations with user:', user);

        // Fetch some jobs to use as source exams
        const jobsRes = await db.execute('SELECT id, job_name, job_category, syllabus FROM jobs WHERE official_application_link IS NOT NULL LIMIT 2');
        const jobs = jobsRes.rows;
        if (jobs.length === 0) {
            console.log('No jobs found to use as source exams!');
            process.exit(1);
        }
        const sourceIds = jobs.map(j => j.id);
        console.log('Source Exam IDs:', sourceIds);
        console.log('Source Exam Names:', jobs.map(j => j.job_name));

        console.log('Calling getRecommendations...');
        const recsResult = await getRecommendations(sourceIds, user.id, { page: 1, search: '', category: '', state: '' });
        console.log('Recommendations output keys:', Object.keys(recsResult));
        console.log('Total matches:', recsResult.totalMatches);
        console.log('Returned data count:', recsResult.data.length);
        console.log('First recommendation:', recsResult.data[0]);
        process.exit(0);
    } catch (e) {
        console.error('Error in recommendations test:', e);
        process.exit(1);
    }
})();
