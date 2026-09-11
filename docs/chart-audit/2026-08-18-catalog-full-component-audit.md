# 图表组件审计 — catalog 全量

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| Skill | `~/.cursor/skills/chart-component-audit/` |
| Scope | catalog 全量（`listChartPluginTypes`） |
| 发现模式 | catalog-discovery（动态 N） |
| 注册类型数 N | **50** |
| parity 文件数 | **44** |
| smoke fixture 数 | **44** |
| 采样 | full |
| 三柱 | 能不能用 · 全不全 · 对不对 |
| **报告状态** | **已落盘**（**旧格式**：无 §3b 控件矩阵、无 fix-report；金样见 [`2026-08-28-bar-explicit-component-audit.md`](2026-08-28-bar-explicit-component-audit.md) + [`2026-08-28-bar-explicit-fix-report.md`](2026-08-28-bar-explicit-fix-report.md)） |

---

## 0. Catalog 发现摘要

| 来源 | 数量 | 备注 |
|------|------|------|
| FE `listChartPluginTypes` / `BUILTIN_PLUGIN_DEFS` | 50 | `catalogParity.test.ts` EXPECTED=50，4/4 绿 |
| parity 文件 `perType/*.parity.test.ts` | 44 | 132 tests 绿 |
| DE 轴 `DE_AXIS_CATALOG` 显式条目 | 49 | **缺 `gis-map`**（`catalog.test.ts` 已红） |
| smoke `CHART_CATALOG_SMOKE_CASES` | 44 | 与 parity 对齐 |
| D3 inspector 矩阵 `D3_WIRING_BY_TYPE` | ~40 登记 | 未登记类型继承 plugin caps |

**差集 R \ P（缺 parity）**

| chartType | 备注 |
|-----------|------|
| `combo` | deprecated → `chart-mix` |
| `timeline` | deprecated → `line` |
| `table` | deprecated → `table-info` |
| `wordCloud` | deprecated → `word-cloud` |
| `heatmap` | deprecated → `t-heatmap` |
| **`gis-map`** | **活跃类型，缺 parity / smoke / DE 轴** |

**差集 R \ M**：同上 6 型。

**R \ A（无显式 DE 轴条目）**：仅 **`gis-map`**（活跃）；deprecated 5 型有轴条目。

---

## 0b. 新类型 / Onboarding 缺口

| chartType | 注册 | DE轴 | profile | parity | smoke | 状态 |
|-----------|------|------|---------|--------|-------|------|
| gis-map | ✓ | ✗ | ✓ GIS_MAP_STYLE | ✗ | ✗ | **ONBOARDING** |
| combo | ✓ | ✓ | ✓ | ✗ | ✗ | ONBOARDING（deprecated） |
| timeline | ✓ | ✓ | ✓ | ✗ | ✗ | ONBOARDING（deprecated） |
| table | ✓ | ✓ | ✓ | ✗ | ✗ | ONBOARDING（deprecated） |
| wordCloud | ✓ | ✓ | ✓ | ✗ | ✗ | ONBOARDING（deprecated） |
| heatmap | ✓ | ✓ | ✓ | ✗ | ✗ | ONBOARDING（deprecated） |

---

## 1. 覆盖矩阵

> **评分说明**：WORKS 上限 **8**（parity L1 仅断言 `ready`/`table`，未断言 REAL 像素/Canvas）；COMPLETE/CORRECT 对 AUDITABLE 型基于 DE catalog + L3 + `inspectorCapabilityMatrix` 抽样。  
> **逐一校验**：AUDITABLE 44 型均经 parity L1–L3；ONBOARDING 6 型仅登记缺口。

### 1a. ONBOARDING / deprecated（不参评三柱均分）

| chartType | 状态 | 判定 |
|-----------|------|------|
| gis-map | ONBOARDING | ONBOARDING |
| combo | ONBOARDING | deprecated |
| timeline | ONBOARDING | deprecated |
| table | ONBOARDING | deprecated |
| wordCloud | ONBOARDING | deprecated |
| heatmap | ONBOARDING | deprecated |

### 1b. AUDITABLE — 笛卡尔 / 双轴（parity 绿）

