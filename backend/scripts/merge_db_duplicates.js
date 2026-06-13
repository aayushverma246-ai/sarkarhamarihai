'use strict';

require('dotenv').config();
const { getSupabase } = require('../src/db');
const { generateFingerprint, richnessScore } = require('../src/engines/deduplicator');

async function mergeDuplicates() {
  const sb = getSupabase();
  console.log('--- Duplicates Merger Start ---');

  // 1. Fetch all jobs
  let allJobs = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: jobs, error } = await sb.from('jobs')
      .select('id, job_name, organization, form_status, official_application_link, selection_process, qualification_required, minimum_age, maximum_age, salary_min, salary_max, state, states')
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error('Failed to fetch jobs:', error.message);
      return;
    }
    if (!jobs || jobs.length === 0) break;
    allJobs.push(...jobs);
    if (jobs.length < limit) break;
    offset += limit;
  }
  
  console.log(`Total jobs fetched from database: ${allJobs.length}`);

  // 2. Group by new fingerprint key
  const groups = new Map();
  for (const job of allJobs) {
    const fp = generateFingerprint(job);
    if (!groups.has(fp)) {
      groups.set(fp, []);
    }
    groups.get(fp).push(job);
  }

  // 3. Process groups with duplicates
  let duplicateGroupsCount = 0;
  let totalDuplicatesDeleted = 0;
  let likesTransferred = 0;
  let appliesTransferred = 0;
  let remindersTransferred = 0;
  let roadmapsTransferred = 0;
  let notificationsTransferred = 0;

  for (const [fp, group] of groups.entries()) {
    if (group.length <= 1) continue;
    duplicateGroupsCount++;

    // Calculate metadata quality score for each job in the group
    const scoredJobs = group.map(job => {
      let score = richnessScore(job) * 10;
      
      // Status preferences: LIVE > UPCOMING > RECENTLY_CLOSED > CLOSED
      if (job.form_status === 'LIVE') score += 1000;
      else if (job.form_status === 'UPCOMING') score += 500;
      else if (job.form_status === 'RECENTLY_CLOSED') score += 100;
      else if (job.form_status === 'CLOSED') score += 50;

      // Prefer standard UPSC names
      if (job.organization === 'Union Public Service Commission') score += 5;
      
      return { job, score };
    });

    // Sort descending by score, and pick the first one as kept
    scoredJobs.sort((a, b) => b.score - a.score);
    const keptJob = scoredJobs[0].job;
    const duplicates = scoredJobs.slice(1).map(x => x.job);

    console.log(`\nDuplicate Group: "${keptJob.job_name}" | Org: "${keptJob.organization}" | Kept ID: ${keptJob.id} (Score: ${scoredJobs[0].score})`);
    
    for (const dup of duplicates) {
      console.log(`  -> Duplicate to remove: "${dup.job_name}" | Org: "${dup.organization}" | ID: ${dup.id} (Score: ${scoredJobs.find(x => x.job.id === dup.id).score})`);

      // Transfer relations from dup.id to keptJob.id

      // A. liked_jobs (columns: id, user_id, job_id)
      const { data: likes, error: likesErr } = await sb.from('liked_jobs').select('*').eq('job_id', dup.id);
      if (likesErr) console.error(`    Error fetching likes: ${likesErr.message}`);
      if (likes && likes.length > 0) {
        for (const like of likes) {
          // Check if user already liked the kept job
          const { data: existingLike } = await sb.from('liked_jobs')
            .select('id').eq('user_id', like.user_id).eq('job_id', keptJob.id).limit(1);
          if (existingLike && existingLike.length > 0) {
            // Duplicate like: delete the reference for duplicate job
            await sb.from('liked_jobs').delete().eq('id', like.id);
          } else {
            // Transfer reference
            const { error: updErr } = await sb.from('liked_jobs').update({ job_id: keptJob.id }).eq('id', like.id);
            if (updErr) console.error(`    Failed transferring like: ${updErr.message}`);
            else likesTransferred++;
          }
        }
      }

      // B. applied_jobs (columns: id, user_id, job_id)
      const { data: applies, error: appliesErr } = await sb.from('applied_jobs').select('*').eq('job_id', dup.id);
      if (appliesErr) console.error(`    Error fetching applies: ${appliesErr.message}`);
      if (applies && applies.length > 0) {
        for (const apply of applies) {
          const { data: existingApply } = await sb.from('applied_jobs')
            .select('id').eq('user_id', apply.user_id).eq('job_id', keptJob.id).limit(1);
          if (existingApply && existingApply.length > 0) {
            await sb.from('applied_jobs').delete().eq('id', apply.id);
          } else {
            const { error: updErr } = await sb.from('applied_jobs').update({ job_id: keptJob.id }).eq('id', apply.id);
            if (updErr) console.error(`    Failed transferring apply: ${updErr.message}`);
            else appliesTransferred++;
          }
        }
      }

      // C. job_reminders (columns: id, user_id, job_id)
      const { data: reminders, error: remsErr } = await sb.from('job_reminders').select('*').eq('job_id', dup.id);
      if (remsErr) console.error(`    Error fetching reminders: ${remsErr.message}`);
      if (reminders && reminders.length > 0) {
        for (const reminder of reminders) {
          const { data: existingReminder } = await sb.from('job_reminders')
            .select('id').eq('user_id', reminder.user_id).eq('job_id', keptJob.id).limit(1);
          if (existingReminder && existingReminder.length > 0) {
            await sb.from('job_reminders').delete().eq('id', reminder.id);
          } else {
            const { error: updErr } = await sb.from('job_reminders').update({ job_id: keptJob.id }).eq('id', reminder.id);
            if (updErr) console.error(`    Failed transferring reminder: ${updErr.message}`);
            else remindersTransferred++;
          }
        }
      }

      // D. roadmaps (columns: id, user_id, job_id)
      const { data: roadmaps, error: roadmapsErr } = await sb.from('roadmaps').select('*').eq('job_id', dup.id);
      if (roadmapsErr) console.error(`    Error fetching roadmaps: ${roadmapsErr.message}`);
      if (roadmaps && roadmaps.length > 0) {
        for (const roadmap of roadmaps) {
          const { data: existingRoadmap } = await sb.from('roadmaps')
            .select('id').eq('user_id', roadmap.user_id).eq('job_id', keptJob.id).limit(1);
          if (existingRoadmap && existingRoadmap.length > 0) {
            await sb.from('roadmaps').delete().eq('id', roadmap.id);
          } else {
            const { error: updErr } = await sb.from('roadmaps').update({ job_id: keptJob.id }).eq('id', roadmap.id);
            if (updErr) console.error(`    Failed transferring roadmap: ${updErr.message}`);
            else roadmapsTransferred++;
          }
        }
      }

      // E. notifications (columns: id, user_id, job_id)
      const { data: notifications, error: notificationsErr } = await sb.from('notifications').select('*').eq('job_id', dup.id);
      if (notificationsErr) console.error(`    Error fetching notifications: ${notificationsErr.message}`);
      if (notifications && notifications.length > 0) {
        for (const notification of notifications) {
          const { error: updErr } = await sb.from('notifications').update({ job_id: keptJob.id }).eq('id', notification.id);
          if (updErr) console.error(`    Failed transferring notification: ${updErr.message}`);
          else notificationsTransferred++;
        }
      }

      // Finally, delete the duplicate job row
      const { error: delErr } = await sb.from('jobs').delete().eq('id', dup.id);
      if (delErr) {
        console.error(`    Failed to delete duplicate job row: ${delErr.message}`);
      } else {
        totalDuplicatesDeleted++;
      }
    }
  }

  console.log('\n--- Merger Report ---');
  console.log(`Duplicate groups processed: ${duplicateGroupsCount}`);
  console.log(`Duplicate job records deleted: ${totalDuplicatesDeleted}`);
  console.log(`Likes transferred: ${likesTransferred}`);
  console.log(`Applies transferred: ${appliesTransferred}`);
  console.log(`Reminders transferred: ${remindersTransferred}`);
  console.log(`Roadmaps transferred: ${roadmapsTransferred}`);
  console.log(`Notifications transferred: ${notificationsTransferred}`);
  console.log('--- Duplicates Merger Complete ---');
}

mergeDuplicates().catch(err => {
  console.error('Fatal error during merge:', err);
});
