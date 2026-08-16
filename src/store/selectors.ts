import { RootState } from './reducers/rootReducer';

// ── Auth Selectors ──
export const selectAuth = (state: RootState) => state.auth;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.loading;
export const selectAuthError = (state: RootState) => state.auth.error;

// ── Jobs Selectors ──
export const selectJobsState = (state: RootState) => state.jobs;
export const selectAllJobs = (state: RootState) => state.jobs.allJobs;
export const selectEligibleJobs = (state: RootState) => state.jobs.rawEligibleJobs;
export const selectPartialJobs = (state: RootState) => state.jobs.rawPartialJobs;
export const selectLikedJobs = (state: RootState) => state.jobs.likedJobs;
export const selectAppliedJobs = (state: RootState) => state.jobs.appliedJobs;
export const selectRemindedJobs = (state: RootState) => state.jobs.remindedJobs;
export const selectJobsLoading = (state: RootState) => state.jobs.loading;
export const selectJobsError = (state: RootState) => state.jobs.error;

// ── Recommendations Selectors ──
export const selectRecsState = (state: RootState) => state.recs;
export const selectRecommendations = (state: RootState) => state.recs.recs;
