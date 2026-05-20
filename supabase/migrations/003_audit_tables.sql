-- audit_logs table for persisting deep audit results
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  audit_type TEXT NOT NULL DEFAULT 'deep_audit',
  report JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by type and date
CREATE INDEX IF NOT EXISTS idx_audit_logs_type_date ON audit_logs (audit_type, created_at DESC);

-- Add last_verified_at to jobs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'last_verified_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN last_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add ARCHIVED as valid form_status (update check constraint if exists)
-- If form_status uses a check constraint, we need to update it to include ARCHIVED
-- Most Supabase setups use TEXT without constraints, so this is safe

-- Create index for stale record detection
CREATE INDEX IF NOT EXISTS idx_jobs_last_verified ON jobs (last_verified_at ASC NULLS FIRST);

-- Create index for status transitions (used by refresh cron)
CREATE INDEX IF NOT EXISTS idx_jobs_status_dates ON jobs (form_status, application_start_date, application_end_date);

-- Scraper logs table (if not exists)
CREATE TABLE IF NOT EXISTS scraper_logs (
  id SERIAL PRIMARY KEY,
  run_id TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  elapsed_ms INTEGER,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clean up old audit logs (keep last 90 days)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
