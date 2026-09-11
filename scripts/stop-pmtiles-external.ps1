# Stop PMTiles external tile server (does not affect VitalSpan)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot
docker compose --profile pmtiles-external stop pmtiles-tile-server
Write-Host "Stopped vitalspan-pmtiles-tile-server"
