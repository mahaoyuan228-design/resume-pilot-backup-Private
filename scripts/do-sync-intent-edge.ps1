$ErrorActionPreference = 'Stop'
$root = 'C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev'
$files = @(
  'src\background\gth-intent-auto.mjs',
  'src\auto\gth-intent-auto.js',
  'src\auto\gth-intent-auto.html',
  'src\background\gth-save-policy.mjs',
  'src\background\worker.mjs',
  'src\popup\popup.js',
  'src\popup\popup.html',
  'src\content\engine.js'
)
foreach ($pack in @('003753','011002')) {
  $ext = Join-Path $root ("dist\edge-internal-v0.1.4.9-20261017-$pack\extension")
  Write-Host "==== sync $pack ===="
  foreach ($rel in $files) {
    $src = Join-Path $root $rel
    $dst = Join-Path $ext $rel
    if (-not (Test-Path $src)) { Write-Host "SKIP missing src $rel"; continue }
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    $s = Get-Item $src; $d = Get-Item $dst
    Write-Host ("copied {0} ({1} bytes) -> {2}" -f $rel, $d.Length, $pack)
  }
  $w = Join-Path $ext 'src\background\worker.mjs'
  $hits = Select-String -Path $w -Pattern 'installGthIntentAutoRunner|gth-intent-auto' 
  Write-Host ("worker intent hits: {0}" -f ($hits.Count))
  $hits | ForEach-Object { "  L$($_.LineNumber): $($_.Line.Trim())" }
}
Write-Host 'SYNC_OK'
