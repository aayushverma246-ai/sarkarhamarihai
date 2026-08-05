const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, official_application_link, official_website_link, official_notification_link');
      
    if (error) throw error;
    
    let malformedCount = 0;
    const examples = [];
    
    data.forEach(job => {
      const app = job.official_application_link || '';
      const web = job.official_website_link || '';
      const notif = job.official_notification_link || '';
      
      const isMalformed = (str) => str.includes('&') || str.includes(' ') || str.includes('%');
      
      if (isMalformed(app) || isMalformed(web) || isMalformed(notif)) {
        malformedCount++;
        if (examples.length < 10) {
          examples.push({ id: job.id, app, web, notif });
        }
      }
    });
    
    console.log(`\nMalformed URLs remaining in the DB: ${malformedCount}`);
    if (malformedCount > 0) {
      console.log('Examples:');
      examples.forEach(ex => {
        console.log(`- Job ${ex.id}:`);
        console.log(`    App Link:  "${ex.app}"`);
        console.log(`    Web Link:  "${ex.web}"`);
        console.log(`    Notif Link: "${ex.notif}"`);
      });
    } else {
      console.log('🎉 100% of malformed links with invalid characters have been successfully corrected!');
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
