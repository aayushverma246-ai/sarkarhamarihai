'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');
const { getRecommendations } = require('../backend/src/services/gemini_recommender');

(async () => {
    try {
        const db = getDb();
        const userRes = await db.execute("SELECT id, email, full_name, age, qualification_type, category FROM users WHERE email = 'irituraj10@gmail.com' LIMIT 1");
        const user = userRes.rows[0];
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        
        // Mock applied exams
        const sourceIds = [
            '674ef0cb4f14165a',
            '7b3799f9763faec6'
        ];
        
        // Fetch recommendations from page 1, 2, 3
        const allItems = [];
        for (const p of [1, 2, 3]) {
            const recsResult = await getRecommendations(sourceIds, user.id, { page: p, search: '', category: '', state: '' });
            allItems.push(...recsResult.data);
        }
        
        console.log('Total Items fetched across page 1, 2, 3:', allItems.length);
        allItems.forEach((item, index) => {
            console.log(`${index + 1}. ${item.job_name}: Similarity = ${item.similarity}%, Overlap Score = ${item.overlap_score}%, Category = ${item.job_category}`);
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
