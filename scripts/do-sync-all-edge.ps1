$ErrorActionPreference = 'Stop'
$root = 'C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev'
$files = @(
  'src\background\cms-basic-auto.mjs',
  'src\profile\cms-basic-seed-from-education.mjs',
  'src\background\gth-intent-auto.mjs',
  'src\background\gth-other-auto.mjs',
  'src\background\gth-simple-auto.mjs',
  'src\background\gth-save-policy.mjs',
  'src\background\worker.mjs',
  'src\background\feishu-atsx-basic-auto.mjs',
  'src\background\beisen-2022-basic-auto.mjs',
  'src\background\moka-basic-auto.mjs',
  'src\content\feishu-atsx-basic.js',
  'src\content\feishu-atsx-profile-map.mjs',
  'src\content\beisen-2022-basic.js',
  'src\content\beisen-2022-profile-map.mjs',
  'src\content\moka-basic.js',
  'src\content\moka-profile-map.mjs',
  'src\auto\cms-basic-auto.js',
  'src\auto\feishu-atsx-basic-auto.js',
  'src\auto\feishu-atsx-basic-auto.html',
  'src\auto\beisen-2022-basic-auto.js',
  'src\auto\beisen-2022-basic-auto.html',
  'src\auto\moka-basic-auto.js',
  'src\auto\moka-basic-auto.html',
  'src\auto\cms-basic-auto.html',
  'src\auto\gth-intent-auto.js',
  'src\auto\gth-intent-auto.html',
  'src\auto\gth-other-auto.js',
  'src\auto\gth-other-auto.html',
  'src\auto\gth-simple-auto.js',
  'src\auto\gth-simple-auto.html',
  'src\popup\popup.js',
  'src\popup\popup.html',
  'src\popup\popup.css',
  'src\content\engine.js',
  'src\content\gth-other-section.js',
  'src\content\gth-simple-section.js',
  'src\profile\options.js',
  'manifest.json'
)
$copied = 0
$skipped = 0
foreach ($pack in @('003753','011002')) {
  $ext = Join-Path $root ("dist\edge-internal-v0.1.4.9-20261017-$pack\extension")
  Write-Host "==== sync $pack ===="
  if (-not (Test-Path $ext)) { Write-Host "MISSING pack $ext"; continue }
  foreach ($rel in $files) {
    $src = Join-Path $root $rel
    $dst = Join-Path $ext $rel
    if (-not (Test-Path $src)) { Write-Host "SKIP missing src $rel"; $skipped++; continue }
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    $d = Get-Item $dst
    Write-Host ("copied {0} ({1} bytes) -> {2}" -f $rel, $d.Length, $pack)
    $copied++
  }
  $w = Join-Path $ext 'src\background\worker.mjs'
  if (Test-Path $w) {
    $hits = Select-String -Path $w -Pattern 'installCmsBasicAutoRunner|installGthIntentAutoRunner|cms-basic-auto'
    Write-Host ("worker hits: {0}" -f ($hits.Count))
    $hits | ForEach-Object { "  L$($_.LineNumber): $($_.Line.Trim())" }
  }
  $seed = Join-Path $ext 'src\profile\cms-basic-seed-from-education.mjs'
  Write-Host ("seed module present: {0}" -f (Test-Path $seed))
}
Write-Host ("SYNC_ALL_OK copied={0} skipped={1}" -f $copied, $skipped)
