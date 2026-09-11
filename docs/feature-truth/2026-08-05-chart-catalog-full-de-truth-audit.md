# Feature Truth Audit: 图表目录全量 DataEase 对齐（44 活跃 + 5 MIG）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | **44** 活跃 `chartType` + **5** deprecated MIG 型；对标 DataEase：L3 字段槽 / L2 编码 / L1 渲染 / Inspector UI |
| 锚点 | `fe/src/components/charts/engine/plugins/metadata.ts` · `chartCatalogSmokeFixtures.ts` · `chartFieldSlots.ts` · `chartCatalogFieldRuleWaivers.ts` · `perType/*.parity.test.ts` |
| 总体判定 | **REAL** |
| **总分 / 档位** | **9/10 · A** |
| 状态 | verified |
| **sampling** | `full`（49 型逐行 §3d；自动化全量参数化 + 44 perType parity） |

> 用户问「44 型是否全部实现可用」→ **是**。Wave 0–10 闭合：MULTI_DIM 笛卡尔 8 维（Wave 0.1）、过滤→query 链（Wave 0.2）、44 型 `perType/*.parity.test.ts`（Wave 1–10）。`pnpm run test:chart-catalog` **506 passed**（catalog ~374 + perType 132）。  
> REAL 试点：[`per-type/line.md`](./per-type/line.md) · 深审：[`2026-08-05-line-de-parity-truth-audit.md`](./2026-08-05-line-de-parity-truth-audit.md)

## 1. 基线与门禁

| 命令 | 结果 | 日期 |
|------|------|------|
| `cd fe && pnpm run test:chart-catalog` | **506 passed**（77 files） | 2026-08-05 |
| `pytest tests/test_viz_chart_catalog_parity.py -q` | **4 passed** | 2026-08-05 |

**门禁覆盖包**（`fe/package.json` · `test:chart-catalog`）：

- L1：`charts.smoke.test.tsx` · `T-VIZ-R30-001/002`
- L2：`chartCatalogData.test.ts` · `T-VIZ-R31-001` · `perType/*.parity.test.ts`
- L3：`chartCatalogFieldRules.test.ts` · `T-VIZ-R32-001`–`014`
- UI：`ChartDataSlots.deParity.test.tsx` · `T-INSP-UI`
- Golden：`chartFieldSlots.catalogGolden.test.ts` · `T-INSP-DE-GOLDEN` / `T-INSP-DE-MIG`
- MIG：`chartCatalogMigration.test.ts` · `T-VIZ-R33-001/002`
- MULTI_DIM：`buildDatasetEncoding.test.ts` · `encodeCartesian.test.ts`
- 过滤链：`chartExecuteProbe.test.ts` · GAP-FILTER-CHAIN
- 双轴图例：`renderDualAxes.test.ts` · dual-line legend
- BE↔FE：`catalogParity.test.ts` + `test_viz_chart_catalog_parity.py`

## 2. 系统性差距（跨型）

| Gap ID | 描述 | 影响 | 锚点 | Phase | 状态 |
|--------|------|------|------|-------|------|
| **GAP-MAX-DIM** | DE 笛卡尔类别轴 1–8 维；FE `MULTI_DIM_OPTS` + `buildDatasetEncoding` 复合类别键 | 曾阻塞 24 型 REAL | `chartDeAxis/builders.ts` · `buildDatasetEncoding.ts` · `encodeCartesian.test.ts` | Wave 0.1 | **RESOLVED**（笛卡尔）；9 型仍保留 signed waiver 仅作槽位计数 bookkeeping，L1/L2/L3 链 REAL |
| **GAP-MAX-TEST** | max 维不对齐经 **signed waiver** 门禁，min 仍严格相等 | 非假绿；waiver 显式记录 | `FIELD_RULE_MAX_WAIVERS` · `T-VIZ-R32-011` min · `T-VIZ-R32-014` max | 当前 | 维持（9 型 waiver 备注） |
| **GAP-STYLE** | 样式 Tab 控件→预览 T7 未 44 型 BROWSER 逐控件验 | 数据 REAL ≠ 样式逐控件 REAL | `chartStyleAuditMatrix.ts` · [07-30 样式审计](./2026-07-30-component-style-per-type-truth-audit.md) | P2 | 开放 |
| **GAP-FILTER-CHAIN** | Inspector「过滤」槽 → SQL 占位符 → execute → render model | 曾阻塞 L3 FIELD 子项 | `chartExecuteProbe.test.ts` · `ChartDataSlots` filters section | Wave 0.2 | **RESOLVED** |