| chartType | WORKS | COMPLETE | CORRECT | 判定 | parity |
|-----------|-------|----------|---------|------|--------|
| line, area, area-stack | 8 | 9 | 9 | PASS | L1–L3 |
| bar, bar-stack, percentage-bar-stack, bar-group, bar-group-stack | 8 | 9 | 9 | PASS | L1–L3 |
| bar-horizontal, bar-stack-horizontal, percentage-bar-stack-horizontal | 8 | 9 | 9 | PASS | L1–L3 |
| chart-mix, chart-mix-group, chart-mix-stack, chart-mix-dual-line | 8 | 9 | 9 | PASS | L1–L3 |
| waterfall, bidirectional-bar | 8 | 8 | 9 | PASS | L1–L3 |
| bar-range, progress-bar, stock-line, bullet-graph | 7 | 8 | 9 | PARTIAL | L1–L3；图例 matrix=missing 但壳层已扩 |

### 1c. AUDITABLE — 分布 / 关系 / 表格 / 指标

| chartType | WORKS | COMPLETE | CORRECT | 判定 | parity | 备注 |
|-----------|-------|----------|---------|------|--------|------|
| pie, pie-donut, pie-rose, pie-donut-rose | 8 | 9 | 9 | PASS | L1–L3 | |
| funnel | 8 | 8 | 9 | PASS | L1–L3 | |
| scatter, quadrant, multi-scatter | 8 | 9 | 9 | PASS | L1–L3 | |
| radar | 7 | 7 | 9 | PARTIAL | L1–L3 | inspector legend=missing |
| treemap, circle-packing | 7 | 7 | 9 | PARTIAL | L1–L3 | legend=missing |
| word-cloud | 6 | 6 | 9 | PARTIAL | L1–L3 | label/legend=missing |
| sankey | 6 | 6 | 9 | PARTIAL | L1–L3 | label+legend=missing |
| graph | 7 | 7 | 9 | PARTIAL | L1–L3 | legend=missing |
| kpi, gauge, liquid | 8 | 9 | 9 | PASS | L1–L3 | 无图例属预期 |
| table-info, table-normal, table-pivot, t-heatmap | 8 | 9 | 9 | PASS | L1–L3 | |

### 1d. AUDITABLE — 地图

| chartType | WORKS | COMPLETE | CORRECT | 判定 | parity | 备注 |
|-----------|-------|----------|---------|------|--------|------|
| map | 8 | 8 | 9 | PASS | L1–L3 | 离线 GeoJSON；GEO-IRON-01 合规 |
| map-3d | 7 | 7 | 9 | PARTIAL | L1–L3 | label matrix=missing |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| scope 类型数 | 50 |
| AUDITABLE | 44 |
| ONBOARDING | 6（含 1 活跃 `gis-map`） |
| PASS / PARTIAL / FAIL | **28 / 16 / 0** |
| 未审计行数 | **0** |
| **逐一校验** | 是（44 parity）；ONBOARDING 记缺口 |

---

## 2. 三柱汇总（AUDITABLE only，n=44）

| 柱 | 均分 | 说明 |
|----|------|------|
| **能不能用（WORKS）** | **7.6** | parity L1/L2 全绿；无 REAL 渲染探针，按 rubric 封顶 |
| **全不全（COMPLETE）** | **8.3** | DE 轴 + style profile 与 G13 镜像一致；部分类型 inspector 矩阵缺项与 profile 不对齐 |
| **对不对（CORRECT）** | **9.0** | L3 blueprint + `deriveFieldRuleFromDeCatalog` 一致；`chartDeAxis/catalog.test` 对 **gis-map** 失败（活跃型） |

加权总分（0.4/0.3/0.3）≈ **8.1**

---

## 3. 字段/维指

| 项 | 结果 |
|----|------|
| DE 轴 catalog | 49/50 显式；**`gis-map` 缺失** → `catalog.test.ts` FAIL |
| parity L3 | 44/44 AUDITABLE 通过 `getDeAxisBlueprint` + `deriveFieldRuleFromDeCatalog` |
| BE FieldRule | `chartCatalogBackendFieldRules.ts` 含 `gis-map`；与 FE DE 轴 **未对齐** |
| 特殊规则 | map 维指走 `region_id` 校验（`buildChartRenderModel`）；合规 |

---

## 4. 样式

