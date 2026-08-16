import * as types from '../actionTypes';
import { Job } from '../../types';

export interface JobsState {
    allJobs: Job[];
    rawEligibleJobs: Job[];
    rawPartialJobs: Job[];
    likedJobs: Job[];
    appliedJobs: Job[];
    remindedJobs: Job[];
    loading: boolean;
    error: string | null;
}

const initialState: JobsState = {
    allJobs: [],
    rawEligibleJobs: [],
    rawPartialJobs: [],
    likedJobs: [],
    appliedJobs: [],
    remindedJobs: [],
    loading: false,
    error: null,
};

export default function jobsReducer(state = initialState, action: any): JobsState {
    switch (action.type) {
        case types.FETCH_JOBS_START:
            return {
                ...state,
                loading: true,
                error: null,
            };
        case types.FETCH_JOBS_SUCCESS:
            return {
                ...state,
                loading: false,
                allJobs: action.payload.allJobs,
                rawEligibleJobs: action.payload.rawEligibleJobs,
                rawPartialJobs: action.payload.rawPartialJobs,
                likedJobs: action.payload.likedJobs,
                appliedJobs: action.payload.appliedJobs,
                remindedJobs: action.payload.remindedJobs,
                error: null,
            };
        case types.FETCH_JOBS_FAIL:
            return {
                ...state,
                loading: false,
                error: action.payload,
            };
        case types.SET_LIKED_JOBS:
            return {
                ...state,
                likedJobs: action.payload,
            };
        case types.SET_APPLIED_JOBS:
            return {
                ...state,
                appliedJobs: action.payload,
            };
        case types.SET_REMINDED_JOBS:
            return {
                ...state,
                remindedJobs: action.payload,
            };
        case types.TOGGLE_LIKE_OPTIMISTIC: {
            const { job, isLiked } = action.payload;
            const likedJobs = isLiked
                ? [...state.likedJobs, job]
                : state.likedJobs.filter(j => j.id !== job.id);
            return {
                ...state,
                likedJobs,
            };
        }
        case types.TOGGLE_APPLY_OPTIMISTIC: {
            const { job, isApplied } = action.payload;
            const appliedJobs = isApplied
                ? [...state.appliedJobs, job]
                : state.appliedJobs.filter(j => j.id !== job.id);
            return {
                ...state,
                appliedJobs,
            };
        }
        case types.TOGGLE_REMINDER_OPTIMISTIC: {
            const { job, isReminded } = action.payload;
            const remindedJobs = isReminded
                ? [...state.remindedJobs, job]
                : state.remindedJobs.filter(j => j.id !== job.id);
            return {
                ...state,
                remindedJobs,
            };
        }
        default:
            return state;
    }
}