**waiver 备注（判定仍为 REAL）**：`kpi` · `table-info` / `table-normal` / `table-pivot` · `map` / `map-3d` · `scatter` · `quadrant` · `multi-scatter` 在 `FIELD_RULE_MAX_WAIVERS` 有 signed max 差异说明；不影响 L1/L2/L3 链路与 perType parity。

## 3. §3d 覆盖矩阵（49 行 · 一型一行）

图例：

- **深度**：`L3·CHAIN` / `L2·CHAIN` / `L1·CHAIN` = vitest 参数化链路断言
- **UI**：`ChartDataSlots.deParity` · T-INSP-UI
- **BROWSER**：[`2026-08-05-chart-browser-walkthrough-log.md`](./2026-08-05-chart-browser-walkthrough-log.md) · **REAL**
- **per-type**：[`./per-type/{chartType}.md`](./per-type/_template.md)

### 3.1 指标（quota）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `gauge` | quota | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #1 | **REAL** | [`./per-type/gauge.md`](./per-type/gauge.md) · `perType/gauge.parity.test.ts` · `chartCatalogData.test.ts` · `charts.smoke.test.tsx` |
| `liquid` | quota | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #2 | **REAL** | [`./per-type/liquid.md`](./per-type/liquid.md) · `perType/liquid.parity.test.ts` · 标准 L3/L2/L1 套件 |
| `kpi` | quota | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #3 | **REAL** | [`./per-type/kpi.md`](./per-type/kpi.md) · `perType/kpi.parity.test.ts` · signed waiver GAP-MAX-DIM（metric-only slot） |

### 3.2 表格（table）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `table-info` | table | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #4 | **REAL** | [`./per-type/table-info.md`](./per-type/table-info.md) · `perType/table-info.parity.test.ts` · waiver GAP-TABLE-DRILL-COUNT |
| `table-normal` | table | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #5 | **REAL** | [`./per-type/table-normal.md`](./per-type/table-normal.md) · `perType/table-normal.parity.test.ts` · waiver GAP-TABLE-DRILL-COUNT |
| `table-pivot` | table | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #6 | **REAL** | [`./per-type/table-pivot.md`](./per-type/table-pivot.md) · `perType/table-pivot.parity.test.ts` · waiver GAP-MAX-DIM（pivot 槽语义） |
| `t-heatmap` | table | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #7 | **REAL** | [`./per-type/t-heatmap.md`](./per-type/t-heatmap.md) · `perType/t-heatmap.parity.test.ts` · 标准 L3/L2/L1 套件 |

### 3.3 趋势（trend）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `line` | trend | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #8 | **REAL** | [`./per-type/line.md`](./per-type/line.md) · **REAL 试点** · MULTI_DIM · GAP-FILTER-CHAIN · [line 深审](./2026-08-05-line-de-parity-truth-audit.md) |
| `area` | trend | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #9 | **REAL** | [`./per-type/area.md`](./per-type/area.md) · `perType/area.parity.test.ts` · MULTI_DIM |
| `area-stack` | trend | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #10 | **REAL** | [`./per-type/area-stack.md`](./per-type/area-stack.md) · `perType/area-stack.parity.test.ts` · MULTI_DIM |

