'use strict';
require('dotenv').config();
const axios = require('axios');

async function run() {
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

    console.log('Fetching first page of recommendations...');
    const response = await axios.post('http://localhost:3001/api/ai/recommendations', {
      ...payload,
      page: 1
    }, {
      headers: {
        'Authorization': 'Bearer mock_guest_token_testuser',
        'Content-Type': 'application/json'
      }
    });

    const recs = response.data.data || [];
    console.log(`Fetched ${recs.length} recommendations from page 1.`);

    let under70Count = 0;
    for (const r of recs) {
      const score = r.similarity !== undefined ? r.similarity : r.overlap_score;
      console.log(`Exam: ${r.job_name} | Overlap Score: ${score}%`);
      if (score < 70) {
        under70Count++;
      }
    }

    console.log(`Number of recommendations with overlap < 70%: ${under70Count}`);
    if (under70Count === 0) {
      console.log('SUCCESS: All checked recommendations have overlap >= 70%!');
    } else {
      console.error('FAILURE: Found recommendations with overlap < 70%!');
    }
  } catch (err) {
    console.error('Verification failed:', err.message);
  }
  process.exit(0);
}

run();
