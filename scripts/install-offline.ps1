# Local paid-package installer. PowerShell 5.1/.NET only; no browser/storage/network calls.
# Deliver beside the existing build-paid.ps1 -Offline ZIP and SHA256SUMS.txt.
param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ZipPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ChecksumPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallRoot,
  [switch]$Update
)
$ErrorActionPreference = 'Stop'

function Local-Path([string]$Path) {
  $full = [IO.Path]::GetFullPath($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path))
  if ($full -notmatch '^[A-Za-z]:\\' -or (New-Object IO.DriveInfo($full.Substring(0, 3))).DriveType -eq 'Network') {
    throw 'Only local disk paths are supported.'
  }
  return $full
}
$zip = Local-Path $ZipPath
$sums = Local-Path $ChecksumPath
$root = (Local-Path $InstallRoot).TrimEnd('\')
if ($root.Length -le 3) { throw 'InstallRoot must be a dedicated directory, not a drive root.' }
# Reject junction/symlink ancestors before any move or extraction.
for ($ancestor = $root; $ancestor; $ancestor = [IO.Path]::GetDirectoryName($ancestor)) {
  if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'InstallRoot must not traverse a junction or symbolic link.'
  }
}
$zipName = [IO.Path]::GetFileName($zip)
$hashes = @(Get-Content -LiteralPath $sums | Where-Object { $_ -match ('^[0-9a-fA-F]{64}  ' + [regex]::Escape($zipName) + '$') })
if ($hashes.Count -ne 1) { throw 'Expected exactly one ZIP checksum in SHA256SUMS.txt.' }
# Use .NET hashing so installation needs no Node or additional PowerShell modules.
$stream = [IO.File]::OpenRead($zip)
$sha = [Security.Cryptography.SHA256]::Create()
try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $sha.Dispose() }
if ($actual -ne $hashes[0].Substring(0, 64)) { throw 'ZIP checksum mismatch; installed files were not changed.' }

function Read-Package([string]$Directory) {
  $manifest = Get-Content -LiteralPath (Join-Path $Directory 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.manifest_version -ne 3 -or $manifest.update_url -or $manifest.background.service_worker -cne 'src/license/guard-worker.mjs') {
    throw 'Expected an offline paid Manifest V3 package without update_url.'
  }
  # Recognize the existing builder format, without executing package JavaScript.
  $config = Get-Content -LiteralPath (Join-Path $Directory 'src/license/paid-config.mjs') -Raw -Encoding UTF8
  foreach ($pattern in @("(?m)^\s*buildFlavor:\s*'paid',", "(?m)^\s*verificationMode:\s*'offline',", '(?m)^\s*licenseServiceUrl:\s*null,', '(?m)^\s*requireSignedEntitlement:\s*true,', '(?m)^\s*publicWebsite:\s*null,')) {
    if ($config -cnotmatch $pattern) { throw 'Expected build-paid.ps1 -Offline signed-only configuration.' }
  }
  $key = [regex]::Match($config, '(?m)^\s*publicKeyPem:\s*("(?:[^"\\]|\\.)*"),\s*$')
  if (-not $key.Success) { throw 'Missing signing public key.' }
  $pem = $key.Groups[1].Value | ConvertFrom-Json
  if ($pem -notmatch 'BEGIN PUBLIC KEY' -or $pem -match 'PRIVATE KEY') { throw 'Invalid signing public key.' }
  return @{ Manifest = $manifest; PublicKey = $pem.Replace("`r", '').Trim() }
}

[IO.Directory]::CreateDirectory($root) | Out-Null
$lock = [IO.File]::Open((Join-Path $root '.install.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
  $current = Join-Path $root 'extension'
  if (Test-Path -LiteralPath $current) {
    if (-not $Update) { throw 'Already installed; use -Update after backing up your profile.' }
    if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'extension must not be a link.' }
    $previous = Read-Package $current
  } elseif ($Update) { throw 'No installed extension to update.' }

  $stage = Join-Path $root ('stage-' + [Guid]::NewGuid().ToString('N'))
  [IO.Directory]::CreateDirectory($stage) | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $archive.Entries) {
      $relative = $entry.FullName.TrimEnd('/')
      foreach ($part in $relative.Split('/')) {
        if ($part -notmatch '^[A-Za-z0-9_-][A-Za-z0-9_.-]*$' -or $part.EndsWith('.') -or $part -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') { throw 'Unsafe ZIP entry.' }
      }
      if (-not $seen.Add($relative)) { throw 'Duplicate ZIP entry.' }
      $target = [IO.Path]::GetFullPath((Join-Path $stage $relative))
      if (-not $target.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP entry escaped staging directory.' }
      if (-not $entry.Name) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
    }
  } finally { $archive.Dispose() }
  $next = Read-Package $stage
  if ($Update -and ($previous.PublicKey -cne $next.PublicKey -or [string]$previous.Manifest.key -cne [string]$next.Manifest.key)) {
    throw 'Signing public key or extension identity changed; obtain a separately activated installation.'
  }
  # Every move is between explicit, checked children of the dedicated root.
  $backup = Join-Path $root ('backup-' + [Guid]::NewGuid().ToString('N'))
  if ($Update) { [IO.Directory]::Move($current, $backup) }
  try { [IO.Directory]::Move($stage, $current) }
  catch {
    if ($Update) { [IO.Directory]::Move($backup, $current) }
    throw
  }
  Write-Output "Extension: $current"
  if ($Update) { Write-Output "Previous package: $backup" }
  Write-Output 'Load extension on first install; Reload the SAME extension after update. liveSupportClaimed=false; Never-Save.'
} finally { $lock.Dispose() }
