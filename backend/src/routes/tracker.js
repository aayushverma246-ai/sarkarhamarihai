const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { generateDailyPlan, generatePlanDebrief } = require('../services/gemini');

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// --- TARGETS (MULTI-EXAM) ---
router.get('/targets', auth, async (req, res) => {
    try {
        const db = getDb();
        const targets = await db.execute({
            sql: 'SELECT * FROM tracker_user_targets WHERE user_id = ? ORDER BY created_at ASC',
            args: [req.user.id]
        });
        return res.json(targets.rows || []);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error retrieving targets' });
    }
});

router.post('/targets', auth, async (req, res) => {
    try {
        const { targets } = req.body;
        const db = getDb();

        // Fetch existing targets to understand what needs to be deleted
        const existingQuery = await db.execute({ sql: 'SELECT id FROM tracker_user_targets WHERE user_id = ?', args: [req.user.id] });
        const existingIds = new Set(existingQuery.rows?.map(r => r.id) || []);

        const incomingIds = new Set(targets.filter(t => t.id).map(t => t.id));

        // Delete targets that are no longer in the request
        for (const id of existingIds) {
            if (!incomingIds.has(id)) {
                await db.execute({ sql: 'DELETE FROM tracker_user_targets WHERE id = ?', args: [id] });
            }
        }

        // Upsert incoming targets
        for (const t of targets) {
            if (t.id && existingIds.has(t.id)) {
                await db.execute({
                    sql: 'UPDATE tracker_user_targets SET exam_name = ?, exam_date = ?, syllabus_completed_pct = ? WHERE id = ?',
                    args: [t.exam_name, t.exam_date || null, t.syllabus_completed_pct || 0, t.id]
                });
            } else {
                await db.execute({
                    sql: 'INSERT INTO tracker_user_targets (id, user_id, exam_name, exam_date, syllabus_completed_pct) VALUES (?, ?, ?, ?, ?)',
                    args: [generateId(), req.user.id, t.exam_name, t.exam_date || null, t.syllabus_completed_pct || 0]
                });
            }
        }

        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error saving targets' });
    }
});

