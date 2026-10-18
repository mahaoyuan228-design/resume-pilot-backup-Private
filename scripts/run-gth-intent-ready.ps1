$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev'
$env:MODE = 'readiness'
$env:OPEN_GTH_PAGE = '0'
$env:OPEN_IF_MISSING = '0'
$env:AUTO_TIMEOUT_MS = '120000'
Write-Host "Running GTH_INTENT_AUTO readiness..."
node scripts\auto-gth-intent.mjs
Write-Host "exit=$LASTEXITCODE"
