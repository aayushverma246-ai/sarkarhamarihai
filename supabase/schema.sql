-- ============================================================
-- SarkarHamariHai — Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  qualification_type TEXT NOT NULL DEFAULT '',
  qualification_status TEXT NOT NULL DEFAULT '',
  current_year INTEGER NOT NULL DEFAULT 0,
  current_semester INTEGER NOT NULL DEFAULT 0,
  expected_graduation_year INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── JOBS (EXAMS) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  organization TEXT NOT NULL,
  qualification_required TEXT NOT NULL,
  allows_final_year_students INTEGER NOT NULL DEFAULT 0,
  minimum_age INTEGER NOT NULL DEFAULT 18,
  maximum_age INTEGER NOT NULL DEFAULT 40,
  application_start_date TEXT NOT NULL,
  application_end_date TEXT NOT NULL,
  salary_min INTEGER NOT NULL DEFAULT 0,
  salary_max INTEGER NOT NULL DEFAULT 0,
  job_category TEXT NOT NULL DEFAULT '',
  official_application_link TEXT NOT NULL DEFAULT '',
  official_notification_link TEXT NOT NULL DEFAULT '',
  official_website_link TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  selection_process TEXT NOT NULL DEFAULT '',
  form_status TEXT NOT NULL DEFAULT 'UPCOMING',
  exam_name_hi TEXT DEFAULT '',
  exam_name_ta TEXT DEFAULT '',
  exam_name_bn TEXT DEFAULT '',
  syllabus TEXT DEFAULT '',
  structured_syllabus_json TEXT DEFAULT '',
  embeddings_json TEXT DEFAULT '',
  exam_type TEXT DEFAULT '',
  state TEXT DEFAULT 'All India',
  states TEXT DEFAULT '[]',
  vacancies INTEGER DEFAULT 0,
  applicants_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LIKED JOBS (SAVED EXAMS) ────────────────────────────────
CREATE TABLE IF NOT EXISTS liked_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ─── APPLIED JOBS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applied_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ─── JOB REMINDERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ROADMAPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  roadmap_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ─── TRACKER: DAILY PLANS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracker_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  wake_time TEXT NOT NULL,
  sleep_time TEXT NOT NULL,
  planned_hours REAL NOT NULL DEFAULT 0,
  completed_hours REAL NOT NULL DEFAULT 0,
  productivity_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRACKER: SESSIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracker_sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES tracker_plans(id) ON DELETE CASCADE,
  exam_target_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  session_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  is_completed INTEGER NOT NULL DEFAULT 0
);

-- ─── TRACKER: USER STATS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracker_user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_study_hours REAL NOT NULL DEFAULT 0,
  overall_readiness_score INTEGER NOT NULL DEFAULT 0,
  target_probability REAL NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRACKER: USER TARGETS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tracker_user_targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  exam_date TEXT,
  syllabus_completed_pct REAL NOT NULL DEFAULT 0,
  target_probability REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EXAM SYLLABUS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_syllabus (
  id SERIAL PRIMARY KEY,
  exam_id TEXT UNIQUE NOT NULL,
  subjects TEXT NOT NULL,
  topics TEXT NOT NULL
);

-- ─── AI RECOMMENDATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  target_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  overlap_percentage INTEGER NOT NULL DEFAULT 0,
  common_topics TEXT NOT NULL DEFAULT '',
  missing_topics TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  similarity INTEGER DEFAULT 0,
  overlapping_topics TEXT DEFAULT '[]',
  difficulty_gap TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source_job_id, target_job_id)
);

-- ─── AI RECOMMENDATION CACHE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── SEED META ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seed_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ─── INDEXES FOR PERFORMANCE ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_form_status ON jobs(form_status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(job_category);
CREATE INDEX IF NOT EXISTS idx_jobs_end_date ON jobs(application_end_date);
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON jobs(application_start_date);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applied_jobs_job_id ON applied_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id ON liked_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_jobs_job_id ON liked_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_reminders_user_id ON job_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_job_reminders_job_id ON job_reminders(job_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_tracker_plans_user_date ON tracker_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tracker_sessions_plan_id ON tracker_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_source ON ai_recommendations(source_job_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_user ON ai_recommendations(user_id);
-- Composite (hot path) indexes
CREATE INDEX IF NOT EXISTS idx_jobs_composite_end ON jobs(application_end_date DESC, job_category);
CREATE INDEX IF NOT EXISTS idx_liked_user_created ON liked_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applied_user_created ON applied_jobs(user_id, created_at DESC);