// Generate the daily plan
router.post('/plan/generate', auth, async (req, res) => {
    try {
        const { wake_time, sleep_time, planned_hours, subjects, preferences } = req.body;
        const userId = req.user.id;
        const db = getDb();
        const today = new Date().toISOString().split('T')[0];

        // Ensure stats exist
        await db.execute({
            sql: `INSERT OR IGNORE INTO tracker_user_stats (user_id) VALUES (?)`,
            args: [userId]
        });

        const planId = generateId();

        // Check if plan already exists for today
        const existingPlan = await db.execute({
            sql: 'SELECT * FROM tracker_plans WHERE user_id = ? AND date = ?',
            args: [userId, today]
        });

        if (existingPlan.rows && existingPlan.rows.length > 0) {
            return res.status(400).json({ error: 'Plan already exists for today.' });
        }

        await db.execute({
            sql: `INSERT INTO tracker_plans (id, user_id, date, wake_time, sleep_time, planned_hours, status) VALUES (?, ?, ?, ?, ?, ?, 'planned')`,
            args: [planId, userId, today, wake_time, sleep_time, planned_hours]
        });

        let sessions = [];

        // Fetch active targets
        const targetsQuery = await db.execute({ sql: 'SELECT * FROM tracker_user_targets WHERE user_id = ?', args: [userId] });
        const activeTargets = targetsQuery.rows || [];
        const targetsContext = activeTargets.length > 0
            ? `\nActive Exam Targets:\n${activeTargets.map(t => `- ${t.exam_name} (Date: ${t.exam_date || 'TBD'}, Syllabus: ${t.syllabus_completed_pct}% complete)`).join('\n')}\nPrioritize overlaps and weight sessions heavily towards underprepared exams.`
            : "";

        const aiSessions = await generateDailyPlan(wake_time, sleep_time, planned_hours, subjects, preferences, targetsContext);
        if (aiSessions && Array.isArray(aiSessions)) {
            sessions = aiSessions;
        }

        if (sessions.length === 0) {
            // Heuristic Fallback
            sessions = [
                { start_time: "09:00 AM", end_time: "11:00 AM", session_type: "study", title: subjects[0] || "General Studies" },
                { start_time: "11:00 AM", end_time: "11:30 AM", session_type: "break", title: "Tea Break" },
                { start_time: "11:30 AM", end_time: "01:30 PM", session_type: "study", title: subjects[1] || "Quantitative Aptitude" },
                { start_time: "01:30 PM", end_time: "02:30 PM", session_type: "rest", title: "Lunch & Rest" },
                { start_time: "02:30 PM", end_time: "04:30 PM", session_type: "mock", title: "Mock Test Practice" },
                { start_time: "04:30 PM", end_time: "05:30 PM", session_type: "revision", title: "Daily Revision" }
            ];
        }

        // Setup exam name to ID map
        const examNameToId = {};
        activeTargets.forEach(t => examNameToId[t.exam_name] = t.id);

        // Insert sessions
        for (let s of sessions) {
            let targetId = null;
            if (s.exam_name && examNameToId[s.exam_name]) {
                targetId = examNameToId[s.exam_name];
            }
            await db.execute({
                sql: `INSERT INTO tracker_sessions (id, plan_id, exam_target_id, start_time, end_time, session_type, title, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                args: [generateId(), planId, targetId, s.start_time, s.end_time, s.session_type, s.title]
            });
        }

        return res.status(201).json({ planId, message: "Plan created successfully" });
    } catch (err) {
        console.error('Plan Generation Error:', err);
        return res.status(500).json({ error: 'Server error generating plan' });
    }
});

// Get today's plan
router.get('/plan/today', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDb();
        const today = new Date().toISOString().split('T')[0];

        const planQuery = await db.execute({
            sql: 'SELECT * FROM tracker_plans WHERE user_id = ? AND date = ?',
            args: [userId, today]
        });

        if (!planQuery.rows || planQuery.rows.length === 0) {
            return res.json({ plan: null, sessions: [] });
        }

        const plan = planQuery.rows[0];

        const sessionQuery = await db.execute({
            sql: 'SELECT * FROM tracker_sessions WHERE plan_id = ? ORDER BY id ASC', // Could order by start_time ideally
            args: [plan.id]
        });

        return res.json({ plan, sessions: sessionQuery.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Toggle session complete
router.put('/session/:id/toggle', auth, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { is_completed } = req.body;
        const db = getDb();

        await db.execute({
            sql: 'UPDATE tracker_sessions SET is_completed = ? WHERE id = ?',
            args: [is_completed ? 1 : 0, sessionId]
        });

        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Evaluate and get debrief
router.post('/plan/evaluate', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDb();
        const today = new Date().toISOString().split('T')[0];

        const planQuery = await db.execute({
            sql: 'SELECT * FROM tracker_plans WHERE user_id = ? AND date = ?',
            args: [userId, today]
        });

        if (!planQuery.rows || planQuery.rows.length === 0) {
            return res.status(404).json({ error: 'No plan found for today.' });
        }
        const plan = planQuery.rows[0];

        const sessionQuery = await db.execute({
            sql: 'SELECT * FROM tracker_sessions WHERE plan_id = ?',
            args: [plan.id]
        });

        let completedChunks = 0;
        let totalChunks = 0;

        sessionQuery.rows.forEach(s => {
            if (s.session_type !== 'break' && s.session_type !== 'rest') {
                totalChunks++;
                if (s.is_completed) completedChunks++;
            }
        });

        const percent = totalChunks > 0 ? (completedChunks / totalChunks) : 0;
        const computedCompletedHours = percent * plan.planned_hours;
        const productivityScore = Math.floor(percent * 100);

        await db.execute({
            sql: `UPDATE tracker_plans SET completed_hours = ?, productivity_score = ?, status = 'completed' WHERE id = ?`,
            args: [computedCompletedHours, productivityScore, plan.id]
        });

        // Update stats
        const statsQuery = await db.execute({ sql: 'SELECT * FROM tracker_user_stats WHERE user_id = ?', args: [userId] });
        let stats = statsQuery.rows[0];

        if (!stats) {
            await db.execute({ sql: `INSERT INTO tracker_user_stats (user_id) VALUES (?)`, args: [userId] });
            stats = { current_streak: 0, longest_streak: 0, total_study_hours: 0, overall_readiness_score: 50 };
        }

        let newStreak = stats.current_streak;
        if (productivityScore > 60) {
            newStreak += 1;
        } else {
            newStreak = 0;
        }

        let longest = Math.max(newStreak, stats.longest_streak);
        let updatedHours = Number(stats.total_study_hours) + Number(computedCompletedHours);

        // ── Data-driven readiness formula ──
        // Component 1: Average syllabus completion across all targets (40% weight)
        let avgSyllabusForReadiness = 0;
        const targetsForReadiness = await db.execute({ sql: 'SELECT syllabus_completed_pct FROM tracker_user_targets WHERE user_id = ?', args: [userId] });
        if (targetsForReadiness.rows && targetsForReadiness.rows.length > 0) {
            avgSyllabusForReadiness = targetsForReadiness.rows.reduce((acc, t) => acc + (t.syllabus_completed_pct || 0), 0) / targetsForReadiness.rows.length;
        }

        // Component 2: Study consistency — days studied in last 7 days (25% weight)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const consistencyQuery = await db.execute({
            sql: "SELECT COUNT(DISTINCT date) as days_studied FROM tracker_plans WHERE user_id = ? AND date >= ? AND status = 'completed'",
            args: [userId, sevenDaysAgo]
        });
        const daysStudied = consistencyQuery.rows[0]?.days_studied || 0;
        const consistencyScore = (daysStudied / 7) * 100;

        // Component 3: Average productivity of last 7 completed plans (20% weight)
        const recentPlansQuery = await db.execute({
            sql: "SELECT productivity_score FROM tracker_plans WHERE user_id = ? AND status = 'completed' ORDER BY date DESC LIMIT 7",
            args: [userId]
        });
        let avgProductivity = productivityScore; // fallback to today
        if (recentPlansQuery.rows && recentPlansQuery.rows.length > 0) {
            avgProductivity = recentPlansQuery.rows.reduce((acc, p) => acc + (p.productivity_score || 0), 0) / recentPlansQuery.rows.length;
        }

        // Component 4: Streak bonus (15% weight) — capped at 100
        const streakBonus = Math.min(newStreak * 5, 100);

        // Weighted readiness
        let updatedReadiness = Math.round(
            (0.40 * avgSyllabusForReadiness) +
            (0.25 * consistencyScore) +
            (0.20 * avgProductivity) +
            (0.15 * streakBonus)
        );
        updatedReadiness = Math.max(0, Math.min(100, updatedReadiness));

        // Advanced AI Probability Math (Logistic Regression approximation)
        let avgSyllabus = 0;
        const targetsQueryEval = await db.execute({ sql: 'SELECT * FROM tracker_user_targets WHERE user_id = ?', args: [userId] });
        if (targetsQueryEval.rows && targetsQueryEval.rows.length > 0) {
            avgSyllabus = targetsQueryEval.rows.reduce((acc, t) => acc + (t.syllabus_completed_pct || 0), 0) / targetsQueryEval.rows.length;
        }

        // Find Mock Test Ratio for today's sessions vs regular
        let mockRatio = 0.5; // default center weight if no data
        let totalSt = 0, totalMock = 0;
        sessionQuery.rows.forEach(s => {
            if (s.session_type === 'mock' && s.is_completed) totalMock++;
            if ((s.session_type === 'study' || s.session_type === 'revision') && s.is_completed) totalSt++;
        });
        if (totalSt > 0) mockRatio = totalMock / totalSt;

        // Calculate Z Score and Probability
        const currentStreak = Math.min(newStreak, 20);

        // Enhanced Logic: Factor in Exam Dates and Syllabus Progress
        let timePressureFactor = 0;
        let mostImminentDate = null;

        if (targetsQueryEval.rows && targetsQueryEval.rows.length > 0) {
            targetsQueryEval.rows.forEach(t => {
                if (t.exam_date) {
                    const daysLeft = Math.max(1, (new Date(t.exam_date) - new Date()) / (1000 * 60 * 60 * 24));
                    if (!mostImminentDate || daysLeft < mostImminentDate) {
                        mostImminentDate = daysLeft;
                    }
                }
            });
        }

        // If there's an imminent exam, calculate the pressure
        if (mostImminentDate) {
            // Pressure increases as days decrease and is mitigated by syllabus completion
            // More syllabus done = less pressure
            timePressureFactor = Math.max(-5, (30 - mostImminentDate) / 10) * (1 - (avgSyllabus / 100));
        }

        const Z = (0.25 * currentStreak) + (0.05 * avgSyllabus) + (2.0 * mockRatio) + (0.1 * updatedHours / 10) - 3.5 - timePressureFactor;
        const clearanceProbability = Math.ceil(100 / (1 + Math.exp(-Z)));

        await db.execute({
            sql: `UPDATE tracker_user_stats SET current_streak = ?, longest_streak = ?, total_study_hours = ?, overall_readiness_score = ?, target_probability = ? WHERE user_id = ?`,
            args: [newStreak, longest, updatedHours, updatedReadiness, clearanceProbability, userId]
        });

        let debrief = `You completed ${completedChunks} out of ${totalChunks} study sessions today. Your productivity score is ${productivityScore}%.`;
        const aiDebrief = await generatePlanDebrief({
            planned_hours: plan.planned_hours,
            completed_hours: computedCompletedHours,
            productivityScore,
            newStreak,
            avgSyllabus,
            mostImminentDate,
            clearanceProbability
        });
        if (aiDebrief) {
            debrief = aiDebrief;
        }

        return res.json({
            productivityScore,
            completedHours: computedCompletedHours,
            newStreak,
            readinessScore: updatedReadiness,
            debrief
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get history calendar matrix
router.get('/history', auth, async (req, res) => {
    try {
        const db = getDb();
        const userId = req.user.id;
        const plansQuery = await db.execute({
            sql: 'SELECT id, date, planned_hours, completed_hours, productivity_score, status FROM tracker_plans WHERE user_id = ? ORDER BY date DESC LIMIT 100',
            args: [userId]
        });
        return res.json({ history: plansQuery.rows || [] });
    } catch (err) {
        return res.status(500).json({ error: 'Server error retrieving history' });
    }
});

// Get specific history day
router.get('/history/:date', auth, async (req, res) => {
    try {
        const db = getDb();
        const userId = req.user.id;
        const date = req.params.date;
        const planQuery = await db.execute({
            sql: 'SELECT * FROM tracker_plans WHERE user_id = ? AND date = ?',
            args: [userId, date]
        });
        if (!planQuery.rows || planQuery.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const plan = planQuery.rows[0];
        const sessionsQuery = await db.execute({ sql: 'SELECT * FROM tracker_sessions WHERE plan_id = ? ORDER BY id ASC', args: [plan.id] });

        return res.json({ plan, sessions: sessionsQuery.rows || [] });
    } catch (err) {
        return res.status(500).json({ error: 'Server error retrieving history date' });
    }
});

// Get long term stats (enhanced with consistency + explanation)
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDb();
        const statsQuery = await db.execute({ sql: 'SELECT * FROM tracker_user_stats WHERE user_id = ?', args: [userId] });
        let stats;
        if (!statsQuery.rows || statsQuery.rows.length === 0) {
            await db.execute({ sql: `INSERT INTO tracker_user_stats (user_id) VALUES (?)`, args: [userId] });
            const newStats = await db.execute({ sql: 'SELECT * FROM tracker_user_stats WHERE user_id = ?', args: [userId] });
            stats = newStats.rows[0];
        } else {
            stats = statsQuery.rows[0];
        }

        // Study consistency: days studied in last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const consistencyQuery = await db.execute({
            sql: "SELECT COUNT(DISTINCT date) as days_studied FROM tracker_plans WHERE user_id = ? AND date >= ? AND status = 'completed'",
            args: [userId, sevenDaysAgo]
        });
        const daysStudiedThisWeek = consistencyQuery.rows[0]?.days_studied || 0;

        // Exam countdowns
        const targetsQuery = await db.execute({ sql: 'SELECT exam_name, exam_date, syllabus_completed_pct FROM tracker_user_targets WHERE user_id = ?', args: [userId] });
        const examCountdowns = [];
        const weakSubjects = [];
        if (targetsQuery.rows) {
            targetsQuery.rows.forEach(t => {
                if (t.exam_date) {
                    const daysLeft = Math.max(0, Math.ceil((new Date(t.exam_date) - new Date()) / (1000 * 60 * 60 * 24)));
                    examCountdowns.push({ exam_name: t.exam_name, days_left: daysLeft, syllabus_pct: t.syllabus_completed_pct || 0 });
                }
                if ((t.syllabus_completed_pct || 0) < 40) {
                    weakSubjects.push({ exam_name: t.exam_name, syllabus_pct: t.syllabus_completed_pct || 0 });
                }
            });
        }

        // Readiness explanation
        const readinessExplanation = `Based on syllabus completion (40%), study consistency (25%), productivity average (20%), and streak bonus (15%).`;

        return res.json({
            ...stats,
            days_studied_this_week: daysStudiedThisWeek,
            exam_countdowns: examCountdowns,
            weak_subjects: weakSubjects,
            readiness_explanation: readinessExplanation
        });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
