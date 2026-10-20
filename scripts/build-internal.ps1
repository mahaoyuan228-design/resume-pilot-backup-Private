# Build a minimal, auditable Microsoft Edge unpacked extension and ZIP.
# Run from any directory: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
# This script never deletes or overwrites an existing build.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $repoRoot 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'manifest.json 不存在。' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$manifest.manifest_version -ne '3') { throw '仅打包 Manifest V3 扩展。' }
$version = [string]$manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') { throw "扩展版本号无效：$version" }

# A strict allowlist prevents tests, server keys, sample data and design files from entering the package.
$files = @(
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
  'src/content/gth-intent.js',
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
$allowed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$sourceHashes = @{}
foreach ($relative in $files) {
  if (-not $allowed.Add($relative)) { throw "重复打包项：$relative" }
  if ($relative -match '^/' -or $relative -match '(^|/)\.\.(/|$)' -or $relative -match '^[A-Za-z]:') { throw "无效打包路径：$relative" }
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "打包文件不存在：$relative" }
  $sourceHashes[$relative] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-Reference([string]$reference, [string]$owner) {
  if ([string]::IsNullOrWhiteSpace($reference)) { return }
  $normalized = $reference.Replace('\', '/')
  if ($normalized -match '^/' -or $normalized -match '(^|/)\.\.(/|$)' -or $normalized -match '[*?]' -or $normalized -match '^[A-Za-z]+:') {
    throw "不支持的扩展本地引用：$owner -> $reference"
  }
  if (-not $allowed.Contains($normalized)) { throw "manifest 引用未纳入打包清单：$owner -> $normalized" }
  $path = Join-Path $repoRoot ($normalized -replace '/', '\')
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "manifest 引用文件不存在：$owner -> $normalized" }
}

Assert-Reference ([string]$manifest.action.default_popup) 'action.default_popup'
Assert-Reference ([string]$manifest.options_page) 'options_page'
if ($manifest.options_ui) { Assert-Reference ([string]$manifest.options_ui.page) 'options_ui.page' }
if ($manifest.side_panel) { Assert-Reference ([string]$manifest.side_panel.default_path) 'side_panel.default_path' }
Assert-Reference ([string]$manifest.devtools_page) 'devtools_page'
if ($manifest.background) { Assert-Reference ([string]$manifest.background.service_worker) 'background.service_worker' }
if ($manifest.chrome_url_overrides) { foreach ($property in $manifest.chrome_url_overrides.PSObject.Properties) { Assert-Reference ([string]$property.Value) "chrome_url_overrides.$($property.Name)" } }
if ($manifest.icons) { foreach ($property in $manifest.icons.PSObject.Properties) { Assert-Reference ([string]$property.Value) "icons.$($property.Name)" } }
if ($manifest.action.default_icon) {
  if ($manifest.action.default_icon -is [string]) { Assert-Reference ([string]$manifest.action.default_icon) 'action.default_icon' }
  else { foreach ($property in $manifest.action.default_icon.PSObject.Properties) { Assert-Reference ([string]$property.Value) "action.default_icon.$($property.Name)" } }
}
foreach ($script in @($manifest.content_scripts)) {
  if ($null -eq $script) { continue }
  foreach ($reference in @($script.js) + @($script.css)) { Assert-Reference ([string]$reference) 'content_scripts' }
}
foreach ($item in @($manifest.web_accessible_resources)) {
  if ($null -eq $item) { continue }
  foreach ($reference in @($item.resources)) { Assert-Reference ([string]$reference) 'web_accessible_resources' }
}
if ($manifest.declarative_net_request.rule_resources) {
  foreach ($rule in @($manifest.declarative_net_request.rule_resources)) { Assert-Reference ([string]$rule.path) 'declarative_net_request.rule_resources' }
}

# Check local imports and HTML asset links in our source (vendor bundles are self-contained).
# Module specifiers include `from '…'`, dynamic `import('…')`, and side-effect `import '…'`
# (no from). `import './bg-ping.mjs'` must fail this check when that file is off the list.
$sourceFiles = $files | Where-Object { $_ -like 'src/*' -and $_ -notlike 'src/import/vendor/*' -and $_ -match '\.(?:html|js|mjs)$' }
foreach ($relative in $sourceFiles) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $content = Get-Content -LiteralPath $source -Raw -Encoding UTF8
  $patterns = if ($relative -like '*.html') { @('(?:src|href)\s*=\s*["'']([^"'']+)["'']') } else { @('(?:from\s*|import\s*\(|import\s*)\s*["''](\.[^"'']+)["'']') }
  foreach ($pattern in $patterns) {
    foreach ($match in [regex]::Matches($content, $pattern)) {
      $reference = $match.Groups[1].Value
      if ($reference -notmatch '^\.') { continue }
      $resolved = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $source) ($reference -replace '/', '\')))
      if (-not $resolved.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "源码引用越界：$relative -> $reference" }
      $local = $resolved.Substring($repoRoot.Length + 1).Replace('\', '/')
      if (-not $allowed.Contains($local)) { throw "源码引用未纳入打包清单：$relative -> $local" }
      if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "源码引用文件不存在：$relative -> $local" }
    }
  }
}

$distRoot = Join-Path $repoRoot 'dist'
if (-not (Test-Path -LiteralPath $distRoot)) { New-Item -ItemType Directory -Path $distRoot | Out-Null }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$baseName = "edge-internal-v$version-$stamp"
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

$hashLines = New-Object 'System.Collections.Generic.List[string]'
foreach ($relative in ($files | Sort-Object)) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  $target = Join-Path $extensionRoot ($relative -replace '/', '\')
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $source -Destination $target
  $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $sourceHashes[$relative]) { throw "源码在复制时发生变化，请重新构建：$relative" }
  $hashLines.Add("$hash  extension/$relative")
}

