const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    console.log('Fetching all jobs to check for https://india.gov.in links...');
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allJobs.push(...data);
        page++;
        if (data.length < pageSize) hasMore = false;
      }
    }
    
    const matchingJobs = [];
    allJobs.forEach(job => {
      const app = job.official_application_link || '';
      const web = job.official_website_link || '';
      const notif = job.official_notification_link || '';
      
      if (app.includes('india.gov.in') || web.includes('india.gov.in') || notif.includes('india.gov.in')) {
        matchingJobs.push(job);
      }
    });
    
    console.log(`\nTotal jobs still pointing to india.gov.in: ${matchingJobs.length}`);
    
    if (matchingJobs.length > 0) {
      const orgs = {};
      matchingJobs.forEach(job => {
        if (!orgs[job.organization]) {
          orgs[job.organization] = 0;
        }
        orgs[job.organization]++;
      });
      
      console.log('\nOrganizations with india.gov.in links:');
      Object.entries(orgs).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        console.log(`- ${name}: ${count} jobs`);
      });
    } else {
      console.log('🎉 No jobs are pointing to india.gov.in!');
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
