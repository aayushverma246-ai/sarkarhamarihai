# Dashboard Tabs - Data Sources & Verification

## Tab Configuration

Each tab displays a specific subset of jobs. Here's what data should appear:

### 1. **Live Eligible** (`eligibleLive`)
- **Source**: `eligibleJobs` filtered by `form_status === 'LIVE'`
- **API**: `/api/jobs/eligible` (filters based on user profile)
- **Criteria**: 
  - Meets user's qualification
  - Meets user's age requirements
  - Meets state criteria
  - Currently accepting applications
- **Status**: ✅ Optimized (uses limited fields)

### 2. **Eligible** (`eligible`)
- **Source**: `rawEligibleJobs` from `/api/jobs/eligible`
- **API**: `/api/jobs/eligible`
- **Criteria**:
  - Meets qualification
  - Meets age
  - Meets state
  - All statuses (LIVE, UPCOMING, CLOSED)
- **Status**: ✅ Optimized (uses limited fields)

### 3. **Close Match** (`partial`)
- **Source**: `rawPartialJobs` from `/api/jobs/partial`
- **API**: `/api/jobs/partial`
- **Criteria**:
  - Meets EITHER qualification OR age (not both)
  - User might be eligible with some conditions
- **Status**: ✅ Optimized (uses limited fields)

### 4. **Live** (`live`)
- **Source**: `allJobs` filtered by `form_status === 'LIVE'`
- **API**: `/api/jobs` (paginated, auto-fetches all)
- **Criteria**: Currently accepting applications
- **Status**: ✅ Optimized (paginated, fetches all)

### 5. **Upcoming** (`upcoming`)
- **Source**: `allJobs` filtered by `form_status === 'UPCOMING'`
- **API**: `/api/jobs` (paginated, auto-fetches all)
- **Criteria**: Applications not yet open
- **Status**: ✅ Optimized (paginated, fetches all)

### 6. **Closed** (`closed`)
- **Source**: `allJobs` filtered by `form_status === 'CLOSED' || 'RECENTLY_CLOSED'`
- **API**: `/api/jobs` (paginated, auto-fetches all)
- **Criteria**: Applications deadline passed
- **Orange Dot**: Shows when jobs closed in last 30 days exist
- **Status**: ✅ Optimized (paginated, fetches all)

### 7. **Saved** (`liked`)
- **Source**: `likedJobs` from `/api/jobs/liked`
- **API**: `/api/jobs/liked`
- **Criteria**: Jobs user has clicked the heart icon on
- **Status**: ✅ Works (only returns liked jobs)

### 8. **Applied** (`applied`)
- **Source**: `appliedJobs` from `/api/jobs/applied`
- **API**: `/api/applied`
- **Criteria**: Jobs user has marked as applied
- **Status**: ✅ Works (only returns applied jobs)

### 9. **All** (`all`)
- **Source**: `rawAllJobs` from `/api/jobs`
- **API**: `/api/jobs` (paginated, auto-fetches all)
- **Criteria**: Every job in database
- **Status**: ✅ Optimized (paginated, fetches all)

## Data Flow

### Frontend (`DashboardPage.tsx`)
```javascript
// Line 358-374: Parallel data load
const [me, jobs, eligible, partial, liked, applied] = await Promise.all([
  api.getMe(),
  api.getJobs(),           // → All jobs (paginated)
  api.getEligibleJobs(),   // → User-specific eligible
  api.getPartialJobs(),    // → User-specific partial
  api.getLikedJobs(),      // → User's liked jobs
  api.getAppliedJobs()     // → User's applied jobs
]);
```

### API Client (`src/api.ts`)
```javascript
// Line 155-186: getJobs() fetches all pages
getJobs: async () => {
  // Fetches 500 jobs at a time until complete
  // Returns: Array of all 15,858+ jobs
}

getJobsPaginated: async (params) => {
  // Returns: { jobs: [], total, limit, offset, hasMore }
}
```

### Backend Routes (`backend/src/routes/jobs.js`)
```javascript
// Line 121-189: Paginated jobs endpoint
GET /api/jobs?limit=500&offset=0
→ Returns { jobs: [...], total: 15858, limit: 500, offset: 0, hasMore: true }

// Line 191-211: Eligible jobs
GET /api/jobs/eligible
→ Filters all jobs by user profile
→ Returns array of matching jobs

// Line 213-233: Partial match jobs
GET /api/jobs/partial
→ Filters jobs that partially match user profile
→ Returns array of close matches
```

## Verification Checklist

After deployment, verify each tab shows correct data:

- [ ] **Live Eligible**: Only shows jobs user is eligible for AND currently open
- [ ] **Eligible**: Shows all jobs user is eligible for (any status)
- [ ] **Close Match**: Shows jobs where user meets some (not all) requirements
- [ ] **Live**: Shows all currently open jobs (regardless of eligibility)
- [ ] **Upcoming**: Shows jobs with future start dates
- [ ] **Closed**: Shows all closed jobs (orange dot if any closed in last 30 days)
- [ ] **Saved**: Shows only jobs user has liked
- [ ] **Applied**: Shows only jobs user has marked as applied
- [ ] **All**: Shows every job in database

## Performance Notes

- ✅ All endpoints now use optimized field selection
- ✅ `/api/jobs` returns paginated responses (200 jobs default)
- ✅ Frontend auto-fetches all pages and combines them
- ✅ Cache set to 2 minutes for instant reload
- ✅ State filter applied client-side after fetching

## Common Issues

**Problem**: Tab shows 0 jobs
- **Check**: API endpoint returns data (use DevTools Network tab)
- **Check**: `form_status` is correctly computed
- **Check**: State filter not too restrictive

**Problem**: Eligible/Partial show wrong jobs
- **Check**: User profile has qualification_type, age, state set
- **Check**: Backend filtering logic matches expectations
- **Check**: `meetsQualification()`, `meetsAge()`, `meetsStateCriteria()` functions work correctly

**Problem**: Counts don't match
- **Check**: State filter is applied consistently
- **Check**: `meetsStateFilter()` function (line 17-36 in DashboardPage.tsx)
