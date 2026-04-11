/**
 * db.js — Supabase adapter for SarkarHamariHai
 *
 * Strategy:
 *  - PRIMARY:  pg pool via SUPABASE_DB_URL (if set — needs DB password from Supabase dashboard)
 *  - FALLBACK: @supabase/supabase-js REST API (works on service role key alone, no password)
 *
 * Interface (matches old Turso libsql client):
 *   db.execute({ sql, args }) → { rows: [...], rowsAffected: N }
 *   db.execute(sqlString)     → { rows: [], rowsAffected: N }
 *   db.batch([...])           → sequential execution
 *
 * SQL auto-transformations:
 *   ? placeholders       → $1, $2 ...
 *   INSERT OR IGNORE     → INSERT ... ON CONFLICT DO NOTHING
 *   INSERT OR REPLACE    → INSERT ... ON CONFLICT (id) DO UPDATE
 *   date('now')          → CURRENT_DATE
 *   datetime('now')      → NOW()
 *   PRAGMA               → skipped
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A';

// Optional: Direct DB URL for pg (requires SUPABASE_DB_PASSWORD in env)
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || null;

// ── Singletons ────────────────────────────────────────────────────────────────
let _pool = null;
let _supabase = null;
let _usePg = !!SUPABASE_DB_URL;

function getSupabaseClient() {
  if (_supabase) return _supabase;
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

function getPool() {
  if (!SUPABASE_DB_URL) return null;
  if (_pool) return _pool;
  const { Pool } = require('pg');
  _pool = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,                    // Allow 10 parallel connections for Promise.all batches
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Fail fast if DB is unreachable
  });
  _pool.on('error', (err) => console.error('[DB Pool]', err.message));
  return _pool;
}

// ── SQL Transformation ────────────────────────────────────────────────────────
function transformSql(sql) {
  let t = sql;
  if (/^\s*PRAGMA/i.test(t)) return null;

  t = t.replace(/date\('now',\s*'-(\d+)\s*day'\)/gi, (_, n) => `(NOW() - INTERVAL '${n} days')`);
  t = t.replace(/date\('now'\)/gi, 'CURRENT_DATE');
  t = t.replace(/datetime\('now'\)/gi, 'NOW()');

  const hadIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(t);
  t = t.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  if (hadIgnore && !/ON CONFLICT/i.test(t)) {
    t = t.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }

  const hadReplace = /INSERT\s+OR\s+REPLACE\s+INTO/i.test(t);
  t = t.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)/gi, 'INSERT INTO $1');
  if (hadReplace && !/ON CONFLICT/i.test(t)) {
    t = t.replace(/;?\s*$/, ' ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id');
  }

  t = t.replace(/AUTOINCREMENT/gi, '');

  // ? → $1, $2 ...
  let idx = 0;
  t = t.replace(/\?/g, () => `$${++idx}`);

  return t;
}

// ── Execute via pg pool (fast, raw SQL) ───────────────────────────────────────
async function executeViaPg(transformed, args) {
  const pool = getPool();
  const result = await pool.query(transformed, args.length > 0 ? args : undefined);
  return { rows: result.rows || [], rowsAffected: result.rowCount || 0 };
}

// ── Execute via Supabase REST API (no DB password needed) ─────────────────────
/**
 * This parses simple SQL into Supabase JS SDK calls.
 * Handles the common patterns used by our routes.
 * Falls back to raw fetch against PostgREST for complex queries.
 */
