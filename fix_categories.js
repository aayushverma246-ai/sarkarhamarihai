// Direct Turso category fix - uses env from backend/.env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const { createClient } = require('@libsql/client/http');

console.log('URL:', process.env.TURSO_DATABASE_URL ? 'SET' : 'MISSING');
console.log('TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'SET' : 'MISSING');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('\n=== DB STATUS CHECK ===\n');
  
  const count = await db.execute('SELECT COUNT(*) as cnt FROM jobs');
  console.log(`Total jobs: ${count.rows[0].cnt}`);
  
  const cats = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY cnt DESC');
  console.log('Current categories:');
  cats.rows.forEach(r => console.log(`  ${r.job_category}: ${r.cnt}`));
  
  console.log('\n=== APPLYING CATEGORY UPDATES ===\n');
  
  const categoryRules = [
    ['%upsc%', 'UPSC'], ['%civil services%', 'UPSC'],
    ['%ssc %', 'SSC'], ['%staff selection%', 'SSC'], ['%selection post%', 'SSC'],
    ['%railway%', 'Railway'], ['%rrb%', 'Railway'], ['%loco pilot%', 'Railway'], ['%track maintainer%', 'Railway'],
    ['%bank%', 'Banking'], ['%ibps%', 'Banking'], ['%rbi %', 'Banking'], ['%nabard%', 'Banking'],
    ['%police%', 'Police & Security'], ['%constable%', 'Police & Security'], ['%sub inspector%', 'Police & Security'], ['%capf%', 'Police & Security'], ['%crpf%', 'Police & Security'], ['%bsf%', 'Police & Security'], ['%cisf%', 'Police & Security'], ['%itbp%', 'Police & Security'],
    ['%defence%', 'Defence'], ['%army%', 'Defence'], ['%navy%', 'Defence'], ['%air force%', 'Defence'], ['%dockyard%', 'Defence'], ['%ordnance%', 'Defence'], ['%bro %', 'Defence'], ['%gref%', 'Defence'], ['%drdo%', 'Defence'], ['%nda %', 'Defence'], ['%cds %', 'Defence'],
    ['%teacher%', 'Teaching & Education'], ['%tet %', 'Teaching & Education'], ['%ctet%', 'Teaching & Education'], ['%tgt%', 'Teaching & Education'], ['%pgt%', 'Teaching & Education'], ['%school%', 'Teaching & Education'], ['%university%', 'Teaching & Education'], ['%iit %', 'Teaching & Education'], ['%nit %', 'Teaching & Education'], ['%iim %', 'Teaching & Education'], ['%jnu%', 'Teaching & Education'], ['%bhu%', 'Teaching & Education'], ['%amu%', 'Teaching & Education'], ['%anganwadi%', 'Teaching & Education'], ['%mid-day%', 'Teaching & Education'],
    ['%court%', 'Judiciary & Law'], ['%judiciary%', 'Judiciary & Law'], ['%nyayalaya%', 'Judiciary & Law'], ['%lok sabha%', 'Judiciary & Law'], ['%rajya sabha%', 'Judiciary & Law'],
    ['%forest%', 'Forest & Environment'], ['%wildlife%', 'Forest & Environment'], ['%van rakshak%', 'Forest & Environment'],
    ['%health%', 'Healthcare'], ['%nurse%', 'Healthcare'], ['%nhm%', 'Healthcare'], ['%hospital%', 'Healthcare'], ['%aiims%', 'Healthcare'], ['%medical%', 'Healthcare'], ['%asha %', 'Healthcare'],
    ['%insurance%', 'Insurance'], ['%lic %', 'Insurance'], ['%esic%', 'Insurance'],
    ['%csir%', 'Research & Science'], ['%icar%', 'Research & Science'], ['%scientist%', 'Research & Science'],
    ['%telecom%', 'Telecom'], ['%bsnl%', 'Telecom'], ['%mtnl%', 'Telecom'],
    ['%shipping%', 'Shipping & Ports'], ['%cochin shipyard%', 'Shipping & Ports'],
    ['%agriculture%', 'Agriculture'], ['%dairy%', 'Agriculture'], ['%cooperative%', 'Agriculture'],
    ['%jee %', 'Entrance Exam'], ['%neet%', 'Entrance Exam'], ['%gate %', 'Entrance Exam'], ['%cuet%', 'Entrance Exam'], ['%clat%', 'Entrance Exam'], ['%nata %', 'Entrance Exam'], ['%nift%', 'Entrance Exam'],
    ['%ongc%', 'PSU'], ['%bhel%', 'PSU'], ['%sail%', 'PSU'], ['%iocl%', 'PSU'], ['%oil india%', 'PSU'], ['%gail%', 'PSU'], ['%coal%', 'PSU'], ['%power grid%', 'PSU'],
    ['%psc%', 'State Government'], ['%patwari%', 'State Government'], ['%lekhpal%', 'State Government'], ['%talathi%', 'State Government'], ['%panchayat%', 'State Government'], ['%zilla%', 'State Government'], ['%municipal%', 'State Government'], ['%electricity%', 'State Government'], ['%transport%', 'State Government'], ['%vidhan sabha%', 'State Government'], ['%district%', 'State Government'], ['%safai%', 'State Government'], ['%rozgar%', 'State Government'], ['%revenue%', 'State Government'],
  ];
  
  let totalUpdated = 0;
  
  for (const [pattern, newCat] of categoryRules) {
    try {
      const result = await db.execute({
        sql: `UPDATE jobs SET job_category = ? WHERE (job_category = 'CENTRAL' OR job_category = 'STATE') AND (LOWER(job_name) LIKE ? OR LOWER(organization) LIKE ?)`,
        args: [newCat, pattern, pattern]
      });
      if (result.rowsAffected > 0) {
        totalUpdated += result.rowsAffected;
        console.log(`  ${pattern} → ${newCat}: ${result.rowsAffected} rows`);
      }
    } catch (e) {
      console.error(`  ERROR ${pattern}: ${e.message.slice(0, 60)}`);
      await new Promise(r => setTimeout(r, 2000));
      // One retry
      try {
        const result = await db.execute({
          sql: `UPDATE jobs SET job_category = ? WHERE (job_category = 'CENTRAL' OR job_category = 'STATE') AND (LOWER(job_name) LIKE ? OR LOWER(organization) LIKE ?)`,
          args: [newCat, pattern, pattern]
        });
        if (result.rowsAffected > 0) {
          totalUpdated += result.rowsAffected;
          console.log(`  RETRY ${pattern} → ${newCat}: ${result.rowsAffected} rows`);
        }
      } catch (e2) {
        console.error(`  RETRY FAILED ${pattern}: ${e2.message.slice(0, 60)}`);
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Final cleanup: remaining CENTRAL → Central Government
  console.log('\nCleaning up remaining CENTRAL/STATE...');
  let remaining = true;
  while (remaining) {
    try {
      const r = await db.execute({
        sql: "UPDATE jobs SET job_category = 'Central Government' WHERE id IN (SELECT id FROM jobs WHERE job_category = 'CENTRAL' LIMIT 300)",
        args: []
      });
      if (r.rowsAffected === 0) {
        remaining = false;
      } else {
        totalUpdated += r.rowsAffected;
        console.log(`  CENTRAL cleanup: ${r.rowsAffected} rows`);
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`  Cleanup error: ${e.message.slice(0, 60)}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  remaining = true;
  while (remaining) {
    try {
      const r = await db.execute({
        sql: "UPDATE jobs SET job_category = 'State Government' WHERE id IN (SELECT id FROM jobs WHERE job_category = 'STATE' LIMIT 300)",
        args: []
      });
      if (r.rowsAffected === 0) {
        remaining = false;
      } else {
        totalUpdated += r.rowsAffected;
        console.log(`  STATE cleanup: ${r.rowsAffected} rows`);
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`  Cleanup error: ${e.message.slice(0, 60)}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  console.log(`\nTotal rows updated: ${totalUpdated}`);
  
  // Final state
  const after = await db.execute('SELECT job_category, COUNT(*) as cnt FROM jobs GROUP BY job_category ORDER BY job_category');
  console.log('\nFINAL CATEGORIES:');
  after.rows.forEach(r => console.log(`  ${r.job_category}: ${r.cnt}`));
  
  // Update seed version
  await db.execute({ sql: "INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('seed_version', ?)", args: ['17'] });
  console.log('\n✓ Seed version → 17');
  
  console.log('\n✅ DONE!');
}

main().catch(e => {
  console.error('FATAL:', e.message, e.stack?.slice(0, 200));
  process.exit(1);
});