### 3.4 对比（compare）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `bar` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #11 | **REAL** | [`./per-type/bar.md`](./per-type/bar.md) · `perType/bar.parity.test.ts` · MULTI_DIM |
| `bar-stack` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #12 | **REAL** | [`./per-type/bar-stack.md`](./per-type/bar-stack.md) · `perType/bar-stack.parity.test.ts` |
| `percentage-bar-stack` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #13 | **REAL** | [`./per-type/percentage-bar-stack.md`](./per-type/percentage-bar-stack.md) · `perType/percentage-bar-stack.parity.test.ts` |
| `bar-group` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #14 | **REAL** | [`./per-type/bar-group.md`](./per-type/bar-group.md) · `perType/bar-group.parity.test.ts` |
| `bar-group-stack` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #15 | **REAL** | [`./per-type/bar-group-stack.md`](./per-type/bar-group-stack.md) · `perType/bar-group-stack.parity.test.ts` |
| `waterfall` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #16 | **REAL** | [`./per-type/waterfall.md`](./per-type/waterfall.md) · `perType/waterfall.parity.test.ts` |
| `bar-horizontal` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #17 | **REAL** | [`./per-type/bar-horizontal.md`](./per-type/bar-horizontal.md) · `perType/bar-horizontal.parity.test.ts` |
| `bar-stack-horizontal` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #18 | **REAL** | [`./per-type/bar-stack-horizontal.md`](./per-type/bar-stack-horizontal.md) · `perType/bar-stack-horizontal.parity.test.ts` |
| `percentage-bar-stack-horizontal` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #19 | **REAL** | [`./per-type/percentage-bar-stack-horizontal.md`](./per-type/percentage-bar-stack-horizontal.md) · `perType/percentage-bar-stack-horizontal.parity.test.ts` |
| `bar-range` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #20 | **REAL** | [`./per-type/bar-range.md`](./per-type/bar-range.md) · `perType/bar-range.parity.test.ts` · `chartCatalogPlanAssertions.ts` |
| `bidirectional-bar` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #21 | **REAL** | [`./per-type/bidirectional-bar.md`](./per-type/bidirectional-bar.md) · `perType/bidirectional-bar.parity.test.ts` |
| `progress-bar` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #22 | **REAL** | [`./per-type/progress-bar.md`](./per-type/progress-bar.md) · `perType/progress-bar.parity.test.ts` |
| `stock-line` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #23 | **REAL** | [`./per-type/stock-line.md`](./per-type/stock-line.md) · `perType/stock-line.parity.test.ts` · F8 OHLC |
| `bullet-graph` | compare | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #24 | **REAL** | [`./per-type/bullet-graph.md`](./per-type/bullet-graph.md) · `perType/bullet-graph.parity.test.ts` · F9 |

### 3.5 分布（distribute）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `pie` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #25 | **REAL** | [`./per-type/pie.md`](./per-type/pie.md) · `perType/pie.parity.test.ts` · `encodeNonCartesian.test.ts` |
| `pie-donut` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #26 | **REAL** | [`./per-type/pie-donut.md`](./per-type/pie-donut.md) · `perType/pie-donut.parity.test.ts` |
| `pie-rose` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #27 | **REAL** | [`./per-type/pie-rose.md`](./per-type/pie-rose.md) · `perType/pie-rose.parity.test.ts` |
| `pie-donut-rose` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #28 | **REAL** | [`./per-type/pie-donut-rose.md`](./per-type/pie-donut-rose.md) · `perType/pie-donut-rose.parity.test.ts` |
| `radar` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #29 | **REAL** | [`./per-type/radar.md`](./per-type/radar.md) · `perType/radar.parity.test.ts` |
| `treemap` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #30 | **REAL** | [`./per-type/treemap.md`](./per-type/treemap.md) · `perType/treemap.parity.test.ts` |
| `word-cloud` | distribute | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #31 | **REAL** | [`./per-type/word-cloud.md`](./per-type/word-cloud.md) · `perType/word-cloud.parity.test.ts` |

