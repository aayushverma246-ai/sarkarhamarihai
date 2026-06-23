require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

// Duplicate mappings: delete ID -> keep ID
const duplicates = {
  '0d9d5ad2077d4eb3': '4e9b4fa6fcdba5ca', // UPSC CAPF AC -> UPSC CAPF Assistant Commandant
  '28050847ef22310b': '4a422dd21dccf807', // UPSC CMS -> UPSC Combined Medical Services CMS
  '8277ea641ec080c8': 'f7a2862b01847a32', // UPSC Geologist Exam -> UPSC Geologist/Geoscientist
  '262a9dcfcb2705e9': '4dd9f9c2cc0d1912', // UPSC IES/ISS -> UPSC IES/ISS Economics Statistics
  '6d4720b5ec901db0': 'fa524fe74694258c', // UPSC Indian Forest Service -> UPSC Indian Forest Service IFoS
  '8c0ba7bc568a85d1': '3106e9bf46d6dadc'  // UPSC NDA I -> UPSC NDA & NA I
};

// Target details for all remaining unique UPSC exams
const upscUpdates = {
  // 1. Civil Services
  'c6dd639b3d748309': {
    job_name: 'UPSC Civil Services (IAS/IPS/IFS) 2026',
    organization: 'UPSC',
    application_start_date: '2026-02-04',
    application_end_date: '2026-02-27',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 32,
    selection_process: 'Stage 1: Preliminary Examination (Objective MCQ Type) → GS Paper I & GS Paper II (CSAT) Stage 2: Main Examination (Descriptive Written Test) → 9 Papers Stage 3: Personality Test (Interview) → Final Evaluation.'
  },
  // 2. CAPF AC
  '4e9b4fa6fcdba5ca': {
    job_name: 'UPSC CAPF Assistant Commandant 2026',
    organization: 'UPSC',
    application_start_date: '2026-02-20',
    application_end_date: '2026-03-12',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 20,
    maximum_age: 25,
    selection_process: 'Stage 1: Written Examination (Paper I: General Ability & Intelligence, Paper II: General Studies, Essay & Comprehension) Stage 2: Physical Standards/Physical Efficiency Tests & Medical Standards Tests Stage 3: Personality Test/Interview.'
  },
  // 3. CDS I
  '561c37adabf30c77': {
    job_name: 'UPSC CDS I 2026',
    organization: 'UPSC',
    application_start_date: '2025-12-10',
    application_end_date: '2025-12-30',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 19,
    maximum_age: 25,
    selection_process: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.'
  },
  // 4. CDS II
  'e6a617de08806874': {
    job_name: 'UPSC CDS II 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-20',
    application_end_date: '2026-06-09',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 19,
    maximum_age: 25,
    selection_process: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.'
  },
  // 5. CISF AC
  '8cae9a2c4f3bd582': {
    job_name: 'UPSC CISF AC (LDCE) 2026',
    organization: 'UPSC',
    application_start_date: '2025-12-03',
    application_end_date: '2025-12-23',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 35,
    selection_process: 'Stage 1: Written Examination (Paper I: Professional Skills & General Ability, Paper II: Essay & Comprehension) Stage 2: Physical Standards/Efficiency & Medical Tests Stage 3: Personality Test / Interview.'
  },
  // 6. CMS
  '4a422dd21dccf807': {
    job_name: 'UPSC Combined Medical Services CMS 2026',
    organization: 'UPSC',
    application_start_date: '2026-03-11',
    application_end_date: '2026-04-01',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'MBBS',
    minimum_age: 21,
    maximum_age: 32,
    selection_process: 'Stage 1: Computer Based Written Examination (Paper I & Paper II) Stage 2: Personality Test (Interview) Stage 3: Document Verification & Medical Standards.'
  },
  // 7. Drug Inspector
  'f953afb06f9b5880': {
    job_name: 'UPSC Drug Inspector 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-12',
    application_end_date: '2026-06-04',
    salary_min: 44900,
    salary_max: 142400,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Written test / Recruitment Test (Objective MCQ) Stage 2: Interview / Personality Test Stage 3: Document Verification.'
  },
  // 8. EO/AO
  '99c141a19c6162f2': {
    job_name: 'UPSC Enforcement Officer/Accounts Officer 2026',
    organization: 'UPSC',
    application_start_date: '2026-10-29',
    application_end_date: '2026-11-28',
    salary_min: 47600,
    salary_max: 151100,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.'
  },
  // 9. ESE
  'd7a743d2769b9897': {
    job_name: 'UPSC Engineering Services (ESE) 2026',
    organization: 'UPSC',
    application_start_date: '2025-09-17',
    application_end_date: '2025-10-08',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Engineering Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Engineering Services Preliminary Examination (Objective) Stage 2: Engineering Services Main Examination (Descriptive) Stage 3: Personality Test (Interview).'
  },
  // 10. EPFO EO/AO
  '3bb30e9fd1b8558f': {
    job_name: 'UPSC EPFO EO/AO 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-23',
    application_end_date: '2026-06-22',
    salary_min: 47600,
    salary_max: 151100,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Recruitment Test (Pen & Paper OMR Based MCQ) Stage 2: Interview.'
  },
  // 11. Geologist/Geoscientist
  'f7a2862b01847a32': {
    job_name: 'UPSC Geologist/Geoscientist 2026',
    organization: 'UPSC',
    application_start_date: '2025-09-04',
    application_end_date: '2025-09-24',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Post Graduation',
    minimum_age: 21,
    maximum_age: 32,
    selection_process: 'Stage 1: Combined Geo-Scientist Preliminary Examination (Objective) Stage 2: Combined Geo-Scientist Main Examination (Descriptive) Stage 3: Personality Test (Interview).'
  },
  // 12. IES/ISS
  '4dd9f9c2cc0d1912': {
    job_name: 'UPSC IES/ISS Economics Statistics 2026',
    organization: 'UPSC',
    application_start_date: '2026-04-15',
    application_end_date: '2026-05-05',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Post Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Written Examination (Descriptive Papers) Stage 2: Viva-Voce (Personality Test).'
  },
  // 13. IFoS
  'fa524fe74694258c': {
    job_name: 'UPSC Indian Forest Service IFoS 2026',
    organization: 'UPSC',
    application_start_date: '2026-02-04',
    application_end_date: '2026-02-27',
    salary_min: 56100,
    salary_max: 177500,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 32,
    selection_process: 'Stage 1: Civil Services Preliminary Exam Stage 2: Indian Forest Service Main Exam (Written Descriptive) Stage 3: Interview/Personality Test.'
  },
  // 14. NDA & NA I
  '3106e9bf46d6dadc': {
    job_name: 'UPSC NDA & NA I 2026',
    organization: 'UPSC',
    application_start_date: '2025-12-18',
    application_end_date: '2026-01-09',
    salary_min: 56100,
    salary_max: 94100,
    qualification_required: 'Class 12',
    minimum_age: 16,
    maximum_age: 19,
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
  },
  // 15. NDA & NA II
  'c93433cec69658a1': {
    job_name: 'UPSC NDA & NA II 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-20',
    application_end_date: '2026-06-09',
    salary_min: 56100,
    salary_max: 94100,
    qualification_required: 'Class 12',
    minimum_age: 16,
    maximum_age: 19,
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
  },
  // 16. NDA III
  '163368cdd871895d': {
    job_name: 'UPSC NDA III 2026',
    organization: 'UPSC',
    application_start_date: '2026-06-06',
    application_end_date: '2026-07-06',
    salary_min: 56100,
    salary_max: 94100,
    qualification_required: 'Class 12',
    minimum_age: 16,
    maximum_age: 19,
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.'
  },
  // 17. SO/Steno CSSS
  '8882fc576e3ac7fd': {
    job_name: 'UPSC SO/Steno Grade D CSSS 2026',
    organization: 'UPSC',
    application_start_date: '2025-09-17',
    application_end_date: '2025-10-08',
    salary_min: 47600,
    salary_max: 151100,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 50,
    selection_process: 'Stage 1: Written Examination (Objective/Descriptive) Stage 2: Evaluation of Service Records.'
  },
  // 18. Assistant Director Scientific Officer
  'adb3209175e4394f': {
    job_name: 'UPSC Assistant Director Scientific Officer 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-30',
    application_end_date: '2026-06-26',
    salary_min: 47600,
    salary_max: 151100,
    qualification_required: 'Post Graduation',
    minimum_age: 21,
    maximum_age: 35,
    selection_process: 'Stage 1: Recruitment Test Stage 2: Interview.'
  },
  // 19. Asst Director Cost Accounts
  '9355acd4df005ced': {
    job_name: 'UPSC Asst Director Cost Accounts 2026',
    organization: 'UPSC',
    application_start_date: '2026-05-17',
    application_end_date: '2026-06-11',
    salary_min: 47600,
    salary_max: 151100,
    qualification_required: 'Graduation',
    minimum_age: 21,
    maximum_age: 30,
    selection_process: 'Stage 1: Recruitment Test Stage 2: Interview.'
  }
};