function Assert-PackedOmitsGthIntentTest([string]$Root) {
  $needle = 'GTH_INTENT_TEST'
  foreach ($file in (Get-ChildItem -LiteralPath $Root -Recurse -File)) {
    $packedText = [IO.File]::ReadAllText($file.FullName)
    if ($packedText.Contains($needle)) {
      throw "交付包含有 GTH_INTENT_TEST（$($file.FullName)）。实验写入钩子不得进入内部或付费包。"
    }
  }
}
Assert-PackedOmitsGthIntentTest $extensionRoot

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipName = "resume-autofill-edge-v$version.zip"
$zipPath = Join-Path $buildRoot $zipName
$zipStream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
  $archive = New-Object IO.Compression.ZipArchive($zipStream, [IO.Compression.ZipArchiveMode]::Create, $false, [Text.Encoding]::UTF8)
  try {
    foreach ($relative in ($files | Sort-Object)) {
      $target = Join-Path $extensionRoot ($relative -replace '/', '\')
      $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = New-Object DateTimeOffset(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
      $inputStream = [IO.File]::OpenRead($target)
      $outputStream = $entry.Open()
      try { $inputStream.CopyTo($outputStream) }
      finally { $outputStream.Dispose(); $inputStream.Dispose() }
    }
  } finally { $archive.Dispose() }
} finally { $zipStream.Dispose() }

$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | Where-Object { $_.Name } | Sort-Object FullName)
  $expected = @($files | Sort-Object)
  if ($entries.Count -ne $expected.Count) { throw "ZIP 内容数量不符：$($entries.Count) / $($expected.Count)" }
  for ($i = 0; $i -lt $expected.Count; $i += 1) {
    if ($entries[$i].FullName -ne $expected[$i]) { throw "ZIP 内容不符：$($entries[$i].FullName) / $($expected[$i])" }
    $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
    $stream = $entries[$i].Open()
    try { $hash = [BitConverter]::ToString($hashAlgorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hashAlgorithm.Dispose() }
    $target = Join-Path $extensionRoot ($expected[$i] -replace '/', '\')
    if ($hash -ne (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "ZIP 内文件哈希不符：$($expected[$i])" }
  }
} finally { $archive.Dispose() }

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
foreach ($relative in $files) {
  $source = Join-Path $repoRoot ($relative -replace '/', '\')
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHashes[$relative]) {
    throw "源码在构建过程中发生变化，请重新构建：$relative"
  }
}
$hashLines.Add("$zipHash  $zipName")
$hashPath = Join-Path $buildRoot 'SHA256SUMS.txt'
[IO.File]::WriteAllLines($hashPath, $hashLines, (New-Object Text.UTF8Encoding($false)))
Write-Output "内部试用包：$buildRoot"
Write-Output "ZIP：$zipPath"
Write-Output "文件数：$($files.Count)"
Write-Output "ZIP SHA256：$zipHash"
