const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations } = require('../services/recommendation_engine');
const { getDb } = require('../db');

// Helper: compute form_status dynamically
const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;
    if (!start || !end) return 'CLOSED';
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';
    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    const diffDays = todayDays - endDays;
    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

// POST /api/ai/recommendations
// Frontend sends { appliedExams: [], page: 1, search: '', category: '' }
router.post('/recommendations', auth, async (req, res) => {
    try {
        const { appliedExams, page = 1, search = '', category = '' } = req.body;
        const userId = req.user.id;
        const db = getDb();
        const todayStr = getTodayIST();
        
        // FALLBACK: If no applied exams, return popular LIVE exams
        if (!appliedExams || appliedExams.length === 0) {
            const fallbackResult = await db.execute('SELECT * FROM jobs ORDER BY application_end_date DESC LIMIT 30');
            const fallbackJobs = fallbackResult.rows
                .map(job => ({ ...job, form_status: computeFormStatus(job, todayStr) }))
                .filter(j => j.form_status === 'LIVE' || j.form_status === 'UPCOMING');
            
            const pageSize = 10;
            const start = (page - 1) * pageSize;
            const data = fallbackJobs.slice(start, start + pageSize).map(job => ({
                id: job.id,
                job_name: job.job_name,
                organization: job.organization,
                job_category: job.job_category,
                form_status: job.form_status,
                application_start_date: job.application_start_date,
                application_end_date: job.application_end_date,
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                qualification_required: job.qualification_required,
                official_application_link: job.official_application_link,
                score: 0,
                explanation: 'Popular exam — mark exams as "Applied" for personalized recommendations'
            }));
            
            return res.json({ data, hasMore: fallbackJobs.length > start + pageSize, page });
        }

        // Use the rebuilt recommendation engine
        const result = await getRecommendations(userId, appliedExams, { page, search, category });
        
        return res.json(result);
    } catch (err) {
        console.error('Recommendation API error:', err);
        return res.status(500).json({ error: 'Server error generating recommendations' });
    }
});

// POST /ai/gap-analysis
router.post('/gap-analysis', auth, async (req, res) => {
    try {
        const { source_exam_ids, target_exam_id } = req.body;
        const db = getDb();

        const sourceExams = (await db.execute({
            sql: `SELECT * FROM jobs WHERE id IN (${source_exam_ids.map(() => '?').join(',')})`,
            args: source_exam_ids
        })).rows;

        const targetExam = (await db.execute({
            sql: 'SELECT * FROM jobs WHERE id = ?',
            args: [target_exam_id]
        })).rows[0];

        if (!targetExam) return res.status(404).json({ error: 'Target exam not found' });

        // Use local syllabus overlap instead of external Lyzr service
        const { syllabusOverlap } = require('../services/recommendation_engine');
        
        const combinedSourceSyllabus = sourceExams
            .map(e => e.syllabus || e.structured_syllabus_json || '')
            .join(' ');
        const targetSyllabus = targetExam.syllabus || targetExam.structured_syllabus_json || '';
        
        const overlapRatio = syllabusOverlap(combinedSourceSyllabus, targetSyllabus);
        
        const gapAnalysis = {
            topic_coverage_percentage: Math.round(overlapRatio * 100),
            source_exams: sourceExams.map(e => e.job_name),
            target_exam: targetExam.job_name,
            overlap_summary: overlapRatio > 0.7
                ? 'High syllabus overlap — your preparation covers most topics'
                : overlapRatio > 0.4
                    ? 'Moderate overlap — additional preparation needed for specific topics'
                    : 'Low overlap — significant new preparation required',
            action_plan: overlapRatio > 0.7
                ? 'Focus on exam-specific practice papers and previous year questions.'
                : overlapRatio > 0.4
                    ? 'Identify gap areas and dedicate focused study time to new topics.'
                    : 'Start with a complete syllabus review and build a new study plan.',
        };
        
        return res.json(gapAnalysis);
    } catch (err) {
        console.error('Gap Analysis API error:', err);
        return res.status(500).json({ error: 'Server error generating gap analysis' });
    }
});

module.exports = router;
