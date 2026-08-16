const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Fixing JSSC link...');
  const { data, error } = await supabase.from('jobs')
    .update({
      official_website_link: 'https://jssc.nic.in',
      official_application_link: 'https://jssc.nic.in',
      official_notification_link: 'https://jssc.nic.in'
    })
    .ilike('official_website_link', '%jsscofficial.com%');
    
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('JSSC link successfully updated to https://jssc.nic.in!');
  }
}
run();
