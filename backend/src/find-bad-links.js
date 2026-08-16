const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb, initDb } = require('./db');

(async () => {
  await initDb();
  const db = getDb();
  console.log('Fetching all jobs to scan for URL issues...');
  
  let offset = 0;
  const batchSize = 1000;
  let allJobs = [];
  let hasMore = true;

  while (hasMore) {
    const res = await db.execute(`SELECT id, job_name, organization, official_website_link, official_application_link FROM jobs ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`);
    const batchRows = res.rows || [];
    allJobs.push(...batchRows);
    if (batchRows.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  console.log(`Total jobs loaded: ${allJobs.length}`);
  const badJobs = [];

  for (const job of allJobs) {
    const wLink = job.official_website_link || '';
    const aLink = job.official_application_link || '';
    
    const isBad = (url) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return lower.includes(' ') || 
             lower.includes('gk') || 
             lower.includes('official') || 
             lower.includes('lorem') ||
             lower.includes('dummy') ||
             lower.includes('placeholder') ||
             !url.startsWith('http');
    };

    if (isBad(wLink) || isBad(aLink)) {
      badJobs.push(job);
    }
  }

  console.log(`Found ${badJobs.length} jobs with suspicious or malformed URLs.`);
  badJobs.slice(0, 30).forEach(j => {
    console.log(`- [${j.id}] Org: "${j.organization}" | Name: "${j.job_name}"`);
    console.log(`   Web Link: "${j.official_website_link}"`);
    console.log(`   App Link: "${j.official_application_link}"`);
  });

  process.exit(0);
})();
