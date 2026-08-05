const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
    .or('official_website_link.ilike.%india.gov.in%,official_application_link.ilike.%india.gov.in%,official_notification_link.ilike.%india.gov.in%');
    
  if (error) {
    console.error(error);
  } else {
    console.log('Remaining jobs in DB with india.gov.in:');
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
