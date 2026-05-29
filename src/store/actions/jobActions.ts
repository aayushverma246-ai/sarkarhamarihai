import * as types from '../actionTypes';
import { api, getCachedUser } from '../../api';
import { Job } from '../../types';
import { meetsQualification, meetsAge, meetsTechnicalCriteria } from '../../utils';

// Async job loading (Phase 1 & Phase 2 combined)
export const fetchAllJobsAction = () => async (dispatch: any) => {
    dispatch({ type: types.FETCH_JOBS_START });
    try {
        const cachedUser = getCachedUser();
        const [me, jobsResponse] = await Promise.all([
            api.getMe().catch(() => cachedUser || { full_name: 'Guest', age: 0 }),
            api.getJobsAllMinimal().catch(err => {
                console.error('[Redux getJobsAllMinimal failed]', err);
                return { jobs: [] };
            }),
        ]);

        const resolvedUser = (me && me.full_name) ? me : (cachedUser || { full_name: 'Guest', age: 0 });
        const validJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];

        // Compute eligible/partial purely from the localized DB payload
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

        // Silent load liked / applied / reminded jobs
        const [liked, applied, reminded] = await Promise.all([
            api.getLikedJobs().catch(() => []),
            api.getAppliedJobs().catch(() => []),
            api.getRemindedJobs().catch(() => []),
        ]);

        dispatch({
            type: types.FETCH_JOBS_SUCCESS,
            payload: {
                allJobs: validJobs,
                rawEligibleJobs: finalEligible,
                rawPartialJobs: finalPartial,
                likedJobs: Array.isArray(liked) ? liked : [],
                appliedJobs: Array.isArray(applied) ? applied : [],
                remindedJobs: Array.isArray(reminded) ? reminded : [],
            }
        });

        // Dispatch AUTH_SUCCESS secretly if getting user session succeeds
        if (me && me.full_name) {
            dispatch({ type: types.AUTH_SUCCESS, payload: me });
        }
    } catch (err: any) {
        const errMsg = err.message || 'Failed to load dashboards data';
        dispatch({ type: types.FETCH_JOBS_FAIL, payload: errMsg });
        throw err;
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
