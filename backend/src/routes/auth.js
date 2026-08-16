const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { CANONICAL_STATES } = require('../constants');
require('dotenv').config();

function validateUserProfile(data, isUpdate = false) {
    const {
        full_name, age, category, state,
        qualification_type, qualification_status,
        current_year, current_semester, expected_graduation_year
    } = data;

    // 1. Full Name Validation
    if (!isUpdate || full_name !== undefined) {
        if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
            return 'Full name must be at least 2 characters long.';
        }
    }

    // 2. Age Validation
    if (!isUpdate || age !== undefined) {
        const parsedAge = Number(age);
        if (isNaN(parsedAge) || parsedAge < 14 || parsedAge > 100) {
            return 'Please enter a valid age between 14 and 100.';
        }
    }

    // 3. Category Validation
    if (!isUpdate || category !== undefined) {
        const validCategories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
        if (!category || !validCategories.includes(category)) {
            return `Category must be one of: ${validCategories.join(', ')}`;
        }
    }

    // 4. State Validation
    if (!isUpdate || state !== undefined) {
        const validStates = [...CANONICAL_STATES, 'All India'];
        if (!state || !validStates.includes(state)) {
            return 'Please select a valid Indian State or All India.';
        }
    }

    // 5. Qualification Type Validation
    if (!isUpdate || qualification_type !== undefined) {
        const validQualifications = ['Class 10', 'Class 12', 'Diploma', 'Graduation', 'Post Graduation', 'PhD'];
        if (!qualification_type || !validQualifications.includes(qualification_type)) {
            return 'Please select a valid qualification level.';
        }
    }

    // 6. Qualification Status Validation
    if (!isUpdate || qualification_status !== undefined) {
        const validStatuses = ['Completed', 'Pursuing'];
        if (!qualification_status || !validStatuses.includes(qualification_status)) {
            return 'Qualification status must be either Completed or Pursuing.';
        }
    }

    // 7. Educational Numeric Values Validation
    if (current_year !== undefined && current_year !== null && current_year !== '') {
        const yr = Number(current_year);
        if (isNaN(yr) || yr < 0 || yr > 10) {
            return 'Current year must be between 0 and 10.';
        }
    }
    if (current_semester !== undefined && current_semester !== null && current_semester !== '') {
        const sem = Number(current_semester);
        if (isNaN(sem) || sem < 0 || sem > 20) {
            return 'Current semester must be between 0 and 20.';
        }
    }
    if (expected_graduation_year !== undefined && expected_graduation_year !== null && expected_graduation_year !== '') {
        const gradYr = Number(expected_graduation_year);
        const thisYear = new Date().getFullYear();
        if (isNaN(gradYr) || (gradYr !== 0 && (gradYr < thisYear - 5 || gradYr > thisYear + 10))) {
            return 'Expected graduation year must be a valid year within range.';
        }
    }

    return null;
}

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

        const validationError = validateUserProfile(req.body, false);
        if (validationError) {
            return res.status(400).json({ error: validationError });
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
// The auth middleware already resolves the correct DB user ID.
// ─────────────────────────────────────────────────────────────────────
router.post('/ensure-profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email || '';

        if (!userId) {
            return res.status(400).json({ error: 'No user ID found in token' });
        }

        const db = getDb();

        // Check by resolved ID (middleware already resolved DB id)
        let user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] })).rows[0];

        if (!user && email) {
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];
        }

        if (!user) {
            // Create minimal profile for new users
            const fullName = req.user.full_name || '';
            const password_hash = await bcrypt.hash(generateId() + generateId(), 10);
            await db.execute({
                sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state,
                    qualification_type, qualification_status, current_year, current_semester, expected_graduation_year)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT (id) DO NOTHING`,
                args: [
                    userId, email, password_hash,
                    fullName, 0, 'General', 'All India',
                    'Graduation', 'Completed', 0, 0, 0
                ]
            });
            user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ? OR email = ?', args: [userId, email] })).rows[0];
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
// POST /api/auth/legacy-login
// Migrates old email/password users to Supabase Auth.
// Verifies bcrypt password from our DB, then creates the user in Supabase Auth.
// ─────────────────────────────────────────────────────────────────────
router.post('/legacy-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDb();

        // Find user in our DB
        const user = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify bcrypt password
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create user in Supabase Auth via admin API
        const sbUrl = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!sbKey) {
            return res.status(500).json({ error: 'Server misconfigured: missing service role key' });
        }

        // Try to create user in Supabase Auth (skip if already exists)
        try {
            const createRes = await fetch(`${sbUrl}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sbKey}`,
                    'apikey': sbKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    email_confirm: true, // Auto-confirm
                    user_metadata: {
                        full_name: user.full_name || '',
                    },
                }),
            });

            if (!createRes.ok) {
                const errData = await createRes.json().catch(() => ({}));
                // 422 = user already exists, which is fine
                if (createRes.status !== 422 && !errData.msg?.includes('already been registered')) {
                    console.warn('Supabase admin create user warning:', errData);
                }
            }
        } catch (createErr) {
            console.warn('Supabase admin create user error:', createErr.message);
        }

        return res.json({
            success: true,
            message: 'Account migrated to Supabase Auth. Please sign in again.',
            user: safeUser(user),
        });
    } catch (err) {
        console.error('Legacy login error:', err);
        return res.status(500).json({ error: 'Server error during legacy login', details: err.message });
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

        const validationError = validateUserProfile(req.body, true);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

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

        // Invalidate recommendations cache in database and memory
        try {
            const { invalidateRecommendationsCache } = require('../services/gemini_recommender');
            await invalidateRecommendationsCache(req.user.id);
        } catch (e) {
            console.error('Failed to invalidate recommendations cache on profile update:', e);
        }

        return res.json(safeUser(user));
    } catch (err) {
        console.error('Update user error:', err);
        return res.status(500).json({ error: 'Server error updating profile' });
    }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/register-device
// Saves or updates a device's push notification FCM/APNs token for a user.
// ─────────────────────────────────────────────────────────────────────
router.post('/register-device', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { token, deviceType } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Device token is required' });
        }

        const db = getDb();

        try {
            // Check if token already registered
            const existing = (await db.execute({
                sql: 'SELECT id FROM user_devices WHERE device_token = ?',
                args: [token]
            })).rows[0];

            if (existing) {
                // Update user link if it changed
                await db.execute({
                    sql: 'UPDATE user_devices SET user_id = ?, device_type = ?, created_at = NOW() WHERE device_token = ?',
                    args: [userId, deviceType || 'android', token]
                });
            } else {
                // Insert new device token record
                const id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                await db.execute({
                    sql: 'INSERT INTO user_devices (id, user_id, device_token, device_type) VALUES (?, ?, ?, ?)',
                    args: [id, userId, token, deviceType || 'android']
                });
            }
        } catch (dbErr) {
            // Suppress table missing errors gracefully so the app does not break, advising SQL migrations
            if (dbErr.message?.includes('does not exist') || dbErr.message?.includes('no such table')) {
                console.warn('[Push] user_devices table missing. Please run the SQL migration in Supabase SQL Editor:');
                console.warn('CREATE TABLE user_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_token TEXT UNIQUE, device_type TEXT, created_at TIMESTAMPTZ DEFAULT NOW());');
                return res.status(200).json({ success: false, warning: 'Migration required: user_devices table missing' });
            }
            throw dbErr;
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Register device token error:', err);
        return res.status(500).json({ error: 'Server error registering device token', details: err.message });
    }
});

module.exports = router;
