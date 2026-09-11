param(
  [Parameter(Mandatory = $false)]
  [string]$File,
  [Parameter(Mandatory = $false)]
  [string]$From,
  [switch]$List,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$PackRoot = $PSScriptRoot
$Mvp = Join-Path $PackRoot "tools\mvp-upload.py"

if (-not (Test-Path -LiteralPath $Mvp)) {
  throw "tools/mvp-upload.py not found; run from vs-ai-spec pack root"
}

$args = @()
if ($List) { $args += "--list" }
if ($ValidateOnly) { $args += "--validate-only" }
if ($From) { $args += @("--from", $From) }
elseif ($File) { $args += @("--file", $File) }
elseif (-not $List) {
  Write-Host "用法:"
  Write-Host "  .\upload-component.ps1 -File examples\my-widget.json"
  Write-Host "  .\upload-component.ps1 -From output\deeptalk-widget.json"
  Write-Host "  .\upload-component.ps1 -List"
  exit 1
}

Push-Location $PackRoot
try {
  python $Mvp @args
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
