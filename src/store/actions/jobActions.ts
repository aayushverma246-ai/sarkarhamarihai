import * as types from '../actionTypes';
import { api, getCachedUser } from '../../api';
import { Job } from '../../types';
import { meetsQualification, meetsAge, meetsTechnicalCriteria } from '../../utils';
// Helper to normalize strings for deduplication key
const normalizeString = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

// Helper to normalize organization name for client-side matching
const normalizeOrg = (org: string): string => {
    if (!org) return '';
    let o = org.toLowerCase().trim();
    o = o.replace(/\bpublic\s+service\s+commission\b/g, 'psc');
    o = o.replace(/\bstate\s+government\b/g, 'government');

    if (o.includes('union psc') || o.includes('union public') || o === 'upsc') return 'upsc';
    if (o.includes('staff selection') || o === 'ssc') return 'ssc';
    if (o.includes('national testing') || o === 'nta') return 'nta';
    if (o.includes('railway recruitment') || o === 'rrb') return 'rrb';
    if (o.includes('state bank of india') || o === 'sbi') return 'sbi';
    if (o.includes('reserve bank of india') || o === 'rbi') return 'rbi';

    return o.replace(/[^a-z0-9]/g, '');
};

// Generate unique fingerprint key for job
const getJobFingerprint = (job: Job): string => {
    const name = normalizeString(job.job_name || '');
    const org = normalizeOrg(job.organization || '');
    const yearMatch = (job.job_name || '').match(/20\d{2}/);
    const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
    return `${name}|${org}|${year}`;
};

// Deduplicate jobs list
const deduplicateJobs = (jobs: Job[]): Job[] => {
    if (!Array.isArray(jobs)) return [];
    const seen = new Map<string, Job>();

    for (const job of jobs) {
        const fp = getJobFingerprint(job);
        const existing = seen.get(fp);
        if (!existing) {
            seen.set(fp, job);
        } else {
            // Keep the one with better status (LIVE > UPCOMING > RECENTLY_CLOSED > CLOSED)
            const getStatusScore = (status?: string) => {
                if (status === 'LIVE') return 100;
                if (status === 'UPCOMING') return 50;
                if (status === 'RECENTLY_CLOSED') return 10;
                return 1;
            };
            const existingScore = getStatusScore(existing.form_status);
            const currentScore = getStatusScore(job.form_status);
            if (currentScore > existingScore) {
                seen.set(fp, job);
            }
        }
    }
    return Array.from(seen.values());
};

// Map saved/applied/reminded list elements to their deduplicated counterparts
const mapSavedJobs = (savedList: Job[], allCleanJobs: Job[]): Job[] => {
    const cleanFingerprints = new Set(allCleanJobs.map(getJobFingerprint));
    const savedFingerprints = new Set(savedList.map(getJobFingerprint));
    
    const result: Job[] = [];
    const seenFp = new Set<string>();

    // First, find all kept jobs that match the saved fingerprints
    for (const job of allCleanJobs) {
        const fp = getJobFingerprint(job);
        if (savedFingerprints.has(fp) && !seenFp.has(fp)) {
            result.push(job);
            seenFp.add(fp);
        }
    }

    // Plus any other saved jobs that might not be in allCleanJobs (e.g., custom ones)
    for (const job of savedList) {
        const fp = getJobFingerprint(job);
        if (!cleanFingerprints.has(fp) && !seenFp.has(fp)) {
            result.push(job);
            seenFp.add(fp);
        }
    }

    return result;
};

