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

function containsPlaceholder(text) {
    if (!text) return true;
    const lower = text.toLowerCase();
    const placeholders = [
        'placeholder', 'dummy', 'lorem', 'lorem ipsum', 'mock', 'test-exam',
        'sample exam', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'na', 'null'
    ];
    return placeholders.some(p => lower.includes(p));
}

const examResourcesMap = {
    'UPSC': [
        { type: "Book", name: "M. Laxmikanth - Indian Polity", purpose: "Indian Polity & Constitution" },
        { type: "Book", name: "Spectrum - Modern India (Rajiv Ahir)", purpose: "History of India & National Movement" },
        { type: "Book", name: "GC Leong - Certificate Physical and Human Geography", purpose: "Geography (World & India)" },
        { type: "Book", name: "Ramesh Singh - Indian Economy", purpose: "Economy" },
        { type: "Book", name: "Science & Technology - Ravi P. Agrahari", purpose: "General Science & Tech" },
        { type: "Platform", name: "Testbook / InsightsIAS Mock Series", purpose: "Simulated Testing & PYQs" },
        { type: "Resource", name: "The Hindu / Indian Express Newspaper", purpose: "Current Affairs & Editorial Analysis" }
    ],
    'SSC': [
        { type: "Book", name: "R.S. Aggarwal - Quantitative Aptitude", purpose: "Quantitative Aptitude" },
        { type: "Book", name: "R.S. Aggarwal - Verbal & Non-Verbal Reasoning", purpose: "General Intelligence & Reasoning" },
        { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "English Comprehension" },
        { type: "Book", name: "Lucent's General Knowledge", purpose: "General Awareness & Static GK" },
        { type: "Platform", name: "Testbook Mock Test Series", purpose: "Simulated Testing & Speed Improvement" },
        { type: "Resource", name: "Kiran Chapterwise Solved PYQs", purpose: "Practice of Past Exams" }
    ],
    'Banking': [
        { type: "Book", name: "M.K. Pandey - Analytical Reasoning", purpose: "Reasoning Ability" },
        { type: "Book", name: "Fast Track Objective Arithmetic - Rajesh Verma", purpose: "Quantitative Aptitude" },
        { type: "Book", name: "Wren & Martin - High School English Grammar", purpose: "English Language" },
        { type: "Book", name: "Pratiyogita Darpan / BankersAdda Capsule", purpose: "Banking, Economy & Financial Awareness" },
        { type: "Platform", name: "Adda247 / Testbook Mock Test Series", purpose: "Simulated Mock Tests" },
        { type: "Resource", name: "Oliveboard / PracticeMock Tests", purpose: "Advanced Level Sectional Practice" }
    ],
    'Railways': [
        { type: "Book", name: "Fast Track Objective Arithmetic - Rajesh Verma", purpose: "Mathematics" },
        { type: "Book", name: "Verbal & Non-Verbal Reasoning - Kiran Publication", purpose: "General Intelligence & Reasoning" },
        { type: "Book", name: "Lucent's General Science", purpose: "General Science Concepts" },
        { type: "Book", name: "Speedy Current Affairs & GK", purpose: "General Awareness" },
        { type: "Platform", name: "Testbook Online Mock Test Series", purpose: "Simulated Testing" }
    ],
    'State PSCs': [
        { type: "Book", name: "M. Laxmikanth - Indian Polity", purpose: "Polity & Constitution" },
        { type: "Book", name: "State Board Textbooks (Class VI to XII)", purpose: "State History, Geography & Culture" },
        { type: "Book", name: "Lucent's General Knowledge", purpose: "General Studies & Mental Ability" },
        { type: "Platform", name: "Testbook / State PSC Specific Mock Series", purpose: "Simulated Testing" },
        { type: "Resource", name: "Regional Newspaper & State Budget Reports", purpose: "State Current Affairs & Schemes" }
    ],
    'Defence': [
        { type: "Book", name: "Pathfinder NDA/CDS - Arihant Publications", purpose: "Mathematics & Core Subjects" },
        { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "English Language" },
        { type: "Book", name: "Lucent's General Science & GK", purpose: "General Knowledge & Science" },
        { type: "Platform", name: "Testbook Defence Mock Series", purpose: "Simulated Testing" }
    ],
    'Police': [
        { type: "Book", name: "Kiran Publication Police SI/Constable Guide", purpose: "Numerical & Reasoning Ability" },
        { type: "Book", name: "Lucent's General Knowledge", purpose: "General Knowledge & Science" },
        { type: "Book", name: "Speedy Current Affairs", purpose: "Current Affairs & Static Awareness" },
        { type: "Platform", name: "Testbook Police Exam Mock Series", purpose: "Simulated Testing" }
    ]
};

