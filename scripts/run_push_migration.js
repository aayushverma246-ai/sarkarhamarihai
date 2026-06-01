/**
 * run_push_migration.js
 *
 * Automatically executes the PostgreSQL schema changes on the Supabase database
 * to support native device push token registrations.
 */
'use strict';

const { getDb, initDb } = require('../backend/src/db');
require('dotenv').config();

async function runMigration() {
  console.log('=== Starting Native Device Token Table Migration ===');
  
  try {
    // Initialize database connectivity
    await initDb();
    const db = getDb();

    console.log('[Migration] Creating "user_devices" table if not exists...');
    // Create the push device registration table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_token TEXT NOT NULL UNIQUE,
        device_type TEXT NOT NULL DEFAULT 'android',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('[Migration] Table "user_devices" checked/created successfully.');

    console.log('[Migration] Creating index "idx_user_devices_user_id" if not exists...');
    // Create helper index for query performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)
    `);
    console.log('[Migration] Index "idx_user_devices_user_id" checked/created successfully.');

    console.log('=== Migration Completed Successfully ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Critical Migration Failure:', err.message);
    process.exit(1);
  }
}

runMigration();