async function executeViaRest(originalSql, transformed, args) {
  const sb = getSupabaseClient();

  // ── SELECT queries ──
  const selectMatch = transformed.match(
    /^\s*SELECT\s+(.*?)\s+FROM\s+(\w+)(.*?)$/is
  );
  if (selectMatch) {
    const [, selectCols, table, rest] = selectMatch;

    let query = sb.from(table);

    // Columns
    const cols = selectCols.trim() === '*' ? '*' : selectCols.trim();
    query = query.select(cols);

    // Parse WHERE conditions (simple equality/comparison)
    const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      // Parse individual conditions
      const processWhere = (clause, queryIn, argsArr) => {
        let q = queryIn;

        // Replace $N placeholders back with actual arg values for parsing
        const resolvedClause = clause.replace(/\$(\d+)/g, (_, n) => {
          const val = argsArr[parseInt(n) - 1];
          return typeof val === 'string' ? `'${val}'` : String(val ?? 'null');
        });

        // Split by OR first
        const orParts = resolvedClause.split(/\s+OR\s+/i);
        if (orParts.length > 1) {
          // Complex OR condition
          const orArr = orParts.map(part => {
             const eqMatch = part.match(/^\s*(\w+)\s*=\s*'([^']*)'\s*$/);
             if (eqMatch) return `${eqMatch[1]}.eq.${eqMatch[2]}`;
             const numMatch = part.match(/^\s*(\w+)\s*=\s*(-?\d+)\s*$/);
             if (numMatch) return `${numMatch[1]}.eq.${numMatch[2]}`;
             return '';
          }).filter(x => x !== '');
          if (orArr.length > 0) {
             q = q.or(orArr.join(','));
          }
          return q;
        }

        // Process AND conditions
        const conditions = resolvedClause.split(/\s+AND\s+/i);
        for (const cond of conditions) {
          const trimmed = cond.trim();
          const eqMatch = trimmed.match(/^(\w+)\s*=\s*'([^']*)'$/);
          const numEqMatch = trimmed.match(/^(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
          const neqMatch = trimmed.match(/^(\w+)\s*!=\s*'([^']*)'$/);
          const isNullMatch = trimmed.match(/^(\w+)\s+IS\s+NULL$/i);
          const inMatch = trimmed.match(/^(\w+)\s+IN\s*\(([^)]+)\)$/i);
          const gteMatch = trimmed.match(/^(\w+)\s*>=\s*'([^']*)'$/);
          const lteMatch = trimmed.match(/^(\w+)\s*<=\s*'([^']*)'$/);
          const likeMatch = trimmed.match(/^LOWER\((\w+)\)\s+LIKE\s+'([^']*)'$/i);

          if (eqMatch) q = q.eq(eqMatch[1], eqMatch[2]);
          else if (numEqMatch) q = q.eq(numEqMatch[1], Number(numEqMatch[2]));
          else if (neqMatch) q = q.neq(neqMatch[1], neqMatch[2]);
          else if (isNullMatch) q = q.is(isNullMatch[1], null);
          else if (inMatch) {
            const vals = inMatch[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            q = q.in(inMatch[1], vals);
          } else if (gteMatch) q = q.gte(gteMatch[1], gteMatch[2]);
          else if (lteMatch) q = q.lte(lteMatch[1], lteMatch[2]);
          else if (likeMatch) q = q.ilike(likeMatch[1], likeMatch[2]);
        }
        return q;
      };

      query = processWhere(whereClause, query, args);
    }

    // ORDER BY — supports multiple columns: ORDER BY col1 DESC, col2 ASC
    const orderByMatch = rest.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s+OFFSET|$)/i);
    if (orderByMatch) {
      const orderCols = orderByMatch[1].split(',').map(c => c.trim());
      for (const col of orderCols) {
        const parts = col.split(/\s+/);
        const colName = parts[0];
        const ascending = (parts[1] || 'ASC').toUpperCase() !== 'DESC';
        if (colName) query = query.order(colName, { ascending });
      }
    }

    // LIMIT & OFFSET
    const limitMatch = rest.match(/LIMIT\s+(\d+)/i);
    const offsetMatch = rest.match(/OFFSET\s+(\d+)/i);

    if (limitMatch && offsetMatch) {
      const limit = parseInt(limitMatch[1]);
      const offset = parseInt(offsetMatch[1]);
      query = query.range(offset, offset + limit - 1);
    } else if (limitMatch) {
      query = query.limit(parseInt(limitMatch[1]));
    }

    // COUNT(*) special case
    if (cols.match(/COUNT\s*\(\s*\*?\s*\)\s+as\s+\w+/i) || cols.match(/COUNT\s*\(\s*\*\s*\)/i)) {
      const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      const alias = (cols.match(/COUNT\s*\(\s*\*?\s*\)\s+as\s+(\w+)/i) || [])[1] || 'count';
      return { rows: [{ [alias]: count }], rowsAffected: 0 };
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') return { rows: [], rowsAffected: 0 }; // no rows
      throw new Error(`[REST SELECT ${table}] ${error.message}`);
    }
    return { rows: data || [], rowsAffected: 0 };
  }

  // ── INSERT queries ──
  const insertMatch = transformed.match(
    /^\s*INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)(.*?)$/is
  );
  if (insertMatch) {
    const [, table, colStr, , rest] = insertMatch;
    const cols = colStr.split(',').map(c => c.trim());
    const obj = {};
    cols.forEach((col, i) => {
      let val = args[i];
      if (val === undefined) val = null;
      obj[col] = val;
    });

    const onConflictMatch = rest.match(/ON\s+CONFLICT\s*\(([^)]+)\)\s*DO\s+(NOTHING|UPDATE.*)/i);
    const onConflictColStr = onConflictMatch ? onConflictMatch[1] : null;
    const doNothing = onConflictMatch && onConflictMatch[2].toUpperCase() === 'NOTHING';
    const doUpdate = onConflictMatch && !doNothing;
    const isIgnoreConflict = /ON CONFLICT DO NOTHING/i.test(rest);

    let q;
    if (doUpdate) {
      q = sb.from(table).upsert(obj, { onConflict: onConflictColStr?.trim(), ignoreDuplicates: false });
    } else if (doNothing || isIgnoreConflict) {
      q = sb.from(table).upsert(obj, { onConflict: onConflictColStr?.trim() || 'id', ignoreDuplicates: true });
    } else {
      q = sb.from(table).insert(obj);
    }

    if (table === 'seed_meta') return { rows: [], rowsAffected: 1 };

    const { error } = await q;
    if (error) {
      if (error.code === '23505') return { rows: [], rowsAffected: 0 }; // duplicate
      throw new Error(`[REST INSERT ${table}] ${error.message} - ${error.details || ''}`);
    }
    return { rows: [], rowsAffected: 1 };
  }

  // ── UPDATE queries ──
  const updateMatch = transformed.match(
    /^\s*UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)$/is
  );
  if (updateMatch) {
    const [, table, setStr, whereStr] = updateMatch;

    // Parse SET clause
    const setObj = {};
    // Replace $N with actual values
    const resolveArgs = (s) => s.replace(/\$(\d+)/g, (_, n) => {
      const val = args[parseInt(n) - 1];
      return typeof val === 'string' ? `|||${val}|||` : String(val ?? 'null');
    });

    const setPairs = setStr.split(',');
    for (const pair of setPairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const col = pair.substring(0, eqIdx).trim();
      let rawVal = pair.substring(eqIdx + 1).trim();
      let val = resolveArgs(rawVal);
      
      if (val.startsWith('|||') && val.endsWith('|||')) {
        val = val.slice(3, -3);
      } else if (val === 'null') {
        val = null;
      } else {
        // numeric
        const num = Number(val);
        if (!isNaN(num) && val !== '') val = num;
      }
      if (col && col !== 'EXCLUDED.id') setObj[col] = val;
    }

    // Parse WHERE for equality (simple)
    const resolvedWhere = resolveArgs(whereStr);
    let q = sb.from(table).update(setObj);

    const conditions = resolvedWhere.split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const eqMatch = cond.match(/^(\w+)\s*=\s*\|\|\|([^|]*)\|\|\|$/);
      const numEqMatch = cond.match(/^(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
      if (eqMatch) q = q.eq(eqMatch[1], eqMatch[2]);
      else if (numEqMatch) q = q.eq(numEqMatch[1], Number(numEqMatch[2]));
    }

    const { error } = await q;
    if (error) throw new Error(`[REST UPDATE ${table}] ${error.message}`);
    return { rows: [], rowsAffected: 1 };
  }

  // ── DELETE queries ──
  const deleteMatch = transformed.match(
    /^\s*DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+?)$/is
  );
  if (deleteMatch) {
    const [, table, whereStr] = deleteMatch;
    const resolveArgs = (s) => s.replace(/\$(\d+)/g, (_, n) => {
      const val = args[parseInt(n) - 1];
      return typeof val === 'string' ? `|||${val}|||` : String(val ?? 'null');
    });
    const resolvedWhere = resolveArgs(whereStr);

    let q = sb.from(table).delete();
    const conditions = resolvedWhere.split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const eqMatch = cond.match(/^(\w+)\s*=\s*\|\|\|([^|]*)\|\|\|$/);
      const numEqMatch = cond.match(/^(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
      if (eqMatch) q = q.eq(eqMatch[1], eqMatch[2]);
      else if (numEqMatch) q = q.eq(numEqMatch[1], Number(numEqMatch[2]));
    }

    const { error } = await q;
    if (error) throw new Error(`[REST DELETE ${table}] ${error.message}`);
    return { rows: [], rowsAffected: 1 };
  }

  // ── Fallback for JOIN queries and complex SELECT ──
  // Use the Supabase REST API's raw SQL endpoint via RPC (if exec_sql function exists)
  // Or just throw a clear error
  throw new Error(`[DB] Cannot parse SQL via REST: ${transformed.substring(0, 120)}`);
}

