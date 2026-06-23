const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  try {
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .in('job_category', ['State PSCs', 'UPSC'])
      .in('form_status', ['LIVE', 'UPCOMING', 'RECENTLY_CLOSED']);

    if (error) throw error;
    console.log('Total active State PSCs or UPSC jobs in DB:', count);

    // Let's list their names and form statuses
    const { data: jobs, error: err2 } = await supabase
      .from('jobs')
      .select('job_name, form_status')
      .in('job_category', ['State PSCs', 'UPSC'])
      .in('form_status', ['LIVE', 'UPCOMING', 'RECENTLY_CLOSED']);
      
    if (err2) throw err2;
    console.log('Jobs list:');
    jobs.forEach(j => console.log(` - ${j.job_name} [${j.form_status}]`));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
