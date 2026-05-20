const http = require('http');
const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/apply/reminders', method: 'GET', headers: { 'Authorization': 'Bearer test' } }, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => { console.log(res.statusCode, data); });
});
req.on('error', e => console.error(e));
req.end();