function generateDeterministicRoadmap(user, job) {
    const defaultSyllabus = examSyllabusMap[job.job_category] || examSyllabusMap['SSC'];
    const isSyllabusValid = job.syllabus && job.syllabus.trim().length > 10 && !containsPlaceholder(job.syllabus);
    
    const keywords = isSyllabusValid ? 
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

    const categoryMilestones = {
        'UPSC': {
            m1: "Complete basic UPSC NCERT books (Class 6-12) & Polity basics",
            m2: "Achieve 65%+ in Sectional GS Mocks & master Modern History",
            m3: "Attempt at least 15 Full-Length UPSC GS & CSAT Mocks",
            m4: "Revise 12 months Current Affairs & do final Mock drill"
        },
        'SSC': {
            m1: "Master basic Arithmetic concepts & English grammar rules",
            m2: "Score 70%+ in SSC Sectional tests & memorize static GK facts",
            m3: "Complete 20 Full-Length SSC Mocks with 80%+ accuracy",
            m4: "Revise last 6 months current affairs & formula sheets"
        },
        'Banking': {
            m1: "Understand all basic reasoning puzzle types & arithmetic shortcuts",
            m2: "Solve sectional mock tests under strict timing constraints",
            m3: "Attempt 25 banking mocks & analyze speed bottlenecks",
            m4: "Revise general banking awareness capsules & static financial terms"
        },
        'Railways': {
            m1: "Learn core general science concepts & fast arithmetic calculation",
            m2: "Achieve consistently 70%+ score in general intelligence practice sets",
            m3: "Complete 15 full-length Railway simulated mocks",
            m4: "Polish current affairs & attempt past 5 years official papers"
        },
        'State PSCs': {
            m1: "Acquire basic state history, culture, and geographic concepts",
            m2: "Score 60%+ in sectional mocks covering state administrative policies",
            m3: "Complete 10 state PSC state-specific GK mock modules",
            m4: "Review latest state budget, economic surveys, and welfare schemes"
        },
        'Defence': {
            m1: "Revise core mathematics syllabus & build daily physical conditioning",
            m2: "Achieve 65%+ in CDS/NDA sectional mock questionnaires",
            m3: "Complete 12 full-length simulated defence paper tests",
            m4: "Revise current events & brush up english grammar templates"
        },
        'Police': {
            m1: "Learn basic logical reasoning & solve general arithmetic formulas",
            m2: "Achieve 70%+ in SI/Constable local mock tests",
            m3: "Complete 15 full SI/Constable mock papers under exam conditions",
            m4: "Review local law guidelines, states GK, and recent current affairs"
        }
    };
    const milestones = categoryMilestones[job.job_category] || categoryMilestones['SSC'];

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
            { phase_name: "Phase 1: Foundation Building", duration: "Day 1 - Day 30", focus: "Concept clarity without timing pressure", daily_targets: p1.slice(0, 3).map(i => "Master " + i), milestone: milestones.m1 },
            { phase_name: "Phase 2: Core Mastery", duration: "Day 31 - Day 60", focus: "Sectional practice and short notes", daily_targets: p2.slice(0, 3).map(i => "Practice " + i), milestone: milestones.m2 },
            { phase_name: "Phase 3: Speed & Accuracy", duration: "Day 61 - Day 90", focus: "Full length mocks and time limits", daily_targets: p3.slice(0, 3).map(i => "Revise " + i), milestone: milestones.m3 },
            { phase_name: "Phase 4: Final Polish", duration: "Day 91 - Day 120", focus: "Current affairs and weak areas", daily_targets: ["Daily Current Affairs", "1 Mock Test Daily"], milestone: milestones.m4 }
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
        resources: examResourcesMap[job.job_category] || examResourcesMap['SSC'],
        revision_plan: {
            method: "Active Recall + 1/3/7/28 Spaced Repetition",
            cycles: ["Cycle 1: Immediate weekend", "Cycle 2: End of month", "Cycle 3: Pre-exam mega sweep"],
            spaced_repetition: "Create an error log notebook and revise it every Sunday."
        },
        mock_test_strategy: {
            start_after: "Syllabus 50% completion",
            frequency: "1/week (Phase 2) -> 2/week (Phase 3) -> Daily (Phase 4)",
            analysis_method: "Post-test error log: categorize mistakes as Conceptual, Silly, or Unattempted",
            recommended_sources: ["Official Previous Year Papers", "Testbook Mock Series"]
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

        // Fetch target exams for personalization (e.g. from user's liked jobs)
        let targets = [];
        try {
            const likedJobsRes = await db.execute({
                sql: 'SELECT j.job_name FROM liked_jobs l JOIN jobs j ON l.job_id = j.id WHERE l.user_id = ?',
                args: [userId]
            });
            targets = (likedJobsRes.rows || []).map(r => r.job_name);
        } catch (err) {
            // Ignore failure fetching targets
        }

        // Generate High-Quality Structured Premium AI Roadmap using Gemini
        const { generatePremiumRoadmapV9 } = require('../services/gemini');
        let finalData;
        try {
            finalData = await generatePremiumRoadmapV9(userRow, jobRow, jobRow.syllabus || jobRow.job_name || '', targets);
        } catch (err) {
            console.warn(`[AI Roadmap] Generation failed, falling back to deterministic: ${err.message}`);
            finalData = generateDeterministicRoadmap(userRow, jobRow);
        }

        const responseData = { id: uuidv4(), job_id: jobId, roadmap_content: finalData, is_ready: true, is_permanent: true };

        await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?)',
            args: [responseData.id, userId, jobId, JSON.stringify(finalData)]
        });

        // Generate a notification for the newly created roadmap
        const notifId = uuidv4();
        await db.execute({
            sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
            args: [notifId, userId, jobId, `✨ Your AI Master Roadmap for ${jobRow.job_name} is ready!`]
        });

        return res.status(200).json(responseData);
    } catch (e) {
        console.error('Roadmap DB Error:', e);
        return res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

module.exports = router;
