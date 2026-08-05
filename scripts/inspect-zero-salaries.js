const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, job_name, organization, qualification_required, salary_min, salary_max, official_website_link')
      .in('form_status', ['LIVE', 'UPCOMING'])
      .eq('salary_min', 0)
      .eq('salary_max', 0)
      .limit(10);
      
    if (error) throw error;
    
    console.log('Sample of active jobs with zero salary:');
    console.log(JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
