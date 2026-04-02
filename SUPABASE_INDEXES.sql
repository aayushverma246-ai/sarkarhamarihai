-- RUN THIS IN THE SUPABASE DASHBOARD -> SQL EDITOR

-- 1. Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Indexes for faster job fetching and sorting
CREATE INDEX IF NOT EXISTS idx_jobs_id ON jobs(id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(job_category);
CREATE INDEX IF NOT EXISTS idx_jobs_app_end_date ON jobs(application_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_app_start_date ON jobs(application_start_date ASC);

-- 3. Indexes for Applied and Saved jobs JOIN performance
CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_job_id ON applied_jobs(job_id);

CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id ON liked_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_jobs_job_id ON liked_jobs(job_id);

-- 4. Indexes for tracking usage speed
CREATE INDEX IF NOT EXISTS idx_job_reminders_user_id ON job_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_job_reminders_job_id ON job_reminders(job_id);
