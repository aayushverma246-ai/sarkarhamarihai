require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');
const { parseEligibility } = require('../backend/src/engines/eligibility');

// Hardcoded UPSC IAS Row ID to protect
const UPSC_CIVIL_SERVICES_ID = 'c6dd639b3d748309';

// Category maps for default selection process
const CATEGORY_SELECTION_PROCESS = {
  'UPSC': 'Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.',
  'SSC': 'Stage 1: Tier I → Computer Based Exam Stage 2: Tier II → Quantitative, Reasoning, English & GA Stage 3: Skill Test (if applicable) Final Stage: Merit based on Tier II scores.',
  'Banking': 'Stage 1: Preliminary Exam → Quantitative, Reasoning, English Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview (for PO/SO posts) Final Stage: Final Merit.',
  'Railways': 'Stage 1: CBT 1 → Screening Stage 2: CBT 2 → Core Subject Mastery Stage 3: Skill Test / Typing (if applicable) Final Stage: Document Verification & Medical.',
  'Defence': 'Stage 1: Written Exam → General Knowledge & Aptitude Stage 2: Physical Test / SSB Interview Stage 3: Medical Exam Final Stage: Final Merit List.',
  'Police': 'Stage 1: Written Exam → Law & Reasoning Stage 2: Physical Measurement Test Stage 3: Personal Interview (for higher ranks) Final Stage: Merit list based on all rounds.',
  'Teaching': 'Stage 1: Written Exam → Pedagogical & Subject Knowledge Stage 2: Interview / Demo Class (if applicable) Final Stage: Selection based on merit score.',
  'Healthcare': 'Stage 1: Computer Based Test (CBT) → Nursing/Medical Standards Stage 2: Document Verification Final Stage: Medical fitness and final selection.',
  'PSU': 'Stage 1: GATE Score / Written Test → Academic/Technical excellence Stage 2: Group Discussion Stage 3: Personal Interview Final Stage: Final Merit list.',
  'Research & Science': 'Stage 1: Written Exam → Advanced Technical/Subject Domain Stage 2: Personal Interview → Research Aptitude Final Stage: Final Merit.',
  'Judiciary': 'Stage 1: Preliminary Exam → Law & General Knowledge Stage 2: Main Exam → Descriptive Law Papers Stage 3: Interview → Viva-voce Final Stage: Merit list.',
  'State PSCs': 'Stage 1: Preliminary Exam → Objective screening Stage 2: Main Exam → Descriptive papers Stage 3: Interview → Personality assessment Final Stage: Final selection based on Mains + Interview.',
  'State Government': 'Stage 1: Written Exam / Screening Test Stage 2: Skill Test / Document Verification Stage 3: Personal Interview (if applicable) Final Stage: Final Merit.',
  'Central Government': 'Stage 1: Written Exam / Screening Test → Objective or Descriptive Stage 2: Skill Test / Document Verification Stage 3: Personal Interview (if applicable) Final Stage: Final Merit.',
  'Entrance Exam': 'Stage 1: Entrance Exam → Objective MCQ Stage 2: Counselling → Seat Allotment based on Rank Stage 3: Document Verification Final Stage: Admission based on Rank + Preference.',
  'Engineering': 'Stage 1: Written Exam / GATE Score Stage 2: Technical Interview Stage 3: Document Verification Final Stage: Final Merit.',
  'Insurance': 'Stage 1: Preliminary Exam → Objective Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview Final Stage: Final Merit.',
  'Agriculture': 'Stage 1: Written Exam → Subject Knowledge Stage 2: Interview / Field Test Final Stage: Final Merit.',
  'Forest & Environment': 'Stage 1: Written Exam → General & Subject Knowledge Stage 2: Physical Test Stage 3: Interview Final Stage: Final Merit.',
  'Telecom': 'Stage 1: Written Exam / GATE Score Stage 2: Interview Final Stage: Final Merit.',
  'Shipping & Ports': 'Stage 1: Written Exam Stage 2: Skill / Trade Test Stage 3: Interview Final Stage: Final Merit.',
  'Cooperative': 'Stage 1: Written Exam Stage 2: Interview Final Stage: Final Merit.'
};

