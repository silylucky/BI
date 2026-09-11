# 把 Protomaps glyphs/sprite 放到与 PMTiles 同一数据目录（离线瓦片服务）
param(
  [string]$DataDir = "$env:USERPROFILE\Desktop"
)

$ErrorActionPreference = "Stop"
$dataPath = (Resolve-Path -LiteralPath $DataDir).Path
$dest = Join-Path $dataPath "basemaps-assets"
$fonts = Join-Path $dest "fonts"
if ((Test-Path -LiteralPath $fonts) -and (Get-ChildItem -LiteralPath $fonts -ErrorAction SilentlyContinue)) {
  Write-Host "basemaps-assets already present: $dest"
  exit 0
}

$tmp = Join-Path $env:TEMP ("basemaps-assets-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Write-Host "Cloning protomaps/basemaps-assets (once) into tile-server data dir..."
  git clone --depth 1 --filter=blob:none https://github.com/protomaps/basemaps-assets.git $tmp
  if ($LASTEXITCODE -ne 0) {
    throw "git clone failed. Download fonts/sprites yourself into $dest (fonts + sprites/v4)."
  }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item -Path (Join-Path $tmp "fonts") -Destination $fonts -Recurse -Force
  $spritesSrc = Join-Path $tmp "sprites"
  if (Test-Path -LiteralPath $spritesSrc) {
    Copy-Item -Path $spritesSrc -Destination (Join-Path $dest "sprites") -Recurse -Force
  }
  Write-Host "Installed: $dest"
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
