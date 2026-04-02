@echo off
echo ========================================
echo  SarkarHamariHai - Complete Fix Deploy
echo ========================================
echo.
echo This script will deploy all fixes to production.
echo.
echo Changes being deployed:
echo  - Fixed /api/jobs pagination (500 per page)
echo  - Fixed /api/jobs/eligible (batched processing)
echo  - Fixed /api/jobs/partial (batched processing)
echo  - Increased timeout to 60 seconds
echo  - Added missing fields (location, created_at, etc)
echo  - Added debug logging
echo.
pause
echo.
echo Starting deployment...
echo.
npx vercel --prod --yes
echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo  1. Open https://sarkarhamarihai.vercel.app
echo  2. Open browser DevTools (F12)
echo  3. Go to Console tab
echo  4. Refresh the dashboard
echo  5. Check for logs like:
echo     [API] getJobs: Fetching all jobs in batches...
echo     [API] Fetching jobs: offset=0, limit=500
echo     [API] Received 500 jobs, total so far: 500
echo.
echo If you see errors, copy them and share with me.
echo.
pause
