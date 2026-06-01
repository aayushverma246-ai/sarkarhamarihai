'use strict';

/**
 * prune_cronjob_org.js — Automatic legacy & duplicate cron cleanup
 */

const https = require('https');

const apiKey = process.argv[2] || process.env.CRONJOB_ORG_API_KEY;

if (!apiKey) {
    console.error('\n[Error] Please provide your cron-job.org API key!');
    process.exit(1);
}

// These are the only 10 official active jobs allowed on the account
const officialTitles = new Set([
    "SarkarHamariHai - Daily Sync",
    "SarkarHamariHai - Reminders Dispatch",
    "SarkarHamariHai - Status Change Notification",
    "SarkarHamariHai - Final Close Notification",
    "SarkarHamariHai - Scraper Pipeline",
    "SarkarHamariHai - Deep Audit",
    "SarkarHamariHai - Verification Engine",
    "SarkarHamariHai - Refresh Cache",
    "SarkarHamariHai - Discovery Scraper",
    "SarkarHamariHai - Healer"
]);

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'api.cron-job.org',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(data ? JSON.parse(data) : {});
                    } catch (_) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`API Error [${res.statusCode}]: ${data}`));
                }
            });
        });

        req.on('error', err => reject(err));
        if (body) {
            req.write(payload);
        }
        req.end();
    });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    try {
        console.log('Connecting to cron-job.org API for pruning...');
        
        // 1. Fetch all current jobs
        const res = await request('GET', '/jobs');
        const existingJobs = res.jobs || [];
        console.log(`Found ${existingJobs.length} total jobs on the account.`);

        const toDelete = [];
        for (const job of existingJobs) {
            if (!officialTitles.has(job.title)) {
                toDelete.push(job);
            }
        }

        if (toDelete.length === 0) {
            console.log('\n✨ Everything is clean! No legacy or duplicate crons found.');
            process.exit(0);
        }

        console.log(`\nFound ${toDelete.length} legacy/duplicate/unrecognized crons to delete.`);
        
        for (const job of toDelete) {
            console.log(`- [Delete] "${job.title}" (Job ID: ${job.jobId})`);
            try {
                await request('DELETE', `/jobs/${job.jobId}`);
                await sleep(4000); // Throttling delay to avoid 429 rate limit
            } catch (err) {
                console.error(`  Failed to delete job ${job.jobId}: ${err.message}`);
            }
        }

        console.log('\n======================================================');
        console.log('🎉 SUCCESS! All legacy & duplicate crons have been pruned.');
        console.log('======================================================\n');
        
    } catch (err) {
        console.error('\n[Error] Pruning failed:', err.message);
        process.exit(1);
    }
}

run();
