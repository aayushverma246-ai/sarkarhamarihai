import * as types from '../actionTypes';
import { api, getCachedUser } from '../../api';
import { Job } from '../../types';
import { meetsQualification, meetsAge, meetsTechnicalCriteria } from '../../utils';

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
    try {
        const cachedRaw = localStorage.getItem('sarkar_jobs_minimal');
        if (cachedRaw) {
            cachedJobs = JSON.parse(cachedRaw);
        }
    } catch (e) {
        console.error('Failed to parse cached jobs:', e);
    }

    const hasCache = Array.isArray(cachedJobs) && cachedJobs.length > 0;

    // Define background network fetch function
    const performFetch = async () => {
        try {
            const [me, jobsResponse] = await Promise.all([
                api.getMe().catch(() => cachedUser || { full_name: 'Guest', age: 0 }),
                api.getJobsAllMinimal().catch(err => {
                    console.error('[Redux getJobsAllMinimal failed]', err);
                    return { jobs: [] };
                }),
            ]);

            const resolvedUser = (me && me.full_name) ? me : (cachedUser || { full_name: 'Guest', age: 0 });
            const validJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];

            // Save to localStorage cache for future instant loads
            if (validJobs.length > 0) {
                try {
                    localStorage.setItem('sarkar_jobs_minimal', JSON.stringify(validJobs));
                } catch (e) {
                    console.error('Failed to write jobs cache:', e);
                }
            }

            const { eligible, partial } = computeEligibility(validJobs, resolvedUser);

            dispatch({
                type: types.FETCH_JOBS_SUCCESS,
                payload: {
                    allJobs: validJobs,
                    rawEligibleJobs: eligible,
                    rawPartialJobs: partial,
                    likedJobs: [], // will stream in Phase 2
                    appliedJobs: [],
                    remindedJobs: [],
                }
            });

            // Dispatch AUTH_SUCCESS secretly if getting user session succeeds
            if (me && me.full_name) {
                dispatch({ type: types.AUTH_SUCCESS, payload: me });
            }

            // Stream in liked/applied/reminded non-blocking
            Promise.all([
                api.getLikedJobs().then(liked => {
                    dispatch({ type: types.SET_LIKED_JOBS, payload: Array.isArray(liked) ? liked : [] });
                }).catch(() => {}),
                api.getAppliedJobs().then(applied => {
                    dispatch({ type: types.SET_APPLIED_JOBS, payload: Array.isArray(applied) ? applied : [] });
                }).catch(() => {}),
                api.getRemindedJobs().then(reminded => {
                    dispatch({ type: types.SET_REMINDED_JOBS, payload: Array.isArray(reminded) ? reminded : [] });
                }).catch(() => {}),
            ]);
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
        const { eligible, partial } = computeEligibility(cachedJobs, resolvedUser);
        dispatch({
            type: types.FETCH_JOBS_SUCCESS,
            payload: {
                allJobs: cachedJobs,
                rawEligibleJobs: eligible,
                rawPartialJobs: partial,
                likedJobs: [],
                appliedJobs: [],
                remindedJobs: [],
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
        dispatch({ type: types.SET_LIKED_JOBS, payload: Array.isArray(liked) ? liked : [] });
    } catch (e) {
        console.error('fetchLikedJobsAction failed:', e);
    }
};

export const fetchAppliedJobsAction = () => async (dispatch: any) => {
    try {
        const applied = await api.getAppliedJobs();
        dispatch({ type: types.SET_APPLIED_JOBS, payload: Array.isArray(applied) ? applied : [] });
    } catch (e) {
        console.error('fetchAppliedJobsAction failed:', e);
    }
};

export const fetchRemindedJobsAction = () => async (dispatch: any) => {
    try {
        const reminded = await api.getRemindedJobs();
        dispatch({ type: types.SET_REMINDED_JOBS, payload: Array.isArray(reminded) ? reminded : [] });
    } catch (e) {
        console.error('fetchRemindedJobsAction failed:', e);
    }
};

// Optimistic action creators with rollback/refetch
export const toggleLikeAction = (job: Job, currentlyLiked: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_LIKE_OPTIMISTIC,
        payload: { job, isLiked: !currentlyLiked }
    });
    try {
        if (currentlyLiked) {
            await api.unlikeJob(job.id);
        } else {
            await api.likeJob(job.id);
        }
        dispatch(fetchLikedJobsAction());
    } catch (err) {
        dispatch({
            type: types.TOGGLE_LIKE_OPTIMISTIC,
            payload: { job, isLiked: currentlyLiked }
        });
        throw err;
    }
};

export const toggleApplyAction = (job: Job, currentlyApplied: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_APPLY_OPTIMISTIC,
        payload: { job, isApplied: !currentlyApplied }
    });
    try {
        await api.toggleApplied(job.id);
        dispatch(fetchAppliedJobsAction());
        window.dispatchEvent(new Event('app:appliedToggled'));
    } catch (err) {
        dispatch({
            type: types.TOGGLE_APPLY_OPTIMISTIC,
            payload: { job, isApplied: currentlyApplied }
        });
        throw err;
    }
};

export const toggleReminderAction = (job: Job, currentlyReminded: boolean) => async (dispatch: any) => {
    dispatch({
        type: types.TOGGLE_REMINDER_OPTIMISTIC,
        payload: { job, isReminded: !currentlyReminded }
    });
    try {
        await api.toggleReminder(job.id);
        dispatch(fetchRemindedJobsAction());
    } catch (err) {
        // Rollback state
        dispatch({
            type: types.TOGGLE_REMINDER_OPTIMISTIC,
            payload: { job, isReminded: currentlyReminded }
        });
        throw err;
    }
};