// Helper to compute eligibility purely from localized user and minimal jobs list
const computeEligibility = (validJobs: Job[], resolvedUser: any) => {
    const hasCompleteProfile = !!(resolvedUser?.qualification_type && resolvedUser?.age && resolvedUser.age > 0);
    let strictlyEligible: Job[] = [];
    let broadlyEligible: Job[] = [];
    let strictPartial: Job[] = [];
    let broadlyUpcoming: Job[] = [];

    for (const j of validJobs) {
        if (hasCompleteProfile) {
            const isEligible = meetsQualification(resolvedUser, j) && meetsAge(resolvedUser, j) && meetsTechnicalCriteria(j);
            if (isEligible) strictlyEligible.push(j);
        }
        if ((j.form_status === 'LIVE' || j.form_status === 'UPCOMING') && meetsTechnicalCriteria(j)) {
            broadlyEligible.push(j);
        }
        if (hasCompleteProfile) {
            const isPartial = (meetsQualification(resolvedUser, j) || meetsAge(resolvedUser, j)) && !(meetsQualification(resolvedUser, j) && meetsAge(resolvedUser, j)) && meetsTechnicalCriteria(j);
            if (isPartial) strictPartial.push(j);
        }
        if (j.form_status === 'UPCOMING' && meetsTechnicalCriteria(j)) {
            broadlyUpcoming.push(j);
        }
    }

    const finalEligible = strictlyEligible.length > 0 ? strictlyEligible : broadlyEligible.slice(0, 100);
    const finalPartial = strictPartial.length > 0 ? strictPartial : broadlyUpcoming.slice(0, 50);

    return { eligible: finalEligible, partial: finalPartial };
};

// Async job loading (Phase 1 & Phase 2 combined with Stale-While-Revalidate caching)
export const fetchAllJobsAction = () => async (dispatch: any) => {
    dispatch({ type: types.FETCH_JOBS_START });

    const cachedUser = getCachedUser();
    let cachedJobs: Job[] = [];
    let cachedLiked: Job[] = [];
    let cachedApplied: Job[] = [];
    let cachedReminded: Job[] = [];

    try {
        const cachedRaw = localStorage.getItem('sarkar_jobs_minimal');
        if (cachedRaw) {
            cachedJobs = JSON.parse(cachedRaw);
        }
        const rawLiked = localStorage.getItem('sarkar_liked_jobs');
        if (rawLiked) cachedLiked = JSON.parse(rawLiked);
        const rawApplied = localStorage.getItem('sarkar_applied_jobs');
        if (rawApplied) cachedApplied = JSON.parse(rawApplied);
        const rawReminded = localStorage.getItem('sarkar_reminded_jobs');
        if (rawReminded) cachedReminded = JSON.parse(rawReminded);
    } catch (e) {
        console.error('Failed to parse cached jobs and auxiliary lists:', e);
    }

    const hasCache = Array.isArray(cachedJobs) && cachedJobs.length > 0;

    // Define background network fetch function
    const performFetch = async () => {
        try {
            const [me, jobsResponse, liked, applied, reminded] = await Promise.all([
                api.getMe().catch(() => cachedUser || { full_name: 'Guest', age: 0 }),
                api.getJobsAllMinimal().catch(err => {
                    console.error('[Redux getJobsAllMinimal failed]', err);
                    return { jobs: [] };
                }),
                api.getLikedJobs().catch(() => cachedLiked),
                api.getAppliedJobs().catch(() => cachedApplied),
                api.getRemindedJobs().catch(() => reminded),
            ]);

            const resolvedUser = (me && me.full_name) ? me : (cachedUser || { full_name: 'Guest', age: 0 });
            const rawFetchedJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];
            const validJobs = deduplicateJobs(rawFetchedJobs);
            const resolvedLiked = mapSavedJobs(Array.isArray(liked) ? liked : [], validJobs);
            const resolvedApplied = mapSavedJobs(Array.isArray(applied) ? applied : [], validJobs);
            const resolvedReminded = mapSavedJobs(Array.isArray(reminded) ? reminded : [], validJobs);

            // Save to localStorage cache for future instant loads
            try {
                if (validJobs.length > 0) {
                    localStorage.setItem('sarkar_jobs_minimal', JSON.stringify(validJobs));
                }
                localStorage.setItem('sarkar_liked_jobs', JSON.stringify(resolvedLiked));
                localStorage.setItem('sarkar_applied_jobs', JSON.stringify(resolvedApplied));
                localStorage.setItem('sarkar_reminded_jobs', JSON.stringify(resolvedReminded));
            } catch (e) {
                console.error('Failed to write jobs cache:', e);
            }

            const { eligible, partial } = computeEligibility(validJobs, resolvedUser);

            dispatch({
                type: types.FETCH_JOBS_SUCCESS,
                payload: {
                    allJobs: validJobs,
                    rawEligibleJobs: eligible,
                    rawPartialJobs: partial,
                    likedJobs: resolvedLiked,
                    appliedJobs: resolvedApplied,
                    remindedJobs: resolvedReminded,
                }
            });

            // Dispatch AUTH_SUCCESS secretly if getting user session succeeds
            if (me && me.full_name) {
                dispatch({ type: types.AUTH_SUCCESS, payload: me });
            }
        } catch (err: any) {
            console.error('Background jobs refresh failed:', err);
            if (!hasCache) {
                const errMsg = err.message || 'Failed to load dashboards data';
                dispatch({ type: types.FETCH_JOBS_FAIL, payload: errMsg });
                throw err;
            }
        }
    };

    if (hasCache) {
        // 1. Optimistically dispatch cache immediately for 0ms loading feedback
        const resolvedUser = cachedUser || { full_name: 'Guest', age: 0 };
        const cleanCachedJobs = deduplicateJobs(cachedJobs);
        const resolvedLiked = mapSavedJobs(cachedLiked, cleanCachedJobs);
        const resolvedApplied = mapSavedJobs(cachedApplied, cleanCachedJobs);
        const resolvedReminded = mapSavedJobs(cachedReminded, cleanCachedJobs);

        const { eligible, partial } = computeEligibility(cleanCachedJobs, resolvedUser);
        dispatch({
            type: types.FETCH_JOBS_SUCCESS,
            payload: {
                allJobs: cleanCachedJobs,
                rawEligibleJobs: eligible,
                rawPartialJobs: partial,
                likedJobs: resolvedLiked,
                appliedJobs: resolvedApplied,
                remindedJobs: resolvedReminded,
            }
        });

        // 2. Perform network request asynchronously in background
        performFetch();
        return; // Resolve action immediately so dashboard loader hides instantly
    } else {
        // No cache: perform fetch synchronously (wait for it to finish)
        await performFetch();
    }
};

