const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Auth middleware — verifies Supabase-issued JWTs.
 * 
 * Strategy:
 * 1. Mock guest tokens → pass through with synthetic user
 * 2. Supabase JWT secret (local verification, fastest) → if SUPABASE_JWT_SECRET is set
 * 3. Supabase REST API verification → calls /auth/v1/user with the token
 * 4. Legacy custom JWT fallback → for existing guest sessions
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

    // Strategy 1: Try Supabase JWT secret (local verification — fastest)
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (supabaseJwtSecret) {
        try {
            const decoded = jwt.verify(token, supabaseJwtSecret);
            req.user = {
                id: decoded.sub,
                email: decoded.email || '',
                role: decoded.role || 'authenticated',
            };
            return next();
        } catch (_) {
            // Fall through to other strategies
        }
    }

    // Strategy 2: Verify via Supabase REST API
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
                req.user = {
                    id: authUser.id,
                    email: authUser.email || '',
                    role: authUser.role || 'authenticated',
                    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
                };
                return next();
            }
        } catch (err) {
            // Fall through to legacy verification
            console.warn('Supabase REST verification failed:', err.message);
        }
    }

    // Strategy 3: Fallback to legacy custom JWT (for existing guest accounts)
    const legacyJwtSecret = process.env.JWT_SECRET || 'sarkarhamarhai_super_secret_jwt_key_2024_prod';
    try {
        const decoded = jwt.verify(token, legacyJwtSecret);
        req.user = decoded; // { id, email, ... }
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;
