# Best-effort: scrape Edge Local Extension Settings (LevelDB) for CMS education job strings.
# Does NOT fully decode LevelDB. Safe read when files are not exclusively locked.
# Run on Jeremy's PC (Windows + Edge). Prefer closing Edge for fewer file locks.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-last-cms-job.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-last-cms-job.ps1 -ExtensionId hdekmacbpblppkbpamgocbanjafigfej
#
# chrome.storage.local keys of interest:
#   resumeCmsEducationJob:<tabId>
#   resumeCmsInternshipJob:<tabId>
#   resumePendingFillReview:<tabId>
#   page_unfocused (reason inside job JSON)
param(
  [string]$ExtensionId = '',
  [string]$OutDir = ''
)
$ErrorActionPreference = 'Continue'

$lesRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default\Local Extension Settings'
if (-not (Test-Path -LiteralPath $lesRoot)) {
  Write-Output "LES missing: $lesRoot"
  Write-Output "Note: full LevelDB decode needs a dedicated tool or chrome.storage; this script only scrapes ASCII strings."
  exit 1
}

$needles = @(
  'resumeCmsEducationJob',
  'resumeCmsInternshipJob',
  'resumePendingFillReview',
  'page_unfocused',
  'cms_education_',
  'education_option_missing',
  'region_option_not_found'
)

function Get-AsciiChunks([byte[]]$bytes) {
  $sb = New-Object System.Text.StringBuilder
  $chunks = New-Object System.Collections.Generic.List[string]
  foreach ($b in $bytes) {
    if ($b -ge 32 -and $b -le 126) { [void]$sb.Append([char]$b) }
    else {
      if ($sb.Length -ge 12) { $chunks.Add($sb.ToString()) }
      [void]$sb.Clear()
    }
  }
  if ($sb.Length -ge 12) { $chunks.Add($sb.ToString()) }
  return $chunks
}

function Try-ReadBytes([string]$path) {
  try {
    $fs = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try {
      $ms = New-Object IO.MemoryStream
      $fs.CopyTo($ms)
      return $ms.ToArray()
    } finally { $fs.Dispose() }
  } catch {
    return $null
  }
}

$dirs = @(Get-ChildItem -LiteralPath $lesRoot -Directory -ErrorAction SilentlyContinue)
if ($ExtensionId) {
  $dirs = @($dirs | Where-Object { $_.Name -eq $ExtensionId })
  if ($dirs.Count -eq 0) {
    Write-Output "ExtensionId not found under LES: $ExtensionId"
    Write-Output 'Available LES dirs:'
    Get-ChildItem -LiteralPath $lesRoot -Directory | ForEach-Object { Write-Output ("  " + $_.Name) }
    exit 1
  }
}

$hits = New-Object System.Collections.Generic.List[object]
foreach ($dir in $dirs) {
  $files = @(Get-ChildItem -LiteralPath $dir.FullName -File -ErrorAction SilentlyContinue)
  foreach ($file in $files) {
    if ($file.Name -eq 'LOCK') { continue }
    $bytes = Try-ReadBytes $file.FullName
    if ($null -eq $bytes -or $bytes.Length -eq 0) {
      $hits.Add([pscustomobject]@{ ExtensionId = $dir.Name; File = $file.Name; Status = 'locked_or_empty'; Snippet = '' })
      continue
    }
    $chunks = Get-AsciiChunks $bytes
    foreach ($chunk in $chunks) {
      $matched = $false
      foreach ($n in $needles) {
        if ($chunk.Contains($n)) { $matched = $true; break }
      }
      if (-not $matched) { continue }
      $snippet = $chunk
      if ($snippet.Length -gt 800) {
        $idx = -1
        foreach ($n in $needles) {
          $i = $snippet.IndexOf($n)
          if ($i -ge 0 -and ($idx -lt 0 -or $i -lt $idx)) { $idx = $i }
        }
        if ($idx -lt 0) { $idx = 0 }
        $start = [Math]::Max(0, $idx - 80)
        $snippet = $snippet.Substring($start, [Math]::Min(800, $snippet.Length - $start))
      }
      $hits.Add([pscustomobject]@{
        ExtensionId = $dir.Name
        File        = $file.Name
        Status      = 'hit'
        Snippet     = $snippet
      })
    }
  }
}

if (-not $OutDir) {
  $repoGuess = Join-Path $PSScriptRoot '..'
  $OutDir = Join-Path $repoGuess 'dist\les-exports'
}
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outPath = Join-Path $OutDir ("cms-job-les-{0}.txt" -f $stamp)

$header = @(
  'ResumeQuickFill LES best-effort export (NOT full LevelDB decode)',
  ('Local time: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
  ('LES: {0}' -f $lesRoot),
  ('ExtensionId filter: {0}' -f $(if ($ExtensionId) { $ExtensionId } else { '(all)' })),
  ('Hit count: {0}' -f $hits.Count),
  '---',
  'How to map extension id:',
  '  edge://extensions -> Developer mode -> ID; or LES folder name.',
  '  Example LES dir that previously contained resumeCmsEducationJob: hdekmacbpblppkbpamgocbanjafigfej',
  'Parent pull tips:',
  '  1) Run this script -> read dist/les-exports/cms-job-les-*.txt',
  '  2) Or screenshot popup Complete Education progress/field outcomes (more accurate)',
  '  3) Full JSON needs chrome.storage.local or a LevelDB tool; close Edge if LOCK blocks reads',
  '========================================'
)

$lines = New-Object System.Collections.Generic.List[string]
foreach ($h in $header) { $lines.Add($h) }
if ($hits.Count -eq 0) {
  $lines.Add('No string hits. Possible: no CMS education job yet, wrong extension id, or data only in compressed ldb blocks.')
  $lines.Add('Skipped full LevelDB decode (heavy deps / file locks).')
} else {
  $i = 0
  foreach ($h in $hits) {
    $i += 1
    $lines.Add(('[{0}] id={1} file={2} status={3}' -f $i, $h.ExtensionId, $h.File, $h.Status))
    if ($h.Snippet) { $lines.Add($h.Snippet); $lines.Add('---') }
  }
}

$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllLines($outPath, $lines, $utf8)
Write-Output ("Wrote: {0}" -f $outPath)
Write-Output ("Hits: {0}" -f $hits.Count)
$hitOnly = @($hits | Where-Object { $_.Status -eq 'hit' })
Write-Output ("Snippets: {0}" -f $hitOnly.Count)
if ($hitOnly.Count -gt 0) {
  Write-Output ("Example extension id: {0}" -f $hitOnly[0].ExtensionId)
}
