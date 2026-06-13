const { getDb } = require('./db');
const { normalizeSyllabus, estimateLiveData } = require('./services/gemini');
require('dotenv').config();

async function auditAndEnrich() {
    const db = getDb();
    console.log('--- STARTING AUDIT & ENRICHMENT ---');

    // 1. Identify jobs missing structured syllabus or live data
    const jobsToEnrich = (await db.execute({
        sql: `SELECT id, job_name, organization, syllabus FROM jobs 
              WHERE (structured_syllabus_json IS NULL OR structured_syllabus_json = '') 
              OR (vacancies IS NULL OR vacancies = 0)
              LIMIT 50` // Limit batch for performance
    })).rows;

    console.log(`Found ${jobsToEnrich.length} jobs needing enrichment in this batch.`);

    for (const job of jobsToEnrich) {
        console.log(`Processing: ${job.job_name} (${job.organization})`);

        try {
            // A. Enrich Live Data
            const liveData = await estimateLiveData(job.job_name, job.organization);
            
            // B. Enrich Syllabus
            let structuredSyllabus = [];
            if (job.syllabus && job.syllabus.length > 20) {
                structuredSyllabus = await normalizeSyllabus(job.syllabus);
            } else {
                // Generate from scratch if syllabus is missing
                structuredSyllabus = await normalizeSyllabus(`Detailed syllabus for ${job.job_name} by ${job.organization}`);
            }

            // C. Update DB
            await db.execute({
                sql: `UPDATE jobs SET 
                      vacancies = ?, 
                      applicants_count = ?, 
                      structured_syllabus_json = ?,
                      syllabus = ?
                      WHERE id = ?`,
                args: [
                    liveData.vacancies || 0,
                    liveData.applicants_count || 0,
                    JSON.stringify(structuredSyllabus),
                    job.syllabus || `Syllabus for ${job.job_name}`,
                    job.id
                ]
            });
            console.log(`  [SUCCESS] Enriched ${job.job_name}`);
        } catch (err) {
            console.error(`  [ERROR] Failed to enrich ${job.job_name}:`, err.message);
        }
    }

    console.log('--- AUDIT & ENRICHMENT BATCH COMPLETED ---');
}

auditAndEnrich().catch(console.error);
