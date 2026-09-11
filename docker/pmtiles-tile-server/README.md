# PMTiles 外部瓦片服务

> **不是 VitalSpan 内置能力**。128GB 级 `planet-z15` 制品不进主 release；运维单独部署本服务，平台管理员在元库登记 `tileServiceId`。

## 职责

| 项 | 说明 |
|----|------|
| 提供 | HTTP Range 读取 `.pmtiles` 归档（MapLibre + pmtiles.js） |
| 不提供 | 图表渲染、JWT、看板 layout |
| 消费方 | VitalSpan `gis-map` 经 `GET /api/v1/tile-services/{id}/resolve` 获取 URL |

## 一键启动（推荐）

在仓库根目录：

```powershell
.\scripts\start-pmtiles-external.ps1 -DataDir C:\Users\30381\Desktop
```

脚本会：

1. 停止占用 8080 的临时进程
2. 若 `basemaps-assets` 缺字体 `.pbf` 或 `sprites/v4/light.json`（空 fonts 目录不算就绪），同步到与 `.pmtiles` 同一目录
3. `docker compose --profile pmtiles-external up -d`
4. 等待健康检查（Range 206 **且** sprite JSON / 抽样 `.pbf` 200）
5. 在 VitalSpan 元库幂等登记 `planet-z15`（glyphs/sprite 指向同一 `baseUrl`）

验真：

```powershell
.\scripts\verify-pmtiles-external.ps1
```

## 启动（Docker · 手动）

```powershell
# 在仓库根目录；PMTILES_DATA_DIR 指向含 .pmtiles 文件的目录
$env:PMTILES_DATA_DIR = "C:\Users\30381\Desktop"
$env:PMTILES_CORS_ORIGIN = "http://localhost:5173"
docker compose --profile pmtiles-external up -d pmtiles-tile-server
```

验证 Range：

```powershell
curl.exe -I -H "Range: bytes=0-15" http://127.0.0.1:8080/planet-z15-20260817.pmtiles
# 期望 206 Partial Content
```

## 在 VitalSpan 登记

```http
POST /api/v1/tile-services
{
  "id": "planet-z15",
  "name": "全球 Planet Z15",
  "baseUrl": "http://127.0.0.1:8080",
  "pmtilesPath": "/planet-z15-20260817.pmtiles",
  "glyphsUrlTemplate": "http://127.0.0.1:8080/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  "spriteUrl": "http://127.0.0.1:8080/basemaps-assets/sprites/v4/light",
  "enabled": true
}
```

看板 `gis-map` → 样式 → **启用全球 PMTiles 底图（外部服务）** → 选择已登记服务。

## 生产

- 内网 Nginx/Caddy + Range + CORS；或对象存储静态托管 + Range
- glyphs/sprite 必须与 `.pmtiles` 同机提供（`/basemaps-assets/`），**不要**使用 jsDelivr / github.io
- 详见 [docs/services/pmtiles-tile-server.md](../../docs/services/pmtiles-tile-server.md)

## 本地临时脚本（已废弃）

`scripts/serve-pmtiles-dev.py` 默认拒绝运行；仅 `python scripts/serve-pmtiles-dev.py --legacy-dev` 供无 Docker 应急。
