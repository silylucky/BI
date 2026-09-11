# 在 VitalSpan 元库登记 PMTiles 外部服务（幂等）
param(
  [Parameter(Mandatory = $true)][string]$ServiceId,
  [Parameter(Mandatory = $true)][string]$ServiceName,
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$PmtilesPath
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location "$repoRoot\backend"

$pyFile = Join-Path $env:TEMP "register-pmtiles-$(Get-Random).py"

function Convert-PyLiteral([string]$Value) {
  return ($Value | ConvertTo-Json -Compress)
}

@'
from app.datasources.models import get_meta_session
from app.viz.tile_services import service as tile_service
from app.viz.tile_services.schemas import TileServiceCreate, TileServicePatch

SERVICE_ID = SERVICE_ID_PLACEHOLDER
SERVICE_NAME = SERVICE_NAME_PLACEHOLDER
BASE_URL = BASE_URL_PLACEHOLDER
PMTILES_PATH = PMTILES_PATH_PLACEHOLDER

db = get_meta_session()
try:
    try:
        tile_service.create_tile_service(
            db,
            TileServiceCreate(
                id=SERVICE_ID,
                name=SERVICE_NAME,
                baseUrl=BASE_URL.rstrip("/"),
                pmtilesPath=PMTILES_PATH,
                enabled=True,
                description="PMTiles external tile server",
                glyphsUrlTemplate=BASE_URL.rstrip("/") + "/basemaps-assets/fonts/{fontstack}/{range}.pbf",
                spriteUrl=BASE_URL.rstrip("/") + "/basemaps-assets/sprites/v4/light",
            ),
            updated_by=None,
        )
        db.commit()
        print(f"registered:{SERVICE_ID}")
    except tile_service.TileServiceError as exc:
        if exc.code != "TILE_SERVICE_EXISTS":
            raise
        tile_service.patch_tile_service(
            db,
            SERVICE_ID,
            TileServicePatch(
                name=SERVICE_NAME,
                baseUrl=BASE_URL.rstrip("/"),
                pmtilesPath=PMTILES_PATH,
                enabled=True,
                glyphsUrlTemplate=BASE_URL.rstrip("/") + "/basemaps-assets/fonts/{fontstack}/{range}.pbf",
                spriteUrl=BASE_URL.rstrip("/") + "/basemaps-assets/sprites/v4/light",
            ),
            updated_by=None,
        )
        db.commit()
        print(f"updated:{SERVICE_ID}")
    resolved = tile_service.resolve_tile_service(db, SERVICE_ID)
    print("pmtilesUrl=" + resolved.pmtiles_url)
finally:
    db.close()
'@ -replace 'SERVICE_ID_PLACEHOLDER', (Convert-PyLiteral $ServiceId) `
   -replace 'SERVICE_NAME_PLACEHOLDER', (Convert-PyLiteral $ServiceName) `
   -replace 'BASE_URL_PLACEHOLDER', (Convert-PyLiteral $BaseUrl) `
   -replace 'PMTILES_PATH_PLACEHOLDER', (Convert-PyLiteral $PmtilesPath) |
  Set-Content -Path $pyFile -Encoding UTF8
try {
  python $pyFile
} finally {
  Remove-Item -LiteralPath $pyFile -Force -ErrorAction SilentlyContinue
}
