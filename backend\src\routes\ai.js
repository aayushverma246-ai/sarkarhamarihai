const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations } = require('../services/recommendation_engine');
const { getGapAnalysisWithLyzr, estimateLiveData } = require('../services/lyzr');
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
            console.log('[AI Recs] No applied exams, returning default LIVE exams as recommendations');
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
                explanation: 'Popular exam - mark exams as "applied" for personalized recommendations'
            }));
            
            return res.json({ data, hasMore: fallbackJobs.length > start + pageSize, page });
        }

        // Try AI engine first
        let results = [];
        try {
            results = await getRecommendations(userId, appliedExams, { page, search, category });
        } catch (engineErr) {
            console.error('[AI Recs] Engine failed:', engineErr.message);
        }
        
        // FALLBACK: If AI engine returns nothing, use local matching
        if (!results || results.length === 0) {
            console.log('[AI Recs] AI engine returned 0 results, using local category matching');
            
            const appliedIds = new Set(appliedExams.map(e => e.id));
            const categories = [...new Set(appliedExams.map(e => e.job_category).filter(Boolean))];
            
            const allJobs = (await db.execute('SELECT * FROM jobs')).rows;
            const candidateJobs = allJobs
                .filter(j => !appliedIds.has(j.id))
                .map(job => ({ ...job, form_status: computeFormStatus(job, todayStr) }));
            
            // Score by category match and status
            const scoredJobs = candidateJobs.map(job => {
                let score = 0;
                if (categories.includes(job.job_category)) score += 50;
                if (job.form_status === 'LIVE') score += 30;
                else if (job.form_status === 'UPCOMING') score += 20;
                
                // Basic syllabus overlap scoring
                const appliedSyllabus = appliedExams.map(e => e.syllabus || '').join(' ').toLowerCase();
                const jobSyllabus = (job.syllabus || '').toLowerCase();
                if (appliedSyllabus && jobSyllabus) {
                    const words1 = new Set(appliedSyllabus.split(/\W+/).filter(w => w.length > 3));
                    const words2 = new Set(jobSyllabus.split(/\W+/).filter(w => w.length > 3));
                    if (words1.size > 0 && words2.size > 0) {
                        const intersection = [...words1].filter(x => words2.has(x)).length;
                        score += Math.round((intersection / Math.min(words1.size, words2.size)) * 50);
                    }
                }
                
                return { ...job, recommendation_score: score };
            });
            
            results = scoredJobs
                .filter(j => j.recommendation_score > 0)
                .sort((a, b) => b.recommendation_score - a.recommendation_score)
                .slice(0, 30)
                .map(job => ({
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
                    similarity: job.recommendation_score,
                    explanation: `Matched via ${categories.includes(job.job_category) ? 'category' : 'syllabus'} similarity`
                }));
        }
        
        // Paginate results
        const pageSize = 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const data = results.slice(start, end);
        const hasMore = results.length > end;

        return res.json({ data, hasMore, page });
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

        const gapAnalysis = await getGapAnalysisWithLyzr(sourceExams, targetExam);
        return res.json(gapAnalysis);
    } catch (err) {
        console.error('Gap Analysis API error:', err);
        return res.status(500).json({ error: 'Server error generating gap analysis' });
    }
});

module.exports = router;
