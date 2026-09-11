# Verify PMTiles external tile server (HTTP Range + CORS)
param(
  [int]$Port = 8080,
  [string]$PmtilesFile = "planet-z15-20260817.pmtiles",
  [string]$CorsOrigin = "http://127.0.0.1:5173"
)

$ErrorActionPreference = "Stop"
$url = "http://127.0.0.1:$Port/$PmtilesFile"

Write-Host "Checking Range: $url"
$range = curl.exe -s -D - -o NUL -H "Range: bytes=0-16383" $url 2>&1
$rangeText = ($range | Out-String)
if ($rangeText -notmatch "206") {
  Write-Host $rangeText
  throw "Range request did not return 206 Partial Content"
}

Write-Host "Checking CORS preflight (127.0.0.1 origin)"
$options127 = curl.exe -s -D - -o NUL -X OPTIONS $url -H "Origin: http://127.0.0.1:5173" -H "Access-Control-Request-Method: GET" 2>&1
$options127Text = ($options127 | Out-String)
if ($options127Text -notmatch "Access-Control-Allow-Origin: http://127\.0\.0\.1:5173") {
  Write-Host $options127Text
  throw "CORS must echo http://127.0.0.1:5173 for local dev"
}

$spriteUrl = "http://127.0.0.1:$Port/basemaps-assets/sprites/v4/light.json"
Write-Host "Checking CORS preflight ($CorsOrigin origin)"
$options = curl.exe -s -D - -o NUL -X OPTIONS $url -H "Origin: $CorsOrigin" -H "Access-Control-Request-Method: GET" 2>&1
$optionsText = ($options | Out-String)
if ($optionsText -notmatch "Access-Control-Allow-Origin") {
  Write-Host $optionsText
  throw "CORS response header missing"
}

Write-Host "Checking colocated sprite: $spriteUrl"
$spriteCode = curl.exe -s -o NUL -w "%{http_code}" $spriteUrl
if ($spriteCode -ne "200") {
  throw "Sprite JSON did not return 200: $spriteUrl (got $spriteCode)"
}

$glyphUrl = "http://127.0.0.1:$Port/basemaps-assets/fonts/Noto%20Sans%20Regular/0-255.pbf"
Write-Host "Checking colocated glyph: $glyphUrl"
$glyphCode = curl.exe -s -o NUL -w "%{http_code}" $glyphUrl
if ($glyphCode -ne "200") {
  throw "Glyph PBF did not return 200: $glyphUrl (got $glyphCode). Empty fonts dir is not ready."
}

Write-Host "OK: PMTiles external service Range + CORS + colocated glyphs/sprite verified"
