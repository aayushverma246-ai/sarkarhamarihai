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
            category: 'State PSCs',
        };

        const states = ['', 'Bihar', 'Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh', 'Delhi', 'Haryana', 'Jharkhand', 'Chhattisgarh', 'Maharashtra', 'Gujarat'];
        const promises = [];

        for (const st of states) {
            const pages = st === '' ? [1, 2, 3] : [1, 2];
            for (const p of pages) {
                const promise = axios.post('http://localhost:3001/api/ai/recommendations', {
                    ...payload,
                    state: st,
                    page: p
                }, {
                    headers: {
                        'Authorization': 'Bearer mock_guest_token_testuser',
                        'Content-Type': 'application/json'
                    }
                }).then(res => ({
                    state: st || 'All India',
                    page: p,
                    status: res.status,
                    count: res.data.data ? res.data.data.length : 0,
                    totalMatches: res.data.totalMatches,
                    data: res.data.data || []
                })).catch(err => ({
                    state: st || 'All India',
                    page: p,
                    error: err.message
                }));
                promises.push(promise);
            }
        }

        const results = await Promise.all(promises);
        console.log('--- INDIVIDUAL REQUEST RESULTS ---');
        let totalCount = 0;
        const allIds = new Set();
        
        for (const r of results) {
            if (r.error) {
                console.log(`[FAIL] State: ${r.state}, Page: ${r.page} -> Error: ${r.error}`);
            } else {
                console.log(`[SUCCESS] State: ${r.state}, Page: ${r.page} -> Status: ${r.status}, Count: ${r.count}, TotalMatches: ${r.totalMatches}`);
                r.data.forEach(item => allIds.add(item.id));
                totalCount += r.count;
            }
        }

        console.log('\n--- SUMMARY ---');
        console.log('Total items fetched (with duplicates):', totalCount);
        console.log('Deduplicated unique items count:', allIds.size);
        process.exit(0);
    } catch (e) {
        console.error('Fatal test error:', e);
        process.exit(1);
    }
})();