async function heal() {
  await initDb();
  const db = getDb();
  console.log("--- STARTING UPSC DETAILS HEALING ENGINE ---");

  // Phase 1: Re-route liked_jobs, notifications, roadmaps from duplicate IDs to kept IDs
  for (const [dupId, keepId] of Object.entries(duplicates)) {
    console.log(`Merging references from duplicate job ${dupId} to kept job ${keepId}...`);
    try {
      // 1. liked_jobs: Update job_id (using ON CONFLICT DO NOTHING in application logic since user might have liked both)
      // To handle unique constraint (user_id, job_id) manually:
      const likes = (await db.execute({
        sql: 'SELECT user_id FROM liked_jobs WHERE job_id = ?',
        args: [dupId]
      })).rows || [];
      
      for (const like of likes) {
        try {
          await db.execute({
            sql: 'INSERT INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`like-${like.user_id}-${keepId}`, like.user_id, keepId]
          });
        } catch (e) { /* ignore constraint errors */ }
      }
      await db.execute({ sql: 'DELETE FROM liked_jobs WHERE job_id = ?', args: [dupId] });

      // 2. notifications: Update job_id
      await db.execute({
        sql: 'UPDATE notifications SET job_id = ? WHERE job_id = ?',
        args: [keepId, dupId]
      });

      // 3. roadmaps: Update job_id
      const roadmaps = (await db.execute({
        sql: 'SELECT user_id, roadmap_content FROM roadmaps WHERE job_id = ?',
        args: [dupId]
      })).rows || [];
      for (const r of roadmaps) {
        try {
          await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`roadmap-${r.user_id}-${keepId}`, r.user_id, keepId, r.roadmap_content]
          });
        } catch (e) { /* ignore */ }
      }
      await db.execute({ sql: 'DELETE FROM roadmaps WHERE job_id = ?', args: [dupId] });

      // 4. Finally, delete duplicate job row
      await db.execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [dupId] });
      console.log(`Duplicate ${dupId} successfully merged and deleted.`);
    } catch (err) {
      console.error(`Error merging duplicate ${dupId}:`, err.message);
    }
  }

  // Phase 2: Update all remaining unique UPSC rows with authentic details
  console.log("\nUpdating unique UPSC exam rows with authentic details...");
  const { parseEligibility } = require('../backend/src/engines/eligibility');
  for (const [id, details] of Object.entries(upscUpdates)) {
    console.log(`Updating ${details.job_name} (${id})...`);
    try {
      const { computeFormStatus } = require('../backend/src/engines/validator');
      const form_status = computeFormStatus(details.application_start_date, details.application_end_date);
      
      const updatedElig = parseEligibility(details.job_name, details.qualification_required, details.minimum_age, details.maximum_age, 'UPSC');
      const updatedEligStr = JSON.stringify(updatedElig);

      await db.execute({
        sql: `UPDATE jobs SET 
                job_name = ?,
                organization = ?,
                application_start_date = ?,
                application_end_date = ?,
                salary_min = ?,
                salary_max = ?,
                qualification_required = ?,
                minimum_age = ?,
                maximum_age = ?,
                selection_process = ?,
                form_status = ?,
                eligibility_json = ?,
                discovery_source = 'healed',
                last_verified_at = ?
              WHERE id = ?`,
        args: [
          details.job_name,
          details.organization,
          details.application_start_date,
          details.application_end_date,
          details.salary_min,
          details.salary_max,
          details.qualification_required,
          details.minimum_age,
          details.maximum_age,
          details.selection_process,
          form_status,
          updatedEligStr,
          new Date().toISOString(),
          id
        ]
      });
      console.log(`  [SUCCESS] Updated details for: ${details.job_name}`);
    } catch (err) {
      console.error(`  [FAILED] Failed to update details for ${id}:`, err.message);
    }
  }

  console.log("\n--- UPSC DETAILS HEALING COMPLETED ---");
  process.exit(0);
}

heal().catch(console.error);
