# Build a SEPARATE paid-flavor Edge unpacked package from the same product sources.
# Does NOT modify the internal package Jeremy loads (worker.mjs / 003753).
# Requires an operator-owned HTTPS license URL. Does NOT invent payment credentials
# or claim a live payment/license server exists.
#
# Example:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 `
#     -LicenseServiceUrl 'https://license.your-owned-domain.cn'
# Optional Ed25519 public key embed (documentation / real operator key — NEVER private key):
#   -PublicKeyPemPath 'tests/fixtures/license/EXAMPLE_ed25519_public.pem'   # EXAMPLE only
#   -PublicKeyPemPath 'C:\secrets\resume-paid-public.pem'                 # operator-owned
#   -RequireSignedEntitlement   # fail-closed unless entitlements carry Ed25519 signature
#
param(
  [Parameter(Mandatory = $true)]
  [string]$LicenseServiceUrl,

  [Parameter(Mandatory = $false)]
  [string]$PublicKeyPemPath = '',

  [Parameter(Mandatory = $false)]
  [switch]$RequireSignedEntitlement
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

if ($LicenseServiceUrl -notmatch '^https://[^/\s]+') {
  throw 'LicenseServiceUrl 必须是 https:// 开头的经营者自有域名（不要填占位或假支付地址当生产）。'
}

$manifestPath = Join-Path $repoRoot 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'manifest.json 不存在。' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$manifest.version

# Reuse internal product allowlist, then add license scaffolding (still no secrets).
$internalScript = Join-Path $PSScriptRoot 'build-internal.ps1'
$internalText = Get-Content -LiteralPath $internalScript -Raw -Encoding UTF8
if ($internalText -notmatch "(?s)\$files = @\((.*?)\n\)") {
  throw '无法从 build-internal.ps1 解析产品文件清单。'
}

# Explicit product list (keep in sync with build-internal.ps1 $files).
$productFiles = @(
  'manifest.json',
  'src/background/basic-task-runner.mjs',
  'src/background/cms-education-task-runner.mjs',
  'src/background/cms-page-focus.mjs',
  'src/background/cms-basic-auto.mjs',
  'src/background/feishu-atsx-basic-auto.mjs',
  'src/background/beisen-2022-basic-auto.mjs',
  'src/background/moka-basic-auto.mjs',
  'src/background/education-task-runner.mjs',
  'src/background/gth-education-auto.mjs',
  'src/background/gth-basic-auto.mjs',
  'src/background/gth-simple-auto.mjs',
  'src/background/gth-other-auto.mjs',
  'src/background/gth-intent-auto.mjs',
  'src/background/gth-save-policy.mjs',
  'src/background/gth-draft-metadata.mjs',
  'src/background/gth-draft-task-runner.mjs',
  'src/background/gth-education-refresh-coordinator.mjs',
  'src/background/gth-refresh-basic-metadata.mjs',
  'src/background/gth-serial-runner.mjs',
  'src/background/gth-serial-step.mjs',
  'src/background/worker.mjs',
  'src/auto/cms-education-auto.html',
  'src/auto/cms-education-auto.js',
  'src/auto/gth-education-auto.html',
  'src/auto/gth-education-auto.js',
  'src/auto/gth-basic-auto.html',
  'src/auto/gth-basic-auto.js',
  'src/auto/gth-simple-auto.html',
  'src/auto/gth-simple-auto.js',
  'src/auto/gth-other-auto.html',
  'src/auto/gth-other-auto.js',
  'src/auto/gth-intent-auto.html',
  'src/auto/gth-intent-auto.js',
  'src/auto/cms-internship-auto.html',
  'src/auto/cms-internship-auto.js',
  'src/auto/cms-basic-auto.html',
  'src/auto/cms-basic-auto.js',
  'src/auto/feishu-atsx-basic-auto.html',
  'src/auto/feishu-atsx-basic-auto.js',
  'src/auto/beisen-2022-basic-auto.html',
  'src/auto/beisen-2022-basic-auto.js',
  'src/auto/moka-basic-auto.html',
  'src/auto/moka-basic-auto.js',
  'src/content/cms-checkboxes.js',
  'src/content/cms-date-picker.js',
  'src/content/cms-education-dates.js',
  'src/content/cms-education-multi-adapters.js',
  'src/content/cms-education-multi-bridge.js',
  'src/content/cms-education-multi-dates.js',
  'src/content/cms-education-multi-region.js',
  'src/content/cms-education-multi-school.js',
  'src/content/cms-education-multi-select.js',
  'src/content/cms-education-multi.js',
  'src/content/cms-education-serialization.mjs',
  'src/content/cms-internship-adapters.js',
  'src/content/cms-internship-bridge.js',
  'src/content/cms-internship-multi.js',
  'src/content/cms-internship-serialization.mjs',
  'src/content/cms-record-controller.js',
  'src/content/cms-region.js',
  'src/content/cms-school-search.js',
  'src/content/cms-session.js',
  'src/content/cms-validation-gaps.js',
  'src/content/engine.js',
  'src/content/feishu-atsx-basic.js',
  'src/content/feishu-atsx-profile-map.mjs',
  'src/content/beisen-2022-basic.js',
  'src/content/beisen-2022-profile-map.mjs',
  'src/content/moka-basic.js',
  'src/content/moka-profile-map.mjs',
  'src/content/gth-basic.js',
  'src/content/gth-draft-save.js',
  'src/content/gth-education.js',
  'src/content/gth-other-section.js',
  'src/content/gth-section-discovery.js',
  'src/content/gth-simple-section.js',
  'src/core/matcher.js',
  'src/import/attachment-store.js',
  'src/import/candidates.mjs',
  'src/import/import.css',
  'src/import/import.html',
  'src/import/import.js',
  'src/import/parser.mjs',
  'src/import/selection-owner.mjs',
  'src/import/vendor/JSZIP-LICENSE.md',
  'src/import/vendor/PAKO-LICENSE.txt',
  'src/import/vendor/PDFJS-LICENSE.txt',
  'src/import/vendor/jszip.min.js',
  'src/import/vendor/pdf.mjs',
  'src/import/vendor/pdf.worker.mjs',
  'src/import/work-records.mjs',
  'src/popup/cms-education-actions.js',
  'src/popup/cms-internship-actions.js',
  'src/popup/gth-basic-actions.js',
  'src/popup/gth-batch-education-actions.js',
  'src/popup/gth-education-actions.js',
  'src/popup/popup.css',
  'src/popup/popup.html',
  'src/popup/popup.js',
  'src/popup/recent-result.js',
  'src/profile/cms-education-plan.mjs',
  'src/profile/cms-education-site-facts-ui.mjs',
  'src/profile/cms-education-site-facts.mjs',
  'src/profile/cms-internship-plan.mjs',
  'src/profile/options.html',
  'src/profile/options.js',
  'src/profile/profile-lifecycle.js',
  'src/profile/site-question-templates.js',
  'src/profile/store.js',
  'src/styles/profile.css'
)

$licenseFiles = @(
  'src/license/flavor.mjs',
  'src/license/errors.mjs',
  'src/license/binding.mjs',
  'src/license/gate.mjs',
  'src/license/client.mjs',
  'src/license/entitlement.mjs',
  'src/license/signed-entitlement.mjs',
  'src/license/guard-worker.mjs',
  'src/license/activate.html',
  'src/license/activate.css',
  'src/license/activate.js'
)

foreach ($relative in ($productFiles + $licenseFiles)) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "打包文件不存在：$relative" }
}

