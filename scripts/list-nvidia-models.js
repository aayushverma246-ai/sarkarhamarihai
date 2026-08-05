const https = require('https');

const options = {
  hostname: 'integrate.api.nvidia.com',
  path: '/v1/models',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer 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'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const ids = data.data.map(m => m.id);
      console.log('Available Models (Total: ' + ids.length + '):');
      ids.sort().forEach(id => console.log('- ' + id));
    } catch (e) {
      console.log('Failed to parse response:', e.message);
      console.log('Raw body:', body);
    }
  });
});

req.on('error', e => console.error('Error:', e));
req.end();
