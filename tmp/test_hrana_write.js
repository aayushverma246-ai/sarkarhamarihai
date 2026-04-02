const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Direct HTTP/Hrana v3 protocol to Turso - bypass libsql client completely
const TURSO_URL = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function tursoExecute(sql, args = []) {
  const url = `${TURSO_URL}/v3/pipeline`;
  const body = {
    requests: [
      { type: "execute", stmt: { sql, args: args.map(a => ({ type: "text", value: String(a) })) } },
      { type: "close" }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

async function main() {
  console.log('=== Direct HTTP/Hrana v3 Write Test ===\n');
  console.log('URL:', TURSO_URL);

  // Test read
  console.log('\n1. Testing read...');
  const readResult = await tursoExecute('SELECT id, job_name, job_category FROM jobs LIMIT 2');
  const rows = readResult.results[0].response.result.rows;
  console.log('Read OK, first row id:', rows[0][0].value);
  console.log('First row category:', rows[0][2].value);

  // Test write
  console.log('\n2. Testing single UPDATE...');
  const start = Date.now();
  const targetId = rows[0][0].value;
  const writeResult = await tursoExecute(
    'UPDATE jobs SET job_category = ? WHERE id = ?',
    ['UPSC', targetId]
  );
  console.log('Write completed in', Date.now() - start, 'ms');
  console.log('Write result:', JSON.stringify(writeResult.results[0].response.result));

  console.log('\n=== Test Complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