$distRoot = Join-Path $repoRoot 'dist'
if (-not (Test-Path -LiteralPath $distRoot)) { New-Item -ItemType Directory -Path $distRoot | Out-Null }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$baseName = "edge-paid-v$version-$stamp"
$buildRoot = Join-Path $distRoot $baseName
$index = 1
while ($true) {
  if (-not (Test-Path -LiteralPath $buildRoot)) {
    try { New-Item -ItemType Directory -Path $buildRoot -ErrorAction Stop | Out-Null; break }
    catch { if (-not (Test-Path -LiteralPath $buildRoot -PathType Container)) { throw } }
  }
  $index += 1
  $buildRoot = Join-Path $distRoot ("$baseName-$index")
}
$extensionRoot = Join-Path $buildRoot 'extension'
New-Item -ItemType Directory -Path $extensionRoot | Out-Null

foreach ($relative in $productFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $source -Destination $target
}

foreach ($relative in $licenseFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $source -Destination $target
}

# Generate paid-config.mjs (URL + optional public key — no merchant / private-key secrets).
$urlEscaped = $LicenseServiceUrl.Replace('\', '\\').Replace("'", "\'")
$publicKeyLiteral = 'null'
$requireSignedLiteral = 'false'
if ($PublicKeyPemPath -and $PublicKeyPemPath.Trim().Length -gt 0) {
  if (-not (Test-Path -LiteralPath $PublicKeyPemPath -PathType Leaf)) {
    throw "PublicKeyPemPath 不存在：$PublicKeyPemPath"
  }
  $pemRaw = [IO.File]::ReadAllText($PublicKeyPemPath)
  if ($pemRaw -notmatch 'BEGIN PUBLIC KEY') {
    throw 'PublicKeyPemPath 必须是 Ed25519 SPKI PUBLIC KEY PEM（不要传入私钥）。'
  }
  if ($pemRaw -match 'BEGIN PRIVATE KEY') {
    throw '拒绝打包私钥。PublicKeyPemPath 只能是公钥。'
  }
  # Embed as a JS double-quoted string (JSON-style escapes). Never embed a private key.
  $pemNorm = $pemRaw.Replace("`r", '')
  $pemEscaped = $pemNorm.Replace('\', '\\').Replace('"', '\"').Replace("`n", '\n')
  $publicKeyLiteral = '"' + $pemEscaped + '"'
}
if ($RequireSignedEntitlement) {
  $requireSignedLiteral = 'true'
  if ($publicKeyLiteral -eq 'null') {
    Write-Warning 'RequireSignedEntitlement 已打开但未提供 PublicKeyPemPath：付费包将在签名校验上 fail-closed（CONFIG_MISSING）。可用 EXAMPLE 公钥仅作文档演示。'
  }
}
$configBody = @"
// Generated by scripts/build-paid.ps1 — do not hand-edit for production.
// publicKeyPem: operator Ed25519 SPKI public key, or null. NEVER embed a private key.
export const paidConfig = {
  buildFlavor: 'paid',
  licenseServiceUrl: '$urlEscaped',
  publicKeyPem: $publicKeyLiteral,
  requireSignedEntitlement: $requireSignedLiteral,
};
"@
$configPath = Join-Path $extensionRoot 'src\license\paid-config.mjs'
[IO.File]::WriteAllText($configPath, $configBody, (New-Object Text.UTF8Encoding($false)))

# Rewrite manifest: paid name + guard-worker (leave source tree manifest untouched).
$paidManifestPath = Join-Path $extensionRoot 'manifest.json'
$paidManifest = Get-Content -LiteralPath $paidManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$paidManifest.name = '简历快填 · 授权版'
$paidManifest.description = '授权核验通过后，在你打开的招聘页面中识别字段，使用已核对的本机资料填写并逐项读回。'
$paidManifest.background.service_worker = 'src/license/guard-worker.mjs'
$paidManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $paidManifestPath -Encoding UTF8

# Paid-only: inject Chinese activate entry into the *copied* popup (source popup untouched).
$popupPath = Join-Path $extensionRoot 'src\popup\popup.html'
$popupHtml = Get-Content -LiteralPath $popupPath -Raw -Encoding UTF8
if ($popupHtml -notmatch 'license/activate\.html') {
  $activateLink = '<a class="text-button" href="../license/activate.html" target="_blank" rel="noopener" style="margin-left:8px">授权激活</a>'
  if ($popupHtml -match 'open-profile') {
    $popupHtml = $popupHtml -replace '(id="open-profile"[^>]*>我的资料库 ↗</button>)', ('$1' + $activateLink)
  } else {
    $popupHtml = $popupHtml -replace '</header>', ($activateLink + '</header>')
  }
  [IO.File]::WriteAllText($popupPath, $popupHtml, (New-Object Text.UTF8Encoding($false)))
}

$readme = @"
# Paid flavor package (candidate)

- Version: $version
- Service worker: src/license/guard-worker.mjs
- LicenseServiceUrl: $LicenseServiceUrl
- This package is NOT a live payment product. Wire an owned HTTPS license service before customer distribution.
- Activate UI (Chinese): src/license/activate.html — paste local entitlement token; no payment credentials.
- Open activate: popup「授权激活」link, or chrome.runtime message RESUME_OPEN_LICENSE_ACTIVATE, or extension URL …/src/license/activate.html
- Ed25519: optional -PublicKeyPemPath embeds publicKeyPem; -RequireSignedEntitlement fail-closes unsigned tokens. EXAMPLE key under tests/fixtures/license/ is for docs/tests only.
- Internal daily Edge loads must keep using edge-internal-*/extension with worker.mjs.
"@
[IO.File]::WriteAllText((Join-Path $buildRoot 'PAID_BUILD_README.txt'), $readme, (New-Object Text.UTF8Encoding($false)))

Write-Output "付费候选包：$buildRoot"
Write-Output "扩展目录：$extensionRoot"
Write-Output "授权服务 URL：$LicenseServiceUrl"
Write-Output '注意：未部署真实授权服务前，所有填写路径应 fail-closed（license_required）。'
Write-Output '不要把此包当作 Jeremy 当前内部 003753 工作流加载。'
if ($PublicKeyPemPath) { Write-Output "已嵌入 publicKeyPem 来源：$PublicKeyPemPath" } else { Write-Output 'publicKeyPem: null（未传 -PublicKeyPemPath；签名令牌将无法校验）' }
Write-Output "requireSignedEntitlement: $RequireSignedEntitlement"
