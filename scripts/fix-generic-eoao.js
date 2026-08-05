const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const targetId = '99c141a19c6162f2';
    const correctProcess = "Stage 1: Recruitment Test (RT) - Pen & Paper based offline exam (Objective MCQ, GS & Aptitude, 75% weightage)\nStage 2: Personal Interview (25% weightage)\nFinal Stage: Final Selection based on composite score of RT + Interview.";
    
    console.log(`Updating selection process for UPSC EO/AO (ID: ${targetId})...`);
    
    const { error } = await supabase
      .from('jobs')
      .update({
        selection_process: correctProcess,
        last_verified_at: new Date().toISOString()
      })
      .eq('id', targetId);
      
    if (error) throw error;
    
    console.log('🎉 Successfully updated!');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
