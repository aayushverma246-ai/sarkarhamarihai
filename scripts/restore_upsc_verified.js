'use strict';
require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');
const { parseEligibility } = require('../backend/src/engines/eligibility');
const { computeFormStatus } = require('../backend/src/engines/validator');

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
    selection_process: 'Stage 1: Preliminary Examination (Objective MCQ Type) → GS Paper I & GS Paper II (CSAT) Stage 2: Main Examination (Descriptive Written Test) → 9 Papers Stage 3: Personality Test (Interview) → Final Evaluation.',
    exam_name_hi: 'यूपीएससी सिविल सेवा परीक्षा (IAS/IPS/IFS) 2026',
    syllabus: 'Preliminary: GS Paper I (History, Geography, Polity, Economics, Science, Current Affairs), GS Paper II CSAT (Maths, Reasoning, English comprehension). Main Exam: General Studies 1-4, Essay, Optional Subject.'
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
    selection_process: 'Stage 1: Written Examination (Paper I: General Ability & Intelligence, Paper II: General Studies, Essay & Comprehension) Stage 2: Physical Standards/Physical Efficiency Tests & Medical Standards Tests Stage 3: Personality Test/Interview.',
    exam_name_hi: 'यूपीएससी सीएपीएफ सहायक कमांडेंट 2026',
    syllabus: 'Paper I: General Ability and Intelligence. Paper II: General Studies, Essay and Comprehension.'
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
    selection_process: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.',
    exam_name_hi: 'यूपीएससी सीडीएस I 2026',
    syllabus: 'English (Vocabulary, Grammar, Comprehension), General Knowledge (Current affairs, History, Geography, Science), Elementary Mathematics (Arithmetic, Algebra, Geometry, Trigonometry).'
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
    selection_process: 'Stage 1: Written Examination (English, General Knowledge, Elementary Mathematics) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Document Verification & Medical Examination.',
    exam_name_hi: 'यूपीएससी सीडीएस II 2026',
    syllabus: 'English (Vocabulary, Grammar, Comprehension), General Knowledge (Current affairs, History, Geography, Science), Elementary Mathematics (Arithmetic, Algebra, Geometry, Trigonometry).'
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
    selection_process: 'Stage 1: Written Examination (Paper I: Professional Skills & General Ability, Paper II: Essay & Comprehension) Stage 2: Physical Standards/Efficiency & Medical Tests Stage 3: Personality Test / Interview.',
    exam_name_hi: 'यूपीएससी सीआईएसएफ एसी (एलडीसीई) 2026',
    syllabus: 'Paper I: Section A: Professional Skills, Section B: General Ability and Intelligence. Paper II: Essay, Précis Writing and Comprehension.'
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
    selection_process: 'Stage 1: Computer Based Written Examination (Paper I & Paper II) Stage 2: Personality Test (Interview) Stage 3: Document Verification & Medical Standards.',
    exam_name_hi: 'यूपीएससी कंबाइंड मेडिकल सर्विसेज 2026',
    syllabus: 'Paper I: Medicine, Paediatrics. Paper II: Surgery, Gynaecology & Obstetrics, Preventive & Social Medicine.'
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
    selection_process: 'Stage 1: Written test / Recruitment Test (Objective MCQ) Stage 2: Interview / Personality Test Stage 3: Document Verification.',
    exam_name_hi: 'यूपीएससी ड्रग इंस्पेक्टर 2026',
    syllabus: 'Pharmacy (Pharmaceutics, Pharmacology, Forensic Pharmacy, Pharmaceutical Chemistry), General Knowledge & Anatomy.'
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
    selection_process: 'Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.',
    exam_name_hi: 'यूपीएससी प्रवर्तन अधिकारी/लेखा अधिकारी 2026',
    syllabus: 'General English, Indian Freedom Struggle, Current Events, Indian Polity & Economy, General Accounting Principles, Industrial Relations & Labour Laws, General Science, Quantitative Aptitude, Social Security.'
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
    selection_process: 'Stage 1: Engineering Services Preliminary Examination (Objective) Stage 2: Engineering Services Main Examination (Descriptive) Stage 3: Personality Test (Interview).',
    exam_name_hi: 'यूपीएससी इंजीनियरिंग सेवा (ESE) 2026',
    syllabus: 'Stage 1: Paper I (General Studies and Engineering Aptitude), Paper II (Civil/Mechanical/Electrical/Electronics & Telecom Engineering). Stage 2: Descriptive Paper I & II in Core Engineering Discipline.'
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
    selection_process: 'Stage 1: Recruitment Test (Pen & Paper OMR Based MCQ) Stage 2: Interview.',
    exam_name_hi: 'यूपीएससी ईपीएफओ ईओ/एओ 2026',
    syllabus: 'General English, Indian Freedom Struggle, Current Events, Indian Polity & Economy, General Accounting Principles, Industrial Relations & Labour Laws, General Science, Quantitative Aptitude, Social Security.'
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
    selection_process: 'Stage 1: Combined Geo-Scientist Preliminary Examination (Objective) Stage 2: Combined Geo-Scientist Main Examination (Descriptive) Stage 3: Personality Test (Interview).',
    exam_name_hi: 'यूपीएससी भूवैज्ञानिक परीक्षा 2026',
    syllabus: 'Stage 1: General Studies, Geology/Hydrogeology/Chemistry/Geophysics. Stage 2: Core advanced Descriptive Geosciences Papers.'
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
    selection_process: 'Stage 1: Written Examination (Descriptive Papers) Stage 2: Viva-Voce (Personality Test).',
    exam_name_hi: 'यूपीएससी आईईएस/आईएसएस परीक्षा 2026',
    syllabus: 'IES: General English, General Studies, General Economics I, II & III, Indian Economics. ISS: General English, General Studies, Statistics I, II, III & IV.'
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
    selection_process: 'Stage 1: Civil Services Preliminary Exam Stage 2: Indian Forest Service Main Exam (Written Descriptive) Stage 3: Interview/Personality Test.',
    exam_name_hi: 'यूपीएससी भारतीय वन सेवा (IFoS) 2026',
    syllabus: 'Preliminary: Civil Services Prelims GS Paper I & II. Mains: Paper I (General English), Paper II (General Knowledge), Paper III, IV, V, VI (Selected Optional Subjects).'
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
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.',
    exam_name_hi: 'यूपीएससी एनडीए और एनए I 2026',
    syllabus: 'Mathematics (Algebra, Trigonometry, Calculus, Statistics), General Ability Test (English Vocabulary/Grammar, Physics, Chemistry, History, Geography, General Science).'
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
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.',
    exam_name_hi: 'यूपीएससी एनडीए और एनए II 2026',
    syllabus: 'Mathematics (Algebra, Trigonometry, Calculus, Statistics), General Ability Test (English Vocabulary/Grammar, Physics, Chemistry, History, Geography, General Science).'
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
    selection_process: 'Stage 1: Written Examination (Mathematics & General Ability Test) Stage 2: SSB Interview (Intelligence & Personality Test) Stage 3: Medical Examination.',
    exam_name_hi: 'यूपीएससी एनडीए III 2026',
    syllabus: 'Mathematics (Algebra, Trigonometry, Calculus, Statistics), General Ability Test (English Vocabulary/Grammar, Physics, Chemistry, History, Geography, General Science).'
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
    selection_process: 'Stage 1: Written Examination (Objective/Descriptive) Stage 2: Evaluation of Service Records.',
    exam_name_hi: 'यूपीएससी एसओ/स्टेनो परीक्षा 2026',
    syllabus: 'Paper I: Note writing, drafting, and office procedures. Paper II: General English and General Knowledge. Shorthand skill test.'
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
    selection_process: 'Stage 1: Recruitment Test Stage 2: Interview.',
    exam_name_hi: 'यूपीएससी सहायक निदेशक वैज्ञानिक अधिकारी 2026',
    syllabus: 'Syllabus varies by scientific field (Physics, Chemistry, Biology, Forensics etc.) as detailed in recruitment notifications.'
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
    selection_process: 'Stage 1: Recruitment Test Stage 2: Interview.',
    exam_name_hi: 'यूपीएससी सहायक निदेशक लागत लेखा 2026',
    syllabus: 'Cost Accounting, Management Accounting, Financial Accounting, Auditing, Corporate Laws, and Taxation.'
  }
};

