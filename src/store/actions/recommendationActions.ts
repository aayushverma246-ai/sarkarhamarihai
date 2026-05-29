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
) => async (dispatch: any) => {
    const isPage1 = pageNum === 1;
    dispatch({
        type: types.FETCH_RECS_START,
        payload: { isPage1 }
    });

    try {
        let res: any = null;
        let attempts = 0;

        // Clean retry loop for maximum robustness (Gemini API network resiliency)
        while (!res && attempts < 3) {
            try {
                res = await api.aiMatch(combinedExams, pageNum, search, category === 'All' ? '' : category, state);
            } catch (e) {
                attempts++;
                if (attempts >= 3) break;
                await new Promise(r => setTimeout(r, 2000 * attempts));
            }
        }

        if (!res) {
            throw new Error('Failed to fetch recommendations after 3 attempts');
        }

        const newData = (res.data || []).map((r: any) => ({
            ...r,
            explanation: r.explanation || "Syllabus overlap match."
        }));

        if (isPage1) {
            try {
                localStorage.setItem('ai_recs_cache', JSON.stringify(newData.slice(0, 8)));
            } catch (err) {
                console.warn('Failed to cache AI recs in localStorage:', err);
            }
        }

        dispatch({
            type: types.FETCH_RECS_SUCCESS,
            payload: {
                recs: newData,
                page: res.page || pageNum,
                hasMore: res.hasMore || false,
                isPage1,
            }
        });
    } catch (err: any) {
        const errMsg = err.message || 'Failed to match syllabus recommendations';
        dispatch({ type: types.FETCH_RECS_FAIL, payload: errMsg });
        throw err;
    }
};
