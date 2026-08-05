const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    console.log('Loading all notifications...');
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*');
      
    if (error) throw error;
    
    console.log(`Total notifications: ${notifications.length}`);
    
    let placeholdersCount = 0;
    const samplePlaceholders = [];
    
    notifications.forEach(n => {
      const msg = n.message || '';
      const lower = msg.toLowerCase();
      if (lower.includes('placeholder') || lower.includes('dummy') || lower.includes('lorem ipsum') || lower.includes('mock') || lower.includes('test notification')) {
        placeholdersCount++;
        if (samplePlaceholders.length < 10) {
          samplePlaceholders.push(n);
        }
      }
    });
    
    console.log(`- Placeholder notifications: ${placeholdersCount}`);
    if (samplePlaceholders.length > 0) {
      console.log('\nSample placeholder notifications:');
      console.log(JSON.stringify(samplePlaceholders, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
