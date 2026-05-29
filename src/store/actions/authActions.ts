import * as types from '../actionTypes';
import { api, setToken, setCachedUser, clearToken } from '../../api';
import { supabase } from '../../utils/supabase';

// ── Supabase Auth-based Action Creators ──────────────────────────────

export const loginAction = (email: string, password: string) => async (dispatch: any) => {
    dispatch({ type: types.AUTH_START });
    try {
        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            throw new Error(error.message);
        }

        if (!data.session || !data.user) {
            throw new Error('Login failed. Please try again.');
        }

        // Ensure user has a profile in our database
        const { user: profile } = await api.ensureProfile();

        if (profile) {
            setCachedUser(profile);
            dispatch({ type: types.AUTH_SUCCESS, payload: profile });
        } else {
            // Fallback: use Supabase user metadata
            const fallbackUser = {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
            };
            setCachedUser(fallbackUser);
            dispatch({ type: types.AUTH_SUCCESS, payload: fallbackUser });
        }

        return { success: true };
    } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : 'Something went wrong';
        dispatch({ type: types.AUTH_FAIL, payload: errMsg });
        throw err;
    }
};

export const guestLoginAction = () => async (dispatch: any) => {
    dispatch({ type: types.AUTH_START });
    try {
        const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
        const baseUrl = isNative
            ? 'https://sarkarhamaraihai.vercel.app/api'
            : ((import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api');

        const res = await fetch(`${baseUrl}/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            throw new Error(data.error || 'Failed to authenticate guest.');
        }

        setToken(data.token);
        setCachedUser(data.user);
        dispatch({ type: types.AUTH_SUCCESS, payload: data.user });
        return { success: true };
    } catch (err: any) {
        console.warn('[Redux Guest Login] Error, falling back to pure offline mode', err);
        const ts = Date.now();
        const mockUser = {
            id: 'offline_guest_' + ts,
            email: 'guest@sarkar.app',
            full_name: 'Guest User',
            age: 25,
            category: 'General',
            state: 'All India',
            qualification_type: 'Graduation',
            qualification_status: 'Completed',
        };
        setToken('mock_guest_token_' + ts);
        setCachedUser(mockUser);
        dispatch({ type: types.AUTH_SUCCESS, payload: mockUser });
        return { success: true };
    }
};

export const fetchCurrentUserAction = () => async (dispatch: any) => {
    dispatch({ type: types.AUTH_START });
    try {
        // Check Supabase session first
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Fetch profile from our backend
            const user = await api.getMe();
            if (user && user.full_name) {
                setCachedUser(user);
                dispatch({ type: types.AUTH_SUCCESS, payload: user });
                return;
            }
        }

        // Fallback to legacy token approach
        const user = await api.getMe();
        if (user && user.full_name) {
            setCachedUser(user);
            dispatch({ type: types.AUTH_SUCCESS, payload: user });
        } else {
            throw new Error('Invalid user object from endpoint');
        }
    } catch (err: any) {
        const errMsg = err.message || 'Failed to fetch current user session';
        dispatch({ type: types.AUTH_FAIL, payload: errMsg });
        throw err;
    }
};

export const logoutAction = () => async (dispatch: any) => {
    // Sign out from Supabase
    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.warn('Supabase signOut error (non-critical):', err);
    }
    // Clear legacy tokens and cached data
    clearToken();
    dispatch({ type: types.AUTH_LOGOUT });
};
