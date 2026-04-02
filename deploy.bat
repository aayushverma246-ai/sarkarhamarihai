@echo off
@echo off
REM ============================================================================
REM SarkarHamariHai - One-Click Vercel Deployment
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo  SarkarHamariHai - Vercel Deployment
echo  Target: sarkarhamarihai.vercel.app
echo ============================================================================
echo.

REM Set project directory
set "PROJECT_DIR=D:\build-govguide-ai-app (2)\build-govguide-ai-app (1)"

cd /d "%PROJECT_DIR%"

echo [1/5] Checking Node.js installation...
node --version
npm --version
echo.

echo [2/5] Checking project files...
if not exist package.json (
    echo [ERROR] package.json not found
    pause
    exit /b 1
)
echo [OK] Project files found
echo.

echo [3/5] Installing dependencies...
call npm install --prefer-offline --no-audit
if errorlevel 1 (
    echo [WARNING] npm install completed with warnings, continuing...
)
echo.

echo [4/5] Building project with Vite...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo [OK] Build completed
echo.

echo [5/5] Deploying to Vercel production...
echo.
echo ============================================================================
echo  DEPLOYMENT IN PROGRESS...
echo ============================================================================
echo.

call npx vercel deploy --prod --yes

if errorlevel 1 (
    echo.
    echo [INFO] If deployment failed, try:
    echo   1. npx vercel login
    echo   2. npx vercel link
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo  ✓ DEPLOYMENT SUCCESSFUL!
echo ============================================================================
echo.
echo Your app is now LIVE! 🎉
echo.
echo 🌐 URL: https://sarkarhamarihai.vercel.app
echo 📊 Dashboard: https://vercel.com/dashboard/sarkar-hamari-hai
echo.
pause