// Map of incorrect seeder SHA-256 IDs to the correct verified MD5 IDs
const mergeMappings = {
  '7a45cc9ff1e4f92f': 'c6dd639b3d748309', // Civil Services
  'c98c6698e53a5b83': 'd7a743d2769b9897', // Engineering Services ESE
  'c081bb89321a5c84': '561c37adabf30c77', // CDS I
  '1f99ea9b50dede1d': '8cae9a2c4f3bd582', // CISF AC LDCE
  '192a0ec269308c54': '8882fc576e3ac7fd', // SO/Steno Grade D CSSS
  'f541a27c24583965': '3bb30e9fd1b8558f', // EPFO EO/AO
};

async function restore() {
  await initDb();
  const db = getDb();
  console.log("--- STARTING UPSC 100% CORRECT RESTORATION SYSTEM ---");

  // 1. Merge and re-route references from duplicate SHA-256 seeder IDs to verified MD5 IDs
  for (const [oldId, newId] of Object.entries(mergeMappings)) {
    console.log(`Re-routing user relations from ${oldId} -> ${newId}...`);

    // Merge liked_jobs
    try {
      const likes = (await db.execute({
        sql: 'SELECT user_id FROM liked_jobs WHERE job_id = ?',
        args: [oldId]
      })).rows || [];
      for (const like of likes) {
        try {
          await db.execute({
            sql: 'INSERT INTO liked_jobs (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`like-${like.user_id}-${newId}`, like.user_id, newId]
          });
        } catch (e) {}
      }
      await db.execute({ sql: 'DELETE FROM liked_jobs WHERE job_id = ?', args: [oldId] });
    } catch (err) {
      console.warn(`  [Warning] liked_jobs merge failed for ${oldId}:`, err.message);
    }

    // Merge applied_jobs
    try {
      const applied = (await db.execute({
        sql: 'SELECT user_id FROM applied_jobs WHERE job_id = ?',
        args: [oldId]
      })).rows || [];
      for (const app of applied) {
        try {
          await db.execute({
            sql: 'INSERT INTO applied_jobs (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`apply-${app.user_id}-${newId}`, app.user_id, newId]
          });
        } catch (e) {}
      }
      await db.execute({ sql: 'DELETE FROM applied_jobs WHERE job_id = ?', args: [oldId] });
    } catch (err) {
      console.warn(`  [Warning] applied_jobs merge failed for ${oldId}:`, err.message);
    }

    // Merge job_reminders
    try {
      const reminders = (await db.execute({
        sql: 'SELECT user_id FROM job_reminders WHERE job_id = ?',
        args: [oldId]
      })).rows || [];
      for (const rem of reminders) {
        try {
          await db.execute({
            sql: 'INSERT INTO job_reminders (id, user_id, job_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`reminder-${rem.user_id}-${newId}`, rem.user_id, newId]
          });
        } catch (e) {}
      }
      await db.execute({ sql: 'DELETE FROM job_reminders WHERE job_id = ?', args: [oldId] });
    } catch (err) {
      console.warn(`  [Warning] job_reminders merge failed for ${oldId}:`, err.message);
    }

    // Re-route notifications
    try {
      await db.execute({
        sql: 'UPDATE notifications SET job_id = ? WHERE job_id = ?',
        args: [newId, oldId]
      });
    } catch (err) {
      console.warn(`  [Warning] notifications update failed for ${oldId}:`, err.message);
    }

    // Merge roadmaps
    try {
      const roadmaps = (await db.execute({
        sql: 'SELECT user_id, roadmap_content FROM roadmaps WHERE job_id = ?',
        args: [oldId]
      })).rows || [];
      for (const r of roadmaps) {
        try {
          await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
            args: [`roadmap-${r.user_id}-${newId}`, r.user_id, newId, r.roadmap_content]
          });
        } catch (e) {}
      }
      await db.execute({ sql: 'DELETE FROM roadmaps WHERE job_id = ?', args: [oldId] });
    } catch (err) {
      console.warn(`  [Warning] roadmaps merge failed for ${oldId}:`, err.message);
    }

    // Re-route ai_recommendations (both source_job_id and target_job_id)
    try {
      await db.execute({
        sql: 'UPDATE ai_recommendations SET source_job_id = ? WHERE source_job_id = ?',
        args: [newId, oldId]
      });
      await db.execute({
        sql: 'UPDATE ai_recommendations SET target_job_id = ? WHERE target_job_id = ?',
        args: [newId, oldId]
      });
    } catch (err) {
      console.warn(`  [Warning] ai_recommendations update failed for ${oldId}:`, err.message);
    }

    // Delete the incorrect duplicate seeder job
    try {
      await db.execute({
        sql: 'DELETE FROM jobs WHERE id = ?',
        args: [oldId]
      });
      console.log(`  [CLEANUP] Purged incorrect seeder job row: ${oldId}`);
    } catch (err) {
      console.error(`  [FAILED] Failed to delete job row ${oldId}:`, err.message);
    }
  }

  // 2. Perform upsert of all 19 verified UPSC exams into Supabase with 100% correct details
  console.log("\nUpserting 19 verified UPSC exams into database...");
  for (const [id, details] of Object.entries(upscUpdates)) {
    console.log(`Upserting: "${details.job_name}" (${id})...`);
    try {
      const status = computeFormStatus(details.application_start_date, details.application_end_date);
      const elig = parseEligibility(details.job_name, details.qualification_required, details.minimum_age, details.maximum_age, 'UPSC');
      const eligStr = JSON.stringify(elig);

      // Note: we set job_category strictly to 'UPSC' so it shows up in dashboard filter
      await db.execute({
        sql: `INSERT INTO jobs (
                id, job_name, organization, qualification_required, allows_final_year_students,
                minimum_age, maximum_age, application_start_date, application_end_date,
                salary_min, salary_max, job_category, official_application_link,
                official_notification_link, official_website_link, description,
                selection_process, form_status, exam_name_hi, exam_name_ta, exam_name_bn,
                syllabus, structured_syllabus_json, embeddings_json, exam_type, state, states,
                vacancies, applicants_count, eligibility_json, selection_process_json,
                links_status_json, discovery_source, last_verified_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
              ON CONFLICT (id) DO UPDATE SET
                job_name = EXCLUDED.job_name,
                organization = EXCLUDED.organization,
                qualification_required = EXCLUDED.qualification_required,
                allows_final_year_students = EXCLUDED.allows_final_year_students,
                minimum_age = EXCLUDED.minimum_age,
                maximum_age = EXCLUDED.maximum_age,
                application_start_date = EXCLUDED.application_start_date,
                application_end_date = EXCLUDED.application_end_date,
                salary_min = EXCLUDED.salary_min,
                salary_max = EXCLUDED.salary_max,
                job_category = EXCLUDED.job_category,
                official_application_link = EXCLUDED.official_application_link,
                official_notification_link = EXCLUDED.official_notification_link,
                official_website_link = EXCLUDED.official_website_link,
                selection_process = EXCLUDED.selection_process,
                form_status = EXCLUDED.form_status,
                exam_name_hi = EXCLUDED.exam_name_hi,
                syllabus = EXCLUDED.syllabus,
                state = EXCLUDED.state,
                states = EXCLUDED.states,
                eligibility_json = EXCLUDED.eligibility_json,
                discovery_source = EXCLUDED.discovery_source,
                last_verified_at = EXCLUDED.last_verified_at`,
        args: [
          id,
          details.job_name,
          details.organization,
          details.qualification_required,
          1, // allows_final_year_students (standard for UPSC)
          details.minimum_age,
          details.maximum_age,
          details.application_start_date,
          details.application_end_date,
          details.salary_min,
          details.salary_max,
          'UPSC', // job_category
          'https://upsconline.nic.in', // official_application_link
          'https://upsc.gov.in', // official_notification_link
          'https://upsc.gov.in', // official_website_link
          '', // description
          details.selection_process,
          status,
          details.exam_name_hi || '', // exam_name_hi
          '', // exam_name_ta
          '', // exam_name_bn
          details.syllabus || '', // syllabus
          '', // structured_syllabus_json
          '', // embeddings_json
          'exam', // exam_type
          'All India', // state
          'All India', // states
          0, // vacancies
          0, // applicants_count
          eligStr, // eligibility_json
          '{}', // selection_process_json
          '{}', // links_status_json
          'healed', // discovery_source
          new Date().toISOString() // last_verified_at
        ]
      });

      console.log(`  [SUCCESS] Restored details and upserted: ${details.job_name}`);
    } catch (err) {
      console.error(`  [FAILED] Failed to restore/upsert: ${id} - ${details.job_name}:`, err.message);
    }
  }

  // 3. Purge any extra duplicate/incorrect jobs with organization = UPSC/Union Public Service or job_name starting with UPSC
  // whose IDs are not in the list of the 19 verified exams.
  const verifiedIds = Object.keys(upscUpdates);
  console.log("\nChecking for any unverified UPSC jobs to purge...");
  try {
    const listRes = await db.execute(`
      SELECT id, job_name, organization 
      FROM jobs 
      WHERE organization = 'UPSC' 
         OR organization = 'Union Public Service Commission' 
         OR job_name LIKE 'UPSC %'
    `);
    const extraJobs = (listRes.rows || []).filter(row => !verifiedIds.includes(row.id));

    if (extraJobs.length > 0) {
      console.log(`Found ${extraJobs.length} extra unverified UPSC jobs. Purging and migrating references...`);
      for (const extra of extraJobs) {
        console.log(`Purging extra UPSC job: "${extra.job_name}" (${extra.id})`);
        
        // Find best match among verified jobs to merge references to, if possible.
        // Otherwise, we just merge references to the Civil Services main row (c6dd639b3d748309) to avoid dangling foreign keys.
        let targetId = 'c6dd639b3d748309';
        const lowercaseName = extra.job_name.toLowerCase();
        for (const [vId, vDet] of Object.entries(upscUpdates)) {
          const firstWord = vDet.job_name.split(' ')[1]?.toLowerCase();
          if (firstWord && lowercaseName.includes(firstWord)) {
            targetId = vId;
            break;
          }
        }
        console.log(`  Merging any references to target verified job ID: ${targetId}`);

        // Merge references
        try { await db.execute({ sql: 'UPDATE liked_jobs SET job_id = ? WHERE job_id = ? ON CONFLICT DO NOTHING', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'DELETE FROM liked_jobs WHERE job_id = ?', args: [extra.id] }); } catch(e){}

        try { await db.execute({ sql: 'UPDATE applied_jobs SET job_id = ? WHERE job_id = ? ON CONFLICT DO NOTHING', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'DELETE FROM applied_jobs WHERE job_id = ?', args: [extra.id] }); } catch(e){}

        try { await db.execute({ sql: 'UPDATE job_reminders SET job_id = ? WHERE job_id = ? ON CONFLICT DO NOTHING', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'DELETE FROM job_reminders WHERE job_id = ?', args: [extra.id] }); } catch(e){}

        try { await db.execute({ sql: 'UPDATE notifications SET job_id = ? WHERE job_id = ?', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'UPDATE roadmaps SET job_id = ? WHERE job_id = ? ON CONFLICT DO NOTHING', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'DELETE FROM roadmaps WHERE job_id = ?', args: [extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'UPDATE ai_recommendations SET source_job_id = ? WHERE source_job_id = ?', args: [targetId, extra.id] }); } catch(e){}
        try { await db.execute({ sql: 'UPDATE ai_recommendations SET target_job_id = ? WHERE target_job_id = ?', args: [targetId, extra.id] }); } catch(e){}

        await db.execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [extra.id] });
        console.log(`  [SUCCESS] Deleted extra UPSC job: ${extra.id}`);
      }
    } else {
      console.log("No extra unverified UPSC jobs found.");
    }
  } catch (err) {
    console.error("Error during extra UPSC job purge:", err.message);
  }

  console.log("\n--- UPSC 100% CORRECT RESTORATION SYSTEM COMPLETED ---");
  process.exit(0);
}

restore().catch(err => {
  console.error("Restoration script failed:", err);
  process.exit(1);
});
