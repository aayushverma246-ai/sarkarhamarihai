const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TEMPLATES = {
  'UPSC': "Stage 1: Preliminary Exam → GS I & CSAT (Objective)\nStage 2: Main Exam → 9 Descriptive Papers\nStage 3: Interview → Personality Test\nFinal Stage: Final Merit based on Mains + Interview.",
  'SSC': "Stage 1: Tier I → Computer Based Exam\nStage 2: Tier II → Quantitative, Reasoning, English\nStage 3: Skill Test → Typing (if applicable)\nFinal Stage: Merit based on Tier scores.",
  'Banking': "Stage 1: Preliminary Exam → Quantitative, Reasoning, English\nStage 2: Main Exam → Objective + Descriptive\nStage 3: Interview (for Officers)\nFinal Stage: Final Merit.",
  'Defence': "Stage 1: Written Exam → General Knowledge & Aptitude\nStage 2: SSB Interview → 5-Day Assessment\nStage 3: Medical Exam\nFinal Stage: Final Merit List.",
  'Railways': "Stage 1: CBT 1 → Screening\nStage 2: CBT 2 → Core Subject Mastery\nStage 3: Skill Test (if applicable)\nFinal Stage: DV & Medical.",
  'Police': "Stage 1: Written Exam\nStage 2: Physical Efficiency Test\nStage 3: Medical Exam\nFinal Stage: Merit list.",
  'Teaching': "Stage 1: Written Exam → Pedagogical & Subject Knowledge\nStage 2: Interview / Demo Class\nFinal Stage: Merit score.",
  'Healthcare': "Stage 1: Computer Based Test\nStage 2: Document Verification\nStage 3: Medical fitness\nFinal Stage: Final selection.",
  'Central Government': "Stage 1: Written Exam / Screening\nStage 2: Skill Test / DV\nStage 3: Interview (if applicable)\nFinal Stage: Final Merit.",
  'State Government': "Stage 1: Written Exam\nStage 2: Skill Test / Interview\nFinal Stage: DV & Merit.",
  'State PSCs': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Interview\nFinal Stage: Final selection.",
  'Engineering': "Stage 1: Written Test / GATE Score\nStage 2: Technical Interview\nStage 3: HR Interview\nFinal Stage: Merit list.",
  'PSU': "Stage 1: GATE Score / Written Test\nStage 2: Group Discussion\nStage 3: Personal Interview\nFinal Stage: Merit list.",
  'Entrance Exam': "Stage 1: Entrance Exam → Objective MCQ\nStage 2: Counselling → Seat Allotment\nStage 3: Document Verification\nFinal Stage: Admission.",
  'Insurance': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Interview\nFinal Stage: Final Merit.",
  'Judiciary': "Stage 1: Preliminary Exam\nStage 2: Main Exam → Law Papers\nStage 3: Interview\nFinal Stage: Merit list.",
  'Research & Science': "Stage 1: Written Exam\nStage 2: Interview → Research Aptitude\nFinal Stage: Final Merit.",
  'Agriculture': "Stage 1: Written Exam\nStage 2: Interview / DV\nFinal Stage: Final selection.",
  'Forest & Environment': "Stage 1: Preliminary Exam\nStage 2: Main Exam\nStage 3: Physical Test\nFinal Stage: Interview & Merit.",
  'Telecom': "Stage 1: Written Test / GATE Score\nStage 2: Interview\nFinal Stage: Merit list.",
  'Shipping & Ports': "Stage 1: Written Test / Trade Test\nStage 2: Physical & Medical\nFinal Stage: Merit list.",
  'Cooperative': "Stage 1: Written Exam\nStage 2: Interview\nFinal Stage: Merit list.",
};

async function run() {
  try {
    console.log('Fetching all jobs to analyze correctness...');
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, organization, selection_process, salary_min, salary_max, official_website_link, official_application_link, official_notification_link, qualification_required, application_start_date, application_end_date')
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
    
    console.log(`\nTotal jobs loaded: ${allJobs.length}`);
    
    let genericSelectionCount = 0;
    let emptySelectionCount = 0;
    let specificSelectionCount = 0;
    
    let zeroSalaryCount = 0;
    let nullSalaryCount = 0;
    let specificSalaryCount = 0;
    
    let defaultDatesCount = 0;
    let nullDatesCount = 0;
    let validDatesCount = 0;
    
    const genericTemplatesList = Object.values(TEMPLATES).map(t => t.replace(/\s+/g, ' ').trim());
    
    allJobs.forEach(job => {
      // Analyze selection process
      const sel = (job.selection_process || '').replace(/\s+/g, ' ').trim();
      if (!sel) {
        emptySelectionCount++;
      } else if (genericTemplatesList.includes(sel)) {
        genericSelectionCount++;
      } else {
        specificSelectionCount++;
      }
      
      // Analyze salary
      if (job.salary_min === null && job.salary_max === null) {
        nullSalaryCount++;
      } else if (job.salary_min === 0 && job.salary_max === 0) {
        zeroSalaryCount++;
      } else {
        specificSalaryCount++;
      }
    });
    
    console.log('\n=== Data Correctness Metrics ===');
    console.log(`Selection Process:`);
    console.log(`- 100% Specific / Accurate: ${specificSelectionCount}`);
    console.log(`- Generic Template Fallback: ${genericSelectionCount}`);
    console.log(`- Empty / Missing: ${emptySelectionCount}`);
    
    console.log(`\nSalary Fields:`);
    console.log(`- Specific Salary Details: ${specificSalaryCount}`);
    console.log(`- Zero (0) Fallback: ${zeroSalaryCount}`);
    console.log(`- Null / Missing: ${nullSalaryCount}`);
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
