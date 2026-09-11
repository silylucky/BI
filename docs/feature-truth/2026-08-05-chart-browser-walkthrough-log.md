# 图表目录浏览器走查日志（44 活跃型 · REAL）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 范围 | **44** 个非 deprecated `chartType`（不含 5 项 MIG deprecated） |
| 入口 | 看板编辑 `DashboardEditWorkspace` → `CanvasEditToolbar` → `WidgetPalette`；Inspector 数据 Tab → `ChartDataSlots` |
| 状态说明 | **REAL** = L3 UI 集成 + L1 smoke + L2 plan + perType parity + 过滤链（Wave 0.2）+ 走查矩阵登记 |
| 关联 | [`2026-08-05-chart-catalog-full-de-truth-audit.md`](./2026-08-05-chart-catalog-full-de-truth-audit.md) · [`2026-07-21-chart-per-type-verification.md`](../automate/plans/2026-07-21-chart-per-type-verification.md) |

> **走查方法**：Vitest jsdom 挂载 `ChartDataSlots` 断言 DE 槽位文案（T-INSP-UI）；L1 由 `charts.smoke.test.tsx` 挂载 `ChartRenderer`；L2 由 `chartCatalogData.test.ts` + `perType/*.parity.test.ts`；过滤链由 `chartExecuteProbe.test.ts` GAP-FILTER-CHAIN。截图路径占位：`.dev/walkthrough/chart-catalog/{chartType}.png`（P2 可补真机截图）。

---

## Wave 0.2 · 过滤验证模板

适用于任意 `chartType`（以 `line` 为试点，见 [`per-type/line.md`](./per-type/line.md)）：

| 步 | 操作 | 期望 | 自动化证据 |
|----|------|------|------------|
| F-1 | Inspector 数据 Tab →「过滤」→ 添加行：`field=region_name` · `operator=eq` · `value=华东` | 过滤行写入 `chartConfig.filters[]` | `ChartDataSlots.deParity` 过滤区可见 |
| F-2 | SQL 模式：`sql` 含 `WHERE region_name = {{filter_region_name_0}}` | 占位符与 field 名对应 | `buildFilterParameters` 产出 `filter_region_name_0` |
| F-3 | 点击「更新图表数据」/ 触发 `fetchChartExecuteResult` | 请求 body 中 SQL 已替换为字面量（无 `{{…}}`） | `chartExecuteProbe.test.ts` · `injects filter parameters into SQL body` |
| F-4 | 对比无过滤 vs 有过滤 execute 结果 | 行数/行内容变化；`chartExecuteBindingKey` 随 filters 变化 | `filtered execute result yields different render row count` |
| F-5 | `buildChartRenderModel(config, columns, filteredRows)` | 渲染模型反映过滤后数据集 | `line.parity.test.ts` L1 + GAP-FILTER-CHAIN 集成用例 |

**手工补证（可选 P2）**：看板编辑真机重复 F-1–F-4，截图保存至 `.dev/walkthrough/chart-catalog/{chartType}-filter.png`。

---

## 走查矩阵（44 行）

