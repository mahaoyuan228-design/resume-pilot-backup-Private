# Build a SEPARATE paid-flavor Edge unpacked package from the same product sources.
# Does NOT modify the internal package Jeremy loads (worker.mjs / 003753).
# Requires an operator-owned HTTPS license URL. Does NOT invent payment credentials
# or claim a live payment/license server exists.
#
# Fresh rebuild (do not hand-patch an old dist, including 20261018 hotpatches):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 `
#     -LicenseServiceUrl 'https://license.your-owned-domain.cn'
# The script copies cms-basic-seed-from-education.mjs, writes paid-config.mjs, points
# the service worker at guard-worker.mjs (static import of that config), and fails if
# the seed is off the list or guard-worker still top-level await-imports paid-config.
# It also fails unless the packed tree matches tip CMS 学历 duplicate_target content,
# region fail-closed markers, and CMS auto inject files. It fails when packed GTH
# basic still treats unsupported or unsettled 现居住地/照片/参加工作时间 as a completed
# skip. It fails when packed CMB basic still treats an unsettled requested field
# as skipped or leaves fillAllowed true. Never Save. No live-site claim.
# Node proof without Edge: node scripts/build-paid-smoke.mjs
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
  'src/background/hotjob-mc-basic-auto.mjs',
  'src/background/cmb-basic-auto.mjs',
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
  'src/background/bg-ping.mjs',
  'src/auto/bg-request.mjs',
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
  'src/auto/hotjob-mc-basic-auto.html',
  'src/auto/hotjob-mc-basic-auto.js',
  'src/auto/cmb-basic-auto.html',
  'src/auto/cmb-basic-auto.js',
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
  'src/content/hotjob-mc-basic.js',
  'src/content/hotjob-mc-profile-map.mjs',
  'src/content/cmb-basic.js',
  'src/content/cmb-birthdate-picker.mjs',
  'src/content/cmb-profile-map.mjs',
  'src/content/cmb-gated-dicts.mjs',
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
  'src/profile/cms-basic-seed-from-education.mjs',
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

