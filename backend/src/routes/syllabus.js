const express = require('express');
const router = express.Router();
const { compareSyllabi, batchCompareSyllabi } = require('../services/gemini');
const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/syllabus/match
 * Rebuilds syllabus matching logic with Gemini and caching.
 */
/**
 * POST /api/syllabus/match
 * Rebuilds syllabus matching logic with Gemini and caching.
 */
router.post('/match', async (req, res) => {
    try {
        const { appliedExams, allExams } = req.body;

        if (!appliedExams || !Array.isArray(appliedExams) || !allExams || !Array.isArray(allExams)) {
            return res.status(400).json({ error: "Invalid request format. Expecting appliedExams and allExams arrays." });
        }

        const db = getDb();
        const results = [];
        const cacheCheckedPairs = new Set();
        const appliedIds = new Set(appliedExams.map(e => e.id));
        const candidateExams = allExams.filter(e => !appliedIds.has(e.id));

        for (const source of appliedExams) {
            const sourceId = source.id;
            const sourceSyllabus = source.syllabus || "";
            if (!sourceSyllabus) continue;

            const cachedMatches = await db.execute({
                sql: 'SELECT target_job_id, overlap_percentage, common_topics as reason FROM ai_recommendations WHERE source_job_id = ?',
                args: [sourceId]
            });

            const cachedMap = new Map();
            (cachedMatches.rows || []).forEach(m => cachedMap.set(m.target_job_id, { similarity: m.overlap_percentage, reason: m.reason }));
            const toAnalyze = [];

            for (const target of candidateExams) {
                const targetId = target.id;
                const cacheKey = `${sourceId}_${targetId}`;
                if (cacheCheckedPairs.has(cacheKey)) continue;
                cacheCheckedPairs.add(cacheKey);

                if (cachedMap.has(targetId)) {
                    results.push({
                        ...target,
                        similarity: cachedMap.get(targetId).similarity,
                        reason: cachedMap.get(targetId).reason
                    });
                } else {
                    toAnalyze.push(target);
                }
            }

            if (toAnalyze.length > 0) {
                const newMatches = await batchCompareSyllabi(sourceSyllabus, toAnalyze);
                
                for (const match of newMatches) {
                    const targetExam = toAnalyze.find(e => e.id === match.id);
                    if (!targetExam) continue;

                    results.push({
                        ...targetExam,
                        similarity: match.similarity,
                        reason: match.reason
                    });

                    try {
                        await db.execute({
                            sql: `INSERT OR REPLACE INTO ai_recommendations (id, user_id, source_job_id, target_job_id, overlap_percentage, common_topics, missing_topics) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            args: [uuidv4(), 'SYSTEM', sourceId, match.id, match.similarity, match.reason, '']
                        });
                    } catch (err) {
                        console.error("Cache Insertion Error:", err);
                    }
                }
            }
        }

        const finalMap = new Map();
        results.forEach(res => {
            if (res.similarity >= 70) {
                const existing = finalMap.get(res.id);
                if (!existing || res.similarity > existing.similarity) {
                    finalMap.set(res.id, res);
                }
            }
        });

        const sortedResults = Array.from(finalMap.values()).sort((a, b) => b.similarity - a.similarity);
        res.json(sortedResults);

    } catch (error) {
        console.error("Syllabus Match Critical Error:", error);
        res.status(500).json([]); 
    }
});

/**
 * GET /api/syllabus/test
 * Health check for syllabus matching.
 */
router.get('/test', (req, res) => res.json({ status: "Syllabus Matcher V2 Active" }));

module.exports = router;
