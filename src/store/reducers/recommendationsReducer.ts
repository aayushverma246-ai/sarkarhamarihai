import * as types from '../actionTypes';

export interface RecommendationsState {
    recs: any[];
    loading: boolean;
    loadingMore: boolean;
    refreshing: boolean;
    page: number;
    hasMore: boolean;
    error: string | null;
}

const initialState: RecommendationsState = {
    recs: [],
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
            const { recs, page, hasMore, isPage1 } = action.payload;
            return {
                ...state,
                loading: false,
                loadingMore: false,
                refreshing: false,
                recs: isPage1 ? recs : [...state.recs, ...recs],
                page,
                hasMore,
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
