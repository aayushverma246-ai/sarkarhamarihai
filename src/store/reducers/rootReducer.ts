import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './authReducer';
import jobsReducer from './jobsReducer';
import recommendationsReducer from './recommendationsReducer';

const rootReducer = combineReducers({
    auth: authReducer,
    jobs: jobsReducer,
    recs: recommendationsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
