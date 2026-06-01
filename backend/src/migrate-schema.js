/**
 * migrate-schema.js — Schema migration runner for SarkarHamariHai
 *
 * Runs database migrations safely via direct connection pool outside HTTP runtime.
 * Loads env variables from backend/.env or root .env automatically.
 */
'use strict';

// Load env variables
require('dotenv').config();

const { getPool } = require('./db');

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  roadmap_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

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

CREATE TABLE IF NOT EXISTS tracker_user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_study_hours REAL NOT NULL DEFAULT 0,
  overall_readiness_score INTEGER NOT NULL DEFAULT 0,
  target_probability REAL NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracker_user_targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  exam_date TEXT,
  syllabus_completed_pct REAL NOT NULL DEFAULT 0,
  target_probability REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function run() {
  console.log('=== Initializing Database Schema Migrations ===');
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('Connecting to database...');
    await client.query('BEGIN');
    
    console.log('Executing migration SQL queries...');
    await client.query(MIGRATION_SQL);
    
    await client.query('COMMIT');
    console.log('✅ Database schemas verified/applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed! Transaction rolled back.');
    console.error('Error Details:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
  
  console.log('=== Migrations Completed ===');
  process.exit(0);
}

run();
