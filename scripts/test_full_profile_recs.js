'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');
const { getRecommendations } = require('../backend/src/services/gemini_recommender');

(async () => {
    try {
        const db = getDb();
        
        // Define a mock user with a complete profile and a random ID
        const mockUserId = 'mock_user_' + Math.random().toString(36).substring(2, 12);
        const mockUser = {
            id: mockUserId,
            email: `mock_${mockUserId}@sarkar.app`,
            password_hash: 'test',
            full_name: 'Test Full Profile User',
            age: 24,
            state: 'Bihar',
            category: 'General',
            qualification_type: 'Graduation',
            qualification_status: 'Completed'
        };

        console.log('Inserting/upserting mock user into database users table with ID:', mockUserId);
        await db.execute({
            sql: `INSERT INTO users (id, email, password_hash, full_name, age, state, category, qualification_type, qualification_status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                mockUser.id, mockUser.email, mockUser.password_hash, mockUser.full_name,
                mockUser.age, mockUser.state, mockUser.category, mockUser.qualification_type,
                mockUser.qualification_status
            ]
        });

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

        console.log('Calling getRecommendations with full profile user in database...');
        const recsResult = await getRecommendations(sourceIds, mockUserId, { page: 1, search: '', category: '', state: '' });
        console.log('Recommendations output keys:', Object.keys(recsResult));
        console.log('Total matches:', recsResult.totalMatches);
        console.log('Returned data count:', recsResult.data.length);
        if (recsResult.data.length > 0) {
            console.log('First recommendation:', recsResult.data[0].job_name);
            console.log('First recommendation state:', recsResult.data[0].state);
            console.log('First recommendation similarity score:', recsResult.data[0].similarity);
        } else {
            console.log('No recommendations returned!');
        }
        process.exit(0);
    } catch (e) {
        console.error('Error in recommendations test:', e);
        process.exit(1);
    }
})();
