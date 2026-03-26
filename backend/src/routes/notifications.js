const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
    const db = getDb();
    const notifications = (await db.execute({
        sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
        args: [req.user.id]
    })).rows;

    // Append 'Z' to created_at so Javascript parses it as UTC instead of local time
    const fixedNotifs = notifications.map(n => ({
        ...n,
        created_at: n.created_at.endsWith('Z') || n.created_at.includes('+')
            ? n.created_at
            : n.created_at + 'Z'
    }));

    return res.json(fixedNotifs);
});

// DELETE /api/notifications/all
router.delete('/all', auth, async (req, res) => {
    try {
        const db = getDb();
        await db.execute({
            sql: 'DELETE FROM notifications WHERE user_id = ?',
            args: [req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const db = getDb();
        await db.execute({
            sql: 'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.user.id]
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