export const fetchLikedJobsAction = () => async (dispatch: any) => {
    try {
        const liked = await api.getLikedJobs();
        const payload = Array.isArray(liked) ? liked : [];
        try {
            localStorage.setItem('sarkar_liked_jobs', JSON.stringify(payload));
        } catch (e) {
            console.error('Failed to cache liked jobs:', e);
        }
        dispatch({ type: types.SET_LIKED_JOBS, payload });
    } catch (e) {
        console.error('fetchLikedJobsAction failed:', e);
    }
};

export const fetchAppliedJobsAction = () => async (dispatch: any) => {
    try {
        const applied = await api.getAppliedJobs();
        const payload = Array.isArray(applied) ? applied : [];
        try {
            localStorage.setItem('sarkar_applied_jobs', JSON.stringify(payload));
        } catch (e) {
            console.error('Failed to cache applied jobs:', e);
        }
        dispatch({ type: types.SET_APPLIED_JOBS, payload });
    } catch (e) {
        console.error('fetchAppliedJobsAction failed:', e);
    }
};

export const fetchRemindedJobsAction = () => async (dispatch: any) => {
    try {
        const reminded = await api.getRemindedJobs();
        const payload = Array.isArray(reminded) ? reminded : [];
        try {
            localStorage.setItem('sarkar_reminded_jobs', JSON.stringify(payload));
        } catch (e) {
            console.error('Failed to cache reminded jobs:', e);
        }
        dispatch({ type: types.SET_REMINDED_JOBS, payload });
    } catch (e) {
        console.error('fetchRemindedJobsAction failed:', e);
    }
};

