/**
 * db.js — Self-Healing Hybrid Database Adapter for SarkarHamariHai
 *
 * Strategy:
 *  1. PRIMARY: High-performance direct PostgreSQL connection pool (pg).
 *     Perfect for local development, docker, and networks supporting direct TCP.
 *  2. FALLBACK: Supabase JS REST Client.
 *     If the direct connection pool fails (e.g., Vercel IPv6 DNS limitations), the engine
 *     automatically and silently falls back to resolving queries via the Supabase SDK client over HTTPS.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// ── Connection Configuration ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[DB] Warning: SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
}

// Construct direct PostgreSQL URL
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString && process.env.SUPABASE_DB_PASSWORD) {
  connectionString = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.ztbgunartkntrqxxsdpc.supabase.co:5432/postgres`;
}

// ── Singletons ────────────────────────────────────────────────────────────────
let _pool = null;
let _supabase = null;
let _usePgPool = !!connectionString && process.env.VERCEL !== '1'; // Active if database credentials are present and not on Vercel

function getSupabaseClient() {
  if (_supabase) return _supabase;
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

function getPool() {
  if (!connectionString) return null;
  if (_pool) return _pool;

  _pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000, // Fail fast if unreachable (e.g. Vercel network limits)
  });

  _pool.on('error', (err) => {
    console.warn('[DB Pool Background Error]:', err.message);
    _usePgPool = false; // Fallback on subsequent queries
  });

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

  let idx = 0;
  t = t.replace(/\?/g, () => `$${++idx}`);

  return t;
}

// ── Execute via pg pool (Fast, Direct TCP) ───────────────────────────────────
async function executeViaPg(transformed, args) {
  const pool = getPool();
  if (!pool) throw new Error("NO_PG_POOL");
  const result = await pool.query(transformed, args.length > 0 ? args : undefined);
  return { rows: result.rows || [], rowsAffected: result.rowCount || 0 };
}

// ── Execute via Supabase REST API (Vercel Serverless Fallback) ────────────────
async function executeViaRest(originalSql, transformed, args) {
  if (transformed && transformed.trim() === 'SELECT 1') {
    return { rows: [{ '?column?': 1 }], rowsAffected: 0 };
  }
  const sb = getSupabaseClient();

  // 1. SELECT queries
  const selectMatch = transformed.match(/^\s*SELECT\s+(.*?)\s+FROM\s+(\w+)(.*?)$/is);
  if (selectMatch) {
    const [, selectCols, table, rest] = selectMatch;
    let query = sb.from(table);

    const cols = selectCols.trim() === '*' ? '*' : selectCols.trim();
    const countMatch = cols.match(/COUNT\s*\(\s*(distinct\s+)?(\w+|\*)\s*\)\s+as\s+(\w+)/i);

    if (countMatch) {
      const isDistinct = !!countMatch[1];
      const fieldName = countMatch[2];
      if (fieldName === '*' && !isDistinct) {
        query = query.select('*', { count: 'exact', head: true });
      } else {
        query = query.select(fieldName);
      }
    } else {
      query = query.select(cols);
    }

    const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const processWhere = (clause, queryIn, argsArr) => {
        let q = queryIn;
        const resolvedClause = clause.replace(/\$(\d+)/g, (_, n) => {
          const val = argsArr[parseInt(n) - 1];
          return typeof val === 'string' ? `'${val}'` : String(val ?? 'null');
        });

        const orParts = resolvedClause.split(/\s+OR\s+/i);
        if (orParts.length > 1) {
          const orArr = orParts.map(part => {
            const eqMatch = part.match(/^\s*(\w+)\s*=\s*'([^']*)'\s*$/);
            if (eqMatch) return `${eqMatch[1]}.eq.${eqMatch[2]}`;
            const numMatch = part.match(/^\s*(\w+)\s*=\s*(-?\d+)\s*$/);
            if (numMatch) return `${numMatch[1]}.eq.${numMatch[2]}`;
            return '';
          }).filter(x => x !== '');
          if (orArr.length > 0) q = q.or(orArr.join(','));
          return q;
        }

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

    const limitMatch = rest.match(/LIMIT\s+(\d+)/i);
    const offsetMatch = rest.match(/OFFSET\s+(\d+)/i);
    if (limitMatch && offsetMatch) {
      const limit = parseInt(limitMatch[1]);
      const offset = parseInt(offsetMatch[1]);
      query = query.range(offset, offset + limit - 1);
    } else if (limitMatch) {
      query = query.limit(parseInt(limitMatch[1]));
    }

    if (countMatch) {
      const isDistinct = !!countMatch[1];
      const fieldName = countMatch[2];
      const alias = countMatch[3];

      if (fieldName === '*' && !isDistinct) {
        const { count, error } = await query;
        if (error) throw new Error(error.message);
        return { rows: [{ [alias]: count }], rowsAffected: 0 };
      } else {
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = data || [];
        let cnt = isDistinct 
          ? new Set(rows.map(r => r[fieldName]).filter(val => val !== null && val !== undefined)).size
          : rows.filter(r => r[fieldName] !== null && r[fieldName] !== undefined).length;
        return { rows: [{ [alias]: cnt }], rowsAffected: 0 };
      }
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') return { rows: [], rowsAffected: 0 };
      throw new Error(`[REST SELECT ${table}] ${error.message}`);
    }
    return { rows: data || [], rowsAffected: 0 };
  }

  // 2. INSERT queries
  const insertMatch = transformed.match(/^\s*INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)(.*?)$/is);
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
    const isIgnoreConflict = /ON CONFLICT DO NOTHING/i.test(rest);

    let q;
    if (onConflictMatch && !doNothing && !isIgnoreConflict) {
      q = sb.from(table).upsert(obj, { onConflict: onConflictColStr?.trim(), ignoreDuplicates: false });
    } else if (doNothing || isIgnoreConflict) {
      q = sb.from(table).upsert(obj, { onConflict: onConflictColStr?.trim() || 'id', ignoreDuplicates: true });
    } else {
      q = sb.from(table).insert(obj);
    }

    if (table === 'seed_meta') return { rows: [], rowsAffected: 1 };

    const { error } = await q;
    if (error) {
      if (error.code === '23505') return { rows: [], rowsAffected: 0 };
      throw new Error(`[REST INSERT ${table}] ${error.message}`);
    }
    return { rows: [], rowsAffected: 1 };
  }

  // 3. UPDATE queries
  const updateMatch = transformed.match(/^\s*UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)$/is);
  if (updateMatch) {
    const [, table, setStr, whereStr] = updateMatch;
    const setObj = {};
    const resolveArgs = (s) => s.replace(/\$(\d+)/g, (_, n) => {
      const val = args[parseInt(n) - 1];
      return typeof val === 'string' ? `|||${val}|||` : String(val ?? 'null');
    });

    const setPairs = setStr.split(',');
    for (const pair of setPairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const col = pair.substring(0, eqIdx).trim();
      let val = resolveArgs(pair.substring(eqIdx + 1).trim());

      if (val.startsWith('|||') && val.endsWith('|||')) {
        val = val.slice(3, -3);
      } else if (val === 'null') {
        val = null;
      } else {
        const num = Number(val);
        if (!isNaN(num) && val !== '') val = num;
      }
      if (col && col !== 'EXCLUDED.id') setObj[col] = val;
    }

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

  // 4. DELETE queries
  const deleteMatch = transformed.match(/^\s*DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+?)$/is);
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
      const inMatch = cond.match(/^(\w+)\s+IN\s*\(([^)]+)\)$/i);
      
      if (eqMatch) q = q.eq(eqMatch[1], eqMatch[2]);
      else if (numEqMatch) q = q.eq(numEqMatch[1], Number(numEqMatch[2]));
      else if (inMatch) {
        const vals = inMatch[2].split(',').map(v => v.trim().replace(/^'|'$/g, '').replace(/^\|\|\||\|\|\|$/g, ''));
        q = q.in(inMatch[1], vals);
      }
    }

    const { error } = await q;
    if (error) throw new Error(`[REST DELETE ${table}] ${error.message}`);
    return { rows: [], rowsAffected: 1 };
  }

  throw new Error(`[DB] Cannot parse SQL via REST: ${transformed.substring(0, 120)}`);
}

// ── JOIN fallback for Vercel REST ──────────────────────────────────────────────
async function executeJoinFallback(originalSql, transformed, args) {
  const sb = getSupabaseClient();

  const genericUserJobsJoin = transformed.match(
    /SELECT\s+j\.\*\s+FROM\s+(\w+)\s+(\w+)\s+JOIN\s+jobs\s+j\s+ON\s+\2\.job_id\s*=\s*j\.id\s+WHERE\s+\2\.user_id\s*=\s*\$1/i
  );

  if (genericUserJobsJoin) {
    const joinTable = genericUserJobsJoin[1];
    const userId = args[0];

    const { data: refs, error: refsErr } = await sb.from(joinTable)
      .select('job_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (refsErr) throw new Error(`[executeJoinFallback refs] ${refsErr.message}`);
    if (!refs || refs.length === 0) return { rows: [], rowsAffected: 0 };

    const jobIds = refs.map(r => r.job_id).filter(id => id !== null && id !== undefined);
    if (jobIds.length === 0) return { rows: [], rowsAffected: 0 };

    const { data: jobs, error: jobsErr } = await sb.from('jobs')
      .select('*')
      .in('id', jobIds);

    if (jobsErr) throw new Error(`[executeJoinFallback jobs] ${jobsErr.message}`);

    const jobsMap = {};
    if (jobs) {
      jobs.forEach(job => {
        jobsMap[job.id] = job;
      });
    }

    const orderedJobs = jobIds
      .map(id => jobsMap[id])
      .filter(job => !!job);

    return { rows: orderedJobs, rowsAffected: 0 };
  }

  console.warn('[DB] Unhandled JOIN in REST fallback — returning empty:', transformed.substring(0, 120));
  return { rows: [], rowsAffected: 0 };
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
  if (!transformed) return { rows: [], rowsAffected: 0 };

  // 1. Try Direct PostgreSQL Connection Pool if active
  if (_usePgPool) {
    try {
      return await executeViaPg(transformed, queryArgs);
    } catch (err) {
      if (err.code === '23505') return { rows: [], rowsAffected: 0 };
      if (err.code === '42701') return { rows: [], rowsAffected: 0 };
      if (err.code === '42P01') return { rows: [], rowsAffected: 0 };

      // Connection/Network limits (like Vercel IPv6 restrictions)
      console.warn('[DB Pool Failed] Falling back automatically to Supabase REST SDK:', err.message);
      _usePgPool = false; // Disable pool and fall through
    }
  }

  // 2. Self-Healing Fallback: Supabase REST SDK over IPv4 HTTPS
  if (transformed.match(/JOIN/i)) {
    try {
      return await executeJoinFallback(sql, transformed, queryArgs);
    } catch (err) {
      console.error('[DB REST JOIN Fallback Exception]:', err.message, 'SQL:', sql);
      throw err;
    }
  }

  try {
    return await executeViaRest(sql, transformed, queryArgs);
  } catch (err) {
    console.error('[DB REST Exception]:', err.message, 'SQL:', sql);
    throw err;
  }
}

// ── batch() ──
async function batch(statements, _mode) {
  const results = [];
  for (const stmt of statements) {
    results.push(await execute(stmt));
  }
  return results;
}

// ── initDb() ──
async function initDb() {
  try {
    const r = await execute('SELECT COUNT(*) as cnt FROM jobs');
    const cnt = r.rows[0]?.cnt ?? '?';
    console.log(`[DB] Database adapter initialized. Active Mode: ${_usePgPool ? 'TCP_ConnectionPool' : 'HTTPS_RestFallback'}. Jobs: ${cnt}`);
  } catch (e) {
    console.warn('[DB] initDb warning:', e.message);
  }
}

// ── ensureVercelUser ──
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

const dbAdapter = { execute, batch };
function getDb() { return dbAdapter; }
function getSupabase() { return getSupabaseClient(); }

module.exports = { getDb, initDb, ensureVercelUser, getSupabase, getPool };
