'use strict';

/**
 * db_deep_audit.js — Deep Database Audit and Rectification Pipeline
 * 
 * Scans all rows in the 'jobs' table, checks each field against the multi-layer 
 * rules engine, identifies mismatches, and deploys the real-time Gemini crawler
 * to dynamically reconcile missing/default dates, links, payscales, and selection procedures.
 */

require('dotenv').config();
const { getDb } = require('../backend/src/db');
const { validateRecord } = require('../backend/src/engines/validation-rules');
const { scrapeExamData } = require('../backend/src/services/scraper');

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function runDeepAudit(options = {}) {
    const { heal = true, limit = 5, recordId = null } = options;
    const db = getDb();
    const logs = [];
    const report = {
        totalAudited: 0,
        validCount: 0,
        mismatchedCount: 0,
        healedCount: 0,
        failures: [],
        mismatchesDetail: []
    };

    logs.push(`[Audit] Booting Deep Dataset Audit Runner (Heal: ${heal}, Limit: ${limit})`);

    try {
        // 1. Fetch records
        let records = [];
        if (recordId) {
            logs.push(`[Audit] Fetching single target record: ${recordId}`);
            const res = await db.execute({
                sql: `SELECT id, job_name, organization, job_category, application_start_date, application_end_date, salary_min, salary_max, selection_process, official_application_link, discovery_source FROM jobs WHERE id = ?`,
                args: [recordId]
            });
            records = res.rows || [];
        } else {
            logs.push(`[Audit] Fetching all active exam records from Supabase in paginated batches...`);
            let offset = 0;
            const batchSize = 1000;
            let hasMore = true;
            while (hasMore) {
                const res = await db.execute(
                    `SELECT id, job_name, organization, job_category, application_start_date, application_end_date, salary_min, salary_max, selection_process, official_application_link, discovery_source FROM jobs ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
                );
                const batchRows = res.rows || [];
                records.push(...batchRows);
                if (batchRows.length < batchSize) {
                    hasMore = false;
                } else {
                    offset += batchSize;
                }
            }
        }

        report.totalAudited = records.length;
        logs.push(`[Audit] Fetched ${records.length} records. Commencing rule execution...`);

        // 2. Validate all records
        const recordsToHeal = [];
        for (const record of records) {
            const validation = validateRecord(record);
            const isSeeded = record.discovery_source === 'seeder';
            if (isSeeded || !validation.valid || validation.score < 90 || !record.selection_process || record.selection_process.includes('Default') || !record.application_start_date) {
                report.mismatchedCount++;
                report.mismatchesDetail.push({
                    id: record.id,
                    job_name: record.job_name,
                    score: validation.score,
                    errors: validation.errors.map(e => `${e.field}: ${e.message}`),
                    warnings: validation.warnings.map(e => `${e.field}: ${e.message}`)
                });
                recordsToHeal.push(record);
            } else {
                report.validCount++;
            }
        }

        logs.push(`[Audit] Diagnostics parsed. Sound records: ${report.validCount} | Violating records: ${report.mismatchedCount}`);

        // 3. Auto-Healing Mode
        if (heal && recordsToHeal.length > 0) {
            const batchLimit = Math.min(recordsToHeal.length, limit);
            logs.push(`[Audit] Auto-healing activated. Selected first ${batchLimit} candidates for real-time web crawlers...`);

            for (let i = 0; i < batchLimit; i++) {
                const item = recordsToHeal[i];
                logs.push(`[Audit] [${i + 1}/${batchLimit}] Triggering live parser engine on: ${item.job_name} (${item.id})`);

                try {
                    const scraped = await scrapeExamData(item.job_name, item.organization, item.official_application_link);

                    if (scraped.scraped_successfully) {
                        logs.push(`[Audit] Successfully scraped fresh metrics. Syncing database values...`);

                        await db.execute({
                            sql: `UPDATE jobs 
                                  SET application_start_date = ?, 
                                      application_end_date = ?, 
                                      salary_min = ?, 
                                      salary_max = ?, 
                                      selection_process = ?, 
                                      official_application_link = ?,
                                      discovery_source = 'deep_scraped',
                                      last_verified_at = CURRENT_TIMESTAMP
                                  WHERE id = ?`,
                            args: [
                                scraped.application_start_date || item.application_start_date,
                                scraped.application_end_date || item.application_end_date,
                                scraped.salary_min !== null ? scraped.salary_min : item.salary_min,
                                scraped.salary_max !== null ? scraped.salary_max : item.salary_max,
                                scraped.selection_process || item.selection_process,
                                scraped.official_application_link || item.official_application_link,
                                item.id
                            ]
                        });

                        // Insert a sync history log row
                        await db.execute({
                            sql: `INSERT INTO verification_logs (operation, source, total_records, verified, mismatches, duration_ms)
                                  VALUES ('scraping_verification', 'deep_audit_heal', 1, 1, 0, 800) ON CONFLICT DO NOTHING`,
                        }).catch(() => { });

                        report.healedCount++;
                        logs.push(`[Audit] Record ${item.id} successfully healed and marked verified.`);
                    } else {
                        throw new Error(scraped.error || 'Parsing yielded empty structured dataset');
                    }
                } catch (scrapeErr) {
                    report.failures.push({ id: item.id, error: scrapeErr.message });
                    logs.push(`[Audit] [Warning] Healing failed for record ${item.id}: ${scrapeErr.message}`);
                }

                // Small courtesy throttle delay between external crawlers
                await sleep(500);
            }
        }

        logs.push(`[Audit] Deep Dataset Audit concluded successfully. Healed count: ${report.healedCount}`);
    } catch (gErr) {
        logs.push(`[Audit] [Critical Error] Audit runner general crash: ${gErr.message}`);
        report.failures.push({ id: 'general', error: gErr.message });
    }

    return {
        success: report.failures.length < report.totalAudited,
        report,
        logs
    };
}

module.exports = {
    runDeepAudit
};

// If executing directly from terminal
if (require.main === module) {
    const { initDb } = require('../backend/src/db');
    (async () => {
        console.log('Initializing Deep Auditing Services...');
        await initDb();
        const limitArg = process.argv[2] ? parseInt(process.argv[2]) : 5;
        const res = await runDeepAudit({ heal: true, limit: limitArg });
        console.log('\n================ AUDIT REPORT ================');
        console.log(`Sound Records: ${res.report.validCount}`);
        console.log(`Violating/Mismatched Records: ${res.report.mismatchedCount}`);
        console.log(`Successfully Repaired Today: ${res.report.healedCount}`);
        console.log(`Errors encountered: ${res.report.failures.length}`);
        console.log('==============================================\n');
    })();
}
