# 图表引擎（`engine/`）

> 生产路径：**D3 单轨** · Plan 层仍称 `antv`（`engine/antv/spec` 数据编码 + `theme.ts` token）

## 渲染管线

```text
ChartRenderer
  └─ legacy table → EmbeddedChartTable（react，deprecated）
  └─ CanvasChartHost → ChartEngineView → D3ViewRouter
        ├─ D3CanvasView      # 柱线饼 / 关系 / KPI / 仪表盘…
        ├─ D3GeoMapView      # 离线中国 choropleth
        └─ D3TableView       # 明细 / 汇总 / 透视
```

## 目录

| 路径 | 职责 |
|------|------|
| `buildChartRenderPlan.ts` | `ChartViewModel` → `ChartRenderPlan`（`kind: "d3"`） |
| `applyChartStyleChain.ts` | D3 主题 / 条件格式 / markLine |
| `plugins/` | `metadata.ts` 真理源 · `buildPlanForType` · `registerChartPluginPackage` |
| `plugins/bar/` | 示例单包插件（`ChartPluginPackage`） |
| `d3/` | SVG 渲染实现 |
| `geo/` | `OfflineGeoPort` · 下钻 · 占位视图 · `geoMapChart` join |
| `three/` · `three/geo/` | `map-3d` Three.js choropleth · `chinaTerrainLoader` · `applyGeoTerrainSurface`（见 [docs/ui/map-texture.md](../../../../docs/ui/map-texture.md)） |
| `antv/spec/` · `theme.ts` | 行列编码与主题 token（无 AntV 运行时） |
| `geoEnginePort.ts` | `activeGeoEngine` / `legacyGeoOptionEngine` 端口 |

## 门禁

`pnpm check:chart-engine`（`fe/scripts/check-chart-engine.mjs`）：

- 禁止 `echarts` / `echarts-for-react` import（`engine/echarts/` 已删除）
- 禁止 `@antv/*` import（`engine/antv/**` 除外；S2/G2/G2Plot/G6 已下架）
- 禁止 `engine/echarts` · `engine/antv/s2` · `engine/antv/g2` 目录复活
