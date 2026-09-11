# DEPRECATED: use docs/api/vs-ai-spec/tools/publish-ai-viz-artifact.py (preflight + POST/PUT).
param(
  [Parameter(Mandatory = $true)]
  [string]$BundlePath,
  [string]$BaseUrl = "http://127.0.0.1:8000",
  [string]$Token = "",
  [string]$ArtifactId = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BundlePath)) {
  throw "Bundle file not found: $BundlePath"
}

if (-not $Token) {
  $Token = $env:VITALSPAN_ACCESS_TOKEN
}
if (-not $Token) {
  throw "Missing token. Pass -Token or set env VITALSPAN_ACCESS_TOKEN (browser localStorage vitalspan:access_token)."
}

$body = Get-Content -Raw -Encoding UTF8 -LiteralPath $BundlePath
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json; charset=utf-8"
}

if ($ArtifactId) {
  $uri = "$BaseUrl/api/v1/ai-viz/artifacts/$ArtifactId"
  $method = "PUT"
} else {
  $uri = "$BaseUrl/api/v1/ai-viz/artifacts"
  $method = "POST"
}

$response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $bodyBytes
$response | ConvertTo-Json -Depth 8
