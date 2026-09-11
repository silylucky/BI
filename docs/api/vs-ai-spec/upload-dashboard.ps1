param(
  [Parameter(Mandatory = $false)]
  [string]$DashboardId,
  [Parameter(Mandatory = $false)]
  [string]$File,
  [Parameter(Mandatory = $false)]
  [string]$ArtifactIds,
  [switch]$ListArtifacts,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PackRoot = $PSScriptRoot
$Tool = Join-Path $PackRoot "tools\mvp-dashboard.py"

if (-not (Test-Path -LiteralPath $Tool)) {
  throw "tools/mvp-dashboard.py not found"
}

$args = @()
if ($ListArtifacts) { $args += "--list-artifacts" }
if ($DryRun) { $args += "--dry-run" }
if ($DashboardId) { $args += @("--dashboard-id", $DashboardId) }
if ($File) { $args += @("--file", $File) }
if ($ArtifactIds) { $args += @("--artifact-ids", $ArtifactIds) }

if ($args.Count -eq 0) {
  Write-Host "用法:"
  Write-Host "  .\upload-dashboard.ps1 -ListArtifacts"
  Write-Host "  .\upload-dashboard.ps1 -DashboardId <uuid> -File examples\e2e-mixed-screen.json"
  Write-Host "  .\upload-dashboard.ps1 -DashboardId <uuid> -ArtifactIds uuid1,uuid2"
  exit 1
}

Push-Location $PackRoot
try {
  python $Tool @args
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
