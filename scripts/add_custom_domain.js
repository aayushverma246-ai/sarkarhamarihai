'use strict';

/**
 * add_custom_domain.js — Add sarkarhamarihai.app to Supabase Auth + Update Cron-Job.org
 *
 * Usage:
 *   node scripts/add_custom_domain.js <SUPABASE_ACCESS_TOKEN> [CRONJOB_ORG_API_KEY]
 *
 * Get your Supabase access token from:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Get your cron-job.org API key from:
 *   https://cron-job.org/ → Settings → API Keys
 */

const https = require('https');

const SUPABASE_TOKEN = process.argv[2];
const CRONJOB_KEY = process.argv[3];
const PROJECT_REF = 'ztbgunartkntrqxxsdpc'; // from SUPABASE_URL

const NEW_DOMAIN = 'sarkarhamarihai.app';
const OLD_DOMAIN = 'sarkarhamarihai.vercel.app';

// ── HTTP Helper ──────────────────────────────────────────────────────
function request(hostname, method, path, body, authHeader) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : '';
        const options = {
            hostname,
            port: 443,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
        };
        if (body) options.headers['Content-Length'] = Buffer.byteLength(payload);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(data ? JSON.parse(data) : {}); }
                    catch { resolve(data); }
                } else {
                    reject(new Error(`[${res.statusCode}] ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(payload);
        req.end();
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════
// PART 1: Supabase Auth — Add new redirect URLs (keep old ones)
// ═══════════════════════════════════════════════════════════════════════
async function updateSupabaseAuth() {
    if (!SUPABASE_TOKEN) {
        console.log('\n⏭️  Skipping Supabase (no token provided)');
        console.log('   To include: node scripts/add_custom_domain.js <SUPABASE_TOKEN> [CRONJOB_KEY]');
        console.log('   Get token: https://supabase.com/dashboard/account/tokens\n');
        return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SUPABASE AUTH — Adding custom domain redirect URLs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const auth = { 'Authorization': `Bearer ${SUPABASE_TOKEN}` };

    // 1. Get current auth config
    console.log('[1/3] Fetching current auth config...');
    let config;
    try {
        config = await request('api.supabase.com', 'GET', `/v1/projects/${PROJECT_REF}/config/auth`, null, auth);
    } catch (err) {
        console.error('❌ Failed to fetch auth config:', err.message);
        console.error('   Make sure your Supabase access token is valid.');
        return;
    }

    const currentSiteUrl = config.site_url || '';
    const currentRedirects = config.uri_allow_list || '';
    console.log(`   Current site_url: ${currentSiteUrl}`);
    console.log(`   Current Redirect URLs: ${currentRedirects || '(none)'}`);

    // 2. Build new redirect list (ADD new domain, KEEP old ones)
    const newRedirects = [
        `https://${NEW_DOMAIN}/**`,
        `https://www.${NEW_DOMAIN}/**`,
        `https://${NEW_DOMAIN}/auth/callback`,
        `https://www.${NEW_DOMAIN}/auth/callback`,
        `https://${OLD_DOMAIN}/**`,
        `https://${OLD_DOMAIN}/auth/callback`,
    ];

    // Parse existing redirects and merge
    const existingList = currentRedirects ? currentRedirects.split(',').map(s => s.trim()).filter(Boolean) : [];
    const mergedSet = new Set([...existingList, ...newRedirects]);
    const mergedList = [...mergedSet].join(',');

    console.log(`\n[2/3] Adding new redirect URLs (keeping existing)...`);
    console.log('   New URLs being added:');
    newRedirects.forEach(u => {
        const isNew = !existingList.includes(u);
        console.log(`     ${isNew ? '➕' : '✓ '} ${u}`);
    });

    // 3. Update auth config
    const updatePayload = {
        site_url: `https://${OLD_DOMAIN}`,
        uri_allow_list: mergedList,
    };

    try {
        console.log(`\n[3/3] Updating Supabase auth config...`);
        console.log(`   Keeping site_url: https://${OLD_DOMAIN}`);
        await request('api.supabase.com', 'PATCH', `/v1/projects/${PROJECT_REF}/config/auth`, updatePayload, auth);
        console.log('   ✅ Supabase auth config updated successfully!');
        console.log(`   Old vercel.app URLs preserved: ✅`);
    } catch (err) {
        console.error('❌ Failed to update auth config:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// PART 2: Cron-Job.org — Update all job URLs to new domain
// ═══════════════════════════════════════════════════════════════════════
async function updateCronJobs() {
    if (!CRONJOB_KEY) {
        console.log('\n⏭️  Skipping cron-job.org (no API key provided)');
        console.log('   To include: node scripts/add_custom_domain.js <SUPABASE_TOKEN> <CRONJOB_KEY>');
        console.log('   Get key: https://cron-job.org/ → Settings → API Keys\n');
        return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  CRON-JOB.ORG — Updating endpoint URLs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const auth = { 'Authorization': `Bearer ${CRONJOB_KEY}` };

    // 1. Fetch existing jobs
    console.log('[1/2] Fetching existing cron jobs...');
    let existingJobs;
    try {
        const res = await request('api.cron-job.org', 'GET', '/jobs', null, auth);
        existingJobs = res.jobs || [];
        console.log(`   Found ${existingJobs.length} jobs on your account.`);
    } catch (err) {
        console.error('❌ Failed to fetch cron jobs:', err.message);
        return;
    }

    // 2. Update jobs that still point to the old domain
    console.log('\n[2/2] Updating job URLs...');
    let updated = 0;
    let skipped = 0;

    for (const job of existingJobs) {
        if (job.url && job.url.includes(OLD_DOMAIN)) {
            const newUrl = job.url.replace(OLD_DOMAIN, NEW_DOMAIN);
            try {
                await request('api.cron-job.org', 'PATCH', `/jobs/${job.jobId}`, {
                    job: { url: newUrl }
                }, auth);
                console.log(`   ✅ "${job.title}" → ${newUrl}`);
                updated++;
                await sleep(3000); // Rate limit protection
            } catch (err) {
                console.error(`   ❌ "${job.title}": ${err.message}`);
            }
        } else {
            skipped++;
        }
    }

    console.log(`\n   Updated: ${updated} | Already on new domain: ${skipped}`);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  SarkarHamariHai — Custom Domain Setup               ║');
    console.log('║  Adding: sarkarhamarihai.app (keeping vercel.app)     ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    await updateSupabaseAuth();
    await updateCronJobs();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  🎉 Domain migration complete!');
    console.log('══════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n💀 Fatal error:', err.message);
    process.exit(1);
});
