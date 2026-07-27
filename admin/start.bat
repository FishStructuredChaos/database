@echo off
cd /d "%~dp0"
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start http://localhost:3456
start http://localhost:3456/admin
echo.
echo  ^<^>^< ROSE DATABASE ^>^>
echo.
echo  Opening site and admin panel in browser...
echo  Press Ctrl+C to stop
echo.
node serve.mjs
pause