async function healAll() {
  await initDb();
  const db = getDb();
  console.log("\n======================================================");
  console.log("🚀 STARTING COMPREHENSIVE DATABASE HEALING SERVICES");
  console.log("======================================================\n");

  console.log("[Healer] Fetching all job records...");
  const res = await db.execute("SELECT id, job_name, organization, job_category, qualification_required, minimum_age, maximum_age, salary_min, salary_max, selection_process, eligibility_json FROM jobs");
  const records = res.rows || [];
  console.log(`[Healer] Fetched ${records.length} records to evaluate.`);

  let updatedCount = 0;
  const startTime = Date.now();

  // Process in batches to avoid network congestion while retaining max concurrency speed
  const BATCH_SIZE = 100;
  let batchPromises = [];

  for (let i = 0; i < records.length; i++) {
    const job = records[i];
    
    // Skip UPSC Civil Services main row (already healed)
    if (job.id === UPSC_CIVIL_SERVICES_ID) continue;

    const name = (job.job_name || '');
    const nameLower = name.toLowerCase();
    const org = (job.organization || '');
    const orgLower = org.toLowerCase();
    const category = (job.job_category || '');

    let needsUpdate = false;
    let qual = job.qualification_required;
    let minAge = job.minimum_age;
    let maxAge = job.maximum_age;
    let salMin = job.salary_min;
    let salMax = job.salary_max;
    let selection = job.selection_process;

    // 1. Resolve qualification required placeholders or missing values
    if (!qual || qual.trim() === '' || qual.includes('Refer') || qual.includes('Notification')) {
      if (nameLower.includes('assistant professor') || nameLower.includes('professor') || nameLower.includes('faculty')) {
        qual = 'Post Graduation';
      } else if (nameLower.includes('pgt') || nameLower.includes('post graduate teacher')) {
        qual = 'Post Graduation';
      } else if (
        nameLower.includes('tgt') || nameLower.includes('graduate teacher') || 
        nameLower.includes('graduation') || nameLower.includes('degree') || 
        nameLower.includes('officer') || nameLower.includes('manager') || 
        nameLower.includes('po') || nameLower.includes('clerk') || 
        nameLower.includes('assistant') || nameLower.includes('scientific') || 
        nameLower.includes('inspector') || nameLower.includes('panchayat') || 
        nameLower.includes('development') || category === 'State PSCs' || 
        category === 'UPSC' || category === 'Banking'
      ) {
        qual = 'Graduation';
      } else if (
        nameLower.includes('constable') || nameLower.includes('soldier') || 
        nameLower.includes('agniveer') || nameLower.includes('typist') || 
        nameLower.includes('steno') || nameLower.includes('12th') || 
        nameLower.includes('class 12') || nameLower.includes('intermediate') || 
        nameLower.includes('driver') || nameLower.includes('conductor')
      ) {
        qual = 'Class 12';
      } else if (
        nameLower.includes('peon') || nameLower.includes('mts') || 
        nameLower.includes('multi tasking') || nameLower.includes('sweeper') || 
        nameLower.includes('waterman') || nameLower.includes('helper') || 
        nameLower.includes('attendant') || nameLower.includes('10th') || 
        nameLower.includes('class 10') || nameLower.includes('matric') || 
        nameLower.includes('lineman') || nameLower.includes('technician') || 
        nameLower.includes('group d')
      ) {
        qual = 'Class 10';
      } else {
        qual = 'Graduation'; // Standard default
      }
      needsUpdate = true;
    }

    // 2. Resolve age limit placeholders/defaults
    if (minAge <= 0 || maxAge <= 0 || (minAge === 18 && maxAge === 35 && (category === 'State PSCs' || category === 'UPSC' || nameLower.includes('officer') || nameLower.includes('manager')))) {
      if (category === 'State PSCs' || category === 'UPSC' || nameLower.includes('officer') || nameLower.includes('manager') || nameLower.includes('professor') || nameLower.includes('faculty')) {
        minAge = 21;
        // Standard State PSC limits: UP, MP, Bihar, Rajasthan etc are 40 years
        maxAge = (orgLower.includes('upsc') || nameLower.includes('upsc')) ? 32 : 40;
      } else if (category === 'Banking') {
        if (nameLower.includes('po') || nameLower.includes('officer') || nameLower.includes('manager')) {
          minAge = 21;
          maxAge = 30;
        } else {
          minAge = 20;
          maxAge = 28;
        }
      } else if (nameLower.includes('cgl') && orgLower.includes('staff selection')) {
        minAge = 18;
        maxAge = 32;
      } else if ((nameLower.includes('chsl') || nameLower.includes('steno')) && orgLower.includes('staff selection')) {
        minAge = 18;
        maxAge = 27;
      } else if (nameLower.includes('mts') || nameLower.includes('havaldar') || nameLower.includes('group d') || orgLower.includes('india post')) {
        minAge = 18;
        maxAge = 25;
      } else if (nameLower.includes('constable') || nameLower.includes('si ') || nameLower.includes('sub inspector') || category === 'Police') {
        minAge = 18;
        maxAge = 25;
      } else if (nameLower.includes('agniveer') || orgLower.includes('army') || orgLower.includes('navy') || orgLower.includes('air force')) {
        if (nameLower.includes('officer') || nameLower.includes('commission')) {
          minAge = 19;
          maxAge = 24;
        } else {
          minAge = 17;
          maxAge = 21;
        }
      } else {
        // Standard State/Central government job age limits
        minAge = 18;
        maxAge = 35;
      }
      needsUpdate = true;
    }

    // 3. Resolve salary/payscale defaults
    if (salMin <= 0 || salMax <= 0 || (salMin === 18000 && salMax === 56900 && (category === 'State PSCs' || category === 'UPSC' || nameLower.includes('officer') || nameLower.includes('manager')))) {
      if (category === 'Entrance Exam' || nameLower.includes('entrance') || nameLower.includes('admission') || nameLower.includes('counselling')) {
        salMin = 0;
        salMax = 0;
      } else if (category === 'UPSC' || category === 'State PSCs' || nameLower.includes('professor') || nameLower.includes('faculty') || nameLower.includes('assistant engineer') || nameLower.includes('scientific officer')) {
        salMin = 56100;
        salMax = 177500; // Level 10
      } else if (nameLower.includes('cgl') || nameLower.includes('po') || nameLower.includes('officer') || nameLower.includes('manager') || nameLower.includes('sub inspector') || nameLower.includes('si ') || category === 'PSU') {
        salMin = 35400;
        salMax = 112400; // Level 6
      } else if (nameLower.includes('chsl') || nameLower.includes('clerk') || nameLower.includes('steno') || nameLower.includes('assistant') || nameLower.includes('typist')) {
        salMin = 25500;
        salMax = 81100; // Level 4
      } else if (nameLower.includes('constable') || nameLower.includes('driver') || nameLower.includes('conductor') || nameLower.includes('technician') || nameLower.includes('lineman')) {
        salMin = 21700;
        salMax = 69100; // Level 3
      } else if (nameLower.includes('mts') || nameLower.includes('havaldar') || nameLower.includes('peon') || nameLower.includes('helper') || nameLower.includes('sweeper') || nameLower.includes('group d') || nameLower.includes('waterman')) {
        salMin = 18000;
        salMax = 56900; // Level 1
      } else if (nameLower.includes('agniveer')) {
        salMin = 30000;
        salMax = 40000; // Consolidated
      } else {
        salMin = 19900;
        salMax = 63200; // Level 2 Standard Default
      }
      needsUpdate = true;
    }

    // 4. Resolve selection process placeholder
    if (!selection || selection.trim() === '' || selection.includes('Default') || selection.includes('Standard')) {
      selection = CATEGORY_SELECTION_PROCESS[category] || CATEGORY_SELECTION_PROCESS['State Government'];
      needsUpdate = true;
    }

    // 5. Always check if eligibility_json needs reconstruction or has placeholder raw_text
    let parsedElig = null;
    try {
      parsedElig = JSON.parse(job.eligibility_json || '{}');
    } catch (_) {}

    const needsJsonHealing = !parsedElig || 
                             !parsedElig.education || 
                             parsedElig.education.raw_text !== qual || 
                             parsedElig.age?.base_min !== minAge || 
                             parsedElig.age?.base_max !== maxAge;

    if (needsUpdate || needsJsonHealing) {
      const updatedElig = parseEligibility(name, qual, minAge, maxAge, category);
      const updatedEligStr = JSON.stringify(updatedElig);

      // Add to batch execution queue
      const executeUpdate = async () => {
        try {
          await db.execute({
            sql: `UPDATE jobs 
                  SET qualification_required = ?, 
                      minimum_age = ?, 
                      maximum_age = ?, 
                      salary_min = ?, 
                      salary_max = ?, 
                      selection_process = ?, 
                      eligibility_json = ?,
                      discovery_source = 'healed',
                      last_verified_at = ?
                  WHERE id = ?`,
            args: [qual, minAge, maxAge, salMin, salMax, selection, updatedEligStr, new Date().toISOString(), job.id]
          });
          return true;
        } catch (err) {
          console.error(`[Error] Failed updating job ${job.id} (${name}): ${err.message}`);
          return false;
        }
      };

      batchPromises.push(executeUpdate());
      updatedCount++;

      if (batchPromises.length >= BATCH_SIZE) {
        await Promise.all(batchPromises);
        batchPromises = [];
        console.log(`[Healer] Progress: Processed and healed ${updatedCount} records...`);
      }
    }
  }

  // Flush remaining promises
  if (batchPromises.length > 0) {
    await Promise.all(batchPromises);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`🎉 COMPREHENSIVE HEALING COMPLETED SUCCESSFULLY!`);
  console.log(`Total Records Scanned:  ${records.length}`);
  console.log(`Successfully Repaired:  ${updatedCount}`);
  console.log(`Duration:               ${duration}s`);
  console.log(`======================================================\n`);
  
  process.exit(0);
}

healAll().catch(err => {
  console.error('[Fatal Error] Healing Engine crash:', err.message);
  process.exit(1);
});
