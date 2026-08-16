'use strict';
/**
 * scripts/audit_database_quality.js — Runs complete validation suite on the database
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb } = require('../src/db');
const { validateRecord } = require('../src/engines/validation-rules');

(async () => {
    try {
        const db = getDb();
        console.log('Fetching all jobs for data quality audit...');
        
        let offset = 0;
        const batchSize = 1000;
        let allJobs = [];
        let hasMore = true;

        while (hasMore) {
            const res = await db.execute(`SELECT * FROM jobs ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`);
            const batchRows = res.rows || [];
            allJobs.push(...batchRows);
            if (batchRows.length < batchSize) {
                hasMore = false;
            } else {
                offset += batchSize;
            }
        }

        console.log(`Total jobs loaded: ${allJobs.length}`);
        let criticalErrors = 0;
        let warningErrors = 0;
        let placeholderAnomalies = 0;
        const exactPlaceholders = [
            'placeholder', 'dummy', 'lorem', 'lorem ipsum', 'mock', 'test', 
            'sample', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'na', 'null'
        ];
        const strictFields = ['job_name', 'organization', 'official_application_link'];
        const strictPatterns = [
            /\bplaceholder\b/i,
            /\blorem\b/i,
            /\bdummy\b/i,
            /\bmock\b/i,
            /test-(?:job|org|user|exam)/i,
            /^test$/i,
            /^sample$/i
        ];

        const anomalies = [];

        for (const job of allJobs) {
            const auditResult = validateRecord(job);
            
            // Check validation errors
            if (!auditResult.valid) {
                criticalErrors += auditResult.errors.length;
                warningErrors += auditResult.warnings.length;
                
                anomalies.push({
                    id: job.id,
                    job_name: job.job_name,
                    organization: job.organization,
                    errors: auditResult.errors,
                    warnings: auditResult.warnings
                });
            }

            // Explicit placeholder scanning matching production logic
            let hasPlaceholder = false;
            const fieldsScanned = [];
            for (const [key, value] of Object.entries(job)) {
                if (typeof value === 'string' && key !== 'id') {
                    const clean = value.trim().toLowerCase();
                    if (exactPlaceholders.includes(clean)) {
                        hasPlaceholder = true;
                        fieldsScanned.push(`${key}: exact match "${value}"`);
                    } else if (strictFields.includes(key)) {
                        for (const re of strictPatterns) {
                            if (re.test(clean)) {
                                hasPlaceholder = true;
                                fieldsScanned.push(`${key}: substring match "${value}"`);
                                break;
                            }
                        }
                    }
                }
            }

            if (hasPlaceholder) {
                placeholderAnomalies++;
                console.log(`⚠️ Placeholder found in Job ID: ${job.id} ("${job.job_name}"):`);
                fieldsScanned.forEach(f => console.log(`   - ${f}`));
            }
        }

        console.log('\n--- QUALITY AUDIT REPORT ---');
        console.log(`Total Jobs Audited: ${allJobs.length}`);
        console.log(`Total Critical Schema Errors: ${criticalErrors}`);
        console.log(`Total Schema Warnings: ${warningErrors}`);
        console.log(`Total Placeholder Anomalies: ${placeholderAnomalies}`);
        console.log('----------------------------\n');

        if (anomalies.length > 0) {
            console.log(`First 10 non-placeholder validation errors/warnings:`);
            anomalies.slice(0, 10).forEach(a => {
                console.log(`\nJob: "${a.job_name}" (${a.id})`);
                a.errors.forEach(e => console.log(`  [CRITICAL] ${e.field}: ${e.message}`));
                a.warnings.forEach(w => console.log(`  [WARNING] ${w.field}: ${w.message}`));
            });
        } else {
            console.log('🎉 100% of jobs in the database are valid, clean, and contains zero placeholders!');
        }

        process.exit(0);
    } catch (err) {
        console.error('Fatal audit error:', err);
        process.exit(1);
    }
})();
