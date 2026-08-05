const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    console.log('Fetching all jobs to analyze organization link distribution...');
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, organization, official_website_link')
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
    
    const orgs = {};
    allJobs.forEach(job => {
      const org = job.organization || 'UNKNOWN';
      const link = job.official_website_link || '';
      
      if (!orgs[org]) {
        orgs[org] = {
          count: 0,
          links: new Set()
        };
      }
      orgs[org].count++;
      if (link) orgs[org].links.add(link);
    });
    
    const uniqueOrgsCount = Object.keys(orgs).length;
    console.log(`Total unique organizations: ${uniqueOrgsCount}`);
    
    // Sort orgs by job count
    const sortedOrgs = Object.entries(orgs).sort((a, b) => b[1].count - a[1].count);
    
    console.log('\nTop 20 organizations by exam count:');
    sortedOrgs.slice(0, 20).forEach(([name, info]) => {
      console.log(`- ${name}: ${info.count} jobs (Links: ${Array.from(info.links).join(', ') || 'None'})`);
    });
    
    // Categorize links
    let genericCount = 0;
    let specificCount = 0;
    let emptyCount = 0;
    
    sortedOrgs.forEach(([name, info]) => {
      const links = Array.from(info.links);
      if (links.length === 0) {
        emptyCount += info.count;
      } else {
        const isGeneric = links.some(l => l.includes('india.gov.in') || l.includes('dnh.gov.in') || l.includes('andamannicobar.gov.in') || l.includes('lakshadweep.gov.in'));
        if (isGeneric) {
          genericCount += info.count;
        } else {
          specificCount += info.count;
        }
      }
    });
    
    console.log(`\nExam Link Distribution:`);
    console.log(`- Exams with specific/official links: ${specificCount}`);
    console.log(`- Exams with placeholder/generic links: ${genericCount}`);
    console.log(`- Exams with empty links: ${emptyCount}`);
    
  } catch (err) {
    console.error('Error analyzing distribution:', err);
  }
  process.exit(0);
}

run();
