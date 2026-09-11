param(
  [string]$PluginRoot = (Join-Path $env:USERPROFILE "Desktop\deeptalk-plugins\plugins\vitalspan"),
  [string]$VitalSpanRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$Spec = Join-Path $VitalSpanRoot "docs\api\vs-ai-spec"
$Product = Join-Path $Spec "deeptalk-product"

if (-not (Test-Path -LiteralPath $PluginRoot)) {
  throw "Plugin root not found: $PluginRoot"
}
if (-not (Test-Path -LiteralPath $Spec)) {
  throw "vs-ai-spec not found: $Spec"
}

$assets = Join-Path $PluginRoot "assets"
$templates = Join-Path $assets "templates"
$productDest = Join-Path $PluginRoot "deeptalk-product-sync"
foreach ($dir in @($assets, $templates, $productDest)) {
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

$assetFiles = @(
  "contract_card.json",
  "aiviz-publish-hints.json",
  "aiviz-structured-fixes.json",
  "aiviz-publish-hints.json",
  "custom-viz-paradigms.json",
  "capability-routing.json"
)
foreach ($name in $assetFiles) {
  $src = Join-Path $Spec "assets\$name"
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $assets $name) -Force
    Write-Host "ok assets/$name"
  }
}

$exampleFiles = @(
  "generic-blank-html.json",
  "generic-blank-d3.json",
  "hex-kpi-grid.json"
)
foreach ($name in $exampleFiles) {
  $src = Join-Path $Spec "examples\$name"
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $templates $name) -Force
    Write-Host "ok assets/templates/$name"
  }
}

$productFiles = @(
  "AGENT-SYSTEM-PROMPT.md",
  "DEEPTALK-AGENT-PROMPT.md",
  "agent-tools.schema.json",
  "E2E-CHECKLIST.md"
)
foreach ($name in $productFiles) {
  $src = Join-Path $Product $name
  if ($name -eq "DEEPTALK-AGENT-PROMPT.md") {
    $src = Join-Path $Spec "DEEPTALK-AGENT-PROMPT.md"
  }
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $productDest $name) -Force
    Write-Host "ok deeptalk-product-sync/$name"
  }
}

Write-Host ""
Write-Host "Next (in deeptalk-plugins):"
Write-Host "  `$env:VITALSPAN_ROOT='$VitalSpanRoot'"
Write-Host "  cd '$((Split-Path -Parent $PluginRoot))'"
Write-Host "  npm run build -w vitalspan-plugin"
Write-Host "  npm run release"
Write-Host "  DeepTalk: install release/vitalspan-v*.zip and restart"
