/**
 * fix_categories_supabase.js
 * 
 * Normalizes all job categories in Supabase from raw (CENTRAL/STATE/PSU)
 * to the full 17-category system (UPSC, SSC, Banking, Railways, etc.)
 * 
 * Uses pg pool directly (fast, no REST rate-limits).
 * Run: node backend/scripts/fix_categories_supabase.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ─── Category rules (order matters — first match wins) ───────────────────────
const RULES = [
  { pattern: /upsc|civil services|ias |ips |ifs |lbsnaa/i, cat: 'UPSC' },
  { pattern: /\bssc\b|staff selection commission|selection post|chsl|cgl |mts |gd constable/i, cat: 'SSC' },
  { pattern: /railway|rrb\b|rrc\b|loco pilot|railway clerk|tier i|tier ii/i, cat: 'Railways' },
  { pattern: /\bbank\b|ibps|rbi\b|nabard|sbi\b|pnb\b|bob\b|canara|po exam|clerk exam|financial services/i, cat: 'Banking' },
  { pattern: /\bpolice|constable|sub[\s-]?inspector|capf|crpf|bsf\b|cisf|itbp|rpf\b|armed force police/i, cat: 'Police' },
  { pattern: /\bdefence|army|navy|air force|dockyard|ordnance|bro\b|nda\b|cds\b|coast guard|military|armed forces/i, cat: 'Defence' },
  { pattern: /teacher|tet\b|ctet|tgt\b|pgt\b|\bschool\b|university|assistant professor|faculty|shikshak|vidyalaya|kendriya|navodaya/i, cat: 'Teaching' },
  { pattern: /junior engineer|assistant engineer|\bae\/je\b|\bjunior je\b|b\.tech|btech|m\.tech|mtech|diploma in engineering|civil eng|mech eng/i, cat: 'Engineering' },
  { pattern: /medical|nurse|nhm\b|aiims|pharmacist|mbbs|doctor|\bhealth\b|hospital|ayush|asha worker|nursing/i, cat: 'Healthcare' },
  { pattern: /\bcourt\b|judiciary|high court|supreme court|district court|judge|munsiff/i, cat: 'Judiciary' },
  { pattern: /lawyer|advocate|legal officer/i, cat: 'Law' },
  { pattern: /insurance|lic\b|esic|niacl|nicl\b|uiic|gic\b/i, cat: 'Insurance' },
  { pattern: /ongc|bhel|sail|iocl|oil india|gail\b|coal india|power grid|ntpc|hal\b|bel\b|beml|rvnl|concor|hpcl|bpcl/i, cat: 'PSU' },
  { pattern: /jee\b|neet|gate\b|cuet|clat|nift|cat\b|mat\b|admission|entrance exam|competitive exam entrant/i, cat: 'Entrance Exams' },
  { pattern: /scholarship|fellowship|stipend/i, cat: 'Scholarships' },
  { pattern: /apprentice/i, cat: 'Apprenticeships' },
  { pattern: /\bpsc\b|state public service|state common|subordinate service|state level|rajkiya/i, cat: 'State PSC' },
  { pattern: /forest|wildlife|environment|ecology/i, cat: 'Forest & Environment' },
  { pattern: /research|scientist|csir|drdo|isro|dae\b|icar|scientific officer/i, cat: 'Research & Science' },
  { pattern: /port\b|shipping|dredging|shipyard|maritime/i, cat: 'Shipping & Ports' },
  { pattern: /telecom|bsnl|mtnl|trai/i, cat: 'Telecom' },
  { pattern: /cooperative|gramin bank|rural bank|sahkari/i, cat: 'Cooperative' },
  { pattern: /agriculture|krishi|horticulture|dairy|animal husbandry/i, cat: 'Agriculture' },
  { pattern: /municipal|corporation|nagar|urban local|panchayat|gram sabha/i, cat: 'Municipal' },
];

function normalizeCategory(jobName, org) {
  const text = `${jobName || ''} ${org || ''}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.cat;
  }
  return 'Others';
}

// ─── Fetch via Supabase REST (no pg password needed) ─────────────────────────
async function fetchAllJobsREST() {
  console.log('📡 Fetching jobs via Supabase REST API...');
  const allRows = [];
  const LIMIT = 1000;
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/jobs?select=id,job_name,organization,job_category&limit=${LIMIT}&offset=${offset}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=none',
        }
      }
    );

    if (!res.ok) {
      throw new Error(`REST API error ${res.status}: ${await res.text()}`);
    }

    const rows = await res.json();
    if (!rows.length) break;

    allRows.push(...rows);
    console.log(`  Fetched ${allRows.length} rows...`);
    if (rows.length < LIMIT) break;
    offset += LIMIT;
  }

  console.log(`✅ Fetched ${allRows.length} total jobs\n`);
  return allRows;
}

// ─── Update via REST PATCH (batched by category) ─────────────────────────────
async function updateCategoryREST(ids, newCategory) {
  // Supabase REST: PATCH with ?id=in.(a,b,c)
  const idList = ids.map(id => `"${id}"`).join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/jobs?id=in.(${idList})`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ job_category: newCategory }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH error for category '${newCategory}': ${text}`);
  }
}

// ─── Update via pg pool (preferred — fast bulk UPDATEs) ──────────────────────
async function updateViaPg(pool, updates) {
  // Group by new category for efficient batch updates
  const byCategory = new Map();
  for (const { id, cat } of updates) {
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(id);
  }

  for (const [cat, ids] of byCategory) {
    // Use parameterized ANY($1) for safe array query
    await pool.query(
      `UPDATE jobs SET job_category = $1 WHERE id = ANY($2)`,
      [cat, ids]
    );
    console.log(`  ✅ Updated ${ids.length} jobs → "${cat}"`);
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  SarkarHamariHai — Category Normalization Script');
  console.log('  Target: Supabase PostgreSQL');
  console.log('══════════════════════════════════════════════════\n');

  // Step 1: Fetch all jobs
  const jobs = await fetchAllJobsREST();

  // Step 2: Compute new categories in-memory
  console.log('🧠 Computing categories in-memory...');
  const updates = [];
  for (const job of jobs) {
    const newCat = normalizeCategory(job.job_name, job.organization);
    if (job.job_category !== newCat) {
      updates.push({ id: job.id, cat: newCat });
    }
  }

  // Category distribution after normalization
  const catCount = {};
  for (const job of jobs) {
    const cat = normalizeCategory(job.job_name, job.organization);
    catCount[cat] = (catCount[cat] || 0) + 1;
  }
  
  console.log('\n📊 New category distribution:');
  const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
  for (const [cat, cnt] of sorted) {
    console.log(`  ${cat.padEnd(25)} ${cnt}`);
  }
  console.log(`\n  Total: ${jobs.length} jobs`);
  console.log(`  Needs update: ${updates.length} records\n`);

  if (updates.length === 0) {
    console.log('✅ All categories already correct. Nothing to update.');
    return;
  }

  // Step 3: Apply updates
  if (SUPABASE_DB_URL) {
    console.log('🔗 Using pg pool for fast bulk updates...');
    const pool = new Pool({
      connectionString: SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });

    try {
      await updateViaPg(pool, updates);
      console.log(`\n✅ DONE — Updated ${updates.length} records via pg pool.`);
    } finally {
      await pool.end();
    }
  } else {
    console.log('🔗 No SUPABASE_DB_URL — using REST API (slower but functional)...');
    
    // Group by category for batched REST updates
    const byCategory = new Map();
    for (const { id, cat } of updates) {
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(id);
    }

    let totalUpdated = 0;
    const BATCH_SIZE = 200; // Supabase URL length limit

    for (const [cat, ids] of byCategory) {
      // Process in batches of 200 to avoid URL length limits
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await updateCategoryREST(batch, cat);
        totalUpdated += batch.length;
        console.log(`  ✅ Updated ${totalUpdated}/${updates.length} — "${cat}" (batch ${Math.floor(i/BATCH_SIZE)+1})`);
        
        // Throttle to avoid rate limiting
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }

    console.log(`\n✅ DONE — Updated ${totalUpdated} records via REST API.`);
  }

  // Step 4: Verify
  console.log('\n🔍 Verifying final category distribution...');
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/jobs?select=job_category&limit=20000`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );
  if (verifyRes.ok) {
    const rows = await verifyRes.json();
    const finalCount = {};
    for (const r of rows) {
      finalCount[r.job_category] = (finalCount[r.job_category] || 0) + 1;
    }
    console.log('\n📊 Final category counts:');
    const finalSorted = Object.entries(finalCount).sort((a, b) => b[1] - a[1]);
    for (const [cat, cnt] of finalSorted) {
      console.log(`  ${cat.padEnd(25)} ${cnt}`);
    }
    console.log(`\n  Total categories: ${finalSorted.length}`);
    console.log(`  Total jobs: ${rows.length}`);
  }
}

main().catch(err => {
  console.error('\n💥 Script failed:', err.message);
  process.exit(1);
});
