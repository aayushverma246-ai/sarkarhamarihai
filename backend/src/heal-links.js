const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb, initDb } = require('./db');

(async () => {
  await initDb();
  const db = getDb();
  console.log('Fetching all jobs for final URL healing...');
  
  let offset = 0;
  const batchSize = 1000;
  let allJobs = [];
  let hasMore = true;

  while (hasMore) {
    const res = await db.execute(`SELECT id, official_website_link, official_application_link, official_notification_link FROM jobs ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`);
    const batchRows = res.rows || [];
    allJobs.push(...batchRows);
    if (batchRows.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  console.log(`Auditing ${allJobs.length} jobs...`);
  let fixCount = 0;

  for (const job of allJobs) {
    let wLink = job.official_website_link || '';
    let aLink = job.official_application_link || '';
    let nLink = job.official_notification_link || '';
    
    let wOrig = wLink;
    let aOrig = aLink;
    let nOrig = nLink;

    const cleanUrl = (url) => {
      if (!url) return '';
      let cleaned = url.trim();
      
      // Remove spaces
      cleaned = cleaned.replace(/\s+/g, '');
      
      // Clean leading double slashes or weird prefix issues
      cleaned = cleaned.replace(/https?:\/+(?=[^\/])/g, 'https://');
      
      // Handle known Llama hallucinations
      if (cleaned.toLowerCase().includes('gk') || cleaned.toLowerCase().includes('official')) {
        if (cleaned.toLowerCase().includes('karnataka')) {
          cleaned = 'https://karnataka.gov.in';
        } else if (cleaned.toLowerCase().includes('dnh')) {
          cleaned = 'https://dnh.gov.in';
        } else if (cleaned.toLowerCase().includes('assam')) {
          cleaned = 'https://assam.gov.in';
        } else {
          cleaned = '';
        }
      }
      
      return cleaned;
    };

    wLink = cleanUrl(wLink);
    aLink = cleanUrl(aLink);
    nLink = cleanUrl(nLink);

    // Apply specific corrections if matching certain organization domains
    if (wLink.includes('assamrifles')) wLink = 'https://assamrifles.gov.in';
    if (aLink.includes('assamrifles')) aLink = 'https://assamrifles.gov.in';
    if (nLink.includes('assamrifles')) nLink = 'https://assamrifles.gov.in';
    
    if (wLink.includes('pareekshabhavan')) wLink = 'https://pareekshabhavan.kerala.gov.in';
    if (aLink.includes('pareekshabhavan')) aLink = 'https://pareekshabhavan.kerala.gov.in';
    if (nLink.includes('pareekshabhavan')) nLink = 'https://pareekshabhavan.kerala.gov.in';

    if (wLink.includes('tspolice') || wLink.includes('ts.police')) wLink = 'https://tspolice.gov.in';
    if (aLink.includes('tspolice') || aLink.includes('ts.police')) aLink = 'https://tspolice.gov.in';
    if (nLink.includes('tspolice') || nLink.includes('ts.police')) nLink = 'https://tspolice.gov.in';

    if (wLink.includes('jsscofficial') || wLink.includes('jhpolice')) wLink = 'https://jhpolice.gov.in';
    if (aLink.includes('jsscofficial') || aLink.includes('jhpolice')) aLink = 'https://jhpolice.gov.in';
    if (nLink.includes('jsscofficial') || nLink.includes('jhpolice')) nLink = 'https://jhpolice.gov.in';

    if (wLink !== wOrig || aLink !== aOrig || nLink !== nOrig) {
      fixCount++;
      await db.execute({
        sql: 'UPDATE jobs SET official_website_link = ?, official_application_link = ?, official_notification_link = ? WHERE id = ?',
        args: [wLink, aLink, nLink, job.id]
      });
    }
  }

  console.log(`Successfully healed ${fixCount} jobs in the database!`);
  process.exit(0);
})();
