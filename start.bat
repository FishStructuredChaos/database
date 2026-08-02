@echo off
title ROSE FISH DATABASE - LOCAL SERVER
echo ======================================================
echo   ROSE FISH DATABASE - LOCAL TEST SERVER
echo   http://localhost:3456
echo   (files auto-rebuild, browser auto-reloads)
echo   Press Ctrl+C to stop
echo ======================================================
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3456"
npm run dev
pause
