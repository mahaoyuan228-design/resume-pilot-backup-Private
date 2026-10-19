param(
  [int]$Port = 9239,
  [string]$ExtId = 'decggijdlhflkjkgmofbclglilpaooij',
  [string]$Only = 'cms-basic,gth-basic',
  [int]$TimeoutMs = 180000
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Runner = Join-Path $RepoRoot 'scripts\run-paid-handoff-cdp.mjs'

$env:CDP_PORT = [string]$Port
$env:RESUME_EXT_ID = $ExtId
$env:ONLY = $Only
$env:AUTO_TIMEOUT_MS = [string]$TimeoutMs

Set-Location $RepoRoot
Write-Host "PAID_QA_RUNNER=$Runner"
& node $Runner
$code = $LASTEXITCODE
if ($null -eq $code) { $code = 1 }
Write-Host "PAID_QA_EXIT=$code"
exit $code
