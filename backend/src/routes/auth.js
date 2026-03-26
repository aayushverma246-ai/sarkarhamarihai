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
    const { password_hash, ...safe } = user;
    return safe;
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const {
            email, password, full_name, age, category, state,
            qualification_type, qualification_status,
            current_year, current_semester, expected_graduation_year
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDb();
        const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] })).rows[0];
        if (existing) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const id = generateId();

        await db.execute({
            sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state,
                qualification_type, qualification_status, current_year, current_semester, expected_graduation_year)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                id, email, password_hash,
                full_name || '', age || 0, category || '', state || '',
                qualification_type || '', qualification_status || '',
                current_year || 0, current_semester || 0, expected_graduation_year || 0
            ]
        });

        const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })).rows[0];
        const token = signToken(user);
        return res.status(201).json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: 'Server error during signup', details: err.message, stack: err.stack });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email/ID and password are required' });
        }

        const db = getDb();
        const user = (await db.execute({
            sql: 'SELECT * FROM users WHERE email = ? OR id = ?',
            args: [email, email]
        })).rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signToken(user);
        return res.json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Server error during login' });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    const db = getDb();
    const user = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] })).rows[0] || req.user;
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(safeUser(user));
});

// PUT /api/auth/me
router.put('/me', auth, async (req, res) => {
    try {
        const {
            full_name, age, category, state,
            qualification_type, qualification_status,
            current_year, current_semester, expected_graduation_year
        } = req.body;

        const db = getDb();
        await db.execute({
            sql: `UPDATE users SET
                full_name = ?, age = ?, category = ?, state = ?,
                qualification_type = ?, qualification_status = ?,
                current_year = ?, current_semester = ?, expected_graduation_year = ?
              WHERE id = ?`,
            args: [
                full_name || '', age || 0, category || '', state || '',
                qualification_type || '', qualification_status || '',
                current_year || 0, current_semester || 0, expected_graduation_year || 0,
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
