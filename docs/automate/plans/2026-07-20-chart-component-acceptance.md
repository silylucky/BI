# 图表组件验收检查计划（对标 DataEase）

> **状态**：P1/P2 已闭环 · AUTO 门禁已补齐 · `[MANUAL]` 走查可按 H 节执行  
> **真理源**：`fe/src/components/charts/engine/plugins/metadata.ts` · `fe/src/lib/chartTableInspector.ts` · PRD `F06-VIZ.md`  
> **禁止**：在线地图/境外地图（GEO-IRON-01）

## 验收原则

1. **配置即生效**：Inspector 可见项必须写入 `nativeBody` 并在预览/看板渲染中体现；禁止仅 UI 占位。
2. **迁移不回归**：存量 `table`/`combo`/`heatmap` 等经 `migrateChartViewConfig` 后，原有下钻/样式/分页行为不得劣化。
3. **分路一致**：D3(画布) / S2(表格) / React(KPI) 按 plugin.library 分路，验收时注明引擎。
4. **证据**：每项标注 `[AUTO]`（单测/smoke）或 `[MANUAL]`（浏览器走查）；未通过标 ❌ 并登记 bug。

---

## A. 通用 Inspector（所有 chartType）

### A1 数据 Tab

| ID | 检查项 | 期望（DE 对标） | 证据 |
|----|--------|-----------------|------|
| INS-D-01 | 切换图表类型 | 调用 `migrateChartViewConfig` + `ensureChartSlotCapacity`；deprecated 类型自动迁到 `migratesTo` | `[AUTO]` migrateChartTypes.test |
| INS-D-02 | 字段槽 | 维/指标/子类别槽位数与 `chartFieldSlots` 一致；空槽不参与校验 | `[AUTO]` chartFieldSlots |
| INS-D-03 | 过滤器 | 增删改 filter 后「更新图表数据」可校验通过并刷新 | `[MANUAL]` |
| INS-D-04 | 结果条数/刷新 | `ChartDataOptions` 修改 limit/refresh 生效 | `[MANUAL]` |
| INS-D-05 | 校验反馈 | 字段错误/CHART_INVALID_STYLE_VARIANT 有可读文案 | `[AUTO]` chartErrors |

### A2 样式 Tab

| ID | 检查项 | 期望 | 证据 |
|----|--------|------|------|
| INS-S-01 | Section 显隐 | `chartStyleSectionsForType(type)` 与 DE 分区一致（palette/title/legend/…） | `[AUTO]` chartStyleSectionRegistry.test |
| INS-S-02 | 配色 | paletteId + 透明度 → 渲染色与图例一致 | `[MANUAL]` |
| INS-S-03 | 标题/背景/边框 | `deStyle` 写入后在 embedded 预览可见 | `[MANUAL]` |
| INS-S-04 | 表格配色 | `isTableLikeChartType` 启用 `ChartPaletteStyleSection` 表格色块 | `[MANUAL]` table-* |

### A3 高级 Tab

| ID | 检查项 | 期望 | 证据 |
|----|--------|------|------|
| INS-A-01 | Capabilities 门控 | `chartInspectorCapabilities(type)` 控制 markLine/conditional/jump/timeRange 显隐 | `[AUTO]` chartTableInspector.test |
| INS-A-02 | 辅助线 | G2Plot Column/Line 出现 annotations 水平线 | `[MANUAL]` bar/line |
| INS-A-03 | 条件样式 | 柱/线/矩阵热力：规则匹配值变色（G2Plot columnStyle/lineStyle/color） | `[AUTO]` chartDeFeatures.test · `[MANUAL]` |
| INS-A-04 | 跳转 | jump 配置后点击图表触发 URL/看板导航（优先于下钻） | `[MANUAL]` |
| INS-A-05 | 时间范围 | timeRange 过滤参数进入 execute | `[MANUAL]` |

---

## B. 渲染引擎分路

| 引擎 | chartType 范围 | 核心检查 |
|------|----------------|----------|
| **D3** | 43 项画布型（trend/compare/distribute/quota/relation/map 等） | `data-testid="d3-*-chart"`；编码、legend、条件色、下钻 |
| **S2** | table-info, table-normal, table-pivot | 分页/滚动/汇总/序号/主题色/下钻列 |
| **React** | kpi, legacy table | KPI 数值格式；legacy table 仍走 EmbeddedChartTable |

