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
    .eq('organization', 'Arunachal Pradesh Local / District Admin')
    .limit(5);
    
  if (error) {
    console.error(error);
  } else {
    console.log('Arunachal Pradesh Jobs in DB:');
    console.log(data);
  }
  
  const { data: data2 } = await supabase
    .from('jobs')
    .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
    .eq('organization', 'Meghalaya Local / District Admin')
    .limit(5);
    
  console.log('Meghalaya Jobs in DB:');
  console.log(data2);
}

run();
