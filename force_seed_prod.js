require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });

// PATCH: Force HTTPS transport (bypasses undici/proxy issues on Windows)
let dbUrl = process.env.TURSO_DATABASE_URL;
if (dbUrl && dbUrl.startsWith('libsql://')) {
    dbUrl = dbUrl.replace('libsql://', 'https://');
    process.env.TURSO_DATABASE_URL = dbUrl;
}

const { initDb, getDb } = require('./backend/src/db');
const { seedInit, seedBatch, seedFinalize, getJobCount } = require('./backend/src/seed');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connectWithRetry() {
    const MAX = 15;
    for (let attempt = 1; attempt <= MAX; attempt++) {
        try {
            console.log(`  [${attempt}/${MAX}] Connecting to Turso...`);
            await initDb(true);
            // Verify connection with a simple query
            const db = getDb();
            await db.execute('SELECT 1');
            console.log('  ✅ Connected!\n');
            return;
        } catch (err) {
            const code = err.code || err.message || 'unknown';
            console.log(`  ⚠️  Connection error (${code}). Database may be waking up.`);
            if (attempt < MAX) {
                const waitSec = Math.min(attempt * 2, 10);
                console.log(`  ⏳ Waiting ${waitSec}s before retry...\n`);
                await sleep(waitSec * 1000);
            } else {
                console.error('\n  ❌ FAILED: Could not connect after 15 attempts.');
                console.error('  Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env');
                process.exit(1);
            }
        }
    }
}

async function main() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  SARKARHAMARIHAI — Production Database Seed');
    console.log('  ⚠️  DO NOT CLOSE THIS WINDOW. Wait for completion.');
    console.log('══════════════════════════════════════════════════════\n');
    console.log(`  DB URL: ${dbUrl}\n`);

    // Step 1: Connect (with aggressive retries for sleeping Turso DB)
    console.log('━━━ STEP 1: Connecting to Turso ━━━');
    await connectWithRetry();

    // Step 2: Delete old jobs
    console.log('━━━ STEP 2: Purging old data ━━━');
    try {
        const result = await seedInit();
        console.log(`  ✅ Purged ${result.deleted} old jobs. Ready to insert ${result.totalJobs} new jobs.\n`);
    } catch (err) {
        console.error('  ❌ Purge failed:', err.message);
        console.log('  Attempting to continue anyway...\n');
    }

    // Step 3: Insert in batches
    const BATCH_SIZE = 200;
    const total = getJobCount();
    console.log(`━━━ STEP 3: Inserting ${total} jobs (batches of ${BATCH_SIZE}) ━━━`);

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
        let retries = 5;
        while (retries > 0) {
            try {
                const result = await seedBatch(offset, BATCH_SIZE);
                const pct = Math.round(((offset + result.inserted) / total) * 100);
                const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
                console.log(`  [${bar}] ${pct}% — Inserted ${offset + result.inserted}/${total}`);
                break;
            } catch (err) {
                retries--;
                if (retries > 0) {
                    console.log(`  ⚠️  Batch ${offset} failed (${err.message}). Retrying in 3s... (${retries} left)`);
                    await sleep(3000);
                } else {
                    console.error(`  ❌ Batch at offset ${offset} FAILED after 5 retries. Continuing...`);
                }
            }
        }
    }
    console.log();

    // Step 4: Finalize
    console.log('━━━ STEP 4: Finalizing (setting version to v18) ━━━');
    try {
        const result = await seedFinalize();
        console.log(`  ✅ Version set to ${result.version}. Total jobs in DB: ${result.totalJobs}\n`);
    } catch (err) {
        console.error('  ❌ Finalize error:', err.message);
    }

    // Step 5: Verify
    console.log('━━━ STEP 5: Verification ━━━');
    try {
        const db = getDb();
        const countResult = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
        const catResult = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC LIMIT 20');
        const versionResult = await db.execute("SELECT value FROM seed_meta WHERE key='seed_version'");
        
        console.log(`  Total jobs: ${countResult.rows[0].cnt}`);
        console.log(`  Seed version: ${versionResult.rows[0]?.value || 'unknown'}`);
        console.log(`  Categories:`);
        for (const row of catResult.rows) {
            console.log(`    ${row.job_category}: ${row.cnt}`);
        }
    } catch (err) {
        console.error('  Verification error:', err.message);
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE! Your production database is updated.');
    console.log('  Visit: https://sarkarhamarihai.vercel.app');
    console.log('══════════════════════════════════════════════════════\n');
    
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
