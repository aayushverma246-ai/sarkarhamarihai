const path = require('path');
const fs = require('fs');

let db;

function getDbClient(url) {
  if (url.startsWith('libsql://') || url.startsWith('https://')) {
    return require('@libsql/client/http').createClient;
  }
  return require('@libsql/client').createClient;
}

function getDb() {
  if (db) return db;

  let url;
  if (process.env.TURSO_DATABASE_URL) {
    // Production: Turso hosted database
    url = process.env.TURSO_DATABASE_URL.trim();
  } else {
    // Local dev or Vercel: file-based SQLite
    if (process.env.VERCEL) {
      // Vercel serverless has a read-only filesystem except for /tmp
      const srcDbPath = path.join(__dirname, '..', 'data', 'sarkar.db');
      const tmpDbPath = '/tmp/sarkar.db';

      // If we haven't copied it yet to the ephemeral /tmp on this cold start
      try {
        if (!fs.existsSync(tmpDbPath)) {
          console.log("Copying sarkar.db to /tmp/sarkar.db for Vercel writable access...");
          fs.copyFileSync(srcDbPath, tmpDbPath);
        } else {
          console.log("sarkar.db already exists in /tmp");
        }
      } catch (err) {
        console.error("Critical error copying SQLite DB to /tmp on Vercel:", err);
      }
      url = `file:${tmpDbPath}`;
    } else {
      const dbPath = path.join(__dirname, '..', 'data', 'sarkar.db');
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      url = `file:${dbPath}`;
    }
  }

  const createClient = getDbClient(url);
  db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA',
  });

  return db;
}

async function initDb() {
  const client = getDb();
  const isLocal = !process.env.TURSO_DATABASE_URL;

  if (isLocal) {
    // Disabled WAL mode because Vercel serverless /tmp copying needs a single monolithic .db file 
    // without worrying about syncing -wal and -shm files across ephemeral requests
    await client.execute('PRAGMA foreign_keys = ON');
  }

  // Create tables
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
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
      state TEXT DEFAULT 'All India',
      states TEXT DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS liked_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS applied_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS job_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS roadmaps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      roadmap_content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      sleep_time TEXT NOT NULL,
      planned_hours REAL NOT NULL DEFAULT 0,
      completed_hours REAL NOT NULL DEFAULT 0,
      productivity_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_sessions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      exam_target_id TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      session_type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      is_completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(plan_id) REFERENCES tracker_plans(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_user_stats (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      total_study_hours REAL NOT NULL DEFAULT 0,
      overall_readiness_score INTEGER NOT NULL DEFAULT 0,
      target_probability REAL NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_user_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      exam_date TEXT,
      syllabus_completed_pct REAL NOT NULL DEFAULT 0,
      target_probability REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS exam_syllabus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id TEXT UNIQUE NOT NULL,
      subjects TEXT NOT NULL,
      topics TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_job_id TEXT NOT NULL,
      target_job_id TEXT NOT NULL,
      overlap_percentage INTEGER NOT NULL,
      common_topics TEXT NOT NULL,
      missing_topics TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, source_job_id, target_job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(source_job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(target_job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of schema) {
    await client.execute(sql);
  }

  // Safe migrations for existing databases
  const migrations = [
    "ALTER TABLE jobs ADD COLUMN official_notification_link TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN official_website_link TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN selection_process TEXT NOT NULL DEFAULT ''",
    `CREATE TABLE IF NOT EXISTS applied_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS job_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`,
    "ALTER TABLE jobs ADD COLUMN form_status TEXT NOT NULL DEFAULT 'UPCOMING'",
    `CREATE TABLE IF NOT EXISTS tracker_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      sleep_time TEXT NOT NULL,
      planned_hours REAL NOT NULL DEFAULT 0,
      completed_hours REAL NOT NULL DEFAULT 0,
      productivity_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_sessions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      session_type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      is_completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(plan_id) REFERENCES tracker_plans(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS tracker_user_stats (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      total_study_hours REAL NOT NULL DEFAULT 0,
      overall_readiness_score INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    "ALTER TABLE tracker_sessions ADD COLUMN exam_target_id TEXT",
    "ALTER TABLE tracker_user_stats ADD COLUMN target_probability REAL NOT NULL DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS tracker_user_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      exam_date TEXT,
      syllabus_completed_pct REAL NOT NULL DEFAULT 0,
      target_probability REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    "ALTER TABLE jobs ADD COLUMN exam_name_hi TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN exam_name_ta TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN exam_name_bn TEXT DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN syllabus TEXT DEFAULT ''",
    "ALTER TABLE ai_recommendations ADD COLUMN similarity INTEGER DEFAULT 0",
    "ALTER TABLE ai_recommendations ADD COLUMN overlapping_topics TEXT DEFAULT '[]'",
    "ALTER TABLE ai_recommendations ADD COLUMN difficulty_gap TEXT DEFAULT 'medium'",
    "ALTER TABLE ai_recommendations ADD COLUMN explanation TEXT DEFAULT ''",
    "DELETE FROM ai_recommendations",
    "ALTER TABLE notifications ADD COLUMN job_id TEXT",
    "CREATE INDEX IF NOT EXISTS idx_jobs_form_status ON jobs(form_status)",
    "CREATE INDEX IF NOT EXISTS idx_applied_jobs_user_id ON applied_jobs(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_liked_jobs_user_id ON liked_jobs(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_reminders_user_id ON job_reminders(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
    "ALTER TABLE jobs ADD COLUMN state TEXT DEFAULT 'All India'",
    "ALTER TABLE jobs ADD COLUMN states TEXT DEFAULT '[]'"
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch (_) { }
  }
}

async function ensureVercelUser(db, decoded) {
  if (!process.env.VERCEL || !decoded || !decoded.id) return;
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, age, category, state, qualification_type, qualification_status, current_year, current_semester, expected_graduation_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        decoded.id, decoded.email, 'serverless_migrated_pass',
        decoded.full_name || '', typeof decoded.age === 'number' ? decoded.age : 0,
        decoded.category || '', decoded.state || '',
        decoded.qualification_type || '', decoded.qualification_status || '',
        decoded.current_year || 0, decoded.current_semester || 0, decoded.expected_graduation_year || 0
      ]
    });
  } catch (e) { }
}

module.exports = { getDb, initDb, ensureVercelUser };