// ── Main execute() ─────────────────────────────────────────────────────────────
async function execute(sqlOrObj, argsParam) {
  let sql, queryArgs;
  if (typeof sqlOrObj === 'string') {
    sql = sqlOrObj;
    queryArgs = argsParam || [];
  } else {
    sql = sqlOrObj.sql;
    queryArgs = sqlOrObj.args || [];
  }

  const transformed = transformSql(sql);
  if (!transformed) return { rows: [], rowsAffected: 0 }; // PRAGMA

  // Try pg pool if SUPABASE_DB_URL is set
  if (_usePg) {
    try {
      return await executeViaPg(transformed, queryArgs);
    } catch (err) {
      if (err.code === '23505') return { rows: [], rowsAffected: 0 };
      if (err.code === '42701') return { rows: [], rowsAffected: 0 };
      if (err.code === '42P01') {
        console.warn('[DB] Table not found:', err.message.substring(0, 80));
        return { rows: [], rowsAffected: 0 };
      }
      // Connection issue → fall through to REST
      console.warn('[DB] pg failed, falling back to REST:', err.message.substring(0, 80));
      _usePg = false;
    }
  }

  // Use Supabase REST API
  try {
    return await executeViaRest(sql, transformed, queryArgs);
  } catch (err) {
    if (err.message.includes('Cannot parse SQL') && transformed.match(/JOIN/i)) {
      // JOINs: manually handle the common patterns via multiple SDK calls
      return await executeJoinFallback(sql, transformed, queryArgs);
    }
    console.error('[DB] REST error:', err.message);
    throw err;
  }
}

