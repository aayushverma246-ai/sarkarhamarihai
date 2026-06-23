const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const userPayload = {
  id: 'guest_user_1779033502094',
  email: 'guest@sarkar.app'
};
const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });

async function testApi() {
  try {
    const res = await axios.post('http://localhost:3001/api/ai/recommendations', {
      appliedExams: [
        { id: 'ce8564e029fbfa4c' },
        { id: '9e90e9ca91308b0e' },
        { id: 'c6e2ee0a4611fcc2' }
      ],
      page: 1,
      search: '',
      category: 'State PSCs',
      state: ''
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('API Status:', res.status);
    console.log('Data count on page 1:', res.data.data ? res.data.data.length : 'no data');
    console.log('hasMore on page 1:', res.data.hasMore);
    console.log('totalMatches:', res.data.totalMatches);

    // Now page 2
    if (res.data.hasMore) {
      const res2 = await axios.post('http://localhost:3001/api/ai/recommendations', {
        appliedExams: [
          { id: 'ce8564e029fbfa4c' },
          { id: '9e90e9ca91308b0e' },
          { id: 'c6e2ee0a4611fcc2' }
        ],
        page: 2,
        search: '',
        category: 'State PSCs',
        state: ''
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('--- Page 2 ---');
      console.log('Data count on page 2:', res2.data.data ? res2.data.data.length : 'no data');
      console.log('hasMore on page 2:', res2.data.hasMore);
    }
  } catch (err) {
    console.error('API request failed:', err.response ? err.response.data : err.message);
  }
}

testApi();
