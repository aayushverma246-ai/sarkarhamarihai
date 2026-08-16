/**
 * fix_broken_tlds.js
 * 
 * Fetches all jobs and checks if their URLs are invalid (lacking a dot or ending in invalid text like .ts, .assam).
 * Resolves them using the word boundary mapper.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATE_MAP = {
  'telangana': 'https://tspsc.gov.in',
  'kerala': 'https://keralapsc.gov.in',
  'assam': 'https://apsc.nic.in',
};

async function run() {
  console.log('Fetching all jobs...');
  let allJobs = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase.from('jobs')
      .select('id, job_name, state, organization, official_website_link')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    page++;
  }
  
  console.log(`Fetched ${allJobs.length} jobs.`);
  
  const updates = [];
  for (const job of allJobs) {
    const link = job.official_website_link || '';
    
    // Check if link is truncated/wrong
    const isTruncated = link === 'https://assam' || link === 'https://tsp.ts' || !link.includes('.') || link.endsWith('.ts');
    
    if (isTruncated) {
      let correctLink = '';
      const name = job.job_name.toLowerCase();
      const org = job.organization.toLowerCase();
      
      if (name.includes('assam rifles')) {
        correctLink = 'https://assamrifles.gov.in';
      } else if (name.includes('telangana') || org.includes('telangana')) {
        correctLink = 'https://tspsc.gov.in';
      } else if (name.includes('assam') || org.includes('assam')) {
        correctLink = 'https://apsc.nic.in';
      }
      
      if (correctLink) {
        updates.push({ id: job.id, link: correctLink, oldLink: link, name: job.job_name });
      }
    }
  }
  
  console.log(`Found ${updates.length} jobs needing recovery.`);
  
  for (const item of updates) {
    console.log(`  Fixing [${item.id}] "${item.name}": "${item.oldLink}" -> "${item.link}"`);
    await supabase.from('jobs').update({
      official_website_link: item.link,
      official_application_link: item.link,
      official_notification_link: item.link
    }).eq('id', item.id);
  }
  
  console.log('Done!');
}
run();
