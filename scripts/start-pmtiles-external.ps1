# PMTiles external tile server (final form; independent of VitalSpan)
param(
  [string]$DataDir = "$env:USERPROFILE\Desktop",
  [string]$PmtilesFile = "planet-z15-20260817.pmtiles",
  [string]$CorsOrigin = "http://127.0.0.1:5173",
  [int]$Port = 8080,
  [string]$ServiceId = "planet-z15",
  [string]$ServiceName = "Planet Z15 Global",
  [switch]$SkipRegister
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

$dataPath = (Resolve-Path -LiteralPath $DataDir).Path
$pmtilesPath = Join-Path $dataPath $PmtilesFile
if (-not (Test-Path -LiteralPath $pmtilesPath)) {
  throw "PMTiles file not found: $pmtilesPath"
}

function Test-ColocatedBasemapAssets([string]$root) {
  $fontsDir = Join-Path $root (Join-Path "basemaps-assets" "fonts")
  $pbf = $null
  if (Test-Path -LiteralPath $fontsDir) {
    $pbf = Get-ChildItem -LiteralPath $fontsDir -Recurse -Filter *.pbf -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  $sprite = Join-Path $root (Join-Path "basemaps-assets" (Join-Path "sprites" (Join-Path "v4" "light.json")))
  return ($null -ne $pbf) -and (Test-Path -LiteralPath $sprite)
}

$syncScript = Join-Path $repoRoot (Join-Path "scripts" "sync-pmtiles-basemaps-assets.ps1")
if (-not (Test-ColocatedBasemapAssets $dataPath)) {
  Write-Host "basemaps-assets incomplete (empty fonts is not ready); syncing next to PMTiles..."
  & $syncScript -DataDir $dataPath
}
if (-not (Test-ColocatedBasemapAssets $dataPath)) {
  throw "basemaps-assets/fonts has no .pbf or sprites/v4/light.json is missing under $dataPath. Do not start until glyphs/sprites sit next to the PMTiles file."
}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $listeners) {
  $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -match '^(python|Python)$') {
    Write-Host "Stopping legacy dev server on port ${Port}: $($proc.ProcessName) (pid $($proc.Id))"
    Stop-Process -Id $proc.Id -Force
  }
}

$env:PMTILES_DATA_DIR = ($dataPath -replace '\\', '/')
$env:PMTILES_CORS_ORIGIN = $CorsOrigin
$env:PMTILES_TILE_PORT = "$Port"
$env:PMTILES_HEALTH_FILE = $PmtilesFile

Write-Host ""
Write-Host "=== PMTiles external tile server ==="
Write-Host "  data dir : $dataPath"
Write-Host "  archive  : $PmtilesFile"
Write-Host "  port     : $Port"
Write-Host "  cors     : $CorsOrigin"
Write-Host ""

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker daemon is not running. Start Docker Desktop, then rerun this script."
}

docker compose --profile pmtiles-external up -d pmtiles-tile-server

$verifyScript = Join-Path $repoRoot (Join-Path 'scripts' 'verify-pmtiles-external.ps1')

Write-Host "Waiting for healthcheck..."
$healthy = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  $status = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}" vitalspan-pmtiles-tile-server 2>$null
  if ($status -eq "healthy") { $healthy = $true; break }
  if ($status -eq "unhealthy" -and $i -gt 5) { break }
}
if (-not $healthy) {
  try {
    & $verifyScript -Port $Port -PmtilesFile $PmtilesFile
    Write-Host "Docker healthcheck pending, but Range probe passed."
    $healthy = $true
  } catch {
    docker logs vitalspan-pmtiles-tile-server --tail 30
    throw "PMTiles external service failed healthcheck"
  }
}

if ($healthy) {
  & $verifyScript -Port $Port -PmtilesFile $PmtilesFile
}

if (-not $SkipRegister) {
  $registerScript = Join-Path $repoRoot (Join-Path 'scripts' 'register-pmtiles-external.ps1')
  & $registerScript -ServiceId $ServiceId -ServiceName $ServiceName -BaseUrl "http://127.0.0.1:${Port}" -PmtilesPath "/${PmtilesFile}"
}

Write-Host ""
Write-Host "External tile server ready."
Write-Host ("  tile URL : http://127.0.0.1:{0}/{1}" -f $Port, $PmtilesFile)
Write-Host ("  assets   : http://127.0.0.1:{0}/basemaps-assets/ (glyphs + sprites)" -f $Port)
Write-Host ("  VitalSpan: gis-map -> optional PMTiles -> {0}" -f $ServiceId)
