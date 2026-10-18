$ErrorActionPreference = 'Continue'
$root = 'C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev'
Write-Host '=== intent in Edge packs ==='
foreach ($pack in @('003753','011002')) {
  $base = Join-Path $root ("dist\edge-internal-v0.1.4.9-20261017-$pack\extension")
  Write-Host "--- $pack ---"
  if (-not (Test-Path $base)) { Write-Host "missing $base"; continue }
  Get-ChildItem $base -Recurse -Filter '*intent*' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
  $w = Join-Path $base 'background\worker.mjs'
  if (Test-Path $w) {
    Select-String -Path $w -Pattern 'IntentAuto|gth-intent' | ForEach-Object { "worker:$($_.LineNumber):$($_.Line.Trim())" }
  }
}
Write-Host '=== src intent mtimes ==='
Get-Item (Join-Path $root 'src\background\gth-intent-auto.mjs'),
  (Join-Path $root 'src\auto\gth-intent-auto.js'),
  (Join-Path $root 'src\auto\gth-intent-auto.html'),
  (Join-Path $root 'scripts\auto-gth-intent.mjs'),
  (Join-Path $root 'src\background\gth-save-policy.mjs') -ErrorAction SilentlyContinue |
  Format-Table Name,Length,LastWriteTime -AutoSize
Write-Host '=== productPaths count src WHITELIST ==='
$wl = Get-Content (Join-Path $root 'WHITELIST.json') -Raw | ConvertFrom-Json
Write-Host ("productPaths={0}" -f $wl.productPaths.Count)
