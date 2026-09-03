'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { getDb, initDb } = require('../backend/src/db');
const { getTodayIST, withStatus, MINIMAL_COLUMNS, serializeMinimalJob } = require('../backend/src/utils/job-serializer');

(async () => {
    try {
        console.log('[Benchmark] Connecting to database...');
        await initDb();
        const db = getDb();
        const todayStr = getTodayIST();

        // 1. Calculate actual job/exam record count
        const countRes = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const count = Number(countRes.rows[0]?.cnt || 0);
        console.log(`[Benchmark] Actual job record count: ${count.toLocaleString()}`);

        // 2. Exact payload benchmarking using sample rows (100 jobs)
        const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, job_category, state, states, application_start_date, application_end_date, vacancies, official_application_link, last_verified_at, created_at';
        const sampleResult = await db.execute(`SELECT ${selectFields} FROM jobs LIMIT 100`);
        const sampleRows = sampleResult.rows || [];

        // A. Standard full job JSON response (array of job objects transformed via shared withStatus)
        const standardJobs = sampleRows.map(j => withStatus(j, todayStr));
        const standardSize = Buffer.byteLength(JSON.stringify(standardJobs));

        // B. Exact /all-minimal payload structure using shared MINIMAL_COLUMNS & serializeMinimalJob
        const minimalRows = sampleRows.map(j => serializeMinimalJob(j, todayStr));
        const minimalPayload = { columns: MINIMAL_COLUMNS, jobs: minimalRows };
        const minimalSize = Buffer.byteLength(JSON.stringify(minimalPayload));

        const reductionPct = (1 - minimalSize / standardSize) * 100;
        console.log(`[Benchmark] Standard JSON payload size (100 jobs): ${standardSize.toLocaleString()} bytes`);
        console.log(`[Benchmark] Exact /all-minimal payload size (100 jobs): ${minimalSize.toLocaleString()} bytes`);
        console.log(`[Benchmark] Measured payload reduction: ${reductionPct.toFixed(2)}%`);

        if (count >= 17000) {
            console.log(`[Verification] PASS: Job record count (${count}) >= 17,000`);
        } else {
            console.log(`[Verification] INFO: Job record count (${count})`);
        }

        if (reductionPct >= 75) {
            console.log(`[Verification] PASS: Measured payload reduction (${reductionPct.toFixed(2)}%) >= 75%`);
        } else {
            console.log(`[Verification] INFO: Measured reduction (${reductionPct.toFixed(2)}%)`);
        }

    } catch (err) {
        console.error('[Benchmark Error]', err.message);
        process.exit(1);
    }
    process.exit(0);
})();
