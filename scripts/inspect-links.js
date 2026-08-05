const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, organization, official_application_link')
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
    
    const placeholderOrgs = {};
    const genericDomains = [
      'india.gov.in',
      'careers.india.gov.in',
      'apprenticeshipindia.org',
      'metro.gov.in',
      'mha.gov.in',
      'dnh.gov.in',
      'andamannicobar.gov.in'
    ];
    
    allJobs.forEach(job => {
      const link = job.official_application_link || '';
      const isPlaceholder = genericDomains.some(domain => link.includes(domain));
      if (isPlaceholder) {
        placeholderOrgs[job.organization] = (placeholderOrgs[job.organization] || 0) + 1;
      }
    });
    
    console.log(`Found ${Object.keys(placeholderOrgs).length} unique organizations with placeholder/generic links:`);
    Object.entries(placeholderOrgs).sort((a, b) => b[1] - a[1]).forEach(([org, count]) => {
      console.log(`- ${org}: ${count} jobs`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

run();
