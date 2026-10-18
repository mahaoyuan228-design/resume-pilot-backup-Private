@echo off
setlocal
cd /d "%~dp0.."
echo CMS education auto-fill (self-reloads extension, then fills profileIndex=5)
node scripts\auto-cms-education.mjs
echo.
echo Result: dist\auto-runs\latest.json
if exist dist\auto-runs\latest.json type dist\auto-runs\latest.json
pause