### 3.6 地图（map）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `map` | map | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #32 | **REAL** | [`./per-type/map.md`](./per-type/map.md) · `perType/map.parity.test.ts` · waiver GAP-MAP-DRILL · GEO-IRON-01 |
| `map-3d` | map | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #33 | **REAL** | [`./per-type/map-3d.md`](./per-type/map-3d.md) · `perType/map-3d.parity.test.ts` · `geoMap3d.audit.test.ts` · waiver GAP-MAP-DRILL |

### 3.7 关系/流程（relation）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `scatter` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #34 | **REAL** | [`./per-type/scatter.md`](./per-type/scatter.md) · `perType/scatter.parity.test.ts` · waiver GAP-MAX-DIM |
| `quadrant` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #35 | **REAL** | [`./per-type/quadrant.md`](./per-type/quadrant.md) · `perType/quadrant.parity.test.ts` · waiver GAP-MAX-DIM |
| `funnel` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #36 | **REAL** | [`./per-type/funnel.md`](./per-type/funnel.md) · `perType/funnel.parity.test.ts` |
| `sankey` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #37 | **REAL** | [`./per-type/sankey.md`](./per-type/sankey.md) · `perType/sankey.parity.test.ts` · `T-VIZ-R32-007` |
| `circle-packing` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #38 | **REAL** | [`./per-type/circle-packing.md`](./per-type/circle-packing.md) · `perType/circle-packing.parity.test.ts` |
| `multi-scatter` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #39 | **REAL** | [`./per-type/multi-scatter.md`](./per-type/multi-scatter.md) · `perType/multi-scatter.parity.test.ts` · waiver GAP-MAX-DIM |
| `graph` | relation | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #40 | **REAL** | [`./per-type/graph.md`](./per-type/graph.md) · `perType/graph.parity.test.ts` · `T-VIZ-R32-008` |

### 3.8 双轴（dual_axes）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `chart-mix` | dual_axes | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #41 | **REAL** | [`./per-type/chart-mix.md`](./per-type/chart-mix.md) · `perType/chart-mix.parity.test.ts` · `T-VIZ-R32-009` |
| `chart-mix-group` | dual_axes | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #42 | **REAL** | [`./per-type/chart-mix-group.md`](./per-type/chart-mix-group.md) · `perType/chart-mix-group.parity.test.ts` |
| `chart-mix-stack` | dual_axes | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #43 | **REAL** | [`./per-type/chart-mix-stack.md`](./per-type/chart-mix-stack.md) · `perType/chart-mix-stack.parity.test.ts` |
| `chart-mix-dual-line` | dual_axes | CHAIN / CHAIN / CHAIN | ✅ | walkthrough #44 | **REAL** | [`./per-type/chart-mix-dual-line.md`](./per-type/chart-mix-dual-line.md) · `perType/chart-mix-dual-line.parity.test.ts` · `renderDualAxes.test.ts` dual-line legend |

### 3.9 Deprecated MIG（5 型 · 仅迁移门禁）

| chartType | family | L3 / L2 / L1 深度 | UI | BROWSER | 判定 | 证据路径 |
|-----------|--------|-------------------|-----|---------|------|----------|
| `table` | table | GATE / — / — | — | — | **PARTIAL** | `chartCatalogMigration.test.ts` · T-VIZ-R33-002 → `table-info` |
| `timeline` | trend | GATE / — / — | — | — | **PARTIAL** | T-VIZ-R33-002 → `line` |
| `wordCloud` | distribute | GATE / — / — | — | — | **PARTIAL** | T-VIZ-R33-002 → `word-cloud` |
| `heatmap` | map | GATE / — / — | — | — | **PARTIAL** | T-VIZ-R33-002 → `t-heatmap` |
| `combo` | dual_axes | GATE / — / — | — | — | **PARTIAL** | T-VIZ-R33-002 → `chart-mix` |

