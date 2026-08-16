import * as types from '../actionTypes';

export interface RecommendationsState {
    recs: any[];
    allMergedRecs: any[];
    loading: boolean;
    loadingMore: boolean;
    refreshing: boolean;
    page: number;
    hasMore: boolean;
    error: string | null;
}

const initialState: RecommendationsState = {
    recs: [],
    allMergedRecs: [],
    loading: false,
    loadingMore: false,
    refreshing: false,
    page: 1,
    hasMore: false,
    error: null,
};

export default function recommendationsReducer(state = initialState, action: any): RecommendationsState {
    switch (action.type) {
        case types.FETCH_RECS_START: {
            const { isPage1 } = action.payload || { isPage1: true };
            return {
                ...state,
                loading: isPage1,
                loadingMore: !isPage1,
                refreshing: isPage1 && state.recs.length > 0,
                error: null,
            };
        }
        case types.FETCH_RECS_SUCCESS: {
            const { allMergedRecs, isPage1, hasMore, page: payloadPage } = action.payload;
            const updatedMerged = Array.isArray(allMergedRecs) ? allMergedRecs : state.allMergedRecs;
            const page = payloadPage !== undefined ? payloadPage : (isPage1 ? 1 : state.page + 1);
            const PAGE_SIZE = 10;
            const visibleRecs = updatedMerged.slice(0, page * PAGE_SIZE);
            const calculatedHasMore = hasMore !== undefined ? hasMore : (updatedMerged.length > page * PAGE_SIZE);
            return {
                ...state,
                loading: false,
                loadingMore: false,
                refreshing: false,
                allMergedRecs: updatedMerged,
                recs: visibleRecs,
                page,
                hasMore: calculatedHasMore,
                error: null,
            };
        }
        case types.FETCH_RECS_FAIL:
            return {
                ...state,
                loading: false,
                loadingMore: false,
                refreshing: false,
                error: action.payload,
            };
        default:
            return state;
    }
}
