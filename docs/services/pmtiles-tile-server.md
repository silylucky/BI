# PMTiles 外部瓦片服务（运维附录）

| 字段 | 值 |
|------|-----|
| 部署形态 | **独立于 VitalSpan** 的 HTTP 静态/RANGE 服务 |
| 平台登记 | `backend/app/viz/tile_services/` · `viz_tile_services` 表 |
| PRD / ADR | F06-VIZ · [arch.md §ADR-12](../arch.md) · GEO-IRON-01 |
| 状态 | 已实现（登记 API + FE 消费）；制品与进程由运维部署 |

## 职责

- 对外提供 `.pmtiles` 文件的 **HTTP Range** 访问（含 CORS）
- 同机提供 Protomaps **glyphs/sprite**（`/basemaps-assets/`），与瓦片同一进程；**禁止**默认公网 CDN

## 边界

| In | Out |
|----|-----|
| 托管 planet-z15 等 PMTiles 归档 + `basemaps-assets/` | VitalSpan 图表渲染、查询、鉴权 |
| Range + CORS 配置 | 128GB 打进 VitalSpan release 包 |
| 内网 URL（如 `http://tiles.internal:8080/...`） | 高德/天地图/Mapbox 等在线底图 Key |

## VitalSpan 侧（已实现）

1. 管理员 `POST /api/v1/tile-services` 登记 `baseUrl` + `pmtilesPath`
2. `gis-map` layout 只存 `tileServiceId`（禁止写 128GB 绝对路径）
3. FE `resolveTileService()` → MapLibre `pmtiles://` 加载；未登记或加载失败时明确报错，**禁止**回退离线中国省界

## 部署

见 [`docker/pmtiles-tile-server/README.md`](../../docker/pmtiles-tile-server/README.md)。

```powershell
# 一键（需 Docker Desktop 已运行）
.\scripts\start-pmtiles-external.ps1 -DataDir C:\path\to\pmtiles-dir

# 停止（不影响 VitalSpan 主栈）
.\scripts\stop-pmtiles-external.ps1

# 验真 Range + CORS + 同机 glyph/sprite
.\scripts\verify-pmtiles-external.ps1
```

**VitalSpan 默认 `docker compose up` 不会启动本服务**（`pmtiles-external` profile 隔离）。

环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PMTILES_DATA_DIR` | （必填） | 宿主机含 `.pmtiles` **以及** `basemaps-assets/`（fonts、sprites）的目录 |
| `PMTILES_TILE_PORT` | `8080` | 对外端口 |
| `PMTILES_CORS_ORIGIN` | `http://localhost:5173` | VitalSpan FE origin |

## 依赖关系

```
[PMTiles 外部服务] ──HTTP Range──► 浏览器 MapLibre (gis-map)
        ▲
        │ resolve URL
[VitalSpan API tile-services]
```

默认离线省界 **不依赖** 本服务。
