# Per-Type Truth: `line`（REAL 试点）

| 字段 | 值 |
|------|-----|
| chartType | `line` |
| 日期 | 2026-08-05 |
| 判定 | **REAL** |
| 专属检查 | MULTI_DIM 8 维类别轴 · 子类别拆系列 · 过滤→query 链 |
| 深审 | [`2026-08-05-line-de-parity-truth-audit.md`](../2026-08-05-line-de-parity-truth-audit.md) |

> **试点说明**：`line` 为 Wave 0–10 全量 REAL 的参考型——笛卡尔 MULTI_DIM、L2 plan 编码、L1 渲染、Inspector 过滤链与 perType 单型门禁均在此型先闭合，再复制到其余 43 型。

## SOP 清单

| 步 | 项 | 状态 | 证据 |
|----|-----|------|------|
| 1 | DE 槽位审计 | ✅ | `getDeAxisBlueprint("line")` · `ChartDataSlots.deParity` · T-INSP-UI |
| 2 | L3 输入 | ✅ | `chartFieldSlots.test.ts` T-INSP-DE-golden · `deriveFieldRuleFromDeCatalog` 1–8 维 |
| 3 | L2 编码 | ✅ | `perType/line.parity.test.ts` · `chartCatalogData.test.ts` T-VIZ-R31-001 |
| 4 | L1 渲染 | ✅ | `charts.smoke.test.tsx` T-VIZ-R30-001 · `d3-line-chart` |
| 5 | 样式 Tab | ✅ | `applyChartStyleChain.test.ts` · trend 族 profile |
| 6 | 过滤链 | ✅ | `chartExecuteProbe.test.ts` · **GAP-FILTER-CHAIN**（Wave 0.2） |
| 7 | perType 自动化 | ✅ | `perType/line.parity.test.ts`（3 tests） |
| 8 | BROWSER REAL | ✅ | walkthrough #8 · 截图 `.dev/walkthrough/chart-catalog/line.png` |

## 关键链路（可复验）

### Wave 0.1 · MULTI_DIM 类别轴

- **槽位**：`chartDeAxis/builders.ts` · `MULTI_DIM_OPTS` → 类别轴 1–8 维
- **编码**：`buildDatasetEncoding.ts` · `resolveCartesianAxisFields` / `compositeCategoryKey` / `buildCartesianCategorySeries`
- **断言**：`buildDatasetEncoding.test.ts` · `encodeCartesian.test.ts`（`composites multiple xAxis fields (MULTI_DIM)`）
- **plan**：`line.parity.test.ts` L2 用例 · `assertPlanMatchesFixture` + F1 夹具

### Wave 0.2 · 过滤→query→渲染

- Inspector「过滤」槽 → `buildFilterParameters` → SQL `{{filter_*}}` 占位符替换
- **断言**：`chartExecuteProbe.test.ts` · `describe("GAP-FILTER-CHAIN")`：
  - `buildFilterParameters maps ChartConfigPanel filter rows to SQL placeholders`
  - `fetchChartExecuteResult injects filter parameters into SQL body`
  - `filtered execute result yields different render row count than unfiltered`

### L2/L1 单型门禁

```bash
cd fe && pnpm exec vitest run src/components/charts/perType/line.parity.test.ts
```

| 用例 | 层级 | 断言要点 |
|------|------|----------|
| `L3: DE axis blueprint is registered` | L3 | 槽位非空 · fieldRule minMetrics |
| `L2: buildPlan encodes §2 fixture (MULTI_DIM…)` | L2 | plan 与 smoke 夹具一致 |
| `L1: render model ready for fixture rows` | L1 | `buildChartRenderModel` → `ready` / `table` |

## 差距 / 备注

- **无阻塞差距**（REAL）
- GAP-MAX-DIM 笛卡尔 waiver 已于 Wave 0.1 解除（`chartCatalogFieldRuleWaivers.ts` 注释）
- 样式 Tab T7 逐控件 BROWSER 仍为 P2 增强项（不阻断 REAL 判定）