| ID | 检查项 | 期望 | 证据 |
|----|--------|------|------|
| ENG-01 | catalog ↔ registry | `GET /charts/types` 条目数 = FE plugin 数；library/paletteCategory 一致 | `[AUTO]` registry.test |
| ENG-02 | buildAntvSpec 委托 | 各 type 的 `buildRenderPlan` 不抛错、empty 态正确 | `[AUTO]` charts.smoke |
| ENG-03 | 行数上限 | 笛卡尔图超 `CHART_EXECUTE_LIMIT` 警告；高级图 cap 采样提示 | `[MANUAL]` |

---

## C. 表格五型（S2 + legacy）

> Profile 真理源：`fe/src/lib/chartTableInspector.ts`

| chartType | DE 名称 | 数据 Tab 差异 | 样式 Tab 差异 | 高级 Tab |
|-----------|---------|---------------|---------------|----------|
| table（legacy） | 明细表旧 | 同明细 | 分页+汇总+列宽 | jump + timeRange |
| table-info | 明细表 | **单容器**「数据列/维度或指标」多 chip 追加 + 钻取/维度 | +序号列 | jump + timeRange |
| table-normal | 汇总表 | 维+指标必填 | +小计 | jump + timeRange |
| table-pivot | 透视表 | 行/列/指标槽 | +小计/合计 | jump + timeRange |
| t-heatmap | 矩阵热力 | 两维+指标 | 最小样式集 | 条件样式 |

### C1 样式（每种表格必查）

| ID | 检查项 | table-info | table-normal | table-pivot | t-heatmap |
|----|--------|:----------:|:------------:|:-----------:|:---------:|
| T-S-01 | 表头/正文/边框色 | ✓ | ✓ | ✓ | ✓ |
| T-S-02 | 斑马纹 | ✓ | ✓ | ✓ | — |
| T-S-03 | 行 hover | ✓ | ✓ | ✓ | — |
| T-S-04 | 自动换行 | ✓ | ✓ | ✓ | — |
| T-S-05 | 分页-翻页模式 | ✓ | ✓ | ✓ | — |
| T-S-06 | 分页-滚动模式 | ✓ | ✓ | ✓ | — |
| T-S-07 | 汇总行 footer | ✓ | ✓ | ✓ | — |
| T-S-08 | S2 totals（透视/汇总） | — | ✓ | ✓ | — |
| T-S-09 | 序号列 | ✓ | — | — | — |
| T-S-10 | widgetShellBg 主题 | ✓ | ✓ | ✓ | ✓ |
| T-S-11 | 滚动条主题色 | ✓ | ✓ | ✓ | — |

### C2 交互

| ID | 检查项 | 期望 |
|----|--------|------|
| T-I-01 | 下钻 | ≥2 维时点击**当前钻取维度列**下钻；`supportsChartDrillInteraction` 含 table-* |
| T-I-02 | 跳转 | jump 启用时点击单元格跳转（优先于下钻） |
| T-I-03 | 分页 | page 模式：S2 pagination；scroll 模式：容器 `dashboard-scroll` 滚动 |

---

## D. 对比/趋势/分布（G2Plot 代表项）

对 **`metadata.ts` 中每个非 deprecated type** 执行下列清单（可抽样：每 paletteCategory 至少 2 型）。

### D1 柱状/条形（compare）

| type | 必查 |
|------|------|
| bar, bar-stack, bar-group, bar-horizontal, waterfall, bar-range, bidirectional-bar, progress-bar, bullet-graph, stock-line | 编码、legend、下钻（≥2维）、条件色、markLine |

### D2 折线/面积（trend）

| type | 必查 |
|------|------|
| line, area, area-stack | dataZoom、系列色、条件色、下钻 |

### D3 饼/分布（distribute）

| type | 必查 |
|------|------|
| pie, pie-donut, pie-rose, radar, treemap, word-cloud | 图例、标签、占比；pie 无 markLine |

### D4 双轴（dual_axes）

| type | 必查 |
|------|------|
| chart-mix, chart-mix-group, chart-mix-stack, chart-mix-dual-line | 双 metric 编码、系列色 |

### D5 关系/流程

| type | 引擎 | 必查 |
|------|------|------|
| scatter, quadrant, multi-scatter | G2Plot | 点选下钻 |
| funnel, sankey | G2Plot | 数据映射 |
| circle-packing | G2Plot | 嵌套圆 |
| graph | G6 | 布局切换 |

### D6 地图（map · G2 离线）

