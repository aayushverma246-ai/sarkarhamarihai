const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * TIER 2 FALLBACK: Deterministic Lite JSON Roadmap
 * Builds a structured JSON object from syllabus keywords matching the 10-section format.
 */
function simulateLiteJSON(user, job) {
    const syllabus = job.syllabus || job.job_name;
    const keywords = syllabus.split(/[,;|(\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 2 && !k.includes('http'));

    const chunkSize = Math.max(1, Math.ceil(keywords.length / 4));
    const p1 = keywords.slice(0, chunkSize);
    const p2 = keywords.slice(chunkSize, chunkSize * 2);
    const p3 = keywords.slice(chunkSize * 2, chunkSize * 3);
    const p4 = keywords.slice(chunkSize * 3);

    return {
        overview: {
            exam_name: job.job_name,
            readiness_score: 15,
            feasibility_status: "Achievable",
            recommended_daily_hours: user.study_hours || 4,
            days_remaining: 90,
            key_insight: `Focus on ${job.job_category} fundamentals with ${user.study_hours || 4}h daily commitment.`
        },
        syllabus_breakdown: [
            { subject: p1[0] || "General Studies", topics: p1.slice(0, 4), weightage: "High", priority_order: 1 },
            { subject: p2[0] || "Core Topics", topics: p2.slice(0, 4), weightage: "High", priority_order: 2 },
            { subject: p3[0] || "Advanced Topics", topics: p3.slice(0, 4), weightage: "Medium", priority_order: 3 },
            { subject: p4[0] || "Current Affairs", topics: p4.slice(0, 4), weightage: "Medium", priority_order: 4 }
        ],
        phase_plan: [
            { phase_name: "Phase 1: Foundation Building", duration: "3 weeks", focus: "Core concepts & basics", daily_targets: p1.slice(0, 3), milestone: "Complete all basic topics" },
            { phase_name: "Phase 2: Core Mastery", duration: "4 weeks", focus: "In-depth subject study", daily_targets: p2.slice(0, 3), milestone: "Solve practice questions" },
            { phase_name: "Phase 3: Advanced Practice", duration: "3 weeks", focus: "Speed & accuracy", daily_targets: p3.slice(0, 3), milestone: "Attempt full-length mocks" },
            { phase_name: "Phase 4: Revision & Mocks", duration: "2 weeks", focus: "Final revision", daily_targets: ["Revise weak areas", "Mock tests daily"], milestone: "Exam readiness" }
        ],
        daily_strategy: {
            morning: { duration: "3 hours", activities: ["New topic study: " + (p1[0] || "Core concepts"), "Note-making and summaries"] },
            afternoon: { duration: "2 hours", activities: ["Practice questions from " + (p2[0] || "Previous topics"), "Solve previous year papers"] },
            evening: { duration: "2 hours", activities: ["Revision of morning topics", "Current affairs / General awareness"] }
        },
        weekly_strategy: {
            weekdays: "Rotate between " + job.job_category + " subjects systematically",
            saturday: "Full-length mock test + detailed error analysis",
            sunday: "Weekly revision of all topics covered + weak area focus"
        },
        resources: [
            { type: "Book", name: job.job_category + " standard textbook", purpose: "Concept building" },
            { type: "Platform", name: "Previous Year Papers", purpose: "Pattern understanding" },
            { type: "Platform", name: "Mock test platforms", purpose: "Timed practice" }
        ],
        revision_plan: {
            method: "Active Recall + Spaced Repetition",
            cycles: ["Cycle 1: After each topic completion", "Cycle 2: Weekly consolidated revision", "Cycle 3: Pre-exam full syllabus sweep"],
            spaced_repetition: "Review notes at Day 1, Day 3, Day 7, Day 14, Day 30 intervals"
        },
        mock_test_strategy: {
            start_after: "Phase 2 completion",
            frequency: "2 per week initially, daily in last month",
            analysis_method: "Post-test error log: categorize mistakes as conceptual, silly, or time-management",
            recommended_sources: ["Official previous year papers", job.job_category + " mock test series"]
        },
        weak_area_plan: {
            identification_method: "Track errors in mock tests by subject and topic",
            improvement_tactics: ["Dedicate 30 min daily to weakest subject", "Use targeted topic-wise quizzes", "Create formula/shortcut sheets"],
            time_allocation: "20% of daily study time for weak areas"
        },
        final_month_strategy: {
            last_30_days: "Only revision + mocks. No new topics. 2 mocks per week minimum.",
            last_7_days: "Light revision, formula sheets, stay calm. One mock every alternate day.",
            exam_day: "Reach early, carry all documents, read questions carefully, attempt easy ones first.",
            mental_preparation: "Get 7-8 hours of sleep, eat light, avoid last-minute cramming."
        },
        warnings: [
            "Do not skip any section of the syllabus",
            "Avoid starting new topics in the final month",
            "Manage time strictly — each subject has a deadline"
        ],
        success_formula: [
            "Consistency beats intensity — show up every day",
            "Mock tests are non-negotiable from Phase 2 onwards",
            "Track progress weekly and adjust plan accordingly"
        ],
        is_ready: true,
        is_permanent: true,
        tier: 2
    };
}

// GET /api/roadmap/:id/roadmap
router.get('/:id/roadmap', auth, async (req, res) => {
    const db = getDb();
    try {
        const roadmap = (await db.execute({
            sql: 'SELECT * FROM roadmaps WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, req.params.id]
        })).rows[0];
        if (!roadmap) return res.status(404).json({ error: 'No roadmap found' });

        // Roadmaps are stored as JSON strings
        const content = typeof roadmap.roadmap_content === 'string' ? JSON.parse(roadmap.roadmap_content) : roadmap.roadmap_content;
        return res.json({ ...roadmap, roadmap_content: content });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to parse roadmap' });
    }
});

// POST /api/roadmap/:id/roadmap
router.post('/:id/roadmap', auth, async (req, res) => {
    let jobId, userId, db;
    try {
        jobId = req.params.id;
        userId = req.user.id;
        db = getDb();

        const userRow = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] })).rows[0] || req.user;
        const jobRow = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [jobId] })).rows[0];

        if (!jobRow) return res.status(404).json({ error: 'Exam not found' });

        // Rule 1: ONE-SHOT ONLY — no regeneration
        const existing = await db.execute({
            sql: 'SELECT * FROM roadmaps WHERE user_id = ? AND job_id = ?',
            args: [userId, jobId]
        });

        if (existing.rows && existing.rows.length > 0) {
            console.log(`[V14 MASTER GUIDE] Blocking regeneration for ${userId} @ ${jobId}`);
            return res.status(200).json({
                ...existing.rows[0],
                roadmap_content: typeof existing.rows[0].roadmap_content === 'string'
                    ? JSON.parse(existing.rows[0].roadmap_content)
                    : existing.rows[0].roadmap_content,
                is_ready: true,
                is_permanent: true
            });
        }

        // Rule 2: Immediately respond with loading state
        const liteData = {
            overview: {
                exam_name: jobRow.job_name,
                days_remaining: 90,
                readiness_score: 0,
                feasibility_status: "Synthesizing Master Guide...",
                recommended_daily_hours: userRow.study_hours || 4,
                key_insight: "AI Coach is auditing your profile vs exam requirements...",
                is_ready: false
            },
            syllabus_breakdown: [],
            phase_plan: [{ phase_name: "Master Guide Initializing...", duration: "Personalizing Blueprint", daily_targets: ["AI Coach auditing your data vs Exam requirements"], milestone: "Loading..." }],
            daily_strategy: {},
            weekly_strategy: {},
            resources: [],
            revision_plan: {},
            mock_test_strategy: {},
            weak_area_plan: {},
            final_month_strategy: {},
            warnings: [],
            success_formula: []
        };

        const responseData = { id: uuidv4(), job_id: jobId, roadmap_content: liteData };

        await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?)',
            args: [responseData.id, userId, jobId, JSON.stringify(liteData)]
        });

        res.status(200).json(responseData);

        // Rule 3: Background Master Guide Generation
        (async () => {
            const bgDb = require('../db').getDb();
            try {
                const targetsQuery = await bgDb.execute({ sql: 'SELECT exam_name FROM tracker_user_targets WHERE user_id = ?', args: [userId] });
                const targets = (targetsQuery.rows || []).map(t => t.exam_name);

                const { generatePremiumRoadmapV9 } = require('../services/gemini');
                const finalData = await generatePremiumRoadmapV9(userRow, jobRow, jobRow.syllabus || jobRow.job_name, targets);

                finalData.is_ready = true;
                finalData.is_permanent = true;
                // Preserve the exam name in overview
                if (finalData.overview) {
                    finalData.overview.exam_name = jobRow.job_name;
                    finalData.overview.is_ready = true;
                }

                await bgDb.execute({
                    sql: 'UPDATE roadmaps SET roadmap_content = ? WHERE id = ?',
                    args: [JSON.stringify(finalData), responseData.id]
                });
                console.log(`[V14 MASTER GUIDE] Success for ${userId}`);
            } catch (bgErr) {
                console.error("[V14 MASTER GUIDE] BG Fail:", bgErr.message);
                // Use deterministic fallback
                const fallbackData = simulateLiteJSON(userRow, jobRow);
                fallbackData.is_ready = true;
                fallbackData.is_permanent = true;
                fallbackData.generation_note = "Generated using deterministic fallback. AI service was temporarily unavailable.";
                await bgDb.execute({
                    sql: 'UPDATE roadmaps SET roadmap_content = ? WHERE id = ?',
                    args: [JSON.stringify(fallbackData), responseData.id]
                });
            }
        })();

    } catch (err) {
        console.error('[ROADMAP V14] CRITICAL:', err);
        if (!res.headersSent) {
            return res.status(200).json({
                id: uuidv4(),
                job_id: req.params.id,
                roadmap_content: { overview: { exam_name: "Loading...", feasibility_status: "Calculating", is_ready: false } }
            });
        }
    }
});

module.exports = router;
