const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const auth = require('../middleware/auth');
require('dotenv').config();

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function signToken(user) {
    const { password_hash, ...safeProps } = user;
    return jwt.sign(
        safeProps,
        process.env.JWT_SECRET || 'sarkarhamarhai_super_secret_jwt_key_2024_prod',
        { expiresIn: '30d' }
    );
}

function safeUser(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/profile-setup
// Called after Supabase signup — creates user profile row in our DB.
// The Supabase access token is sent as Bearer token for authentication.
// ─────────────────────────────────────────────────────────────────────
router.post('/profile-setup', auth, async (req, res) => {
    try {
        const supabaseUserId = req.user.id;
        const email = req.user.email;

        const {
            full_name, age, category, state,
            qualification_type, qualification_status,
            current_year, current_semester, expected_graduation_year
        } = req.body;

        if (!full_name) {
            return res.status(400).json({ error: 'Full name is required' });
        }

        const db = getDb();

        // Check if user profile already exists
        let user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [supabaseUserId] })).rows[0];

        if (user) {
            // Update existing profile
            await db.execute({
                sql: `UPDATE users SET
                    full_name = ?, age = ?, category = ?, state = ?,
                    qualification_type = ?, qualification_status = ?,
                    current_year = ?, current_semester = ?, expected_graduation_year = ?,
                    email = ?
                  WHERE id = ?`,
                args: [
                    full_name || user.full_name,
                    age !== undefined ? age : user.age,
                    category || user.category,
                    state || user.state,
                    qualification_type || user.qualification_type,
                    qualification_status || user.qualification_status,
                    current_year !== undefined ? current_year : user.current_year,
                    current_semester !== undefined ? current_semester : user.current_semester,
                    expected_graduation_year !== undefined ? expected_graduation_year : user.expected_graduation_year,
                    email || user.email,
                    supabaseUserId
                ]
            });
        } else {
            // Also check by email (user might exist from old system)
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];

            if (user) {
                // Migrate: update their ID to Supabase ID
                await db.execute({
                    sql: `UPDATE users SET id = ?, full_name = ?, age = ?, category = ?, state = ?,
                        qualification_type = ?, qualification_status = ?,
                        current_year = ?, current_semester = ?, expected_graduation_year = ?
                      WHERE email = ?`,
                    args: [
                        supabaseUserId,
                        full_name || user.full_name,
                        age !== undefined ? age : user.age,
                        category || user.category,
                        state || user.state,
                        qualification_type || user.qualification_type,
                        qualification_status || user.qualification_status,
                        current_year !== undefined ? current_year : user.current_year,
                        current_semester !== undefined ? current_semester : user.current_semester,
                        expected_graduation_year !== undefined ? expected_graduation_year : user.expected_graduation_year,
                        email
                    ]
                });
            } else {
                // Create new user profile
                const password_hash = await bcrypt.hash(generateId() + generateId(), 10);
                await db.execute({
                    sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state,
                        qualification_type, qualification_status, current_year, current_semester, expected_graduation_year)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        supabaseUserId, email, password_hash,
                        full_name || '', age || 0, category || '', state || '',
                        qualification_type || '', qualification_status || '',
                        current_year || 0, current_semester || 0, expected_graduation_year || 0
                    ]
                });
            }
        }

        const finalUser = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [supabaseUserId] })).rows[0]
            || (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];

        return res.status(200).json({ user: safeUser(finalUser) });
    } catch (err) {
        console.error('Profile setup error:', err);
        return res.status(500).json({ error: 'Server error during profile setup', details: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/ensure-profile
// Lightweight endpoint called on login — ensures user has a DB row.
// If user doesn't exist yet, creates a minimal profile.
// ─────────────────────────────────────────────────────────────────────
router.post('/ensure-profile', auth, async (req, res) => {
    try {
        const supabaseUserId = req.user.id;
        const email = req.user.email || '';

        if (!supabaseUserId) {
            return res.status(400).json({ error: 'No user ID found in token' });
        }

        const db = getDb();

        // Check by Supabase ID first
        let user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [supabaseUserId] })).rows[0];

        if (user) {
            return res.json({ user: safeUser(user) });
        }

        // Check by email (migration from old system)
        if (email) {
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];
        }

        if (user) {
            // Migrate: update their ID to Supabase user ID
            try {
                await db.execute({
                    sql: 'UPDATE users SET id = ? WHERE email = ?',
                    args: [supabaseUserId, email]
                });
            } catch (migErr) {
                // ID conflict — user might already exist with this ID, just fetch
                console.warn('ID migration conflict, fetching existing:', migErr.message);
            }
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ? OR email = ?', args: [supabaseUserId, email] })).rows[0];
        } else {
            // Create minimal profile — use Google metadata if available
            const fullName = req.user.full_name || req.user.name || '';
            try {
                const password_hash = await bcrypt.hash(generateId() + generateId(), 10);
                await db.execute({
                    sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state,
                        qualification_type, qualification_status, current_year, current_semester, expected_graduation_year)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT (id) DO NOTHING`,
                    args: [
                        supabaseUserId, email, password_hash,
                        fullName, 0, 'General', 'All India',
                        'Graduation', 'Completed', 0, 0, 0
                    ]
                });
            } catch (insErr) {
                console.warn('Insert conflict, trying to fetch existing:', insErr.message);
            }
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ? OR email = ?', args: [supabaseUserId, email] })).rows[0];
        }

        if (!user) {
            return res.status(500).json({ error: 'Failed to create or find user profile' });
        }

        return res.json({ user: safeUser(user) });
    } catch (err) {
        console.error('Ensure profile error:', err);
        return res.status(500).json({ error: 'Server error ensuring profile', details: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/guest — Guest login (kept as-is)
// ─────────────────────────────────────────────────────────────────────
router.post('/guest', async (req, res) => {
    try {
        const guestEmail = 'guest@sarkar.app';
        const db = getDb();
        
        // 1. Try to fetch existing guest
        let user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [guestEmail] })).rows[0];
        
        // 2. If missing, create immediately
        if (!user) {
            const id = 'guest_user_' + Date.now();
            const password_hash = await bcrypt.hash('guestpass2026', 10);
            await db.execute({
                sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state,
                    qualification_type, qualification_status, current_year, current_semester, expected_graduation_year)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING`,
                args: [
                    id, guestEmail, password_hash,
                    'Guest User', 25, 'General', 'All India',
                    'Graduation', 'Completed', 0, 0, 0
                ]
            });
            // Fetch the newly inserted (or conflicted) user
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [guestEmail] })).rows[0];
        }

        if (!user) {
            throw new Error("Failed to provision guest user");
        }

        const token = signToken(user);
        return res.json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('Guest login error:', err);
        return res.status(500).json({ error: 'Server error during guest authentication' });
    }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/auth/me — Get current user profile
