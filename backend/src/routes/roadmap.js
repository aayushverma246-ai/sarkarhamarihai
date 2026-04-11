const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const examSyllabusMap = {
    'UPSC': ['Indian Polity & Constitution', 'History of India & National Movement', 'Geography (World & India)', 'Economy', 'General Science & Tech'],
    'SSC': ['Quantitative Aptitude', 'General Intelligence & Reasoning', 'English Comprehension', 'General Awareness'],
    'Banking': ['Reasoning Ability', 'Quantitative Aptitude / Data Interpretation', 'English Language', 'General / Financial Awareness'],
    'Railways': ['Mathematics', 'General Intelligence & Reasoning', 'General Science', 'General Awareness (Current Affairs)'],
    'State PSCs': ['State History & Culture', 'State Geography & Economy', 'General Mental Ability', 'Current Events (State & National)'],
    'Defence': ['Mathematics', 'General Knowledge & Current Affairs', 'English', 'General Science'],
    'Police': ['General Knowledge', 'Reasoning', 'Numerical Ability', 'Current Affairs']
};

function generateDeterministicRoadmap(user, job) {
    const defaultSyllabus = examSyllabusMap[job.job_category] || examSyllabusMap['SSC'];
    const keywords = job.syllabus?.length > 10 ? 
        job.syllabus.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 3) : 
        defaultSyllabus;

    const subjects = keywords.length >= 4 ? keywords : defaultSyllabus;
    
    // Distribute subjects into 4 phases
    const chunkSize = Math.max(1, Math.ceil(subjects.length / 4));
    const p1 = subjects.slice(0, chunkSize);
    const p2 = subjects.slice(chunkSize, chunkSize * 2).length ? subjects.slice(chunkSize, chunkSize * 2) : [subjects[0] + " (Advanced)"];
    const p3 = subjects.slice(chunkSize * 2, chunkSize * 3).length ? subjects.slice(chunkSize * 2, chunkSize * 3) : ["Mock Tests & Revision"];
    const p4 = subjects.slice(chunkSize * 3).length ? subjects.slice(chunkSize * 3) : ["Current Affairs & Final Polish"];

    const studyHours = user.study_hours || 4;
    const isQualifying = user.qualification_status === 'Pursuing';
    
    const keyInsight = isQualifying 
        ? `Balancing ${job.job_category} prep with college studies requires strict time management. Dedicate ${studyHours}h/day.`
        : `Full-time prep advantage: Utilize ${studyHours}h/day systematically with 60% focus on ${p1[0] || 'core subjects'}.`;

    return {
        overview: {
            exam_name: job.job_name,
            readiness_score: 15,
            feasibility_status: studyHours >= 6 ? "High Probability" : "Achievable",
            recommended_daily_hours: studyHours,
            days_remaining: 120, // Blueprint standard
            key_insight: keyInsight,
            is_ready: true
        },
        syllabus_breakdown: [
            { subject: p1[0] || "Core Fundamentals", topics: p1, weightage: "High (35%)", priority_order: 1 },
            { subject: p2[0] || "Advanced Concepts", topics: p2, weightage: "High (30%)", priority_order: 2 },
            { subject: p3[0] || "Problem Solving", topics: p3, weightage: "Medium (20%)", priority_order: 3 },
            { subject: p4[0] || "Current Affairs", topics: p4, weightage: "Medium (15%)", priority_order: 4 }
        ],
        phase_plan: [
            { phase_name: "Phase 1: Foundation Building", duration: "Day 1 - Day 30", focus: "Concept clarity without timing pressure", daily_targets: p1.slice(0, 3).map(i => "Master " + i), milestone: "Complete NCERTs / Basic Textbooks" },
            { phase_name: "Phase 2: Core Mastery", duration: "Day 31 - Day 60", focus: "Sectional practice and short notes", daily_targets: p2.slice(0, 3).map(i => "Practice " + i), milestone: "Consistently scoring 60%+ in sectionals" },
            { phase_name: "Phase 3: Speed & Accuracy", duration: "Day 61 - Day 90", focus: "Full length mocks and time limits", daily_targets: p3.slice(0, 3).map(i => "Revise " + i), milestone: "Attempt 2 full mocks per week" },
            { phase_name: "Phase 4: Final Polish", duration: "Day 91 - Day 120", focus: "Current affairs and weak areas", daily_targets: ["Daily Current Affairs", "1 Mock Test Daily"], milestone: "Exam Readiness Peak" }
        ],
        daily_strategy: {
            morning: { duration: `${Math.ceil(studyHours * 0.4)} hours`, activities: ["Fresh mind concept studying: " + (p1[0] || "Core Subject"), "Note-making"] },
            afternoon: { duration: `${Math.ceil(studyHours * 0.4)} hours`, activities: ["Tackle calculation-heavy topics", "Solve 50+ MCQs"] },
            evening: { duration: `${Math.ceil(studyHours * 0.2)} hours`, activities: ["Daily current affairs digest", "Light revision of morning concepts"] }
        },
        weekly_strategy: {
            weekdays: `Focus heavily on ${job.job_category} static syllabus progression`,
            saturday: "Attempt 1 Previous Year Paper (PYP) in strict exam conditions",
            sunday: "Consolidated revision of the week + Error book maintenance"
        },
        resources: [
            { type: "Book", name: `Standard ${job.job_category} Reference Books`, purpose: "Concept Building" },
            { type: "Platform", name: "Textbook / Gradeup Mock Series", purpose: "Simulated Testing" },
            { type: "Resource", name: "The Hindu / Indian Express", purpose: "Current Affairs" }
        ],
        revision_plan: {
            method: "Active Recall + 1/3/7/28 Spaced Repetition",
            cycles: ["Cycle 1: Immediate weekend", "Cycle 2: End of month", "Cycle 3: Pre-exam mega sweep"],
            spaced_repetition: "Create an error log notebook and revise it every Sunday."
        },
        mock_test_strategy: {
            start_after: "Syllabus 50% completion",
            frequency: "1/week (Phase 2) -> 2/week (Phase 3) -> Daily (Phase 4)",
            analysis_method: "Post-test error log: categorize mistakes as Conceptual, Silly, or Unattempted",
            recommended_sources: ["Official Previous Year Papers", "Reputed Mock Series"]
        },
        weak_area_plan: {
            identification_method: "Identify topics scoring <50% in three consecutive mock tests",
            improvement_tactics: ["Re-watch foundational lectures", "Solve 100 dedicated questions on the weak topic"],
            time_allocation: "Allocate first 1 hour of the day exclusively to the weakest topic"
        },
        final_month_strategy: {
            last_30_days: "No new textbooks. Rely entirely on self-made short notes and mocks.",
            last_7_days: "One full-length mock alternate day. Fix sleep cycle to match exam timing.",
            exam_day: "Hydrate, carry admit card, read instructions. Use 3-pass attempt strategy.",
            mental_preparation: "Visualize success. Accept that 100% syllabus completion is a myth."
        },
        warnings: [
            "Do not chase multiple new resources in the last 30 days.",
            "Avoid skipping Mock Test analysis (Analysis > Giving Mocks).",
            "Do not ignore previous year question (PYQ) trends."
        ],
        success_formula: [
            "Consistency beats intensity.",
            "Revision > Reading new material.",
            "Exam temperament is 50% of the game."
        ],
        is_ready: true,
        is_permanent: true,
        tier: 1 // High quality deterministic
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

        // Generate High-Quality Structured Deterministic Roadmap synchronously
        const finalData = generateDeterministicRoadmap(userRow, jobRow);

        const responseData = { id: uuidv4(), job_id: jobId, roadmap_content: finalData, is_ready: true, is_permanent: true };

        await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?)',
            args: [responseData.id, userId, jobId, JSON.stringify(finalData)]
        });

        return res.status(200).json(responseData);
    } catch (e) {
        console.error('Roadmap DB Error:', e);
        return res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

module.exports = router;