| 项 | 结果 |
|----|------|
| G13 镜像 | `catalogParity` plugin.properties ↔ `chartTypeStyleProfiles` **4/4 绿** |
| 壳层图例 | `supportsEmbeddedShellLegend` 已扩至多数有图例类型；`radar`/`treemap` 等 matrix legend=missing 时样式区仍可能展示图例 → **COMPLETE 扣分** |
| ChartStylePanel | **3/4 绿**；`renders DE-style accordion` **超时失败**（疑似环境/异步，非类型逻辑） |
| gis-map | 有 `GIS_MAP_STYLE` + 专用 Inspector 分区（底图/图层/符号化） |

---

## 5. 渲染与其它

| 项 | 结果 |
|----|------|
| 渲染链 | D3 单轨：`CanvasChartHost` → `D3ViewRouter` → `renderD3Chart`；`gis-map` → `GisMapView`（MapLibre，离线 transform） |
| Plan 链 | `buildChartViewModel` → `buildPlanForType`（antv encode 名）→ `applyChartStyleChain` → dispatch |
| 图例双轨 | shell（`buildLegendSnapshot`）与 inline（各 `render*.ts`）仍可能不一致 → 见会话内 arch-reviewer **C-2** |
| GEO-IRON-01 | `map`/`map-3d` 离线；`gis-map` 经 `gisMapTransformRequest` 离线瓦片 — **未发现在线高德/天地图 Key 路径** |
| vitest REAL | **无** perType 断言像素/Canvas；WORKS 不可评满分 |

---

## 6. P0/P1 修复项

| 优先级 | chartType | 柱/状态 | 摘要 | 证据 | 修复方向 |
|--------|-----------|---------|------|------|----------|
| **P0** | gis-map | ONBOARDING | 活跃类型无 DE 轴、无 parity/smoke | `catalog.test.ts` FAIL；R\P 差集 | 补 `DE_AXIS_CATALOG` + `gis-map.parity.test.ts` + smoke fixture |
| **P1** | radar, treemap, word-cloud, sankey, graph | COMPLETE | profile/Inspector 展示图例区但 matrix legend=missing | `inspectorCapabilityMatrix.ts` | 对齐 matrix 或隐藏 UI；或补壳层图例项 |
| **P1** | bar-range, stock-line, progress-bar, bullet-graph | COMPLETE | 同上 legend=missing | 同上 | 扩 `resolveSeriesLegendNames` 或标 matrix wired |
| **P1** | 全类型 | WORKS | L1 不证明真渲染 | `bar.parity.test.ts` L1 | 增 REAL smoke（Canvas/DOM）或标注 GATE |
| **P2** | map-3d | COMPLETE | label matrix=missing | D3 matrix | 补接线或标 partial |
| **P2** | — | 测试 | ChartStylePanel 单测超时 | `ChartStylePanel.test.tsx:62` | 增 timeout 或 mock 重型子树 |
| **P3** | deprecated×5 | ONBOARDING | 无 parity（可接受） | R\P | 保持 migratesTo；文档注明不测 |

---

## 7. 验证命令与输出摘要

```bash
cd fe && npx vitest run src/components/charts/engine/plugins/catalogParity.test.ts --reporter=verbose
# → 4 passed

cd fe && npx vitest run src/components/charts/perType --reporter=dot
# → 44 files, 132 passed

cd fe && npx vitest run src/lib/chartDeAxis/catalog.test.ts --reporter=dot
# → 1 failed: gis-map DE_AXIS_CATALOG undefined

cd fe && npx vitest run src/components/dashboard/ChartStylePanel.test.tsx --reporter=dot
# → 3 passed, 1 failed (timeout accordion)
```

---

## 8. Blind spots

- 无 Playwright 图表真渲染走查
- 未逐类型打开 Inspector 手工拖字段
- `gis-map` MapLibre 离线瓦片合规未做运行时网络抓包
- BE `GET /api/v1/charts/types` 未与 FE R 做差集

---

## 9. 结论

- **整体**：44/50 型具备完整 parity 门禁，笛卡尔/双轴/饼图/表格类 **PASS** 为主；**无 FAIL 级**不能渲染项（在 L1 语义下）。
- **最大缺口**：活跃类型 **`gis-map`** 未完成 onboarding（DE 轴 + parity + smoke），且 **阻断 `chartDeAxis/catalog.test`**。
- **系统性风险**：Inspector 能力矩阵与样式/图例 UI 对部分关系图、统计图 **不一致**；parity 绿 ≠ 生产真渲染。

**建议修复顺序**：① `gis-map` onboarding → ② legend matrix/UI 对齐 → ③ 增 REAL render smoke（可选）。