| ID | 检查项 | 期望 |
|----|--------|------|
| MAP-01 | 省级 choropleth | china-provinces.json |
| MAP-02 | 名称/adcode join | analyzeMatch 提示未匹配 |
| MAP-03 | 省→市下钻 | drillStack + 离线 assets |
| MAP-04 | 禁止在线瓦片 | 无外链 geo CDN |

### D7 指标（quota）

| type | 必查 |
|------|------|
| gauge, liquid, kpi | 单 metric 渲染；kpi 卡片格式 |

---

## E. 下钻与跳转（跨类型）

| ID | 检查项 | 期望 | 状态 |
|----|--------|------|------|
| DRILL-01 | 白名单 | compare/trend/distribute/table-*/map/legacy | ✅ 已扩 `chartDrill.ts` |
| DRILL-02 | migrated config | ChartRenderer 用 `localConfig` 判定与 pipeline | ✅ |
| DRILL-03 | 表格列 | 仅 `drillClickField` 列可点 | ✅ S2 + EmbeddedChartTable |
| DRILL-04 | 面包屑 | embedded 模式 ChartDrillChrome 显示 | `[MANUAL]` |
| JUMP-01 | 互斥 | jump 配置且未下钻时 `onJumpClick` 优先 | `[MANUAL]` |

---

## F. 自动化门禁

```bash
# 类型检查
cd fe && npx tsc --noEmit

# 图表域单测
cd fe && npx vitest run src/lib/chartDrill.test.ts src/lib/chartDeFeatures.test.ts \
  src/lib/chartTableInspector.test.ts src/lib/chartStyleSectionRegistry.test.ts \
  src/components/charts/engine/registry.test.ts src/lib/migrateChartTypes.test.ts \
  src/components/charts/engine/plugins/catalogParity.test.ts \
  src/components/charts/engine/applyChartStyleChain.test.ts

# Smoke
cd fe && npx vitest run src/components/charts/charts.smoke.test.tsx

# Backend catalog parity
pytest tests/test_viz_chart_catalog_parity.py -q
```

### 待补 AUTO

- [x] table-normal / table-pivot / t-heatmap smoke（`charts.smoke.test.tsx`）
- [x] conditional G2Plot 集成 smoke + `applyChartStyleChain.test.ts`
- [x] catalog API ↔ FE registry 契约测试（`catalogParity.test.ts` + `test_viz_chart_catalog_parity.py`）

---

## G. 本轮已修回归（2026-07-20）

| 严重度 | 问题 | 修复 |
|--------|------|------|
| P1 | table-info 下钻失效 | 扩展 `supportsChartDrillInteraction`；Renderer 用 migrated config |
| P1 | S2 未传 widgetShellBg | `ChartStyleContext.widgetShellBg` → AntvS2View |
| P1 | scroll 分页未体现 | scroll 模式容器 `dashboard-scroll overflow-auto` |
| P1 | conditionalRules 无消费者 | `applyConditionalRulesToG2PlotOptions` |
| P1 | 切 chartType 未 migrate | ChartEditorColumn 调用 `migrateChartViewConfig` |
| P2 | S2 下钻未限制列 | 读取 `drillClickField` + valueField 校验 |
| P2 | paginationVariant S2 未读 | `TablePaginationBar` 统一 S2/legacy 分页 UI |
| P2 | ChartTableColorPanel 死代码 | `tableColor` 纳入 styleSections；palette 内嵌去重 |
| P2 | 缺 table-normal/pivot/t-heatmap smoke | `charts.smoke.test.tsx` 扩展 |
| P2 | catalog ↔ registry 无契约测试 | `catalogParity.test.ts` + `test_viz_chart_catalog_parity.py` |

---

## H. 走查顺序建议

1. **回归热点**：table-info 下钻 → 表格样式 → bar 条件色 → 切 type 迁移  
2. **表格五型**：按 C 节矩阵逐型  
3. **Picker 八区**：quota → table → trend → compare → distribute → map → relation → dual_axes  
4. **高级 Tab**：markLine / conditional / jump 各抽 1 型  
5. **文档**：仅当行为变更时同步 `docs/services/viz.md` / `F06-VIZ.md`（@prd-sync.mdc）

---

## I. 缺陷登记模板

```markdown
### BUG-VIZ-xxx
- **chartType**:
- **Tab/项**:
- **复现**:
- **期望（DE）**:
- **实际**:
- **根因文件**:
- **修复 PR**:
```
