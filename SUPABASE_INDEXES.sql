-- Supabase performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_job ON applied_jobs(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_job_reminders_user_job ON job_reminders(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_job ON liked_jobs(user_id, job_id);
