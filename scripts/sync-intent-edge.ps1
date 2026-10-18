$ErrorActionPreference = 'Stop'
$root = 'C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev'
$pairs = @(
  @{ src = 'src\background\gth-intent-auto.mjs'; dstRel = 'src\background\gth-intent-auto.mjs' },
  @{ src = 'src\auto\gth-intent-auto.js'; dstRel = 'src\auto\gth-intent-auto.js' },
  @{ src = 'src\auto\gth-intent-auto.html'; dstRel = 'src\auto\gth-intent-auto.html' },
  @{ src = 'src\background\gth-save-policy.mjs'; dstRel = 'src\background\gth-save-policy.mjs' },
  @{ src = 'src\background\worker.mjs'; dstRel = 'src\background\worker.mjs' },
  @{ src = 'src\popup\popup.js'; dstRel = 'src\popup\popup.js' },
  @{ src = 'src\popup\popup.html'; dstRel = 'src\popup\popup.html' }
)
# discover actual extension layout
foreach ($pack in @('003753','011002')) {
  $ext = Join-Path $root ("dist\edge-internal-v0.1.4.9-20261017-$pack\extension")
  Write-Host "==== pack $pack ===="
  Write-Host "ext exists: $(Test-Path $ext)"
  # find worker
  Get-ChildItem $ext -Recurse -Filter 'worker.mjs' | ForEach-Object { "worker=$($_.FullName)" }
  Get-ChildItem $ext -Recurse -Filter 'manifest.json' | ForEach-Object { "manifest=$($_.FullName)" }
  # show top-level
  Get-ChildItem $ext | Select-Object Name,Mode | Format-Table -AutoSize
}