// Optimistic action creators with rollback/refetch and localStorage sync
export const toggleLikeAction = (job: Job, currentlyLiked: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_LIKE_OPTIMISTIC,
        payload: { job, isLiked: !currentlyLiked }
    });

    // Update LocalStorage cache optimistically
    try {
        const cached = localStorage.getItem('sarkar_liked_jobs');
        let list: Job[] = cached ? JSON.parse(cached) : [];
        if (currentlyLiked) {
            list = list.filter(j => j.id !== job.id);
        } else {
            if (!list.some(j => j.id === job.id)) {
                list.push(job);
            }
        }
        localStorage.setItem('sarkar_liked_jobs', JSON.stringify(list));
    } catch (e) {
        console.error('Failed to update local liked cache:', e);
    }

    try {
        if (currentlyLiked) {
            await api.unlikeJob(job.id);
        } else {
            await api.likeJob(job.id);
        }
    } catch (err) {
        // Rollback state in Redux and LocalStorage
        dispatch({
            type: types.TOGGLE_LIKE_OPTIMISTIC,
            payload: { job, isLiked: currentlyLiked }
        });
        try {
            const cached = localStorage.getItem('sarkar_liked_jobs');
            let list: Job[] = cached ? JSON.parse(cached) : [];
            if (currentlyLiked) {
                if (!list.some(j => j.id === job.id)) list.push(job);
            } else {
                list = list.filter(j => j.id !== job.id);
            }
            localStorage.setItem('sarkar_liked_jobs', JSON.stringify(list));
        } catch (e) {
            console.error('Failed to rollback local liked cache:', e);
        }
        throw err;
    }
};

export const toggleApplyAction = (job: Job, currentlyApplied: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_APPLY_OPTIMISTIC,
        payload: { job, isApplied: !currentlyApplied }
    });

    // Update LocalStorage cache optimistically
    try {
        const cached = localStorage.getItem('sarkar_applied_jobs');
        let list: Job[] = cached ? JSON.parse(cached) : [];
        if (currentlyApplied) {
            list = list.filter(j => j.id !== job.id);
        } else {
            if (!list.some(j => j.id === job.id)) {
                list.push(job);
            }
        }
        localStorage.setItem('sarkar_applied_jobs', JSON.stringify(list));
    } catch (e) {
        console.error('Failed to update local applied cache:', e);
    }

    try {
        await api.toggleApplied(job.id);
        window.dispatchEvent(new Event('app:appliedToggled'));
    } catch (err) {
        // Rollback state in Redux and LocalStorage
        dispatch({
            type: types.TOGGLE_APPLY_OPTIMISTIC,
            payload: { job, isApplied: currentlyApplied }
        });
        try {
            const cached = localStorage.getItem('sarkar_applied_jobs');
            let list: Job[] = cached ? JSON.parse(cached) : [];
            if (currentlyApplied) {
                if (!list.some(j => j.id === job.id)) list.push(job);
            } else {
                list = list.filter(j => j.id !== job.id);
            }
            localStorage.setItem('sarkar_applied_jobs', JSON.stringify(list));
        } catch (e) {
            console.error('Failed to rollback local applied cache:', e);
        }
        throw err;
    }
};

export const toggleReminderAction = (job: Job, currentlyReminded: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_REMINDER_OPTIMISTIC,
        payload: { job, isReminded: !currentlyReminded }
    });

    // Update LocalStorage cache optimistically
    try {
        const cached = localStorage.getItem('sarkar_reminded_jobs');
        let list: Job[] = cached ? JSON.parse(cached) : [];
        if (currentlyReminded) {
            list = list.filter(j => j.id !== job.id);
        } else {
            if (!list.some(j => j.id === job.id)) {
                list.push(job);
            }
        }
        localStorage.setItem('sarkar_reminded_jobs', JSON.stringify(list));
    } catch (e) {
        console.error('Failed to update local reminded cache:', e);
    }

    try {
        await api.toggleReminder(job.id);
    } catch (err) {
        // Rollback state in Redux and LocalStorage
        dispatch({
            type: types.TOGGLE_REMINDER_OPTIMISTIC,
            payload: { job, isReminded: currentlyReminded }
        });
        try {
            const cached = localStorage.getItem('sarkar_reminded_jobs');
            let list: Job[] = cached ? JSON.parse(cached) : [];
            if (currentlyReminded) {
                if (!list.some(j => j.id === job.id)) list.push(job);
            } else {
                list = list.filter(j => j.id !== job.id);
            }
            localStorage.setItem('sarkar_reminded_jobs', JSON.stringify(list));
        } catch (e) {
            console.error('Failed to rollback local reminded cache:', e);
        }
        throw err;
    }
};
