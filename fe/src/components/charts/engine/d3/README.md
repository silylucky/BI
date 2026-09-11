# D3 图表引擎

画布类 chartType（含 KPI、表格三件套）统一由 `engine/d3/` 渲染。

## VCDS（VitalSpan Chart Design System）

视觉/交互/性能真理源：`core/chartVisualTokens.ts` · `core/themeEngine.ts` · `core/sceneGraph.ts`

| 分路 | 组件 |
|------|------|
| 柱线饼/关系/指标等 | `D3CanvasView` → `renderDispatch.ts` |
| 地图 | `D3GeoMapView` → `geo/renderChoropleth.ts` |
| 明细/汇总/透视表 | `D3TableView` → `VitalSpanTable` / `TablePivotGrid` |

## Renderer 编写规范

1. 从 `core/` 引用 Token、theme、tooltip、crosshair；禁止 magic number
2. 笛卡尔图优先 `buildCartesianScene` + `drawCartesianAxes`（柱图用 `drawCartesianBandAxes`）
3. 散点 >5k 由 `perfRouter` 路由至 `canvasScatterLayer` 混合渲染
4. live resize 时容器带 `data-vs-incremental=true`，尽量保留 SVG 根节点
5. 单文件 ≤300 行；超出拆 `*Layout.ts` / `*Paint.ts`

Plan 构建仍经 `buildPlanForType`（`kind: "d3"`）。

详细计划：[`docs/automate/plans/2026-07-21-d3-visual-excellence.md`](../../../../docs/automate/plans/2026-07-21-d3-visual-excellence.md)
