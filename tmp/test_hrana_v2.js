const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Try the Turso HTTP API with the Hrana v2 protocol (older, simpler)
const TURSO_URL = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function hrana2Execute(sql, args = []) {
  const url = `${TURSO_URL}/v2/pipeline`;
  const body = {
    requests: [
      { 
        type: "execute", 
        stmt: { 
          sql, 
          args: args.map(a => ({ type: "text", value: String(a) }))
        } 
      },
      { type: "close" }
    ]
  };

  console.log(`  Sending to ${url}...`);
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const text = await resp.text();
  console.log(`  Status: ${resp.status}`);
  
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  return JSON.parse(text);
}

async function main() {
  console.log('=== Turso Hrana v2 Write Test ===\n');

  // Try a simple CREATE TABLE + INSERT to see if ANY writes work
  console.log('1. Trying CREATE TABLE test...');
  try {
    const r1 = await hrana2Execute('CREATE TABLE IF NOT EXISTS _test_write (id INTEGER PRIMARY KEY, val TEXT)');
    console.log('CREATE TABLE result:', JSON.stringify(r1.results?.[0]?.response?.result || r1));
  } catch (e) {
    console.log('CREATE TABLE error:', e.message);
  }

  console.log('\n2. Trying INSERT...');
  try {
    const r2 = await hrana2Execute('INSERT OR REPLACE INTO _test_write (id, val) VALUES (1, ?)', ['hello_' + Date.now()]);
    console.log('INSERT result:', JSON.stringify(r2.results?.[0]?.response?.result || r2));
  } catch (e) {
    console.log('INSERT error:', e.message);
  }

  console.log('\n3. Trying UPDATE on jobs...');
  try {
    const r3 = await hrana2Execute('UPDATE jobs SET job_category = job_category WHERE id = (SELECT id FROM jobs LIMIT 1)');
    console.log('UPDATE result:', JSON.stringify(r3.results?.[0]?.response?.result || r3));
  } catch (e) {
    console.log('UPDATE error:', e.message);
  }

  // cleanup
  try {
    await hrana2Execute('DROP TABLE IF EXISTS _test_write');
  } catch(e) {}

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
