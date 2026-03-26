// Central API client for SarkarHamariHai
// All requests go through here — handles JWT auth, errors, and base URL.

// In production: VITE_API_URL is set to the Render backend URL via .env.production
// In local dev: falls back to localhost:3001
// In production / Vercel: VITE_API_URL is '/api'
// In local dev: falls back to localhost:3001/api
const API_BASE: string = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'sarkar_token';
const USER_KEY = 'sarkar_user';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('sarkar_liked');
    localStorage.removeItem('sarkar_notifs');
}

export function getCachedUser(): any | null {
    try {
        const s = localStorage.getItem(USER_KEY);
        return s ? JSON.parse(s) : null;
    } catch {
        return null;
    }
}

export function setCachedUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ── In-memory API cache (makes back-navigation instant) ──────────────────
const _cache = new Map<string, { data: any; ts: number }>();

function getCached<T>(key: string, ttlMs: number): T | null {
    const entry = _cache.get(key);
    if (entry && Date.now() - entry.ts < ttlMs) return entry.data as T;
    return null;
}

function setCache(key: string, data: any) {
    _cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(prefix?: string) {
    if (!prefix) { _cache.clear(); return; }
    for (const key of _cache.keys()) {
        if (key.startsWith(prefix)) _cache.delete(key);
    }
}

async function request<T>(
    method: string,
    path: string,
    body?: any,
    requiresAuth = false,
    retries = 1
): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (requiresAuth || token) {
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            credentials: 'same-origin',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (res.status === 401) {
            clearToken();
            window.location.href = '/login';
            throw new Error('Session expired. Please log in again.');
        }

        if (res.status >= 500 && retries > 0) {
            // Server error, wait and retry
            await new Promise(r => setTimeout(r, 1000));
            return request(method, path, body, requiresAuth, retries - 1);
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        return res.json();
    } catch (err: any) {
        // Handle network layer failures (e.g., DNS, offline)
        if ((err.message === 'Failed to fetch' || err.name === 'TypeError') && retries > 0) {
            await new Promise(r => setTimeout(r, 1500));
            return request(method, path, body, requiresAuth, retries - 1);
        }
        throw err;
    }
}

// Cached GET helper — checks in-memory cache before fetching
async function cachedGet<T>(path: string, ttlMs: number, requiresAuth = false): Promise<T> {
    const cached = getCached<T>(path, ttlMs);
    if (cached) return cached;
    const data = await request<T>('GET', path, undefined, requiresAuth);
    setCache(path, data);
    return data;
}

const TWO_MIN = 120_000;
const THIRTY_SEC = 30_000;

export const api = {
    // Auth
    signup: (data: any) => request<{ token: string; user: any }>('POST', '/auth/signup', data),
    login: (email: string, password: string) =>
        request<{ token: string; user: any }>('POST', '/auth/login', { email, password }),
    getMe: () => cachedGet<any>('/auth/me', THIRTY_SEC, true),
    updateMe: (data: any) => {
        invalidateCache('/auth/me');
        invalidateCache('/jobs/eligible');
        invalidateCache('/jobs/partial');
        return request<any>('PUT', '/auth/me', data, true);
    },

    // Jobs (cached — these are the heaviest endpoints)
    getJobs: () => cachedGet<any[]>('/jobs', TWO_MIN),
    getJobById: (id: string) => cachedGet<any>(`/jobs/${id}`, TWO_MIN),
    getEligibleJobs: () => cachedGet<any[]>('/jobs/eligible', TWO_MIN, true),
    getPartialJobs: () => cachedGet<any[]>('/jobs/partial', TWO_MIN, true),
    getRecommendedJobs: () => cachedGet<any[]>('/jobs/recommendations', THIRTY_SEC, true),
    getLikedJobs: () => cachedGet<any[]>('/jobs/liked', THIRTY_SEC, true),
    getLikedStatus: (id: string) =>
        cachedGet<{ liked: boolean }>(`/jobs/${id}/liked-status`, THIRTY_SEC, true),
    likeJob: (id: string) => {
        invalidateCache('/jobs/liked');
        return request<{ liked: boolean }>('POST', `/jobs/${id}/like`, {}, true);
    },
    unlikeJob: (id: string) => {
        invalidateCache('/jobs/liked');
        return request<{ liked: boolean }>('DELETE', `/jobs/${id}/like`, undefined, true);
    },

    // Notifications
    getNotifications: () => cachedGet<any[]>('/notifications', THIRTY_SEC, true),
    deleteNotification: (id: string) => {
        invalidateCache('/notifications');
        return request<{ success: boolean }>('DELETE', `/notifications/${id}`, undefined, true);
    },
    deleteAllNotifications: () => {
        invalidateCache('/notifications');
        return request<{ success: boolean }>('DELETE', '/notifications/all', undefined, true);
    },

    // Roadmap V9
    getRoadmap: (jobId: string) => cachedGet<any>(`/roadmap/${jobId}/roadmap`, TWO_MIN, true),
    getGeneratedRoadmap: (jobId: string) => request<any>('GET', `/roadmap/${jobId}/roadmap`, undefined, true),
    generateRoadmap: (jobId: string) => {
        invalidateCache(`/roadmap/${jobId}/roadmap`);
        return request<any>('POST', `/roadmap/${jobId}/roadmap?t=${Date.now()}`, {}, true);
    },

    // Application Tracking & Reminders
    getAppliedJobs: () => cachedGet<any[]>('/apply/applied', THIRTY_SEC, true),
    getAppliedStatus: (jobId: string) => cachedGet<{ applied: boolean }>(`/apply/status/${jobId}`, THIRTY_SEC, true),
    getReminderStatus: (jobId: string) => cachedGet<{ reminders_enabled: boolean }>(`/apply/reminder/${jobId}`, THIRTY_SEC, true),
    toggleApplied: (jobId: string) => {
        // Only invalidate applied-jobs list and the specific job's apply status
        invalidateCache('/apply/applied');
        invalidateCache(`/apply/status/${jobId}`);
        return request<{ applied: boolean }>('POST', '/apply/toggle', { job_id: jobId }, true);
    },
    toggleReminder: (jobId: string) => {
        // Only invalidate the specific job's reminder status, not the whole apply namespace
        invalidateCache(`/apply/reminder/${jobId}`);
        return request<{ reminders_enabled: boolean }>('POST', '/apply/reminder/toggle', { job_id: jobId }, true);
    },
    unmarkApplied: (jobId: string) => {
        invalidateCache('/apply/applied');
        invalidateCache(`/apply/status/${jobId}`);
        invalidateCache('/jobs/recommendations');
        return request<{ success: boolean }>('DELETE', '/apply/applied-exam', { exam_id: jobId }, true);
    },

    // Tracker
    getTrackerStats: () => cachedGet<any>('/tracker/stats', THIRTY_SEC, true),
    getTrackerTargets: () => cachedGet<any[]>('/tracker/targets', THIRTY_SEC, true),
    saveTrackerTargets: (targets: any[]) => {
        invalidateCache('/tracker/targets');
        return request<any>('POST', '/tracker/targets', { targets }, true);
    },
    getTrackerHistory: () => cachedGet<any>('/tracker/history', THIRTY_SEC, true),
    getTrackerHistoryDate: (date: string) => cachedGet<any>(`/tracker/history/${date}`, THIRTY_SEC, true),
    getTrackerPlanToday: () => request<any>('GET', '/tracker/plan/today', undefined, true),
    generateTrackerPlan: (data: any) => request<any>('POST', '/tracker/plan/generate', data, true),
    evaluateTrackerPlan: () => {
        invalidateCache('/tracker/stats');
        invalidateCache('/tracker/history');
        return request<any>('POST', '/tracker/plan/evaluate', {}, true);
    },
    toggleTrackerSession: (sessionId: string, is_completed: boolean) => request<any>('PUT', `/tracker/session/${sessionId}/toggle`, { is_completed }, true),
    syllabusMatch: (appliedExams: any[]) => request<any[]>('POST', '/syllabus/match', { appliedExams }, true),
    aiMatch: (appliedExams: any[], page = 1, search = '', category = '') => request<any>('POST', '/ai/recommendations', { appliedExams, page, search, category }, true),
};
