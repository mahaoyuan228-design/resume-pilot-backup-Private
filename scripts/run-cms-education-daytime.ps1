[CmdletBinding()]
param(
  [switch]$Collect,
  [switch]$NeverSave,
  [string]$ApprovedManifest,
  [string]$MachineRoot,
  [string]$OutDir,
  [string]$ReviewedRef = '392dbe0b6bf1234be47b2d516ab37ef8ee7e353d',
  [ValidateRange(1, 65535)][int]$Port = 9239,
  [ValidateRange(0, 29)][int]$RowIndex = 0,
  [ValidateRange(1000, 120000)][int]$StepTimeoutMs = 30000
)
$ErrorActionPreference = 'Stop'
$cmsHarnessRoot = Split-Path -Parent $PSScriptRoot
$cmsHarnessScript = Join-Path $PSScriptRoot 'cms-education-daytime-harness.mjs'
if (-not $OutDir) {
  $cmsHarnessMode = if ($Collect) { 'collect' } else { 'prepare' }
  $OutDir = Join-Path $cmsHarnessRoot (Join-Path '_temp-scripts' ("cms-edu-daytime-$cmsHarnessMode-" + [guid]::NewGuid().ToString('N')))
}
$cmsHarnessArgs = @($cmsHarnessScript, '--out', $OutDir)
if ($Collect) {
  if (-not $NeverSave -or -not $ApprovedManifest -or -not $MachineRoot) {
    throw 'Collection requires -NeverSave, -ApprovedManifest and -MachineRoot. Default invocation is offline preparation.'
  }
  $cmsHarnessArgs += @('--collect', '--never-save', '--approved-manifest', $ApprovedManifest,
    '--machine-root', $MachineRoot, '--port', "$Port", '--row-index', "$RowIndex", '--step-timeout-ms', "$StepTimeoutMs")
} else {
  $cmsHarnessArgs += @('--prepare', '--reviewed-ref', $ReviewedRef)
}
& node @cmsHarnessArgs
exit $LASTEXITCODE
