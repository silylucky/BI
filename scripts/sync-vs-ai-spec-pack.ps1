param(
  [string]$Destination = (Join-Path $env:USERPROFILE "Desktop\vs-ai-spec-deeptalk-test")
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot "docs\api\vs-ai-spec"

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source spec pack not found: $Source"
}

if (-not (Test-Path -LiteralPath $Destination)) {
  New-Item -ItemType Directory -Path $Destination | Out-Null
}

Write-Host "Sync $Source -> $Destination"
# /E only: update official pack files; do NOT /MIR-delete external examples (e.g. custom-viz-trend-line.json).
robocopy $Source $Destination /E /XD __pycache__ .pytest_cache examples\_work _work /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

$workDir = Join-Path $Destination "examples\_work"
if (Test-Path -LiteralPath $workDir) {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}

Write-Host "done. DeepTalk integration project synced; set VITALSPAN_ROOT if validating from Desktop."
$localExample = Join-Path $Destination "local.config.json.example"
if (Test-Path -LiteralPath $localExample) {
  Write-Host "MVP upload: cd $Destination && python tools\mvp-upload.py --file examples\your.json"
  Write-Host "See MVP-UPLOAD.md"
}