> MIG 型 L3 **GATE** = `chartFieldSlots.catalogGolden.test.ts` · T-INSP-DE-MIG 槽位 label 与 DE catalog 一致。

---

## 4. 覆盖摘要

| 指标 | 值 |
|------|-----|
| §3d 总行数 | **49**（44 活跃 + 5 MIG） |
| L1 CHAIN（活跃） | **44/44** · T-VIZ-R30-001/002 |
| L2 CHAIN（活跃） | **44/44** · T-VIZ-R31-001 · perType parity |
| L3 CHAIN（活跃） | **44/44** · T-VIZ-R32-* |
| UI 集成（活跃） | **44/44** · T-INSP-UI |
| perType parity | **44/44** · 132 tests |
| BROWSER REAL | **44/44** · 走查日志 |
| **REAL 判定（活跃）** | **44/44** |
| signed waiver 备注 | **9/44**（kpi · table×3 · map×2 · scatter · quadrant · multi-scatter） |
| MIG PARTIAL | **5/5** |
| **逐一校验** | **是** — 506 vitest + 4 pytest |
| 总体 scope 可否 REAL | **是** — GAP-STYLE 为 P2 增强 |

### 判定汇总

| 档位 | 数量 | 说明 |
|------|------|------|
| **REAL** | **44** | 活跃型；L1/L2/L3 + perType + 过滤链 |
| PARTIAL（MIG） | 5 | 仅 migratesTo 门禁 |
| **总体** | — | **REAL**（9/10 · A） |

## 5. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ |
|------|------|------|------|--------|
| 1 | `pnpm run test:chart-catalog` | 全绿 | **506 passed** | ✅ |
| 2 | `pytest test_viz_chart_catalog_parity.py -q` | 4 passed | **4 passed** | ✅ |
| 3 | `chartCatalogSmokeFixtures.test.ts` | 44 型夹具一一对应 | **44/44** | ✅ |
| 4 | `perType/*.parity.test.ts` | 44 型 × 3 tests | **132 passed** | ✅ |
| 5 | Wave 0.1 MULTI_DIM | 复合类别键 + 子系列 | `buildDatasetEncoding.test.ts` · `encodeCartesian.test.ts` | ✅ |
| 6 | Wave 0.2 GAP-FILTER-CHAIN | 过滤→SQL→render | `chartExecuteProbe.test.ts` | ✅ |
| 7 | `renderDualAxes.test.ts` | dual-line 图例 | 左/右指标名 + extBubble | ✅ |
| 8 | 44 型样式 Tab BROWSER T7 | 逐控件预览变化 | **未执行** | ❌ GAP-STYLE（P2） |

## 6. 修复优先级

| 优先级 | Gap | 一句话 |
|--------|-----|--------|
| P0 | AUTO 门禁 | ✅ 506 + 4 pytest 已绿 |
| P0 | GAP-MAX-DIM 笛卡尔 | ✅ Wave 0.1 MULTI_DIM |
| P0 | GAP-FILTER-CHAIN | ✅ Wave 0.2 chartExecuteProbe |
| P0 | perType 44 型 | ✅ Wave 1–10 parity tests |
| P2 | GAP-STYLE | 44 型样式 section BROWSER T7 |
| P2 | BROWSER 截图 | `.dev/walkthrough/chart-catalog/*.png` 真机补图 |

## 7. 交接

- **数据链路（拖字段→出图→编码→过滤）**：44 型 **REAL**，见 §3d 与 [`per-type/`](./per-type/)
- **REAL 试点**：[`per-type/line.md`](./per-type/line.md)
- **P2 增强**：样式 Tab T7 · 真机截图（不阻断 REAL）
- 浏览器明细：[`2026-08-05-chart-browser-walkthrough-log.md`](./2026-08-05-chart-browser-walkthrough-log.md)
- 计划真理源：[`2026-07-21-chart-per-type-verification.md`](../automate/plans/2026-07-21-chart-per-type-verification.md)
