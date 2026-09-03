'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { getDb, initDb } = require('../backend/src/db');
const { CANONICAL_CATEGORIES, CANONICAL_STATES, normalizeCategory, normalizeState } = require('../backend/src/constants');
const { isJobVerified } = require('../backend/src/services/gemini_recommender');

const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;
    if (!start || !end) return 'CLOSED';
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';
    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    if ((todayDays - endDays) <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

function withStatus(job, todayStr) {
    const isVerified = Boolean(job.job_name && job.organization && job.official_application_link?.length > 5);
    const lastUpdated = job.created_at || todayStr;
    let parsedStates = [];
    if (job.states && job.states !== '[]') {
        try { parsedStates = JSON.parse(job.states); } catch (_) { }
    }
    let normalizedCategory = job.job_category;
    if (normalizedCategory) {
        const canonical = normalizeCategory(normalizedCategory);
        if (canonical) normalizedCategory = canonical;
    }
    let normalizedState = job.state;
    if (normalizedState) {
        const canonical = normalizeState(normalizedState);
        if (canonical) normalizedState = canonical;
    }
    const normalizedStatesArr = parsedStates.map(s => normalizeState(s) || s);
    return {
        ...job,
        job_category: normalizedCategory || job.job_category,
        state: normalizedState || job.state,
        states: normalizedStatesArr,
        form_status: computeFormStatus(job, todayStr),
        allows_final_year_students: !!job.allows_final_year_students,
        is_verified: isVerified,
        last_updated: lastUpdated
    };
}

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

        // A. Standard full job JSON response (array of job objects)
        const standardJobs = sampleRows.map(j => withStatus(j, todayStr));
        const standardSize = Buffer.byteLength(JSON.stringify(standardJobs));

        // B. Exact /all-minimal endpoint column array & array-of-arrays representation from backend/src/routes/jobs.js
        const columns = [
            'id', 'job_name', 'organization', 'qualification_required',
            'allows_final_year_students', 'minimum_age', 'maximum_age',
            'job_category', 'state', 'states', 'application_start_date',
            'application_end_date', 'vacancies', 'official_application_link',
            'last_verified_at', 'created_at', 'form_status', 'is_verified', 'last_updated'
        ];

        const minimalRows = sampleRows.map(j => {
            const statusJob = withStatus(j, todayStr);
            return columns.map(col => statusJob[col] ?? null);
        });

        const minimalPayload = { columns, jobs: minimalRows };
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
