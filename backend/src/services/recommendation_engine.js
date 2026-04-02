const { getGapAnalysisWithLyzr } = require('./lyzr');
const { getDb } = require('../db');

/**
 * AI RECOMMENDATION ENGINE
 * 1. Build User Profile from applied exams.
 * 2. Compare with all available exams.
 * 3. Rank by syllabus overlap (>= 70%).
 */

async function buildUserProfile(appliedExams) {
    if (!appliedExams || appliedExams.length === 0) return null;

    const profile = {
        applied_exam_names: appliedExams.map(e => e.job_name),
        combined_syllabus: appliedExams.map(e => e.syllabus || e.structured_syllabus_json).join('\n'),
        categories: [...new Set(appliedExams.map(e => e.job_category))]
    };

    return profile;
}

async function getRecommendations(userId, appliedExams, filters = {}) {
    const { search = '', category = '' } = filters;
    const db = getDb();
    const userProfile = await buildUserProfile(appliedExams);
    if (!userProfile) return [];

    // Fetch candidate exams excluding already applied ones
    const appliedIds = appliedExams.map(e => e.id);
    let query = 'SELECT * FROM jobs WHERE id NOT IN (' + appliedIds.map(() => '?').join(',') + ')';
    let args = [...appliedIds];

    if (category && category !== 'All') {
        query += ' AND job_category = ?';
        args.push(category);
    }

    if (search) {
        query += ' AND (job_name LIKE ? OR organization LIKE ?)';
        args.push(`%${search}%`, `%${search}%`);
    }

    const candidates = (await db.execute({ sql: query, args })).rows;

    const recommendations = [];

    // Fast local filtering first (basic keyword overlap)
    // Then use Lyzr for deep analysis of top candidates
    for (const job of candidates) {
        const overlap = calculateBasicOverlap(userProfile.combined_syllabus, job.syllabus || job.structured_syllabus_json);
        
        // If basic overlap looks promising (>= 50% for local check), we'll do deeper AI analysis
        if (overlap >= 0.5 || (userProfile.categories.includes(job.job_category))) {
             // For production-ready, we might want to pre-calculate these or use a vector DB.
             // Given the constraints, we'll use a hybrid approach.
             recommendations.push({
                 id: job.id,
                 name: job.job_name,
                 basic_overlap: overlap,
                 job: job
             });
        }
    }

    // Sort by basic overlap and take top 10 for deep AI analysis
    const topCandidates = recommendations
        .sort((a, b) => b.basic_overlap - a.basic_overlap)
        .slice(0, 10);

    const finalResults = [];

    for (const cand of topCandidates) {
        try {
            const gapAnalysis = await getGapAnalysisWithLyzr(appliedExams, cand.job);
            
            if (gapAnalysis.topic_coverage_percentage >= 70) {
                finalResults.push({
                    exam_id: cand.id,
                    exam_name: cand.name,
                    overlap_percentage: gapAnalysis.topic_coverage_percentage,
                    gap_analysis: gapAnalysis,
                    action_plan: gapAnalysis.action_plan,
                    rank: 0 // Will assign after sorting
                });
            }
        } catch (err) {
            console.error(`Error analyzing ${cand.name}:`, err);
        }
    }

    // Final sorting and ranking
    const sorted = finalResults.sort((a, b) => b.overlap_percentage - a.overlap_percentage);
    return sorted.map((res, index) => ({ ...res, rank: index + 1 }));
}

function calculateBasicOverlap(syllabus1, syllabus2) {
    if (!syllabus1 || !syllabus2) return 0;
    
    const words1 = new Set(syllabus1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(syllabus2.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size / Math.min(words1.size, words2.size);
}

module.exports = { getRecommendations };
