@echo off
rem One-shot hotjob tenant basic: readiness, then fill-without-save. NEVER clicks Save/submit/下一步.
rem Usage: scripts\run-hotjob-tenant.cmd zhonglian^|nanyue^|celebright^|guosheng^|caict^|opple
rem Precondition: tenant already logged in on the trial Edge (CDP 9237).
rem   zhonglian (中联): live uses /mc/deliver/operationResumer (antd-mobile). Path B —
rem     routes to scripts\auto-hotjob-mc-basic.mjs (siteId=hotjob-mc); CMS_BASIC not used.
rem   opple (欧普): shell-guess mc (portal /mc/position/campus) → same Path B as zhonglian.
rem   other tenants (nanyue/celebright/guosheng/caict): park on .../SU*/pb/resumeOperation.html → auto-cms-basic.mjs
rem Env passthrough: RESUME_EXT_ID (default trial hhembhoojafdefnkonmgoejfedgloanc), RELOAD=1,
rem   AUTO_TIMEOUT_MS, OPEN_CMS_PAGE (default 0 here), NO_PAUSE=1, CDP_PORT (default 9237).
setlocal
cd /d "%~dp0.."
set "TENANT=%~1"
set "CMS_SU="
if /i "%TENANT%"=="zhonglian"  set "CMS_SU=SU661f37091eb8053acd6cdf3d"
if /i "%TENANT%"=="nanyue"     set "CMS_SU=SU670a291d6202cc7666c744bc"
if /i "%TENANT%"=="celebright" set "CMS_SU=SU6279c916bef57c3ac0d49671"
if /i "%TENANT%"=="guosheng"   set "CMS_SU=SU6879a7b3e57172288b60df9d"
if /i "%TENANT%"=="caict"      set "CMS_SU=SU642fbf5fbef57c1e269fa798"
if /i "%TENANT%"=="opple"      set "CMS_SU=SU646ed9920dcad45af14821b4"
if not defined CMS_SU (
  echo Unknown tenant "%TENANT%". Use: zhonglian ^| nanyue ^| celebright ^| guosheng ^| caict ^| opple
  set "RC=64"
  goto :end
)
if not defined CDP_PORT set "CDP_PORT=9237"
if not defined RESUME_EXT_ID set "RESUME_EXT_ID=hhembhoojafdefnkonmgoejfedgloanc"

rem --- mc Path B (中联 live; 欧普 shell-guess mc): thin hotjob-mc adapter (not CMS_BASIC) ---
if /i "%TENANT%"=="zhonglian" set "USE_HOTJOB_MC=1"
if /i "%TENANT%"=="opple" set "USE_HOTJOB_MC=1"
if defined USE_HOTJOB_MC (
  set "CMS_PAGE=https://wecruit.hotjob.cn/%CMS_SU%/mc/deliver/operationResumer"
  echo [hotjob-tenant] %TENANT% %CMS_SU% -^> mc operationResumer via auto-hotjob-mc-basic.mjs
  echo [hotjob-tenant] step 1/2 MODE=readiness
  set "MODE=readiness"
  node scripts\auto-hotjob-mc-basic.mjs --live
  set "RC=%ERRORLEVEL%"
  if not "%RC%"=="0" (
    echo [hotjob-tenant] mc readiness failed rc=%RC% - not filling. See dist\auto-runs\hotjob-mc-basic-readiness-latest.json
    goto :end
  )
  echo [hotjob-tenant] step 2/2 MODE=fill (fill-wo-save + restore; Never Save / never 下一步)
  set "MODE=fill"
  node scripts\auto-hotjob-mc-basic.mjs --live
  set "RC=%ERRORLEVEL%"
  echo [hotjob-tenant] mc fill rc=%RC%. Evidence: dist\auto-runs\hotjob-mc-basic-*-latest.json
  goto :end
)

rem --- other tenants: pb CMS_BASIC ---
set "CMS_PAGE="
echo [hotjob-tenant] %TENANT% %CMS_SU% -^> https://wecruit.hotjob.cn/%CMS_SU%/pb/resumeOperation.html
if not defined OPEN_CMS_PAGE set "OPEN_CMS_PAGE=0"
set "OPEN_IF_MISSING=0"
echo [hotjob-tenant] step 1/2 MODE=readiness
set "MODE=readiness"
node scripts\auto-cms-basic.mjs
set "RC=%ERRORLEVEL%"
if "%RC%"=="4" (
  echo [hotjob-tenant] unexpected mc refuse rc=4 for pb tenant - see HOTJOB_MC doc
  goto :end
)
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
:end
if not "%NO_PAUSE%"=="1" pause
endlocal & exit /b %RC%
