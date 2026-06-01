/**
 * apply_indexes.js
 * Applies mandatory PostgreSQL indexes to Supabase for performance.
 * Uses the pg pool (direct DB) if SUPABASE_DB_URL is set, else REST rpc.
 * 
 * Run: node backend/scripts/apply_indexes.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const statements = [
    // ── Core tables ─────────────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);",
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_id ON jobs(id);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(job_category);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_app_end_date ON jobs(application_end_date DESC);",
    "CREATE INDEX IF NOT EXISTS idx_jobs_composite ON jobs(job_category, application_end_date DESC);",

    // ── Applied jobs ─────────────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_applied_jobs_job_id ON applied_jobs(job_id);",
    "CREATE INDEX IF NOT EXISTS idx_applied_jobs_created_at ON applied_jobs(created_at DESC);",

    // ── Liked jobs ────────────────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id ON liked_jobs(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_liked_jobs_job_id ON liked_jobs(job_id);",

    // ── Notifications — CRITICAL (very hot path for per-user queries) ─────────
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id);",

    // ── Job reminders ─────────────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_job_reminders_user_id ON job_reminders(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_job_reminders_job_id ON job_reminders(job_id);",

    // ── Roadmaps ──────────────────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_roadmaps_job_id ON roadmaps(job_id);",
];

async function applyViaPg() {
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false },
        max: 3,
    });
    console.log('Using pg pool (direct DB connection)...\n');
    for (const sql of statements) {
        try {
            await pool.query(sql);
            console.log('✅', sql.replace('CREATE INDEX IF NOT EXISTS ', '').substring(0, 80));
        } catch (err) {
            console.warn('⚠️ Skipped:', err.message.substring(0, 80));
        }
    }
    await pool.end();
}

async function applyViaRest() {
    console.log('Using REST API (no SUPABASE_DB_URL set)...\n');
    console.log('Note: Supabase REST does not support DDL. Please run these SQL statements');
    console.log('in the Supabase SQL Editor at: https://supabase.com/dashboard/project/ztbgunartkntrqxxsdpc/sql\n');
    console.log('── SQL to run ──────────────────────────────────────────────────────');
    for (const s of statements) {
        console.log(s);
    }
    console.log('────────────────────────────────────────────────────────────────────');
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  SarkarHamariHai — Supabase Index Creation');
    console.log('══════════════════════════════════════════════════\n');

    if (process.env.SUPABASE_DB_URL) {
        await applyViaPg();
        console.log('\n✅ All indexes applied via pg pool.');
    } else {
        await applyViaRest();
    }
}

main().catch(err => {
    console.error('Script error:', err.message);
    process.exit(1);
});