// ── JOIN fallback for common route patterns ────────────────────────────────────
async function executeJoinFallback(originalSql, transformed, args) {
  const sb = getSupabaseClient();

  // Pattern: SELECT j.* FROM applied_jobs a JOIN jobs j ON a.job_id = j.id WHERE a.user_id = $1
  const appliedJobsJoin = transformed.match(
    /SELECT\s+j\.\*\s+FROM\s+(\w+)\s+\w+\s+JOIN\s+jobs\s+j\s+ON\s+\w+\.job_id\s+=\s+j\.id\s+WHERE\s+\w+\.user_id\s*=\s*\$1/i
  );
  if (appliedJobsJoin) {
    const joinTable = appliedJobsJoin[1];
    const userId = args[0];
    const { data: refs, error: e1 } = await sb.from(joinTable).select('job_id').eq('user_id', userId);
    if (e1) throw new Error(e1.message);
    if (!refs || refs.length === 0) return { rows: [], rowsAffected: 0 };
    const jobIds = refs.map(r => r.job_id);
    const { data: jobs, error: e2 } = await sb.from('jobs').select('*').in('id', jobIds);
    if (e2) throw new Error(e2.message);
    return { rows: jobs || [], rowsAffected: 0 };
  }

  // Pattern: SELECT j.* FROM liked_jobs JOIN jobs j ...
  const likedJobsJoin = transformed.match(
    /SELECT\s+.+\s+FROM\s+liked_jobs\s+\w+\s+JOIN\s+jobs\s+j\s+ON.+WHERE\s+\w+\.user_id\s*=\s*\$1/i
  );
  if (likedJobsJoin) {
    const userId = args[0];
    const { data: refs } = await sb.from('liked_jobs').select('job_id').eq('user_id', userId);
    if (!refs || refs.length === 0) return { rows: [], rowsAffected: 0 };
    const { data: jobs } = await sb.from('jobs').select('*').in('id', refs.map(r => r.job_id));
    return { rows: jobs || [], rowsAffected: 0 };
  }

  console.warn('[DB] Unhandled JOIN — returning empty:', transformed.substring(0, 120));
  return { rows: [], rowsAffected: 0 };
}

// ── batch() ────────────────────────────────────────────────────────────────────
async function batch(statements, _mode) {
  const results = [];
  for (const stmt of statements) {
    results.push(await execute(stmt));
  }
  return results;
}

// ── getDb() ────────────────────────────────────────────────────────────────────
const dbAdapter = { execute, batch };
function getDb() { return dbAdapter; }

// ── initDb() — connectivity check ─────────────────────────────────────────────
async function initDb() {
  try {
    const r = await execute('SELECT COUNT(*) as cnt FROM jobs');
    const cnt = r.rows[0]?.cnt ?? '?';
    console.log(`[DB] Supabase connected. Jobs: ${cnt}`);
  } catch (e) {
    console.warn('[DB] initDb warn:', e.message);
  }
}

// ── ensureVercelUser (backward-compat no-op) ───────────────────────────────────
async function ensureVercelUser(_db, decoded) {
  if (!decoded?.id) return;
  try {
    await execute({
      sql: `INSERT INTO users
              (id, email, password_hash, full_name, age, category, state,
               qualification_type, qualification_status,
               current_year, current_semester, expected_graduation_year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING`,
      args: [
        decoded.id, decoded.email || '', 'migrated',
        decoded.full_name || '', decoded.age || 0,
        decoded.category || '', decoded.state || '',
        decoded.qualification_type || '', decoded.qualification_status || '',
        decoded.current_year || 0, decoded.current_semester || 0,
        decoded.expected_graduation_year || 0,
      ],
    });
  } catch (_) { /* silent */ }
}

function getSupabase() { return getSupabaseClient(); }

module.exports = { getDb, initDb, ensureVercelUser, getSupabase, getPool };
