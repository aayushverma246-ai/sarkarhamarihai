/**
 * migrate_to_supabase.js
 *
 * Migrates all data from Turso (libSQL) to Supabase (PostgreSQL) in the correct order.
 * Handles batches, maps fields where necessary, handles different primary keys (onConflict),
 * and handles large tables like jobs efficiently.
 */
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const { createClient: createLibsqlClient } = require('@libsql/client');
require('dotenv').config();

// Turso config
const tursoUrl = process.env.TURSO_DATABASE_URL || '';
const tursoToken = process.env.TURSO_AUTH_TOKEN || '';

// Supabase config
const supabaseUrl = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });
const sb = createSupabaseClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// Batch size for Supabase inserts
const BATCH_SIZE = 200;

async function migrateTable(tableName, onConflictCol = 'id', customMappingFn = null) {
  console.log(`\n----------------------------------------`);
  console.log(`Migrating table: ${tableName} (onConflict: ${onConflictCol})`);
  console.log(`----------------------------------------`);

  try {
    // 1. Fetch all rows from Turso
    const tursoRes = await turso.execute(`SELECT * FROM ${tableName}`);
    const rows = tursoRes.rows;
    console.log(`Fetched ${rows.length} rows from Turso [${tableName}]`);

    if (rows.length === 0) {
      console.log(`Skipping migration for ${tableName} (no rows)`);
      return;
    }

    // 2. Prepare/map rows
    let mappedRows = rows.map(row => {
      // Convert row to plain object
      const obj = { ...row };
      
      // Clean up fields that might be empty strings or invalid formats
      for (const key in obj) {
        if (obj[key] === 'null' || obj[key] === null) {
          obj[key] = null;
        }
      }
      
      if (customMappingFn) {
        return customMappingFn(obj);
      }
      return obj;
    }).filter(Boolean);

    if (mappedRows.length === 0) {
      console.log(`No rows to insert after mapping [${tableName}]`);
      return;
    }

    // 3. Batch upsert into Supabase
    console.log(`Inserting ${mappedRows.length} rows into Supabase [${tableName}] in batches of ${BATCH_SIZE}...`);
    let successfulCount = 0;
    
    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const batch = mappedRows.slice(i, i + BATCH_SIZE);
      const { error } = await sb.from(tableName).upsert(batch, { onConflict: onConflictCol, ignoreDuplicates: false });
      
      if (error) {
        console.error(`❌ Error in batch ${i} - ${i + batch.length} for ${tableName}:`, error.message, error.details);
        // Try individual inserts to see which ones fail or if we can bypass it
        console.log(`Attempting individual inserts for this batch...`);
        for (const item of batch) {
          const { error: singleErr } = await sb.from(tableName).upsert(item, { onConflict: onConflictCol });
          if (singleErr) {
            console.error(`  ❌ Failed row ${onConflictCol}=${item[onConflictCol] || 'N/A'}: ${singleErr.message}`);
          } else {
            successfulCount++;
          }
        }
      } else {
        successfulCount += batch.length;
      }
    }

    console.log(`✅ Completed ${tableName}: Successfully migrated ${successfulCount}/${mappedRows.length} rows.`);
  } catch (err) {
    console.error(`❌ Critical error migrating table ${tableName}:`, err.message);
  }
}

