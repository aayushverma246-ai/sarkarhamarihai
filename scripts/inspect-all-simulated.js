const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    console.log('Loading all jobs...');
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, organization, form_status')
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
    
    console.log(`Total jobs loaded: ${allJobs.length}`);
    
    let districtAdminCount = 0;
    let otherSimulatedCount = 0;
    let realCount = 0;
    
    const sampleDistrict = [];
    const sampleOther = [];
    const sampleReal = [];
    
    allJobs.forEach(job => {
      const name = job.job_name;
      const org = job.organization;
      
      const isDistrictAdmin = org.includes('Local / District Admin') || name.includes(' District ');
      
      // Other bulk simulated categories (e.g. state police generated for all states, etc.)
      const isOtherSimulated = !isDistrictAdmin && (
        org.includes('State Police') || 
        org.includes('Police Department') && (org.includes('Dadra & Nagar Haveli') || org.includes('Lakshadweep') || org.includes('Daman & Diu')) ||
        org.includes('Electricity Dept') && (org.includes('Dadra & Nagar Haveli') || org.includes('Lakshadweep') || org.includes('Andaman'))
      );
      
      if (isDistrictAdmin) {
        districtAdminCount++;
        if (sampleDistrict.length < 5) sampleDistrict.push(job);
      } else if (isOtherSimulated) {
        otherSimulatedCount++;
        if (sampleOther.length < 5) sampleOther.push(job);
      } else {
        realCount++;
        if (sampleReal.length < 10) sampleReal.push(job);
      }
    });
    
    console.log(`\n=== Job Categories ===`);
    console.log(`- Simulated Local/District Admin jobs: ${districtAdminCount}`);
    console.log(`- Other bulk-generated simulated jobs: ${otherSimulatedCount}`);
    console.log(`- Real / Actual recruitments: ${realCount}`);
    
    console.log('\n--- Sample District Admin Job ---');
    console.log(JSON.stringify(sampleDistrict, null, 2));
    
    console.log('\n--- Sample Other Simulated Job ---');
    console.log(JSON.stringify(sampleOther, null, 2));
    
    console.log('\n--- Sample Real Job ---');
    console.log(JSON.stringify(sampleReal, null, 2));
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
