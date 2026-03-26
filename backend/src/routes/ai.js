const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { batchSyllabusMatch } = require('../services/gemini');
const { v4: uuidv4 } = require('uuid');

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function meetsStateCriteria(user, job) {
    if (!user) return true;
    const textToSearch = (job.job_name + ' ' + (job.organization || ''));
    const userState = (user.state || '').toLowerCase();

    const mentionedStates = indianStates.filter(state => {
        const regex = new RegExp(`(?:^|\\s|,)${escapeRegex(state)}(?:\\s|,|$)`, 'i');
        return regex.test(textToSearch);
    });

    if (mentionedStates.length === 0) return true;
    if (!userState) return true;
    if (mentionedStates.some(state => state.toLowerCase() === userState)) return true;
    return false;
}

function getLocation(job) {
    const textToSearch = (job.job_name + ' ' + (job.organization || ''));
    const mentionedStates = indianStates.filter(state => {
        const regex = new RegExp(`(?:^|\\s|,)${escapeRegex(state)}(?:\\s|,|$)`, 'i');
        return regex.test(textToSearch);
    });
    return mentionedStates.length > 0 ? mentionedStates[0] : 'All India';
}

/** Compute eligibility score (0-100) based on user profile vs job requirements */
function computeEligibilityScore(user, job) {
    if (!user) return 50;
    let score = 0;
    let factors = 0;

    // Age match
    const userAge = user.age || 0;
    if (userAge > 0 && job.minimum_age && job.maximum_age) {
        factors++;
        if (userAge >= job.minimum_age && userAge <= job.maximum_age) {
            score += 100;
        } else if (userAge < job.minimum_age) {
            const gap = job.minimum_age - userAge;
            score += Math.max(0, 100 - gap * 20);
        } else {
            const gap = userAge - job.maximum_age;
            score += Math.max(0, 100 - gap * 20);
        }
    }

    // Qualification match
    const qualOrder = ['Class 10', 'Class 12', 'Graduation', 'Post Graduation', 'PhD'];
    const userQualIdx = qualOrder.indexOf(user.qualification_type || '');
    const jobQualIdx = qualOrder.indexOf(job.qualification_required || '');
    if (userQualIdx >= 0 && jobQualIdx >= 0) {
        factors++;
        if (userQualIdx >= jobQualIdx) {
            score += 100; // meets or exceeds requirement
        } else {
            score += Math.max(0, 100 - (jobQualIdx - userQualIdx) * 30);
        }
    }

    // Category relevance
    if (user.category && job.job_category) {
        factors++;
        score += 70; // base relevance
    }

    return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * AI Recommendation Engine V14.0 — Production Rebuild
 * - Parameterized SQL (no injection)
 * - Processes ALL applied exams (not just 2)
 * - Expands candidate pool to 30
 * - Includes eligibility scoring and gap analysis
 */
router.post('/recommendations', auth, async (req, res) => {
    try {
        const { appliedExams, page = 1, search = '', category = '' } = req.body;
        const limit = 6;

        if (!appliedExams || appliedExams.length === 0) {
            return res.json({ data: [], total: 0, page: 1, hasMore: false });
        }

        const db = getDb();
        const userId = req.user.id;

        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE id = ?',
            args: [userId]
        });
        const user = userResult.rows[0];

        // Build parameterized SQL for search/category filtering
        let sql = 'SELECT id, job_name, organization, syllabus, job_category, form_status, minimum_age, maximum_age, qualification_required, salary_min, salary_max, application_start_date, application_end_date, official_application_link FROM jobs WHERE 1=1';
        const sqlArgs = [];

        if (search) {
            sql += ' AND (job_name LIKE ? OR organization LIKE ?)';
            sqlArgs.push(`%${search}%`, `%${search}%`);
        }
        if (category && category !== 'All') {
            sql += ' AND job_category = ?';
            sqlArgs.push(category);
        }

        const jobsResult = await db.execute({ sql, args: sqlArgs });
        const allJobs = jobsResult.rows;

        const appliedIds = new Set(appliedExams.map(j => j.id));
        let candidateJobs = allJobs.filter(j => !appliedIds.has(j.id) && meetsStateCriteria(user, j));

        // Load cached recommendations
        const appliedDbIds = appliedExams.map(e => e.id);
        let cacheMap = new Map();
        if (appliedDbIds.length > 0) {
            const placeholders = appliedDbIds.map(() => '?').join(',');
            const cachedPairsResult = await db.execute({
                sql: `SELECT * FROM ai_recommendations WHERE source_job_id IN (${placeholders})`,
                args: appliedDbIds
            });
            for (const row of cachedPairsResult.rows) {
                cacheMap.set(`${row.source_job_id}_${row.target_job_id}`, row);
            }
        }

        // PRE-FILTER candidates with quick keyword + category scoring → top 30
        const scoredCandidates = candidateJobs.map(job => {
            let score = 0;
            const jobText = (job.job_name + ' ' + (job.organization || '') + ' ' + (job.syllabus || '')).toLowerCase();
            for (const applied of appliedExams) {
                const appliedText = ((applied.job_name || '') + ' ' + (applied.syllabus || '')).toLowerCase();
                const appliedWords = appliedText.split(/\s+/).filter(w => w.length > 3);
                for (const word of appliedWords) {
                    if (jobText.includes(word)) score += 5;
                }
                if (job.job_category === applied.job_category) score += 25;
            }
            // Eligibility bonus
            score += computeEligibilityScore(user, job) * 0.3;
            return { job, score };
        });

        const prioritizedJobs = scoredCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 30)
            .map(item => item.job);

        const resultMap = new Map();

        // Process ALL applied exams (batch in groups of 3 for API efficiency)
        const appliedBatches = [];
        for (let i = 0; i < appliedExams.length; i += 3) {
            appliedBatches.push(appliedExams.slice(i, i + 3));
        }

        for (const batch of appliedBatches) {
            for (const applied of batch) {
                const sourceSyllabus = applied.syllabus || applied.job_name;
                const toAnalyze = [];

                for (const target of prioritizedJobs) {
                    const key = `${applied.id}_${target.id}`;
                    const cached = cacheMap.get(key);

                    if (cached) {
                        let overlapping = [];
                        let missing = [];
                        try { overlapping = JSON.parse(cached.common_topics || '[]'); } catch (e) { }
                        try { missing = JSON.parse(cached.missing_topics || '[]'); } catch (e) { }

                        const fullResult = {
                            ...target,
                            similarity: cached.overlap_percentage,
                            overlapping_topics: overlapping,
                            missing_topics: missing,
                            difficulty_gap: cached.difficulty_gap || 'medium',
                            explanation: cached.explanation || "Strict syllabus overlap match.",
                            location: getLocation(target),
                            eligibility_score: computeEligibilityScore(user, target)
                        };
                        const existing = resultMap.get(target.id);
                        if (!existing || fullResult.similarity > existing.similarity) {
                            resultMap.set(target.id, fullResult);
                        }
                    } else {
                        toAnalyze.push(target);
                    }
                }

                if (toAnalyze.length > 0) {
                    try {
                        const batches = await batchSyllabusMatch(sourceSyllabus, toAnalyze);
                        for (const match of batches) {
                            const target = toAnalyze.find(j => j.id === match.id);
                            if (!target) continue;

                            const similarity = match.similarity || 0;
                            const fullResult = {
                                ...target,
                                similarity,
                                overlapping_topics: match.overlapping_topics || [],
                                missing_topics: match.missing_topics || [],
                                difficulty_gap: match.difficulty_gap || 'medium',
                                explanation: match.explanation || "Syllabus match detected.",
                                location: getLocation(target),
                                eligibility_score: computeEligibilityScore(user, target)
                            };

                            const existing = resultMap.get(target.id);
                            if (!existing || similarity > existing.similarity) {
                                resultMap.set(target.id, fullResult);
                            }

                            // Cache the result
                            try {
                                await db.execute({
                                    sql: `INSERT OR REPLACE INTO ai_recommendations (id, user_id, source_job_id, target_job_id, overlap_percentage, common_topics, missing_topics, explanation)
                                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    args: [
                                        uuidv4(), 'SYSTEM', applied.id, target.id, similarity,
                                        JSON.stringify(match.overlapping_topics || []),
                                        JSON.stringify(match.missing_topics || []),
                                        match.explanation || ""
                                    ]
                                });
                            } catch (err) { /* cache write failure is non-critical */ }
                        }
                    } catch (aiErr) {
                        console.error('[AI] Batch analysis error:', aiErr.message);
                        // Continue with other applied exams even if one fails
                    }
                }
            }
        }

        // STRICT 70% FILTER + composite ranking
        const results = Array.from(resultMap.values())
            .filter(r => r.similarity >= 70)
            .sort((a, b) => {
                // Primary: overlap percentage
                if (b.similarity !== a.similarity) return b.similarity - a.similarity;
                // Secondary: eligibility score
                if ((b.eligibility_score || 0) !== (a.eligibility_score || 0)) return (b.eligibility_score || 0) - (a.eligibility_score || 0);
                // Tertiary: LIVE exams first
                if (a.form_status === 'LIVE' && b.form_status !== 'LIVE') return -1;
                if (b.form_status === 'LIVE' && a.form_status !== 'LIVE') return 1;
                return 0;
            });

        const total = results.length;
        const pageNum = parseInt(page, 10) || 1;
        const skip = (pageNum - 1) * limit;
        const paginated = results.slice(skip, skip + limit);

        return res.json({ data: paginated, total, page: pageNum, hasMore: skip + limit < total });

    } catch (err) {
        console.error('[AI] V14.0 Error:', err.message);
        return res.status(500).json({ error: "AI Engine processing error. Please retry." });
    }
});

module.exports = router;