async function migrateReferencedJobs() {
  console.log(`\n----------------------------------------`);
  console.log(`Migrating referenced jobs specifically`);
  console.log(`----------------------------------------`);
  
  try {
    // 1. Gather all referenced job IDs from Turso tables
    const jobIds = new Set();
    
    const liked = await turso.execute('SELECT DISTINCT job_id FROM liked_jobs');
    liked.rows.forEach(r => r.job_id && jobIds.add(r.job_id));
    
    const applied = await turso.execute('SELECT DISTINCT job_id FROM applied_jobs');
    applied.rows.forEach(r => r.job_id && jobIds.add(r.job_id));
    
    const reminders = await turso.execute('SELECT DISTINCT job_id FROM job_reminders');
    reminders.rows.forEach(r => r.job_id && jobIds.add(r.job_id));
    
    const notifs = await turso.execute('SELECT DISTINCT job_id FROM notifications');
    notifs.rows.forEach(r => r.job_id && jobIds.add(r.job_id));
    
    const roadmaps = await turso.execute('SELECT DISTINCT job_id FROM roadmaps');
    roadmaps.rows.forEach(r => r.job_id && jobIds.add(r.job_id));
    
    console.log(`Found ${jobIds.size} unique referenced job IDs.`);
    
    if (jobIds.size === 0) {
      console.log('No referenced jobs to migrate.');
      return;
    }
    
    const jobIdsArr = Array.from(jobIds);
    
    // 2. Fetch only these jobs from Turso and upsert them to Supabase
    // To do this safely and avoid query limit errors, we chunk the IN query or query one-by-one.
    // Since there are very few referenced jobs, we can query them one-by-one or in small chunks.
    let migratedCount = 0;
    
    for (const jobId of jobIdsArr) {
      // Check if job exists in Supabase first
      const { data: existing, error: checkErr } = await sb.from('jobs').select('id').eq('id', jobId).single();
      
      if (!checkErr && existing) {
        // Job already exists in Supabase
        continue;
      }
      
      // Fetch from Turso
      const tursoJobRes = await turso.execute({
        sql: 'SELECT * FROM jobs WHERE id = ?',
        args: [jobId]
      });
      
      if (tursoJobRes.rows.length > 0) {
        const job = { ...tursoJobRes.rows[0] };
        
        // Map allows_final_year_students
        job.allows_final_year_students = job.allows_final_year_students ? 1 : 0;
        
        // Clean nulls
        for (const key in job) {
          if (job[key] === 'null' || job[key] === null) {
            job[key] = null;
          }
        }
        
        const { error: insertErr } = await sb.from('jobs').upsert(job, { onConflict: 'id' });
        if (insertErr) {
          console.error(`❌ Failed to migrate job ${jobId}:`, insertErr.message);
        } else {
          console.log(`✅ Migrated referenced job ${jobId} (${job.job_name})`);
          migratedCount++;
        }
      }
    }
    
    console.log(`Finished jobs migration: Migrated ${migratedCount} missing referenced jobs.`);
  } catch (err) {
    console.error('❌ Error migrating referenced jobs:', err.message);
  }
}

async function main() {
  console.log('=== Starting Complete Turso to Supabase Data Migration ===');

  // 1. Users
  await migrateTable('users', 'id');

  // 2. Jobs - migrate only referenced jobs to avoid "Resource exhausted" limit in Turso
  await migrateReferencedJobs();

  // 3. Liked Jobs
  await migrateTable('liked_jobs', 'id');

  // 4. Applied Jobs
  await migrateTable('applied_jobs', 'id');

  // 5. Job Reminders
  await migrateTable('job_reminders', 'id');

  // 6. Notifications
  await migrateTable('notifications', 'id', (notif) => {
    // Add default values for new columns type and read
    if (notif.type === undefined || notif.type === null) {
      notif.type = 'info';
    }
    if (notif.read === undefined || notif.read === null) {
      notif.read = false;
    }
    // Clean up timestamps if SQLite stored them without timezone
    if (notif.created_at && !notif.created_at.includes('T') && !notif.created_at.includes('+')) {
      notif.created_at = notif.created_at.replace(' ', 'T') + '.000Z';
    }
    return notif;
  });

  // 7. Roadmaps
  await migrateTable('roadmaps', 'id');

  // 8. Tracker Plans
  await migrateTable('tracker_plans', 'id');

  // 9. Tracker User Stats
  await migrateTable('tracker_user_stats', 'user_id');

  // 10. Tracker User Targets
  await migrateTable('tracker_user_targets', 'id');

  // 11. Exam Syllabus (SQLite: name_pattern, Supabase: exam_id)
  await migrateTable('exam_syllabus', 'exam_id', (row) => {
    const newRow = {
      subjects: row.subjects,
      topics: row.topics,
      exam_id: row.name_pattern // map name_pattern to exam_id
    };
    return newRow;
  });

  // 12. AI Recommendations
  await migrateTable('ai_recommendations', 'id');

  // 13. Tracker Sessions (dependent on tracker_plans)
  await migrateTable('tracker_sessions', 'id');

  // 14. Seed Meta
  await migrateTable('seed_meta', 'key');

  console.log('\n=== Migration Completed ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
