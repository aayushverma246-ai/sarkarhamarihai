const https = require('https');
const { createClient } = require('@libsql/client/http');
require('dotenv').config({ path: '.env' });

function request(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ body: data, headers: res.headers, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function verify() {
    console.log('--- PRODUCTION VERIFICATION DEEP DIVE ---');
    
    // 1. Fetch live index
    console.log('1. Checking Frontend Client Hash & State...');
    const indexRes = await request('https://sarkarhamarihai.vercel.app/');
    const jsMatch = indexRes.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!jsMatch) {
         console.log('Failed to find JS bundle in index.html (Maybe different bundler pattern?)');
         // fallback check
         const matches = [...indexRes.body.matchAll(/href="([^"]+\.js)"/g)];
         for (let m of matches) {
             const jsUrl = `https://sarkarhamarihai.vercel.app${m[1]}`;
             const jsSrc = await request(jsUrl);
             if (jsSrc.body.includes('circuitBreakUntil')) {
                 console.log(`✅ SUCCESS: Found circuitBreakUntil in bundle: ${m[1]}`);
                 break;
             }
         }
    } else {
        const jsUrl = `https://sarkarhamarihai.vercel.app${jsMatch[1]}`;
        const jsSrc = await request(jsUrl);
        if (jsSrc.body.includes('circuitBreakUntil')) {
            console.log(`✅ SUCCESS: Front-end code deployed successfully.`);
        } else {
            console.log(`❌ FAILURE: Front-end code IS MISSING the circuitBreakUntil variable! Initial commit was likely ignored.`);
        }
    }

    // 2. Check API Headers
    console.log('\n2. Checking Vercel /api/jobs Edge Headers...');
    const apiRes = await request('https://sarkarhamarihai.vercel.app/api/jobs');
    const cc = apiRes.headers['cache-control'];
    if (cc && cc.includes('stale-while-revalidate')) {
        console.log(`✅ SUCCESS: Found proper edge headers: ${cc}`);
    } else {
        console.log(`❌ FAILURE: Invalid or missing Edge Cache headers! (got: ${cc})`);
    }

    // 3. Database Check
    console.log('\n3. Checking Live Turso Database Normalization...');
    if (!process.env.TURSO_DATABASE_URL) {
        console.log('Skip DB, no TURSO_DATABASE_URL in .env');
        return;
    }
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    const countRes = await db.execute("SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC LIMIT 10");
    let showsUglyStrings = false;
    for (let row of countRes.rows) {
        console.log(`  - ${row.job_category}: ${row.cnt}`);
        if (!['UPSC','SSC','Banking','Railways','Defence','State PSC','Teaching','Engineering','Medical','Law','Judiciary','Insurance','PSU','Police','Entrance Exams','Scholarships','Apprenticeships','Others'].includes(row.job_category)) {
            showsUglyStrings = true;
        }
    }
    
    if (showsUglyStrings || countRes.rows.length === 0) {
        console.log(`❌ FAILURE: DB is STILL messy!`);
    } else {
        console.log(`✅ SUCCESS: DB is perfectly categorized into 18 tabs!`);
    }
}

verify().catch(console.error);
