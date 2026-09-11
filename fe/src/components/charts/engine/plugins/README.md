# ChartViewPlugin Registry

对标 DataEase `ChartViewPlugin` + compile-time glob 注册；backend `GET /api/v1/charts/types` 为 catalog 真理源，FE `BUILTIN_PLUGIN_DEFS` 镜像元数据与渲染计划。

## 目录

| 路径 | 职责 |
|------|------|
| `types.ts` | `ChartViewPlugin` / `DePaletteCategory` |
| `metadata.ts` | ~40 内置 type 元数据（paletteCategory、properties、capabilities） |
| `registry.ts` | `registerChartPlugin` / `getChartPlugin` |
| `plans/buildPlan.ts` | `buildPlanForType` → `ChartRenderPlan` |
| `index.ts` | 启动时 `registerBuiltinChartPlugins()` |

## 渲染分路

`ChartEngineView` → `D3ViewRouter`：

| library | 视图 |
|---------|------|
| `d3` | `D3CanvasView` / `D3GeoMapView` / `D3TableView` |
| `react` | legacy `table`（`EmbeddedChartTable` 薄壳） |

样式管线：`applyChartStyleChain`（D3 主题 / seriesColor / conditional / markLines）。

## 存量迁移

`fe/src/lib/migrateChartTypes.ts`：layout 加载时将 `table`→`table-info`、`bar+stacked`→`bar-stack` 等。

## 约束

- `@antv/*` 仅允许 `engine/antv/**`（见 `fe/scripts/check-chart-engine.mjs`）
- 地图仅离线 GeoJSON（`map`/`map-3d`）；`gis-map` 经 `GisMapView` + `maplibre-gl`；不注册在线 L7 地图 type
