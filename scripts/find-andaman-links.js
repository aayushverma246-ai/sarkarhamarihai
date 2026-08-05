const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
      .or('official_website_link.ilike.%andaman.gov.in%,official_application_link.ilike.%andaman.gov.in%,official_notification_link.ilike.%andaman.gov.in%');
      
    if (error) throw error;
    
    console.log(`Jobs containing andaman.gov.in: ${data.length}`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
