// Central API client for SarkarHamariHai
// All requests go through here — handles JWT auth, errors, and base URL.

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

// ── Circuit Breaker for Rate Limiting (Startup-Grade Resilience) ──
let circuitBreakUntil = 0;

async function request<T>(
    method: string,
    path: string,
    body?: any,
    requiresAuth = false,
    retries = 1,
    timeoutMs = 60000 // Increased to 60 seconds for large requests
): Promise<T> {
    if (Date.now() < circuitBreakUntil) {
        console.warn(`[Circuit Breaker] Request to ${path} blocked until ${new Date(circuitBreakUntil).toISOString()}`);
        return null as unknown as T;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (requiresAuth || token) {
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            credentials: 'same-origin',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (res.status === 429) {
            // Open the circuit: Block all network requests for 15 seconds
            circuitBreakUntil = Date.now() + 15000;
            console.error('[Rate Limit 429] Circuit broken. Pausing network for 15s.');
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 15000));
                return request(method, path, body, requiresAuth, retries - 1, timeoutMs);
            }
            throw new Error('Server limit reached. Pausing updates.');
        }

        if (res.status === 401) {
            // ZERO FAILURE GUEST LOGIN: If this is an offline mock token, suppress logout
            if (token?.startsWith('mock_guest_token_')) {
                console.warn('[Offline Mode] Backend returned 401 for mock guest token, suppressing logout.');
                return null as unknown as T; // Return null to prevent UI crashes requiring array
            }
            clearToken();
            // Don't redirect here - let the caller handle it
            // This prevents redirect loops and allows dashboard to gracefully degrade
            throw new Error('Session expired. Please log in again.');
        }

        if (res.status >= 500 && retries > 0) {
            // Server error, wait and retry with slight jitter
            const jitter = Math.random() * 1000;
            await new Promise(r => setTimeout(r, 1000 + jitter));
            return request(method, path, body, requiresAuth, retries - 1, timeoutMs);
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        return res.json();
    } catch (err: any) {
        clearTimeout(timeoutId);
        
        // Handle abort/timeout
        if (err.name === 'AbortError') {
            if (token?.startsWith('mock_guest_token_')) return null as unknown as T;
            throw new Error('Request timed out. Please check your connection.');
        }
        
        // Handle network layer failures (e.g., DNS, offline)
        if ((err.message === 'Failed to fetch' || err.name === 'TypeError') && retries > 0) {
            const jitter = Math.random() * 1000;
            await new Promise(r => setTimeout(r, 1500 + jitter));
            return request(method, path, body, requiresAuth, retries - 1, timeoutMs);
        }
        
        // Zero-failure fallback for network errors when running mock token
        if (token?.startsWith('mock_guest_token_')) {
            console.warn('[Offline Mode] Network request failed completely. Graceful degradation.');
            return null as unknown as T;
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

const THIRTY_SEC = 30_000;
const FIVE_MIN = THIRTY_SEC;
const TWO_MIN = THIRTY_SEC;

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
    // Efficient dashboard aggregation (New pattern to avoid Turso OOM)
    // Fetch jobs directly without heavy infinite loops
    getJobs: async (params?: { status?: string; limit?: number; offset?: number }) => {
        // If no params, use the highly optimized all-minimal payload
        if (!params || Object.keys(params).length === 0) {
            const cacheKey = '/jobs-all-minimal';
            const cached = getCached<any>(cacheKey, FIVE_MIN);
            if (cached) return cached;
            const result = await request<any>('GET', '/jobs/all-minimal', undefined, false, 1, 90000);
            const jobs = Array.isArray(result) ? result : (result?.jobs || []);
            if (jobs.length > 0) setCache(cacheKey, jobs);
            return jobs;
        }

        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.status) query.set('status', params.status);
        
        const path = `/jobs?${query.toString()}`;
        const cacheKey = path;
        
        const cached = getCached<any>(cacheKey, TWO_MIN);
        if (cached) return cached;

        const result = await request<any>('GET', path, undefined, false);
        const jobs = Array.isArray(result) ? result : (result.jobs || []);
        
        setCache(cacheKey, jobs);
        return jobs;
    },
    getJobsPaginated: async (params?: { limit?: number; offset?: number; status?: string; state?: string; category?: string }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.status) query.set('status', params.status);
        if (params?.state) query.set('state', params.state);
        if (params?.category) query.set('category', params.category);
        const queryStr = query.toString();
        const path = queryStr ? `/jobs?${queryStr}` : '/jobs';
        return request<{ jobs: any[]; total: number; limit: number; offset: number; hasMore: boolean }>('GET', path, undefined, false);
    },
    getJobsAllMinimal: () => request<{ jobs: any[] }>('GET', '/jobs/all-minimal', undefined, false),
    getJobById: (id: string) => cachedGet<any>(`/jobs/${id}`, TWO_MIN),
    getCategories: () => cachedGet<string[]>('/jobs/categories', 300_000),
    getStates: () => cachedGet<string[]>('/jobs/states', 300_000),
    getEligibleJobs: (state = '', category = '') => {
        const q = new URLSearchParams();
        if (state) q.set('state', state);
        if (category) q.set('category', category);
        const qs = q.toString();
        return cachedGet<any[]>(`/jobs/eligible${qs ? '?' + qs : ''}`, TWO_MIN, true);
    },
    getPartialJobs: (state = '', category = '') => {
        const q = new URLSearchParams();
        if (state) q.set('state', state);
        if (category) q.set('category', category);
        const qs = q.toString();
        return cachedGet<any[]>(`/jobs/partial${qs ? '?' + qs : ''}`, TWO_MIN, true);
    },
    getRecommendedJobs: () => cachedGet<any[]>('/jobs/recommendations', TWO_MIN, true),
    getLiveJobs: (state = '', category = '') => {
        const q = new URLSearchParams();
        if (state) q.set('state', state);
        if (category) q.set('category', category);
        const qs = q.toString();
        return cachedGet<any[]>(`/jobs/live${qs ? '?' + qs : ''}`, TWO_MIN, false);
    },
    getUpcomingJobs: (state = '', category = '') => {
        const q = new URLSearchParams();
        if (state) q.set('state', state);
        if (category) q.set('category', category);
        const qs = q.toString();
        return cachedGet<any[]>(`/jobs/upcoming${qs ? '?' + qs : ''}`, TWO_MIN, false);
    },
    getLikedJobs: () => cachedGet<any[]>('/jobs/liked', THIRTY_SEC, true),
    getLikedStatus: async (id: string) => {
        const res = await cachedGet<{ liked: boolean }>(`/jobs/${id}/liked-status`, THIRTY_SEC, true);
        return res || { liked: false };
    },
    likeJob: (id: string) => {
        invalidateCache('/jobs/liked');
        return request<{ liked: boolean }>('POST', `/jobs/${id}/like`, {}, true);
    },
    unlikeJob: (id: string) => {
        invalidateCache('/jobs/liked');
        return request<{ liked: boolean }>('DELETE', `/jobs/${id}/like`, undefined, true);
    },

    // Notifications
    getNotificationCount: () => cachedGet<{ count: number }>('/notifications/count', THIRTY_SEC, true),
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
    getAppliedStatus: async (jobId: string) => {
        const res = await cachedGet<{ applied: boolean }>(`/apply/status/${jobId}`, THIRTY_SEC, true);
        return res || { applied: false };
    },
    getReminderStatus: async (jobId: string) => {
        const res = await cachedGet<{ reminders_enabled: boolean }>(`/apply/reminder/${jobId}`, THIRTY_SEC, true);
        return res || { reminders_enabled: false };
    },
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
