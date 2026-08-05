const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    console.log('Querying all public tables...');
    // We can list tables via rpc or simple queries. Let's do simple select queries.
    const tables = ['jobs', 'liked_jobs', 'roadmaps', 'notifications', 'user_notifications', 'users', 'ai_recommendations'];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(`Table "${table}": Error / Not available: ${error.message}`);
      } else {
        console.log(`Table "${table}": ${count} records`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
