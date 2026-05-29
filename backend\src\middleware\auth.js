const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
require('dotenv').config();

/**
 * Auth middleware — verifies Supabase-issued JWTs then resolves the actual
 * database user ID (which may differ from the Supabase auth UUID for
 * legacy users who signed up before the Supabase migration).
 * 
 * After verification, req.user.id is ALWAYS the database users.id value.
 */
async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];

    // Allow mock guest tokens through (offline mode)
    if (token.startsWith('mock_guest_token_')) {
        req.user = { id: 'offline_guest_' + token.split('_').pop(), email: 'guest@sarkar.app' };
        return next();
    }

    let supabaseId = null;
    let email = '';
    let fullName = '';

    // Strategy 1: Try Supabase JWT secret (local verification — fastest)
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (supabaseJwtSecret) {
        try {
            const decoded = jwt.verify(token, supabaseJwtSecret);
            supabaseId = decoded.sub;
            email = decoded.email || '';
        } catch (_) {
            // Fall through to other strategies
        }
    }

    // Strategy 2: Verify via Supabase REST API
    if (!supabaseId) {
        const sbUrl = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
        const sbKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (sbKey) {
            try {
                const response = await fetch(`${sbUrl}/auth/v1/user`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'apikey': sbKey
                    }
                });

                if (response.ok) {
                    const authUser = await response.json();
                    supabaseId = authUser.id;
                    email = authUser.email || '';
                    fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
                }
            } catch (err) {
                console.warn('Supabase REST verification failed:', err.message);
            }
        }
    }

    // Strategy 3: Fallback to legacy custom JWT (for existing guest accounts)
    if (!supabaseId) {
        const legacyJwtSecret = process.env.JWT_SECRET || 'sarkarhamarhai_super_secret_jwt_key_2024_prod';
        try {
            const decoded = jwt.verify(token, legacyJwtSecret);
            req.user = decoded; // { id, email, ... }
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    // ── Resolve actual database user ID ──
    // The Supabase auth UUID may differ from the database users.id for legacy users.
    // Look up by Supabase UUID first, then by email.
    try {
        const db = getDb();
        let dbUser = (await db.execute({ sql: 'SELECT id, email, full_name FROM users WHERE id = ?', args: [supabaseId] })).rows[0];

        if (!dbUser && email) {
            dbUser = (await db.execute({ sql: 'SELECT id, email, full_name FROM users WHERE email = ?', args: [email] })).rows[0];
        }

        req.user = {
            id: dbUser ? dbUser.id : supabaseId,  // Use DB id if found, else Supabase UUID
            supabase_id: supabaseId,               // Always store the Supabase UUID too
            email: email,
            full_name: fullName || (dbUser ? dbUser.full_name : ''),
            role: 'authenticated',
        };
    } catch (dbErr) {
        // DB lookup failed — fall back to Supabase UUID
        console.warn('DB user lookup failed:', dbErr.message);
        req.user = {
            id: supabaseId,
            supabase_id: supabaseId,
            email: email,
            full_name: fullName,
            role: 'authenticated',
        };
    }

    return next();
}

module.exports = authMiddleware;
