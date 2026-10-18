@echo off
rem One-shot hotjob tenant CMS basic: readiness, then fill-without-save. NEVER clicks Save/submit.
rem Usage: scripts\run-hotjob-tenant.cmd zhonglian^|nanyue^|celebright^|guosheng
rem zhonglian is the mc shell (operationResumer) and does NOT call CMS_BASIC.
rem Other tenants: tab parked on .../SU*/pb/resumeOperation.html in the trial Edge.
rem Env passthrough: RESUME_EXT_ID, RELOAD=1, AUTO_TIMEOUT_MS, OPEN_CMS_PAGE (default 0 here), NO_PAUSE=1.
rem mc live fill also needs HOTJOB_MC_FULL_NAME, HOTJOB_MC_PHONE, HOTJOB_MC_EMAIL. Never Save.
setlocal
cd /d "%~dp0.."
set "TENANT=%~1"
if /i "%TENANT%"=="zhonglian" goto :mc
set "CMS_SU="
if /i "%TENANT%"=="nanyue"     set "CMS_SU=SU670a291d6202cc7666c744bc"
if /i "%TENANT%"=="celebright" set "CMS_SU=SU6279c916bef57c3ac0d49671"
if /i "%TENANT%"=="guosheng"   set "CMS_SU=SU6879a7b3e57172288b60df9d"
if not defined CMS_SU (
  echo Unknown tenant "%TENANT%". Use: zhonglian ^| nanyue ^| celebright ^| guosheng
  set "RC=64"
  goto :end
)
set "CMS_PAGE="
if not defined OPEN_CMS_PAGE set "OPEN_CMS_PAGE=0"
set "OPEN_IF_MISSING=0"
echo [hotjob-tenant] %TENANT% %CMS_SU% -^> https://wecruit.hotjob.cn/%CMS_SU%/pb/resumeOperation.html
echo [hotjob-tenant] step 1/2 MODE=readiness
set "MODE=readiness"
node scripts\auto-cms-basic.mjs
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo [hotjob-tenant] readiness failed rc=%RC% - not filling. See dist\auto-runs\hotjob-tenant-cms-basic-latest.json
  goto :end
)
rem Reload only once (step 1); avoid re-reloading the SW between steps.
set "RELOAD="
echo [hotjob-tenant] step 2/2 MODE=fill (fill-without-save; Save is never clicked)
set "MODE=fill"
node scripts\auto-cms-basic.mjs
set "RC=%ERRORLEVEL%"
echo [hotjob-tenant] fill rc=%RC%. Evidence: dist\auto-runs\hotjob-tenant-%CMS_SU:~2,6%-cms-basic-*.json
goto :end

:mc
rem Trial Edge extension id (not the older hdek… default used by CMS/GTH harnesses).
if not defined RESUME_EXT_ID set "RESUME_EXT_ID=hhembhoojafdefnkonmgoejfedgloanc"
set "HOTJOB_MC_PAGE=https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/operationResumer"
echo [hotjob-mc] zhonglian shell=mc -^> %HOTJOB_MC_PAGE%
echo [hotjob-mc] step 1/2 MODE=readiness (CDP attach; never Save)
set "MODE=readiness"
node scripts\auto-hotjob-mc-basic.mjs --live
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo [hotjob-mc] readiness failed rc=%RC% - not filling. See dist\auto-runs\hotjob-mc-basic-readiness-latest.json
  goto :end
)
echo [hotjob-mc] step 2/2 MODE=fill (fill-without-save; Save is never clicked)
set "MODE=fill"
node scripts\auto-hotjob-mc-basic.mjs --live
set "RC=%ERRORLEVEL%"
echo [hotjob-mc] fill rc=%RC%. Evidence: dist\auto-runs\hotjob-mc-basic-fill-latest.json

:end
if not "%NO_PAUSE%"=="1" pause
endlocal & exit /b %RC%
