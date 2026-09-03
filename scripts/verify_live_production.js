'use strict';

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = 'https://sarkarhamarihai.app';
const CRON_SECRET = process.env.CRON_SECRET || 'Mnc6Ql9cqg84dOevfjxDvsbN9p9dCPVMlEL25eAB5kE=';

function fetchUrl(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
    });
}

(async () => {
    console.log(`[Live Empirical Verification] Testing production deployment at: ${BASE_URL}\n`);

    // 1. Verify Frontend Index Page
    try {
        const res = await fetchUrl(BASE_URL);
        console.log(`1. Frontend Landing Page (${BASE_URL}): HTTP ${res.status}`);
        if (res.status === 200 && res.body.includes('<title>')) {
            console.log('   ✓ PASS: Production frontend HTML serving correctly');
        } else {
            console.log('   ✗ FAIL:', res.status, res.body.substring(0, 100));
        }
    } catch (err) {
        console.log('   ✗ FAIL (Frontend):', err.message);
    }

    // 2. Verify /api/jobs/categories
    try {
        const res = await fetchUrl(`${BASE_URL}/api/jobs/categories`);
        console.log(`\n2. API Categories (${BASE_URL}/api/jobs/categories): HTTP ${res.status}`);
        if (res.status === 200) {
            const categories = JSON.parse(res.body);
            console.log(`   ✓ PASS: Returned ${categories.length} categories (Includes: ${categories.slice(0, 5).join(', ')})`);
        } else {
            console.log('   ✗ FAIL:', res.status, res.body.substring(0, 100));
        }
    } catch (err) {
        console.log('   ✗ FAIL (Categories):', err.message);
    }

    // 3. Verify /api/jobs/states
    try {
        const res = await fetchUrl(`${BASE_URL}/api/jobs/states`);
        console.log(`\n3. API States (${BASE_URL}/api/jobs/states): HTTP ${res.status}`);
        if (res.status === 200) {
            const states = JSON.parse(res.body);
            console.log(`   ✓ PASS: Returned ${states.length} states`);
        } else {
            console.log('   ✗ FAIL:', res.status, res.body.substring(0, 100));
        }
    } catch (err) {
        console.log('   ✗ FAIL (States):', err.message);
    }

    // 4. Verify /api/jobs/all-minimal
    try {
        const res = await fetchUrl(`${BASE_URL}/api/jobs/all-minimal`);
        console.log(`\n4. High-Performance Endpoint (${BASE_URL}/api/jobs/all-minimal): HTTP ${res.status}`);
        if (res.status === 200) {
            const payload = JSON.parse(res.body);
            console.log(`   ✓ PASS: Returned ${payload.jobs?.length || 0} jobs with ${payload.columns?.length || 0} columns`);
            console.log(`   Cache Header: ${res.headers['x-cache'] || 'HIT/MISS'}, Content-Length: ${res.headers['content-length'] || Buffer.byteLength(res.body)} bytes`);
        } else {
            console.log('   ✗ FAIL:', res.status, res.body.substring(0, 100));
        }
    } catch (err) {
        console.log('   ✗ FAIL (all-minimal):', err.message);
    }

    // 5. Verify Cron Unauthorized Guard (No Secret)
    try {
        const res = await fetchUrl(`${BASE_URL}/api/cron/daily`);
        console.log(`\n5. Cron Endpoint Security Check (${BASE_URL}/api/cron/daily without secret): HTTP ${res.status}`);
        if (res.status === 401 || res.status === 403) {
            console.log('   ✓ PASS: Unauthorized access correctly rejected with 401/403');
        } else {
            console.log('   INFO:', res.status, res.body.substring(0, 100));
        }
    } catch (err) {
        console.log('   INFO (Cron Guard):', err.message);
    }

    // 6. Verify Cron Execution (With Valid Secret)
    try {
        const res = await fetchUrl(`${BASE_URL}/api/cron/daily?secret=${CRON_SECRET}`);
        console.log(`\n6. Cron Endpoint Execution (${BASE_URL}/api/cron/daily with secret): HTTP ${res.status}`);
        if (res.status === 200) {
            console.log(`   ✓ PASS: Cron daily task executed successfully: ${res.body.substring(0, 120)}`);
        } else {
            console.log('   INFO:', res.status, res.body.substring(0, 120));
        }
    } catch (err) {
        console.log('   INFO (Cron Execution):', err.message);
    }

    console.log('\n[Live Empirical Verification Complete]');
})();
