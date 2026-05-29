import * as types from '../actionTypes';
import { getCachedUser, getToken } from '../../api';

export interface AuthState {
    user: any | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
}

// Check for cached user on startup (works for both Supabase sessions and guest tokens)
const cachedUser = getCachedUser();
const legacyToken = getToken();

const initialState: AuthState = {
    user: cachedUser,
    loading: false,
    error: null,
    // Authenticated if we have a cached user (Supabase session will be verified async)
    isAuthenticated: !!cachedUser && (!!legacyToken || true),
};

export default function authReducer(state = initialState, action: any): AuthState {
    switch (action.type) {
        case types.AUTH_START:
            return {
                ...state,
                loading: true,
                error: null,
            };
        case types.AUTH_SUCCESS:
            return {
                ...state,
                loading: false,
                user: action.payload,
                isAuthenticated: true,
                error: null,
            };
        case types.AUTH_FAIL:
            return {
                ...state,
                loading: false,
                error: action.payload,
                isAuthenticated: false,
                user: null,
            };
        case types.AUTH_LOGOUT:
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                error: null,
                loading: false,
            };
        default:
            return state;
    }
}
