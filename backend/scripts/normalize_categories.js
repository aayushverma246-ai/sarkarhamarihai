const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const EXACT_CATEGORIES = [
  'UPSC', 'SSC', 'Banking', 'Railways', 'Defence', 'State PSC', 'Teaching',
  'Engineering', 'Medical', 'Law', 'Judiciary', 'Insurance', 'PSU', 'Police',
  'Entrance Exams', 'Scholarships', 'Apprenticeships', 'Others'
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Startup-grade Exponential Backoff Helper
async function withRetry(operationName, fn, maxRetries = 8, initialDelay = 2000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('fetch failed: timeout')), 30000);
      });
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`[FATAL] ${operationName} failed completely: ${e.message}`);
        throw e;
      }
      const backoff = initialDelay * Math.pow(1.5, attempt) + Math.random() * 500;
      console.warn(`[WARN] ${operationName} error (${e.message}). Retrying ${attempt}/${maxRetries} in ${Math.round(backoff)}ms...`);
      await sleep(backoff);
    }
  }
}

async function main() {
  console.log('--- NODE-SIDE MEMORY-MAPPED CATEGORY NORMALIZATION ---\n');

  // Convert SQL LIKE patterns to pure Javascript regex
  const rules = [
    { pattern: /upsc|civil services/i, cat: 'UPSC' },
    { pattern: /ssc |staff selection|selection post/i, cat: 'SSC' },
    { pattern: /railway|rrb|loco pilot|rrc/i, cat: 'Railways' },
    { pattern: /bank|ibps|rbi |nabard|sbi /i, cat: 'Banking' },
    { pattern: /police|constable|sub inspector|capf|crpf|bsf|cisf|itbp/i, cat: 'Police' },
    { pattern: /defence|army|navy|air force|dockyard|ordnance|bro |nda |cds |coast guard/i, cat: 'Defence' },
    { pattern: /teacher|tet |ctet|tgt|pgt|school|university|assistant professor|faculty/i, cat: 'Teaching' },
    { pattern: /engineer|b\.tech|m\.tech|diploma engineer|ae\/je|junior engineer/i, cat: 'Engineering' },
    { pattern: /health|nurse|nhm|medical|aiims|pharmacist|mbbs|doctor/i, cat: 'Medical' },
    { pattern: /court|judiciary|high court|supreme court|judge/i, cat: 'Judiciary' },
    { pattern: /lawyer|advocate|legal/i, cat: 'Law' },
    { pattern: /insurance|lic |esic|niacl/i, cat: 'Insurance' },
    { pattern: /ongc|bhel|sail|iocl|oil india|gail|coal|power grid|ntpc|hal /i, cat: 'PSU' },
    { pattern: /jee |neet|gate |cuet|clat|nift|admission/i, cat: 'Entrance Exams' },
    { pattern: /scholarship|fellowship/i, cat: 'Scholarships' },
    { pattern: /apprentice/i, cat: 'Apprenticeships' },
    { pattern: /psc|state common|subordinate/i, cat: 'State PSC' },
  ];

  console.log('1. Fetching full table into Node.js (Atomic)...');
  const fetchResult = await withRetry('Fetch Jobs', async () => 
    db.execute('SELECT id, job_name, organization, job_category FROM jobs')
  );
  
  const jobs = fetchResult.rows;
  console.log(`✅ Loaded ${jobs.length} jobs in milliseconds.\n`);

  console.log('2. Processing categories in-memory (0ms latency)...');
  const updates = [];
  
  for (const job of jobs) {
    const textToSearch = `${job.job_name || ''} ${job.organization || ''}`;
    let mappedCat = 'Others';
    
    for (const rule of rules) {
      if (rule.pattern.test(textToSearch)) {
        mappedCat = rule.cat;
        break;
      }
    }

    if (job.job_category !== mappedCat) {
      updates.push({
        sql: `UPDATE jobs SET job_category = ? WHERE id = ?`,
        args: [mappedCat, job.id]
      });
    }
  }

  console.log(`✅ Analyzed ${jobs.length} strings: Found ${updates.length} records needing updates.\n`);

  if (updates.length > 0) {
    console.log(`3. Executing proxy batches in chunks of 15...`);
    
    const CHUNK_SIZE = 15;
    let chunksProcessed = 0;
    
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      await withRetry(`Batch [${i} - ${i + chunk.length}]`, async () => {
        await db.batch(chunk, 'write');
      });
      chunksProcessed += chunk.length;
      console.log(`   Pushed: ${chunksProcessed}/${updates.length} to Turso...`);
      await sleep(500); // longer breather to avoid proxy overload
    }
  }
  
  console.log(`\n✅ DATABASE FULLY NORMALIZED OVER HTTP PROXY!`);
}

main().catch(console.error);
