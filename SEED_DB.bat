@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

echo.
echo ============================================================
echo   SARKARHAMARIHAI - DIRECT DATABASE SEED
echo   Seeds 1500+ jobs directly to Turso from local machine
echo   (Bypasses Vercel 60s timeout limit)
echo ============================================================
echo.

cd /d "D:\build-govguide-ai-app (2)\build-govguide-ai-app (1)"

echo [DB] Using Turso credentials from .env...
echo [DB] Starting seed process (this takes 2-5 minutes)...
echo.

node force_seed_prod.js

echo.
echo ============================================================
echo   DATABASE SEED COMPLETE
echo ============================================================
echo.
echo   Now verify at:
echo   https://sarkarhamarihai.vercel.app/api/health
echo   https://sarkarhamarihai.vercel.app/api/test-jobs
echo.
pause
