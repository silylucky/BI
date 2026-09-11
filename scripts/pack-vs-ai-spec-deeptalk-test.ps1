param(
  [string]$OutputZip = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot "docs\api\vs-ai-spec"
if (-not $OutputZip) {
  $OutputZip = Join-Path $RepoRoot "docs\api\vs-ai-spec-deeptalk-test.zip"
}

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source spec pack not found: $Source"
}

$staging = Join-Path $env:TEMP ("vs-ai-spec-deeptalk-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $staging | Out-Null
try {
  robocopy $Source $staging /E /XD __pycache__ .pytest_cache examples\_work _work /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy staging failed with exit code $LASTEXITCODE"
  }
  if (Test-Path -LiteralPath $OutputZip) {
    Remove-Item -LiteralPath $OutputZip -Force
  }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $OutputZip -CompressionLevel Optimal
  Write-Host "packed $OutputZip"
}
finally {
  Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}