# No-hand-patch gate. A copied 20261018 dist is not this build. Fail closed when the
# seed is absent, paid-config is still a top-level await import, or any relative
# import in the output tree does not resolve, including side-effect `import './…'`
# (Edge 155 will not register that SW).
$seedRel = 'src/profile/cms-basic-seed-from-education.mjs'
if ($productFiles -notcontains $seedRel) {
  throw "付费包清单缺少 ${seedRel}。cms-basic-auto 的 seed import 无法在新构建中解析。不要用手改 dist 补文件。"
}
$seedOut = Join-Path $extensionRoot ($seedRel -replace '/', '\')
if (-not (Test-Path -LiteralPath $seedOut -PathType Leaf)) {
  throw "付费包输出缺少 ${seedRel}"
}
$guardOut = Join-Path $extensionRoot 'src\license\guard-worker.mjs'
$guardText = [IO.File]::ReadAllText($guardOut)
if ($guardText -match 'await\s+import\s*\(\s*[''"]\./paid-config\.mjs[''"]\s*\)') {
  throw 'guard-worker 仍有顶层 await import("./paid-config.mjs")。Edge 155 MV3 服务工作者无法注册。必须静态 import { paidConfig as paidConfigImported } from "./paid-config.mjs"。不要热补 dist。'
}
if ($guardText -notmatch 'import\s+\{\s*paidConfig\s+as\s+paidConfigImported\s*\}\s+from\s+[''"]\./paid-config\.mjs[''"]') {
  throw 'guard-worker 缺少 paid-config 静态 import。'
}
if ($guardText -match 'softwareClickedSave\s*=\s*true') {
  throw 'guard-worker 试图 Save。付费包保持 Never Save。'
}
$sourcePaidConfigPath = Join-Path $repoRoot 'src\license\paid-config.mjs'
$sourcePaidConfig = [IO.File]::ReadAllText($sourcePaidConfigPath)
if ($sourcePaidConfig -match 'buildFlavor:\s*[''"]paid[''"]') {
  throw '源码 src/license/paid-config.mjs 必须保持 fail-closed 占位（buildFlavor 不是 paid）。真实配置只写入付费包输出。'
}
if ($sourcePaidConfig -notmatch 'buildFlavor:\s*[''"]internal[''"]') {
  throw '源码 paid-config.mjs 必须保持 buildFlavor internal。'
}
if ($sourcePaidConfig -match 'BEGIN PRIVATE KEY') { throw '源码 paid-config.mjs 含私钥。' }
$generatedPaidConfig = [IO.File]::ReadAllText($configPath)
if ($generatedPaidConfig -notmatch 'Generated by scripts/build-paid\.ps1') {
  throw '付费包 paid-config.mjs 不是本脚本生成的。'
}
if ($generatedPaidConfig -notmatch 'buildFlavor:\s*[''"]paid[''"]') {
  throw '生成的 paid-config.mjs 不是 flavor paid。'
}
if ($generatedPaidConfig -match 'BEGIN PRIVATE KEY') { throw '生成的 paid-config.mjs 含私钥。拒绝打包。' }
$manifestRaw = [IO.File]::ReadAllText($paidManifestPath)
if ($manifestRaw -notmatch 'src/license/guard-worker\.mjs') {
  throw '写出的 manifest 未指向 src/license/guard-worker.mjs'
}
if ([string]$paidManifest.background.service_worker -ne 'src/license/guard-worker.mjs') {
  throw '付费包 service_worker 不是 guard-worker.mjs'
}

$packed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$packedList = New-Object 'System.Collections.Generic.List[string]'
foreach ($relative in @($productFiles + $licenseFiles + @('src/license/paid-config.mjs'))) {
  if (-not $packed.Add($relative)) { throw "付费包重复路径：$relative" }
  $packedList.Add($relative)
}
foreach ($relative in $packedList) {
  if ($relative -notlike 'src/*' -or $relative -like 'src/import/vendor/*' -or $relative -notmatch '\.(?:html|js|mjs)$') { continue }
  $packedFile = Join-Path $extensionRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $packedFile -PathType Leaf)) { throw "付费包引用扫描缺少文件：$relative" }
  $content = [IO.File]::ReadAllText($packedFile)
  # Same graph as build-internal: `from '…'`, `import('…')`, and side-effect `import '…'`.
  $patterns = if ($relative -like '*.html') { @('(?:src|href)\s*=\s*["'']([^"'']+)["'']') } else { @('(?:from\s*|import\s*\(|import\s*)\s*["''](\.[^"'']+)["'']') }
  foreach ($pattern in $patterns) {
    foreach ($match in [regex]::Matches($content, $pattern)) {
      $reference = $match.Groups[1].Value
      if ($reference -notmatch '^\.') { continue }
      $resolved = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $packedFile) ($reference -replace '/', '\')))
      $sep = [IO.Path]::DirectorySeparatorChar
      $extPrefix = $extensionRoot.TrimEnd('\', '/')
      if (-not $extPrefix.EndsWith($sep)) { $extPrefix = $extPrefix + $sep }
      if (-not $resolved.StartsWith($extPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "付费包引用越界：$relative -> $reference"
      }
      $local = $resolved.Substring($extPrefix.Length).Replace('\', '/')
      if (-not $packed.Contains($local)) { throw "付费包引用未纳入清单：$relative -> $local" }
      if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "付费包引用文件不存在：$relative -> $local" }
    }
  }
}

# CMS tip content gate (degree duplicate_target, region fail-closed, paid CMS auto).
# executeScript paths are strings, so the import walk above does not see them.
# Hashes must match this checkout. Do not hotpatch an older dist, including 20261018.
$cmsTipFiles = @(
  'src/content/engine.js',
  'src/content/cms-region.js',
  'src/content/cms-education-multi-select.js',
  'src/content/cms-record-controller.js',
  'src/content/cms-education-serialization.mjs',
  'src/profile/site-question-templates.js',
  'src/background/cms-basic-auto.mjs',
  'src/background/cms-education-task-runner.mjs',
  'src/license/guard-worker.mjs'
)
$cmsRunnerFiles = @(
  'src/background/cms-basic-auto.mjs',
  'src/background/cms-education-task-runner.mjs'
)
$cmsRequiredInject = @(
  'src/content/engine.js',
  'src/content/cms-region.js',
  'src/content/cms-education-multi-select.js',
  'src/auto/cms-basic-auto.html',
  'src/auto/cms-education-auto.html'
)
foreach ($relative in $cmsTipFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "付费包缺少 tip CMS 文件：$relative" }
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) { throw "付费包与 tip 源码不一致：$relative。不要热补 dist，包括 20261018 旧包。" }
  $text = [IO.File]::ReadAllText($target)
  if ($text -match 'softwareClickedSave\s*=\s*true') { throw "付费包试图 Save：$relative。Never Save。" }
}
function Require-PackedNeedle([string]$Relative, [string]$Needle, [string]$Label = 'CMS') {
  $target = Join-Path $extensionRoot ($Relative -replace '/', '\')
  $text = [IO.File]::ReadAllText($target)
  if (-not $text.Contains($Needle)) { throw "付费包缺少 tip ${Label} 内容：${Relative} :: ${Needle}" }
}
Require-PackedNeedle 'src/content/engine.js' 'education 学历'
Require-PackedNeedle 'src/content/engine.js' 'cms-ant-v3-${M.normalize(labels[0])}-${position}'
Require-PackedNeedle 'src/content/engine.js' 'cms_record_requires_explicit_binding'
Require-PackedNeedle 'src/content/engine.js' 'function settleUnresolvedEntry'
Require-PackedNeedle 'src/content/engine.js' 'if (reason === "duplicate_target") return "failed"'
Require-PackedNeedle 'src/content/engine.js' 'region_fact_not_unique'
Require-PackedNeedle 'src/content/cms-education-multi-select.js' 'DEGREE_LEVELS'
Require-PackedNeedle 'src/content/cms-education-multi-select.js' "['硕士','硕士研究生']"
Require-PackedNeedle 'src/content/cms-education-multi-select.js' "['本科','大学本科']"
Require-PackedNeedle 'src/content/cms-education-multi-select.js' "['博士','博士研究生']"
Require-PackedNeedle 'src/content/cms-record-controller.js' 'DEGREE_LEVELS'
Require-PackedNeedle 'src/content/cms-record-controller.js' "['硕士','硕士研究生']"
Require-PackedNeedle 'src/content/cms-record-controller.js' "['本科','大学本科']"
Require-PackedNeedle 'src/content/cms-record-controller.js' "['博士','博士研究生']"
Require-PackedNeedle 'src/content/cms-education-serialization.mjs' 'DEGREE_LEVELS'
Require-PackedNeedle 'src/content/cms-education-serialization.mjs' "['硕士','硕士研究生']"
Require-PackedNeedle 'src/content/cms-education-serialization.mjs' "['本科','大学本科']"
Require-PackedNeedle 'src/content/cms-education-serialization.mjs' "['博士','博士研究生']"
Require-PackedNeedle 'src/profile/site-question-templates.js' 'export function planCmsRegionFact'
Require-PackedNeedle 'src/profile/site-question-templates.js' 'export const CMS_REGION_FACT_FAIL_CLOSED_REASONS'
Require-PackedNeedle 'src/profile/site-question-templates.js' 'region_fact_not_unique'
Require-PackedNeedle 'src/profile/site-question-templates.js' 'region_fact_unconfirmed'
Require-PackedNeedle 'src/content/cms-region.js' 'implementationRevision:3'
Require-PackedNeedle 'src/content/cms-region.js' "status:'failed',reason:'unconfirmed_or_incomplete_region_pair'"
Require-PackedNeedle 'src/content/cms-region.js' "reason:'region_fact_not_unique'"
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' 'function coerceRegionFailClosed'
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' 'planCmsRegionFact'
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' 'CMS_REGION_FACT_FAIL_CLOSED_REASONS'
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' "'src/content/engine.js'"
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' "'src/content/cms-region.js'"
Require-PackedNeedle 'src/background/cms-basic-auto.mjs' 'Never Save/submit'
Require-PackedNeedle 'src/license/guard-worker.mjs' "bootPaidAuto('cms-basic-auto', installCmsBasicAutoRunner)"
Require-PackedNeedle 'src/license/guard-worker.mjs' 'installCmsEducationTaskRunner({ verifyBeforeFill })'
Require-PackedNeedle 'src/license/guard-worker.mjs' "installCmsEducationTaskRunner({ recordKind: 'internship', verifyBeforeFill })"
Require-PackedNeedle 'src/background/cms-education-task-runner.mjs' "'src/content/cms-education-multi-select.js'"
Require-PackedNeedle 'src/background/cms-education-task-runner.mjs' 'CMS_EDUCATION_AUTO_FILL'
Require-PackedNeedle 'src/background/cms-education-task-runner.mjs' 'export function installCmsEducationTaskRunner'
$seenInject = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($relative in $cmsRunnerFiles) {
  $runnerPath = Join-Path $extensionRoot ($relative -replace '/', '\')
  $runnerText = [IO.File]::ReadAllText($runnerPath)
  $found = @([regex]::Matches($runnerText, "'(src/[^']+\.(?:js|mjs|html))'") | ForEach-Object { $_.Groups[1].Value })
  if ($found.Count -eq 0) { throw "付费包 CMS 注入文件未纳入清单：$relative 没有注入路径" }
  foreach ($local in $found) {
    [void]$seenInject.Add($local)
    if (-not $packed.Contains($local)) { throw "付费包 CMS 注入文件未纳入清单：$relative -> $local" }
    $out = Join-Path $extensionRoot ($local -replace '/', '\')
    if (-not (Test-Path -LiteralPath $out -PathType Leaf)) { throw "付费包 CMS 注入文件未纳入清单：$relative -> $local 不在输出树" }
  }
}
foreach ($local in $cmsRequiredInject) {
  if (-not $seenInject.Contains($local)) { throw "付费包 CMS 注入文件未纳入清单：自动注入集合缺少 $local" }
}

# GTH basic fail-closed gate. Unsupported or unsettled 现居住地/照片/参加工作时间
# are failed, and a requested fill is not stored as completed. executeScript of
# gth-basic.js is a string, so the import walk above does not see it.
$gthTipFiles = @(
  'src/content/gth-basic.js',
  'src/background/basic-task-runner.mjs',
  'src/background/gth-basic-auto.mjs',
  'src/popup/gth-basic-actions.js'
)
$gthRunnerFiles = @(
  'src/background/gth-basic-auto.mjs',
  'src/background/basic-task-runner.mjs'
)
$gthRequiredInject = @(
  'src/content/gth-basic.js'
)
foreach ($relative in $gthTipFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "付费包缺少 tip GTH 文件：$relative" }
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) { throw "付费包与 tip 源码不一致：$relative。不要热补 dist，包括 20261018 旧包。" }
  $text = [IO.File]::ReadAllText($target)
  if ($text -match 'softwareClickedSave\s*=\s*true') { throw "付费包试图 Save：$relative。Never Save。" }
}
Require-PackedNeedle 'src/content/gth-basic.js' "status:field.kind==='unsupported'?'failed':'skipped'" 'GTH'
Require-PackedNeedle 'src/content/gth-basic.js' "reason:field.kind==='unsupported'?'control_not_supported':'not_run'" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "status:supported?(valid?row.status:'skipped'):'failed'" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' 'export const GTH_COVERAGE_FAIL_CLOSED_REASONS' 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' 'export function planGthBasicCoverage' 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' 'export function sealGthJobCoverage' 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' 'export function gthRequestedFillBlocksComplete' 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "'control_not_supported'" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "'region_fact_not_unique'" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "'region_fact_unconfirmed'" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "selector:null,query:null,status:'failed',ok:false" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "const blocked=fields.some(field=>field.status==='failed'&&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(field.reason));" 'GTH'
Require-PackedNeedle 'src/background/basic-task-runner.mjs' "if(outcome!=='failed_before_write'&&gthRequestedFillBlocksComplete(coveragePlan)){" 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' 'planGthBasicCoverage' 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' 'sealGthJobCoverage' 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' 'gthRequestedFillBlocksComplete' 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' 'if(gthRequestedFillBlocksComplete(coveragePlan)){' 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' 'Unsupported or unsettled 现居住地/照片/参加工作时间 fail closed and are not a completed fill.' 'GTH'
Require-PackedNeedle 'src/background/gth-basic-auto.mjs' "'src/content/gth-basic.js'" 'GTH'
Require-PackedNeedle 'src/popup/gth-basic-actions.js' 'GTH_COVERAGE_FAIL_CLOSED_REASONS' 'GTH'
Require-PackedNeedle 'src/popup/gth-basic-actions.js' '现居住地、照片或参加工作时间未能填写（控件尚未支持，或地区资料未定）。本次不记为完成，未保存、未提交。' 'GTH'
$seenGthInject = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($relative in $gthRunnerFiles) {
  $runnerPath = Join-Path $extensionRoot ($relative -replace '/', '\')
  $runnerText = [IO.File]::ReadAllText($runnerPath)
  $found = @([regex]::Matches($runnerText, "'(src/[^']+\.(?:js|mjs|html))'") | ForEach-Object { $_.Groups[1].Value })
  if ($found.Count -eq 0) { throw "付费包 GTH 注入文件未纳入清单：$relative 没有注入路径" }
  foreach ($local in $found) {
    [void]$seenGthInject.Add($local)
    if (-not $packed.Contains($local)) { throw "付费包 GTH 注入文件未纳入清单：$relative -> $local" }
    $out = Join-Path $extensionRoot ($local -replace '/', '\')
    if (-not (Test-Path -LiteralPath $out -PathType Leaf)) { throw "付费包 GTH 注入文件未纳入清单：$relative -> $local 不在输出树" }
  }
}
foreach ($local in $gthRequiredInject) {
  if (-not $seenGthInject.Contains($local)) { throw "付费包 GTH 注入文件未纳入清单：自动注入集合缺少 $local" }
}

# CMB basic fail-closed gate. A requested field that is ambiguous, unsupported,
# or unsettled stays failed (requestedFillBlocked, fillAllowed false). executeScript
# of cmb-basic.js is a string, so the import walk above does not see it.
$cmbTipFiles = @(
  'src/content/cmb-basic.js',
  'src/content/cmb-profile-map.mjs',
  'src/background/cmb-basic-auto.mjs',
  'src/auto/cmb-basic-auto.js',
  'src/popup/popup.js'
)
$cmbRunnerFiles = @(
  'src/background/cmb-basic-auto.mjs'
)
$cmbRequiredInject = @(
  'src/content/cmb-basic.js'
)
foreach ($relative in $cmbTipFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "付费包缺少 tip CMB 文件：$relative" }
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $targetHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  if ($sourceHash -ne $targetHash) { throw "付费包与 tip 源码不一致：$relative。不要热补 dist，包括 20261018 旧包。" }
  $text = [IO.File]::ReadAllText($target)
  if ($text -match 'softwareClickedSave\s*=\s*true') { throw "付费包试图 Save：$relative。Never Save。" }
}
Require-PackedNeedle 'src/content/cmb-basic.js' 'const REQUESTED_FILL_FAIL_CLOSED = new Set([' 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'item_ambiguous'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'radio_readback_ambiguous'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'select_readback_ambiguous'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'datepicker_hint_only'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'profile_fact_unconfirmed'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' "'invalid_profile_value'" 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' 'They stay failed rows. They are not omitted from a successful fill.' 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' 'const blocked = (plan?.blockers || []).filter((row) => REQUESTED_FILL_FAIL_CLOSED.has(row?.reason));' 'CMB'
Require-PackedNeedle 'src/content/cmb-basic.js' 'const ok = !failed;' 'CMB'
Require-PackedNeedle 'src/content/cmb-profile-map.mjs' 'export const CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS' 'CMB'
Require-PackedNeedle 'src/content/cmb-profile-map.mjs' 'export function cmbRequestedFillBlockers' 'CMB'
Require-PackedNeedle 'src/content/cmb-profile-map.mjs' 'It is not a skipped success.' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'requestedFillBlocked: cmbRequestedFillBlockers(plan).length > 0,' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'fillAllowed: plan.ok === true && cmbRequestedFillBlockers(plan).length === 0,' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'export function sealCmbRequestedFill' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'const report = sealCmbRequestedFill(rawReport, plan);' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'A requested ambiguous, unsupported, or unsettled field is failed, not skipped.' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' 'if (CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS.includes(reason)) return false;' 'CMB'
Require-PackedNeedle 'src/background/cmb-basic-auto.mjs' "'src/content/cmb-basic.js'" 'CMB'
Require-PackedNeedle 'src/auto/cmb-basic-auto.js' "result?.ok && result.readiness?.profilePlan?.requestedFillBlocked === true && autoMode !== 'fill'" 'CMB'
Require-PackedNeedle 'src/auto/cmb-basic-auto.js' '请求的字段里有不明确或不能填写的项，没有当作通过。' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'datepicker_hint_only: "出生日期只能提示，没有写入。请核对网页后再决定。"' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'profile_fact_unconfirmed: "有资料尚未核对，本次不能当作完成。"' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'invalid_profile_value: "有资料对不上网页选项，本次不能当作完成。"' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'item_ambiguous: "有字段对应到多处，没有猜选。请核对网页后再决定。"' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'radio_readback_ambiguous: "有选项读回不唯一，没有猜选。请核对网页后再决定。"' 'CMB'
Require-PackedNeedle 'src/popup/popup.js' 'select_readback_ambiguous: "有下拉读回不唯一，没有猜选。请核对网页后再决定。"' 'CMB'
$seenCmbInject = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($relative in $cmbRunnerFiles) {
  $runnerPath = Join-Path $extensionRoot ($relative -replace '/', '\')
  $runnerText = [IO.File]::ReadAllText($runnerPath)
  $found = @([regex]::Matches($runnerText, "'(src/[^']+\.(?:js|mjs|html))'") | ForEach-Object { $_.Groups[1].Value })
  if ($found.Count -eq 0) { throw "付费包 CMB 注入文件未纳入清单：$relative 没有注入路径" }
  foreach ($local in $found) {
    [void]$seenCmbInject.Add($local)
    if (-not $packed.Contains($local)) { throw "付费包 CMB 注入文件未纳入清单：$relative -> $local" }
    $out = Join-Path $extensionRoot ($local -replace '/', '\')
    if (-not (Test-Path -LiteralPath $out -PathType Leaf)) { throw "付费包 CMB 注入文件未纳入清单：$relative -> $local 不在输出树" }
  }
}
foreach ($local in $cmbRequiredInject) {
  if (-not $seenCmbInject.Contains($local)) { throw "付费包 CMB 注入文件未纳入清单：自动注入集合缺少 $local" }
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
- Rebuild from source with this script. Do not hand-patch dist (including a 20261018 hotpatch).
- guard-worker.mjs static-imports the generated paid-config.mjs. Top-level await import fails Edge 155 SW registration.
- src/profile/cms-basic-seed-from-education.mjs is on the product list and is copied. cms-basic-auto imports it.
- Packed CMS tip files match this checkout (学历 generated-id suffix, region fail-closed, CMS auto inject list). A 20261018 tree fails this gate.
- Packed GTH basic files match this checkout. Unsupported or unsettled 现居住地/照片/参加工作时间 are failed, and that fill is not stored as completed. A tree that still marks those rows skipped fails this gate.
- Packed CMB basic files match this checkout. An unsettled requested field stays failed, with requestedFillBlocked and fillAllowed false. A tree that still skips those fields or sets fillAllowed true fails this gate.
- Source src/license/paid-config.mjs stays the fail-closed internal placeholder. This folder's copy is generated.
- Never Save. This package does not claim a live recruiting site is supported.
- Node proof without launching Edge: node scripts/build-paid-smoke.mjs
"@
[IO.File]::WriteAllText((Join-Path $buildRoot 'PAID_BUILD_README.txt'), $readme, (New-Object Text.UTF8Encoding($false)))

Write-Output "付费候选包：$buildRoot"
Write-Output "扩展目录：$extensionRoot"
Write-Output "授权服务 URL：$LicenseServiceUrl"
Write-Output '注意：未部署真实授权服务前，所有填写路径应 fail-closed（license_required）。'
Write-Output '不要把此包当作 Jeremy 当前内部 003753 工作流加载。'
if ($PublicKeyPemPath) { Write-Output "已嵌入 publicKeyPem 来源：$PublicKeyPemPath" } else { Write-Output 'publicKeyPem: null（未传 -PublicKeyPemPath；签名令牌将无法校验）' }
Write-Output "requireSignedEntitlement: $RequireSignedEntitlement"
