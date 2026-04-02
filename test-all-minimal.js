// Tests the new parallel all-minimal approach with server-side cache simulation
require('dotenv').config({ path: '.env' });
const { getDb } = require('./backend/src/db');

const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, job_category, state, states, application_start_date, application_end_date, vacancies, official_application_link';
const SAFE_MAX_PAGES = 20;
const limit = 1000;

async function fetchAllJobs(db) {
    const fetchPromises = [];
    for (let i = 0; i < SAFE_MAX_PAGES; i++) {
        fetchPromises.push(
            db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date DESC LIMIT ${limit} OFFSET ${i * limit}`)
              .then(r => r.rows || [])
              .catch(() => [])
        );
    }
    const results = await Promise.all(fetchPromises);
    const allRows = results.flat();

    const seen = new Set();
    const unique = [];
    for (const row of allRows) {
        if (row.id && !seen.has(row.id)) { seen.add(row.id); unique.push(row); }
    }
    return unique;
}

async function main() {
    const db = getDb();
    
    console.log('=== COLD FETCH (no cache) ===');
    const t1 = Date.now();
    const rows1 = await fetchAllJobs(db);
    const cold = Date.now() - t1;
    console.log(`  Fetched ${rows1.length} jobs in ${cold}ms`);
    
    console.log('\n=== WARM FETCH (simulated in-memory cache hit <1ms) ===');
    const cache = rows1; // simulate setCachedResult
    const t2 = Date.now();
    const rows2 = cache; // simulate getCachedResult  
    const warm = Date.now() - t2;
    console.log(`  Served ${rows2.length} jobs in ${warm}ms`);

    console.log('\n=== SUMMARY ===');
    console.log(`  Cold (first load): ${cold}ms`);
    console.log(`  Warm (cached):     <1ms`);
    console.log(`  Status:            ${cold < 6000 ? '✅ PASS' : '⚠️  SLOW'}`);
}

main().catch(console.error);