// ─────────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const db = getDb();
        // Try by ID first, then by email
        let user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0];
        
        if (!user && req.user.email) {
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [req.user.email] })).rows[0];
        }

        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(safeUser(user));
    } catch (err) {
        console.error('Get me error:', err);
        return res.status(500).json({ error: 'Server error fetching user profile' });
    }
});

// ─────────────────────────────────────────────────────────────────────
// PUT /api/auth/me — Update current user profile
// ─────────────────────────────────────────────────────────────────────
router.put('/me', auth, async (req, res) => {
    try {
        const {
            full_name, age, category, state,
            qualification_type, qualification_status,
            current_year, current_semester, expected_graduation_year
        } = req.body;

        const db = getDb();
        const existingRow = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0];
        if (!existingRow) return res.status(404).json({ error: 'User not found' });

        await db.execute({
            sql: `UPDATE users SET
                full_name = ?, age = ?, category = ?, state = ?,
                qualification_type = ?, qualification_status = ?,
                current_year = ?, current_semester = ?, expected_graduation_year = ?
              WHERE id = ?`,
            args: [
                full_name !== undefined ? full_name : existingRow.full_name,
                age !== undefined ? age : existingRow.age,
                category !== undefined ? category : existingRow.category,
                state !== undefined ? state : existingRow.state,
                qualification_type !== undefined ? qualification_type : existingRow.qualification_type,
                qualification_status !== undefined ? qualification_status : existingRow.qualification_status,
                current_year !== undefined ? current_year : existingRow.current_year,
                current_semester !== undefined ? current_semester : existingRow.current_semester,
                expected_graduation_year !== undefined ? expected_graduation_year : existingRow.expected_graduation_year,
                req.user.id
            ]
        });

        const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0];
        return res.json(safeUser(user));
    } catch (err) {
        console.error('Update user error:', err);
        return res.status(500).json({ error: 'Server error updating profile' });
    }
});

module.exports = router;