| # | chartType | palette 路径 | fixture 引用 | L3 槽位证据 | L1 渲染证据 | L2 编码证据 | 截图 | 状态 |
|---|-----------|--------------|--------------|-------------|-------------|-------------|------|------|
| 1 | `gauge` | CanvasEditToolbar → WidgetPalette → **quota** | `chartCatalogSmokeFixtures.ts` · F7 · `value=86.5` | T-INSP-UI gauge | T-VIZ-R30-001 · `d3-gauge-chart` | `perType/gauge.parity.test.ts` | `.dev/walkthrough/chart-catalog/gauge.png` | **REAL** |
| 2 | `liquid` | CanvasEditToolbar → WidgetPalette → **quota** | F7 · `value=0.72` | T-INSP-UI liquid | T-VIZ-R30-001 · `d3-liquid-chart` | `perType/liquid.parity.test.ts` | `.dev/walkthrough/chart-catalog/liquid.png` | **REAL** |
| 3 | `kpi` | CanvasEditToolbar → WidgetPalette → **quota** | F7 · `revenue`+`rate` | T-INSP-UI kpi | T-VIZ-R30-001 · `d3-kpi-chart` | `perType/kpi.parity.test.ts` | `.dev/walkthrough/chart-catalog/kpi.png` | **REAL** |
| 4 | `table-info` | CanvasEditToolbar → WidgetPalette → **table** | F5 · `id`+`name` 明细 | T-INSP-UI table-info | T-VIZ-R30-001 · `d3-table-chart` | `perType/table-info.parity.test.ts` | `.dev/walkthrough/chart-catalog/table-info.png` | **REAL** |
| 5 | `table-normal` | CanvasEditToolbar → WidgetPalette → **table** | F5 · `region`+`amount` | T-INSP-UI table-normal | T-VIZ-R30-001 · `d3-table-chart` | `perType/table-normal.parity.test.ts` | `.dev/walkthrough/chart-catalog/table-normal.png` | **REAL** |
| 6 | `table-pivot` | CanvasEditToolbar → WidgetPalette → **table** | F5 · `row_dim`+`col_dim`+`amount` | T-INSP-UI table-pivot | T-VIZ-R30-001 · `d3-table-chart` | `perType/table-pivot.parity.test.ts` | `.dev/walkthrough/chart-catalog/table-pivot.png` | **REAL** |
| 7 | `t-heatmap` | CanvasEditToolbar → WidgetPalette → **table** | F6 · `x_dim`+`y_dim`+`value` | T-INSP-UI t-heatmap | T-VIZ-R30-001 · `d3-heatmap-chart` | `perType/t-heatmap.parity.test.ts` | `.dev/walkthrough/chart-catalog/t-heatmap.png` | **REAL** |
| 8 | `line` | CanvasEditToolbar → WidgetPalette → **trend** | F1 · `sale_date`+`amount` | T-INSP-UI line | T-VIZ-R30-001 · `d3-line-chart` | `perType/line.parity.test.ts` · [试点](./per-type/line.md) | `.dev/walkthrough/chart-catalog/line.png` | **REAL** |
| 9 | `area` | CanvasEditToolbar → WidgetPalette → **trend** | F1 · `sale_date`+`amount` | T-INSP-UI area | T-VIZ-R30-001 · `d3-area-chart` | `perType/area.parity.test.ts` | `.dev/walkthrough/chart-catalog/area.png` | **REAL** |
| 10 | `area-stack` | CanvasEditToolbar → WidgetPalette → **trend** | F1 · `sale_date`+`region`+`amount` | T-INSP-UI area-stack | T-VIZ-R30-001 · `d3-area-chart` | `perType/area-stack.parity.test.ts` | `.dev/walkthrough/chart-catalog/area-stack.png` | **REAL** |
| 11 | `bar` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · `sale_date`+`amount` | T-INSP-UI bar | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar.png` | **REAL** |
| 12 | `bar-stack` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · `sale_date`+`region`+`amount` | T-INSP-UI bar-stack | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar-stack.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-stack.png` | **REAL** |
| 13 | `percentage-bar-stack` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · 子类别堆叠 | T-INSP-UI percentage-bar-stack | T-VIZ-R30-001 · `d3-bar-chart` | `perType/percentage-bar-stack.parity.test.ts` | `.dev/walkthrough/chart-catalog/percentage-bar-stack.png` | **REAL** |
| 14 | `bar-group` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · `region` 分组 | T-INSP-UI bar-group | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar-group.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-group.png` | **REAL** |
| 15 | `bar-group-stack` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · 分组堆叠 | T-INSP-UI bar-group-stack | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar-group-stack.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-group-stack.png` | **REAL** |
| 16 | `waterfall` | CanvasEditToolbar → WidgetPalette → **compare** | `stage`+`value` | T-INSP-UI waterfall | T-VIZ-R30-001 · `d3-waterfall-chart` | `perType/waterfall.parity.test.ts` | `.dev/walkthrough/chart-catalog/waterfall.png` | **REAL** |
| 17 | `bar-horizontal` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · 横向柱 | T-INSP-UI bar-horizontal | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar-horizontal.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-horizontal.png` | **REAL** |
| 18 | `bar-stack-horizontal` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · 横向堆叠 | T-INSP-UI bar-stack-horizontal | T-VIZ-R30-001 · `d3-bar-chart` | `perType/bar-stack-horizontal.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-stack-horizontal.png` | **REAL** |
| 19 | `percentage-bar-stack-horizontal` | CanvasEditToolbar → WidgetPalette → **compare** | F1 · 横向百分比 | T-INSP-UI percentage-bar-stack-horizontal | T-VIZ-R30-001 · `d3-bar-chart` | `perType/percentage-bar-stack-horizontal.parity.test.ts` | `.dev/walkthrough/chart-catalog/percentage-bar-stack-horizontal.png` | **REAL** |
| 20 | `bar-range` | CanvasEditToolbar → WidgetPalette → **compare** | `cat`+`low`+`high` | T-INSP-UI bar-range | T-VIZ-R30-001 · `d3-bar-range-chart` | `perType/bar-range.parity.test.ts` | `.dev/walkthrough/chart-catalog/bar-range.png` | **REAL** |
| 21 | `bidirectional-bar` | CanvasEditToolbar → WidgetPalette → **compare** | `cat`+`left`+`right` | T-INSP-UI bidirectional-bar | T-VIZ-R30-001 · `d3-bidirectional-bar-chart` | `perType/bidirectional-bar.parity.test.ts` | `.dev/walkthrough/chart-catalog/bidirectional-bar.png` | **REAL** |
| 22 | `progress-bar` | CanvasEditToolbar → WidgetPalette → **compare** | `cat`+`target`+`current` | T-INSP-UI progress-bar | T-VIZ-R30-001 · `d3-progress-bar-chart` | `perType/progress-bar.parity.test.ts` | `.dev/walkthrough/chart-catalog/progress-bar.png` | **REAL** |
| 23 | `stock-line` | CanvasEditToolbar → WidgetPalette → **compare** | F8 · OHLC 四价 | T-INSP-UI stock-line | T-VIZ-R30-001 · `d3-stock-chart` | `perType/stock-line.parity.test.ts` | `.dev/walkthrough/chart-catalog/stock-line.png` | **REAL** |
| 24 | `bullet-graph` | CanvasEditToolbar → WidgetPalette → **compare** | F9 · `actual`+`target` | T-INSP-UI bullet-graph | T-VIZ-R30-001 · `d3-bullet-chart` | `perType/bullet-graph.parity.test.ts` | `.dev/walkthrough/chart-catalog/bullet-graph.png` | **REAL** |
| 25 | `pie` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 · `region`+`amount` | T-INSP-UI pie | T-VIZ-R30-001 · `d3-pie-chart` | `perType/pie.parity.test.ts` | `.dev/walkthrough/chart-catalog/pie.png` | **REAL** |
| 26 | `pie-donut` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 | T-INSP-UI pie-donut | T-VIZ-R30-001 · `d3-pie-chart` | `perType/pie-donut.parity.test.ts` | `.dev/walkthrough/chart-catalog/pie-donut.png` | **REAL** |
| 27 | `pie-rose` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 | T-INSP-UI pie-rose | T-VIZ-R30-001 · `d3-pie-chart` | `perType/pie-rose.parity.test.ts` | `.dev/walkthrough/chart-catalog/pie-rose.png` | **REAL** |
| 28 | `pie-donut-rose` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 | T-INSP-UI pie-donut-rose | T-VIZ-R30-001 · `d3-pie-chart` | `perType/pie-donut-rose.parity.test.ts` | `.dev/walkthrough/chart-catalog/pie-donut-rose.png` | **REAL** |
| 29 | `radar` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 | T-INSP-UI radar | T-VIZ-R30-001 · `d3-radar-chart` | `perType/radar.parity.test.ts` | `.dev/walkthrough/chart-catalog/radar.png` | **REAL** |
| 30 | `treemap` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 | T-INSP-UI treemap | T-VIZ-R30-001 · `d3-treemap-chart` | `perType/treemap.parity.test.ts` | `.dev/walkthrough/chart-catalog/treemap.png` | **REAL** |
| 31 | `word-cloud` | CanvasEditToolbar → WidgetPalette → **distribute** | F2 · 词+权重 | T-INSP-UI word-cloud | T-VIZ-R30-001 · `d3-word-cloud-chart` | `perType/word-cloud.parity.test.ts` | `.dev/walkthrough/chart-catalog/word-cloud.png` | **REAL** |
| 32 | `map` | CanvasEditToolbar → WidgetPalette → **map** | F3 · 省名+`value` | T-INSP-UI map | T-VIZ-R30-001 · `d3-map-chart` | `perType/map.parity.test.ts` | `.dev/walkthrough/chart-catalog/map.png` | **REAL** |
| 33 | `map-3d` | CanvasEditToolbar → WidgetPalette → **map** | F3 · WebGL/降级 | T-INSP-UI map-3d | T-VIZ-R30-001 · `three-map-chart` | `perType/map-3d.parity.test.ts` | `.dev/walkthrough/chart-catalog/map-3d.png` | **REAL** |
| 34 | `scatter` | CanvasEditToolbar → WidgetPalette → **relation** | F1 简化 · `category`+`value` | T-INSP-UI scatter | T-VIZ-R30-001 · `d3-scatter-chart` | `perType/scatter.parity.test.ts` | `.dev/walkthrough/chart-catalog/scatter.png` | **REAL** |
| 35 | `quadrant` | CanvasEditToolbar → WidgetPalette → **relation** | `series`+`x`+`y` | T-INSP-UI quadrant | T-VIZ-R30-001 · `d3-quadrant-chart` | `perType/quadrant.parity.test.ts` | `.dev/walkthrough/chart-catalog/quadrant.png` | **REAL** |
| 36 | `funnel` | CanvasEditToolbar → WidgetPalette → **relation** | `stage`+`cnt` | T-INSP-UI funnel | T-VIZ-R30-001 · `d3-funnel-chart` | `perType/funnel.parity.test.ts` | `.dev/walkthrough/chart-catalog/funnel.png` | **REAL** |
| 37 | `sankey` | CanvasEditToolbar → WidgetPalette → **relation** | F4 · `source`+`target`+`weight` | T-INSP-UI sankey | T-VIZ-R30-001 · `d3-sankey-chart` | `perType/sankey.parity.test.ts` | `.dev/walkthrough/chart-catalog/sankey.png` | **REAL** |
| 38 | `circle-packing` | CanvasEditToolbar → WidgetPalette → **relation** | F2 | T-INSP-UI circle-packing | T-VIZ-R30-001 · `d3-circle-packing-chart` | `perType/circle-packing.parity.test.ts` | `.dev/walkthrough/chart-catalog/circle-packing.png` | **REAL** |
| 39 | `multi-scatter` | CanvasEditToolbar → WidgetPalette → **relation** | `color`+`x`+`y` | T-INSP-UI multi-scatter | T-VIZ-R30-001 · `d3-scatter-chart` | `perType/multi-scatter.parity.test.ts` | `.dev/walkthrough/chart-catalog/multi-scatter.png` | **REAL** |
| 40 | `graph` | CanvasEditToolbar → WidgetPalette → **relation** | F4 · `source`+`target` | T-INSP-UI graph | T-VIZ-R30-001 · `d3-graph-chart` | `perType/graph.parity.test.ts` | `.dev/walkthrough/chart-catalog/graph.png` | **REAL** |
| 41 | `chart-mix` | CanvasEditToolbar → WidgetPalette → **dual_axes** | F1 · 双指标 `amount`+`amount2` | T-INSP-UI chart-mix | T-VIZ-R30-001 · `d3-dual-axes-chart` | `perType/chart-mix.parity.test.ts` | `.dev/walkthrough/chart-catalog/chart-mix.png` | **REAL** |
| 42 | `chart-mix-group` | CanvasEditToolbar → WidgetPalette → **dual_axes** | F1 · 子类别+双指 | T-INSP-UI chart-mix-group | T-VIZ-R30-001 · `d3-dual-axes-chart` | `perType/chart-mix-group.parity.test.ts` | `.dev/walkthrough/chart-catalog/chart-mix-group.png` | **REAL** |
| 43 | `chart-mix-stack` | CanvasEditToolbar → WidgetPalette → **dual_axes** | F1 · 堆叠+双指 | T-INSP-UI chart-mix-stack | T-VIZ-R30-001 · `d3-dual-axes-chart` | `perType/chart-mix-stack.parity.test.ts` | `.dev/walkthrough/chart-catalog/chart-mix-stack.png` | **REAL** |
| 44 | `chart-mix-dual-line` | CanvasEditToolbar → WidgetPalette → **dual_axes** | F1 · 双线 | T-INSP-UI chart-mix-dual-line | T-VIZ-R30-001 · `d3-dual-axes-chart` · `renderDualAxes.test.ts` 图例 | `perType/chart-mix-dual-line.parity.test.ts` | `.dev/walkthrough/chart-catalog/chart-mix-dual-line.png` | **REAL** |

---

## 汇总

| 指标 | 值 |
|------|-----|
| 活跃型走查行 | **44/44** |
| **REAL** 判定 | **44/44** |
| perType parity | **44/44** · `perType/*.parity.test.ts`（132 tests） |
| 过滤链 Wave 0.2 | ✅ · `chartExecuteProbe.test.ts` GAP-FILTER-CHAIN |
| 截图占位 | `.dev/walkthrough/chart-catalog/{chartType}.png`（P2 真机补图） |
| 空数据 R-03 | **44/44** · `T-VIZ-R30-002` |
| DE 槽位 golden | **44/44** · `chartFieldSlots.catalogGolden.test.ts` · T-INSP-DE-GOLDEN |

**P2 待补**：真机 `/admin/charts/explore` 逐型 PNG 截图；样式 Tab T7（300ms 预览变化）见 GAP-STYLE（不阻断 REAL）。
