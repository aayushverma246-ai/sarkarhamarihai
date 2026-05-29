// Action Types for Redux State Management

// Auth Action Types
export const AUTH_START = 'AUTH_START';
export const AUTH_SUCCESS = 'AUTH_SUCCESS';
export const AUTH_FAIL = 'AUTH_FAIL';
export const AUTH_LOGOUT = 'AUTH_LOGOUT';

// Jobs Action Types
export const FETCH_JOBS_START = 'FETCH_JOBS_START';
export const FETCH_JOBS_SUCCESS = 'FETCH_JOBS_SUCCESS';
export const FETCH_JOBS_FAIL = 'FETCH_JOBS_FAIL';
export const SET_LIKED_JOBS = 'SET_LIKED_JOBS';
export const SET_APPLIED_JOBS = 'SET_APPLIED_JOBS';
export const SET_REMINDED_JOBS = 'SET_REMINDED_JOBS';

export const TOGGLE_LIKE_OPTIMISTIC = 'TOGGLE_LIKE_OPTIMISTIC';
export const TOGGLE_APPLY_OPTIMISTIC = 'TOGGLE_APPLY_OPTIMISTIC';
export const TOGGLE_REMINDER_OPTIMISTIC = 'TOGGLE_REMINDER_OPTIMISTIC';

// Recommendations Action Types
export const FETCH_RECS_START = 'FETCH_RECS_START';
export const FETCH_RECS_SUCCESS = 'FETCH_RECS_SUCCESS';
export const FETCH_RECS_FAIL = 'FETCH_RECS_FAIL';
