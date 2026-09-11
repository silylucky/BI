# VitalSpan database backup — delegates to Python (compose + host fallback)
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
python (Join-Path $PSScriptRoot "backup-databases.py")
exit $LASTEXITCODE
