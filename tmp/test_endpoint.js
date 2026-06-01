const path = require('path');

// Load environment variables
require('dotenv').config();

const { getDb } = require('../backend/src/db');
const db = getDb();

// Pre-compute today's date string
const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';
    return 'CLOSED';
}

function withStatus(job, todayStr) {
    return {
        ...job,
        form_status: computeFormStatus(job, todayStr)
    };
}

async function run() {
    const todayStr = getTodayIST();
    const selectFields = 'id, job_name, organization, qualification_required, allows_final_year_students, minimum_age, maximum_age, job_category, state, states, application_start_date, application_end_date, vacancies, official_application_link, last_verified_at, created_at';

    const allRows = [];
    const isRest = true; // FORCE REST MODE TO TEST SEQUENTIAL HTTPS PAGINATION
    console.log('isRest:', isRest);

    if (isRest) {
        const limit = 1000;
        let offset = 0;
        while (true) {
            try {
                const result = await db.execute(`SELECT ${selectFields} FROM jobs ORDER BY application_end_date DESC, id LIMIT ${limit} OFFSET ${offset}`);
                const rows = result.rows || [];
                if (rows.length === 0) break;
                allRows.push(...rows);
                console.log(`Successfully fetched offset ${offset} (${rows.length} rows)`);
                if (rows.length < limit) break; // last page detected
                offset += limit;
            } catch (err) {
                console.warn(`[all-minimal sequential page fail at offset ${offset}]:`, err.message);
                break; // stop on error to avoid infinite loop
            }
        }
    }

    const seen = new Set();
    const unique = [];
    for (const row of allRows) {
        if (row.id && !seen.has(row.id)) { seen.add(row.id); unique.push(row); }
    }

    console.log('Total unique jobs fetched via HTTPS sequential:', unique.length);
}

run().catch(console.error);
