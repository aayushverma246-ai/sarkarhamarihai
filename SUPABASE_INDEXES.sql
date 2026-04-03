-- ═══════════════════════════════════════════════════════════════════════
--  SarkarHamariHai — Production Performance Indexes
--  Apply in Supabase Dashboard → SQL Editor
--  URL: https://supabase.com/dashboard/project/ztbgunartkntrqxxsdpc/sql
-- ═══════════════════════════════════════════════════════════════════════

-- ── NOTIFICATIONS (Most Critical — hot path per user) ─────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_job_id      ON notifications(job_id);

-- ── JOBS (Core browse/sort) ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_id               ON jobs(id);
CREATE INDEX IF NOT EXISTS idx_jobs_category         ON jobs(job_category);
CREATE INDEX IF NOT EXISTS idx_jobs_end_date         ON jobs(application_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_start_date       ON jobs(application_start_date);
-- Composite for stable pagination (ORDER BY application_end_date DESC, id)
CREATE INDEX IF NOT EXISTS idx_jobs_pagination       ON jobs(application_end_date DESC, id);
-- Composite for category-filtered browse
CREATE INDEX IF NOT EXISTS idx_jobs_category_end     ON jobs(job_category, application_end_date DESC);

-- ── USERS ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_id    ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── LIKED JOBS ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id    ON liked_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_jobs_job_id     ON liked_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_liked_user_created    ON liked_jobs(user_id, created_at DESC);

-- ── APPLIED JOBS ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id  ON applied_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_job_id   ON applied_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_applied_user_created  ON applied_jobs(user_id, created_at DESC);

-- ── JOB REMINDERS ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_reminders_user_id ON job_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_job_reminders_job_id  ON job_reminders(job_id);

-- ── ROADMAPS ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id  ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_job_id   ON roadmaps(job_id);

-- ── TRACKER ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tracker_plans_user_date  ON tracker_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tracker_sessions_plan_id ON tracker_sessions(plan_id);

-- ═══════════════════════════════════════════════════════════════════════
