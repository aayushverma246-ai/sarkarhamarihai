'use strict';
const axios = require('axios');

(async () => {
    try {
        const payload = {
            appliedExams: [
                { id: '674ef0cb4f14165a' },
                { id: '7b3799f9763faec6' }
            ],
            search: '',
            category: '',
            state: ''
        };

        for (let pageNum = 1; pageNum <= 3; pageNum++) {
            console.log(`Sending POST /api/ai/recommendations request for page ${pageNum}...`);
            const response = await axios.post('http://localhost:3001/api/ai/recommendations', {
                ...payload,
                page: pageNum
            }, {
                headers: {
                    'Authorization': 'Bearer mock_guest_token_testuser',
                    'Content-Type': 'application/json'
                }
            });

            console.log(`--- Page ${pageNum} Response ---`);
            console.log('Status:', response.status);
            console.log('Data count:', response.data.data ? response.data.data.length : 'undefined');
            console.log('hasMore:', response.data.hasMore);
            console.log('totalMatches:', response.data.totalMatches);
            if (response.data.data && response.data.data.length > 0) {
                console.log('First item on page:', response.data.data[0].job_name);
                console.log('Last item on page:', response.data.data[response.data.data.length - 1].job_name);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error('API request failed:');
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Headers:', e.response.headers);
            console.error('Body:', e.response.data);
        } else {
            console.error('Error Message:', e.message);
        }
        process.exit(1);
    }
})();

