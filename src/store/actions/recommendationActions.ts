import * as types from '../actionTypes';
import { api } from '../../api';
import { Job } from '../../types';

// Async recommendation matches action creator
export const fetchRecommendationsAction = (
    combinedExams: Job[],
    pageNum = 1,
    search = '',
    category = '',
    state = ''
) => async (dispatch: any, getState: any) => {
    const pageNumber = Number(pageNum) || 1;
    const isPage1 = pageNumber === 1;

    const recsState = getState().recs;
    const currentPage = recsState ? recsState.page : 1;

    // Check if we already have the merged list loaded on the client side for page > 1
    if (pageNumber > 1 && pageNumber <= currentPage) {
        dispatch({
            type: types.FETCH_RECS_START,
            payload: { isPage1: false }
        });
        // Simulate short delay for premium micro-interaction feel
        await new Promise(r => setTimeout(r, 100));
        dispatch({
            type: types.FETCH_RECS_SUCCESS,
            payload: {
                allMergedRecs: recsState.allMergedRecs,
                isPage1: false,
                hasMore: recsState.hasMore,
                page: pageNumber,
            }
        });
        return;
    }

    dispatch({
        type: types.FETCH_RECS_START,
        payload: { isPage1 }
    });

    try {
        const categoryFilter = category === 'All' ? '' : category;
        const stateFilter = (state === 'All' || state === 'All India' || state === 'all') ? '' : state;

        // Perform a single backend query for the requested page
        const response = await api.aiMatch(combinedExams, pageNumber, search, categoryFilter, stateFilter);

        // Merge with existing list if pageNumber > 1
        const existingRecs = isPage1 ? [] : (recsState && recsState.allMergedRecs ? recsState.allMergedRecs : []);
        const newRecs = response && Array.isArray(response.data) ? response.data : [];

        // Merge and deduplicate results
        const seen = new Set(existingRecs.map((r: any) => r.id));
        const mergedList = [...existingRecs];
        for (const r of newRecs) {
            if (r && r.id && !seen.has(r.id)) {
                seen.add(r.id);
                mergedList.push({
                    ...r,
                    explanation: r.explanation || "Syllabus overlap match."
                });
            }
        }



        // Sort DESC by similarity, then LIVE first
        mergedList.sort((a, b) => {
            const aVal = a.similarity !== undefined && a.similarity !== null ? a.similarity : a.overlap_score;
            const bVal = b.similarity !== undefined && b.similarity !== null ? b.similarity : b.overlap_score;
            const aSim = typeof aVal === 'number' ? aVal : parseFloat(String(aVal)) || 0;
            const bSim = typeof bVal === 'number' ? bVal : parseFloat(String(bVal)) || 0;
            if (bSim !== aSim) return bSim - aSim;

            const order: Record<string, number> = { LIVE: 3, UPCOMING: 2, RECENTLY_CLOSED: 1, CLOSED: 0 };
            const aStatus = order[a.form_status] || 0;
            const bStatus = order[b.form_status] || 0;
            return bStatus - aStatus;
        });

        // Filter out recommendations based on threshold (70% standard, 30% when searching)
        const minScore = search ? 30 : 70;
        const filteredList = mergedList.filter(r => {
            const val = r.similarity !== undefined && r.similarity !== null ? r.similarity : r.overlap_score;
            const score = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
            return score >= minScore;
        });

        dispatch({
            type: types.FETCH_RECS_SUCCESS,
            payload: {
                allMergedRecs: filteredList,
                isPage1: isPage1,
                hasMore: response?.hasMore ?? (newRecs.length === 10),
                page: pageNumber,
            }
        });
    } catch (err: any) {
        const errMsg = err.message || 'Failed to match syllabus recommendations';
        dispatch({ type: types.FETCH_RECS_FAIL, payload: errMsg });
        throw err;
    }
};
