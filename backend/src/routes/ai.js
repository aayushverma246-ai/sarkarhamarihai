const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRecommendations, isJobVerified } = require('../services/gemini_recommender');
const { getSupabase } = require('../db');

function getSb() {
  return getSupabase();
}

const getTodayIST = () => {
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job) {
  const todayStr = getTodayIST();
  const start = job.application_start_date;
  const end = job.application_end_date;
  if (!start || !end) return 'CLOSED';
  if (todayStr < start) return 'UPCOMING';
  if (todayStr <= end) return 'LIVE';
  return 'CLOSED';
}

// POST /api/ai/recommendations
router.post('/recommendations', auth, async (req, res) => {
  try {
    const { appliedExams = [], page = 1, search = '', category = '', state = '' } = req.body;
    const userId = req.user.id;
    const sb = getSb();

    const cleanCategory = (category === 'All' || category === 'all') ? '' : category;
    const cleanState = (state === 'All' || state === 'All India' || state === 'all') ? '' : state;

    // Get source exam IDs from applied
    let sourceIds = (appliedExams || []).map(e => e.id).filter(Boolean);

    // Fetch applied jobs as source from applied_jobs table
    const { data: appliedRows } = await sb.from('applied_jobs')
      .select('job_id').eq('user_id', userId);
    if (appliedRows) sourceIds.push(...appliedRows.map(r => r.job_id));

    sourceIds = [...new Set(sourceIds)];

    // FALLBACK: If no source exams, return popular LIVE exams
    if (sourceIds.length === 0) {
      const { data: popular } = await sb.from('jobs')
        .select('id, job_name, organization, job_category, form_status, application_start_date, application_end_date, salary_min, salary_max, qualification_required, official_application_link, official_website_link')
        .in('form_status', ['LIVE', 'UPCOMING'])
        .order('application_end_date', { ascending: false })
        .limit(100);

      const verifiedPopular = (popular || []).filter(isJobVerified);

      const PAGE_SIZE = 10;
      const startIdx = (page - 1) * PAGE_SIZE;
      const data = verifiedPopular.slice(startIdx, startIdx + PAGE_SIZE).map(job => ({
        ...job,
        similarity: 0,
        overlap_score: 0,
        explanation: 'Popular exam — apply to exams to unlock AI syllabus matching.',
        overlapping_topics: [],
        missing_topics: [],
        difficulty_gap: 'high',
        gap_analysis: { matched_topics: [], missing_topics: [], extra_topics: [] },
      }));

      return res.json({ data, hasMore: verifiedPopular.length > startIdx + PAGE_SIZE, page, totalMatches: verifiedPopular.length });
    }

    // Use Gemini recommendation engine
    const result = await getRecommendations(sourceIds, userId, { page, search, category: cleanCategory, state: cleanState });
    return res.json(result);
  } catch (err) {
    console.error('[AI Route] Error:', err.message);
    return res.status(500).json({ error: 'Recommendation engine error', details: err.message });
  }
});

// POST /ai/gap-analysis
router.post('/gap-analysis', auth, async (req, res) => {
  try {
    const { source_exam_ids, target_exam_id } = req.body;
    const sb = getSb();
    const { computeGapAnalysis, structureSyllabus } = require('../services/gemini_recommender');

    const { data: sourceExams } = await sb.from('jobs')
      .select('id, job_name, syllabus').in('id', source_exam_ids);
    const { data: targetData } = await sb.from('jobs')
      .select('id, job_name, syllabus').eq('id', target_exam_id).single();

    if (!targetData) return res.status(404).json({ error: 'Target exam not found' });

    const combinedSource = (sourceExams || []).map(e => (e.syllabus || '') + ' ' + e.job_name).join(' ');
    const srcStruct = structureSyllabus(combinedSource);
    const tgtStruct = structureSyllabus(targetData.syllabus, targetData.job_name);
    const gap = computeGapAnalysis(srcStruct, tgtStruct);

    return res.json({
      topic_coverage_percentage: gap.matched_topics.length > 0
        ? Math.round((gap.matched_topics.length / (gap.matched_topics.length + gap.missing_topics.length)) * 100)
        : 0,
      source_exams: (sourceExams || []).map(e => e.job_name),
      target_exam: targetData.job_name,
      gap_analysis: gap,
      overlap_summary: gap.missing_topics.length <= 2
        ? 'High overlap — your preparation covers most topics.'
        : gap.missing_topics.length <= 5
          ? 'Moderate overlap — additional preparation needed for specific topics.'
          : 'Significant gaps — focused study plan recommended.',
    });
  } catch (err) {
    console.error('[Gap Analysis] Error:', err.message);
    return res.status(500).json({ error: 'Gap analysis error' });
  }
});

module.exports = router;
