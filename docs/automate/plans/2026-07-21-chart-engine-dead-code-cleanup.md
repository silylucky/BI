# 图表引擎死代码清理 — PR 分批清单

> 状态：2026-07-21 · 主路径已 D3 单轨；本文档指导剩余清理 PR 顺序。

## 目标架构

```text
ChartRenderer → CanvasChartHost → ChartEngineView → D3ViewRouter
  ├─ D3CanvasView（柱线饼/关系/指标…）
  ├─ D3GeoMapView（地图）
  └─ D3TableView（明细/汇总/透视）
```

真理源：`metadata.ts`（`library: "d3"`）· `buildPlanForType` · `renderDispatch.ts`

---

## PR-1 ✅ 下架运行时死代码（本批已做）

| 项 | 动作 |
|----|------|
| `engine/echarts/` 渲染层 | 删除整目录 |
| `engine/antv/s2/` | 删除整目录 |
| `engine/antv/g2/` | 删除整目录 |
| `AdvancedEchartsChart` / `renderFromSpec` / `KpiCard` | 删除 |
| `lib/echarts-*` 重导出 | 删除 |
| 地理工具 | 迁至 `engine/geo/geoMapChart.ts` · `geoMapLevels.ts` |
| `getFallbackChartType` | 迁至 `lib/chartFallback.ts` |
| `@antv/s2` / `@antv/s2-react` | 从 `package.json` 移除 |
| ECharts 专属 smoke | 从 `charts.advanced.smoke.test.tsx` 移除 |

**验收**：`pnpm test` · `node scripts/check-chart-engine.mjs` · 看板明细/汇总/透视/地图 smoke 通过。

---

## PR-2 ✅ 命名与类型债（本批已做）

| 项 | 动作 | 风险 |
|----|------|------|
| `AntvEngineView` | 重命名为 `ChartEngineView` | 低 |
| `AntvRenderPlan` / `buildAntvRenderPlan` | 重命名为 `ChartRenderPlan` / `buildChartRenderPlan` | 中（面广） |
| `CanvasChartHost` | 保留或合并进 `ChartEngineView` | 低 |
| `ChartEngineId` | 移除 `"echarts"` · `"kpi"` 遗留 | 低 |
| `ChartLibrary` | 收窄为 `"d3" \| "react"` | 低 |
| `AntvPlotKind` | 移除 `g2plot` / `g6` / `s2` 分支 | 低 |
| `applyChartStyleChain` | 删除 `g2plot` 死分支 | 低 |
| `registry` engine 对外名 `"antv"` | 评估改为 `"d3"` 或 `"canvas"` | 中（API/测试） |

**验收**：`pnpm test` · `node scripts/check-chart-engine.mjs` · 图表 registry / resolveRenderSpec 测试通过。

---

## PR-2（续）registry engine 对外名（建议下一批）

## PR-3 ✅ 地理引擎收口（本批已做）

| 项 | 动作 |
|----|------|
| `echartsGeoEngine` | 重命名为 `legacyGeoOptionEngine`（`echartsGeoEngine` 保留 deprecated 别名） |
| `geoMapChart.ts` 内 ECharts option 构建函数 | 保留供 legacy 引擎与单测；生产路径走 `offlineGeoEngine` |
| `AntvGeoPlaceholderView` | 迁至 `engine/geo/GeoMapPlaceholderView.tsx` |
| `OfflineGeoAntVPort` | 重命名为 `OfflineGeoPort`（`antvGeoEngine` → `offlineGeoEngine` / `activeGeoEngine`） |
| `geoMapLevels` glob | 修正市/区县 GeoJSON `import.meta.glob` 路径（`../../../../assets`） |

**验收**：`node scripts/check-chart-engine.mjs` · 图表/geo smoke 通过。

---

## PR-4 ✅ 文档与门禁（本批已做）

| 项 | 动作 |
|----|------|
| `components/README.md` | 更新图表引擎表 |
| `engine/README.md` · `engine/d3/README.md` · `engine/antv/README.md` | 反映 D3 单轨与无 S2 |
| `docs/automate/plans/2026-07-21-d3-full-chart-migration.md` | 标记 S2/ECharts 已清理 |
| `check-chart-engine.mjs` | 禁止 `engine/echarts` · `engine/antv/s2` · `engine/antv/g2` 目录复活 |
| legacy `table`（react） | 引导迁移后删除 `EmbeddedChartTable` 薄壳（单独 PR） |

---

## PR-5 ✅ 测试债（本批已做）

| 项 | 动作 |
|----|------|
| mock catalog `renderer: "echarts"` | 改为 `antv` |
| `ChartEditRail` / `theme-analysis` 的 `echarts-for-react` mock | 删除 |
| `resolveRenderSpec.test` engine 字段 | 更新为 `antv`（PR-2） |
| `geoMapChart.test` 内 ECharts option 用例 | 保留占位构建 |
| `T-VIZ-R43-006-02` embed 预览 | 补全 validate + token 双次 mock |

---

## 明确不清理（保留）

| 模块 | 原因 |
|------|------|
| `engine/antv/spec/encode*.ts` | D3 plan 数据编码 |
| `engine/antv/theme.ts` | D3 主题 token |
| `engine/buildChartRenderPlan.ts` | Plan 构建入口 |
| `engine/geo/geoMapChart.ts` | 离线地图 join/占位（非 ECharts 运行时） |
| legacy `table` → `table-info` 迁移 | 存量配置兼容，单独 PR |

---

## 合并顺序建议

```text
PR-1 ✅ → PR-2 ✅ → PR-3 ✅ → PR-4 ✅ → PR-5 ✅
```

后续可选：legacy `table` react 薄壳删除 · registry `engine` 对外名 `"d3"` 评估。
