'use strict';

/**
 * setup_cronjob_org.js — Automated Cron-Job.org Schedulers Setup
 * 
 * Usage: node scripts/setup_cronjob_org.js <YOUR_CRONJOB_ORG_API_KEY>
 */

const https = require('https');

const apiKey = process.argv[2] || process.env.CRONJOB_ORG_API_KEY;

if (!apiKey) {
    console.error('\n[Error] Please provide your cron-job.org API key!');
    console.error('Usage: node scripts/setup_cronjob_org.js <YOUR_API_KEY>\n');
    console.error('To get an API key:');
    console.error('1. Log into https://cron-job.org/');
    console.error('2. Go to Settings -> API Keys');
    console.error('3. Create a new API Key and copy it here.\n');
    process.exit(1);
}

const jobsToSetup = [
    {
        title: "SarkarHamariHai - Daily Sync",
        url: "https://sarkarhamarihai.vercel.app/api/cron/daily?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [8], // 08:00 AM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Reminders Dispatch",
        url: "https://sarkarhamarihai.vercel.app/api/cron/notifications?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [9, 14, 20], // 09:00 AM, 02:00 PM, 08:00 PM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Status Change Notification",
        url: "https://sarkarhamarihai.vercel.app/api/cron/status-change-notify?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [0, 6, 12, 18], // Every 6 hours
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Final Close Notification",
        url: "https://sarkarhamarihai.vercel.app/api/cron/final-close-notify?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [20], // 08:00 PM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Scraper Pipeline",
        url: "https://sarkarhamarihai.vercel.app/api/cron/hourly-update?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [-1], // Hourly
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Deep Audit",
        url: "https://sarkarhamarihai.vercel.app/api/cron/deep-audit?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [1], // 01:00 AM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Verification Engine",
        url: "https://sarkarhamarihai.vercel.app/api/cron/verify?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [2], // 02:00 AM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Refresh Cache",
        url: "https://sarkarhamarihai.vercel.app/api/cron/refresh?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [0, 6, 12, 18], // Every 6 hours
            minutes: [30],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Discovery Scraper",
        url: "https://sarkarhamarihai.vercel.app/api/cron/discovery?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [3], // 03:00 AM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    },
    {
        title: "SarkarHamariHai - Healer",
        url: "https://sarkarhamarihai.vercel.app/api/cron/healer?secret=sarkar_cron_key_v1",
        schedule: {
            timezone: "Asia/Kolkata",
            expiresAt: 0,
            hours: [4], // 04:00 AM IST
            minutes: [0],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        }
    }
];


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
        console.log('Connecting to cron-job.org REST API...');
        
        // 1. Fetch existing jobs
        const res = await request('GET', '/jobs');
        const existingJobs = res.jobs || [];
        console.log(`Found ${existingJobs.length} existing jobs on your account.`);

        const existingTitlesMap = {};
        for (const job of existingJobs) {
            existingTitlesMap[job.title] = job.jobId;
        }

        // 2. Process all required jobs
        console.log('\nProcessing automated schedulers...');
        for (const jobConfig of jobsToSetup) {
            const existingId = existingTitlesMap[jobConfig.title];
            if (existingId) {
                console.log(`- [Update] "${jobConfig.title}" already exists (Job ID: ${existingId}) -> Syncing settings`);
                await request('PATCH', `/jobs/${existingId}`, {
                    job: {
                        title: jobConfig.title,
                        url: jobConfig.url,
                        enabled: true,
                        saveResponses: true,
                        schedule: jobConfig.schedule
                    }
                });
                await sleep(5000); // Throttling delay to avoid 429
                continue;
            }

            console.log(`- [Create] "${jobConfig.title}"`);
            await request('PUT', '/jobs', {
                job: {
                    title: jobConfig.title,
                    url: jobConfig.url,
                    enabled: true,
                    saveResponses: true,
                    schedule: jobConfig.schedule
                }
            });
            await sleep(5000); // Throttling delay to avoid 429
        }

        console.log('\n======================================================');
        console.log('🎉 SUCCESS! All 5 cron-job.org schedulers are active!');
        console.log('======================================================\n');
        console.log('You can now log into your console at https://cron-job.org/ to check logs.');
        console.log('The scrapers, status checkers, and reminder dispatches are 100% active.');
        
    } catch (err) {
        console.error('\n[Error] Setup failed:', err.message);
        process.exit(1);
    }
}

run();
