const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    let activeJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, organization, form_status')
        .in('form_status', ['LIVE', 'UPCOMING'])
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        activeJobs.push(...data);
        page++;
        if (data.length < pageSize) hasMore = false;
      }
    }
    
    let simulatedCount = 0;
    let realCount = 0;
    let realZeroSalaryCount = 0;
    
    const realSample = [];
    
    activeJobs.forEach(job => {
      if (job.organization.includes('Local / District Admin')) {
        simulatedCount++;
      } else {
        realCount++;
        if (job.salary_min === 0 && job.salary_max === 0) {
          realZeroSalaryCount++;
        }
        if (realSample.length < 15) {
          realSample.push(job);
        }
      }
    });
    
    console.log(`Total active jobs: ${activeJobs.length}`);
    console.log(`Simulated district jobs: ${simulatedCount}`);
    console.log(`Real, non-simulated active jobs: ${realCount}`);
    console.log(`Real active jobs with zero salary: ${realZeroSalaryCount}`);
    console.log('\nSample of real active jobs:');
    console.log(JSON.stringify(realSample, null, 2));
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
