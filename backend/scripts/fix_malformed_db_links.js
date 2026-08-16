/**
 * fix_malformed_db_links.js
 * 
 * Fetches all jobs from Supabase, cleans application, notification, and website links 
 * using advanced malformed URL extraction, and writes any changes back to the database.
 * Run: node backend/scripts/fix_malformed_db_links.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cleanMalformedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Check if it's conversational
  const lower = trimmed.toLowerCase();
  const conversationalKeywords = ['official', 'website', 'however', 'visit', 'government', 'portal', 'click', 'here', 'apply', 'visit:', 'page'];
  
  // Count how many 'http' are in the string
  const httpCount = (lower.match(/https?:\/\//g) || []).length;
  
  const nonUrlText = lower.replace(/https?:\/\/[^\s]+/g, '');
  const hasConversationalWords = conversationalKeywords.some(word => nonUrlText.includes(word));
  
  if ((httpCount > 1 || hasConversationalWords) && trimmed.includes(' ')) {
    // Conversational text: extract the last valid URL
    const urlRegex = /https?:\/\/[^\s"'()]+/g;
    const matches = trimmed.match(urlRegex);
    if (matches && matches.length > 0) {
      let extracted = matches[matches.length - 1];
      extracted = extracted.replace(/[.,;:!]+$/, '');
      return extracted.replace(/[\s\r\n\t]/g, '');
    }
  }
  
  // Not conversational: just clean protocol space and remove all spaces
  let cleaned = trimmed.replace(/^(https?:\/\/)\s+/, '$1');
  cleaned = cleaned.replace(/[\s\r\n\t]/g, '');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/[.,;:!]+$/, '');
  
  return cleaned;
}

async function run() {
  console.log('=== SarkarHamariHai Exhaustive Malformed Link Cleaner ===');
  console.log('Fetching all jobs from Supabase...');
  
  let allJobs = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error('Fetch error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    page++;
  }
  
  console.log(`Total jobs fetched: ${allJobs.length}`);
  
  const updates = [];
  
  for (const job of allJobs) {
    const origWeb = job.official_website_link || '';
    const origApp = job.official_application_link || '';
    const origNotif = job.official_notification_link || '';
    
    const cleanWeb = cleanMalformedUrl(origWeb);
    const cleanApp = cleanMalformedUrl(origApp);
    const cleanNotif = cleanMalformedUrl(origNotif);
    
    if (cleanWeb !== origWeb || cleanApp !== origApp || cleanNotif !== origNotif) {
      updates.push({
        id: job.id,
        origWeb,
        cleanWeb,
        origApp,
        cleanApp,
        origNotif,
        cleanNotif,
        name: job.job_name,
        org: job.organization
      });
    }
  }
  
  console.log(`Found ${updates.length} jobs with malformed or conversational URLs needing cleanup.`);
  
  if (updates.length === 0) {
    console.log('No malformed URLs found. Database is completely clean!');
    process.exit(0);
  }
  
  // Apply updates in batches of 50
  const BATCH = 50;
  let updatedCount = 0;
  
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const promises = batch.map(item => {
      console.log(`  Updating [${item.id}] "${item.name}":`);
      if (item.origWeb !== item.cleanWeb) console.log(`     Web: "${item.origWeb}" -> "${item.cleanWeb}"`);
      if (item.origApp !== item.cleanApp) console.log(`     App: "${item.origApp}" -> "${item.cleanApp}"`);
      if (item.origNotif !== item.cleanNotif) console.log(`     Notif: "${item.origNotif}" -> "${item.cleanNotif}"`);
      
      return supabase.from('jobs')
        .update({
          official_website_link: item.cleanWeb,
          official_application_link: item.cleanApp,
          official_notification_link: item.cleanNotif
        })
        .eq('id', item.id);
    });
    
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    updatedCount += batch.length - errors.length;
    if (errors.length > 0) {
      errors.forEach(e => console.error('  ERR:', e.error.message));
    }
    console.log(`  Progress: ${updatedCount}/${updates.length} updated...`);
  }
  
  console.log(`\n✅ Done! Successfully cleaned up ${updatedCount} malformed database links.`);
  process.exit(0);
}

run();
