const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    console.log('Loading all jobs...');
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, syllabus')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allJobs.push(...data);
        page++;
        if (data.length < pageSize) hasMore = false;
      }
    }
    
    console.log(`Total jobs loaded: ${allJobs.length}`);
    
    let hasSyllabusCount = 0;
    let emptySyllabusCount = 0;
    let placeholderSyllabusCount = 0;
    
    const samplePlaceholders = [];
    
    allJobs.forEach(job => {
      const syllabus = job.syllabus;
      if (!syllabus) {
        emptySyllabusCount++;
      } else {
        hasSyllabusCount++;
        const lower = JSON.stringify(syllabus).toLowerCase();
        if (lower.includes('placeholder') || lower.includes('generic') || lower.includes('lorem ipsum')) {
          placeholderSyllabusCount++;
          if (samplePlaceholders.length < 5) {
            samplePlaceholders.push(job);
          }
        }
      }
    });
    
    console.log(`\n=== Syllabus Analysis ===`);
    console.log(`- Jobs with syllabus: ${hasSyllabusCount}`);
    console.log(`- Jobs with empty/null syllabus: ${emptySyllabusCount}`);
    console.log(`- Jobs with generic/placeholder syllabus: ${placeholderSyllabusCount}`);
    
    if (samplePlaceholders.length > 0) {
      console.log('\nSample generic/placeholder syllabi:');
      console.log(JSON.stringify(samplePlaceholders, null, 2));
    }
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
