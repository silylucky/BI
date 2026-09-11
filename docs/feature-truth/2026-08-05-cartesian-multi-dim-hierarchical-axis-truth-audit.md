# Feature Truth Audit: 笛卡尔多维度分层类别轴（对标 DataEase）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | 类别轴拖入 ≥2 维度时的分层 X/Y 轴展示；编码 → 排序 → 分层规划 → D3 渲染 |
| 锚点 | `buildDatasetEncoding.ts` · `hierarchicalAxis.ts` · `sceneGraph.ts` · `renderBar.ts` / `renderD3LineChart.ts` / `renderArea.ts` / `renderDualAxes.ts` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | draft |
| **sampling** | `full`（本功能相关笛卡尔子型全列；非 44 型样式全量） |

## 1. 核验标准与预期（来自对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 柱状图类别轴拖入 4 维（日期/省/商品/类目）时，X 轴下方出现**多行**分层标签：粗维合并段 + 最细维底行抽稀；与柱位置对齐 | 用户截图 + 对话「多层展示」 |
| T2 | Tooltip 复合类目 `A / B / C / D` 与轴层字段顺序一致 | 对话 + `formatCompositeCategoryDisplay` |
| T3 | 折线/面积/双轴等**纵向笛卡尔**图与柱图行为一致 | 工程约定 + `sceneGraph` 统一 `drawHierarchicalCategoryAxis` |
| T4 | 横向柱图（`bar-horizontal` 族）Y 轴亦支持多层（若 DE 对标） | DE 笛卡尔族；当前实现缺口 |
| T5 | 编辑器真机预览：修后 4 维场景目视符合 T1，无「仅省份重复一行」 | 用户二次截图仍报未完成 |

- 非目标：44 型样式 Tab 全量；地图类；单维度类目轴行为变更

## 2. 完整链路图

```
ChartDataSlots(xAxis multi) → resolveChartEncoding → buildPlan(categoryLevelCount)
  → encodeCartesianRows(composite key) → normalizeCategoryAxisDomain(sort)
  → planHierarchicalCategoryAxis → drawHierarchicalCategoryAxis
  → .vs-axis-x-tiered DOM
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | 槽位/编码 | 通 | `encodeCartesian.test.ts` MULTI_DIM | 复合 key `\u0001` |
| 2 | 排序/层数 | 通 | `buildDatasetEncoding.test.ts` sort | `normalizeCategoryAxisDomain` |
| 3 | 轴规划 | 通 | `hierarchicalAxis.test.ts` 12 passed | 4 层 activeLevels 单测 |
| 4 | 柱渲染 | 部分通 | `renderBar.test.ts` tiered | 未断言 4 行全可见 |
| 5 | 折线渲染 | 部分通 | `renderD3LineChart.test.ts` tiered | 3 层样本，非 4 维 |
| 6 | 面积/双轴 | 未验多层 | 无 tiered 单测 | 代码已接线路 |
| 7 | 横向柱 | 断 | `renderBarHorizontal.ts` | 仅 sort，无分层 Y |
| 8 | 真机预览 | 未复验 | 用户截图 15:55 | 修后无 BROWSER 证据 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 柱图 4 维多层轴 | PARTIAL | 6/C | CHAIN 有 tiered；用户目视仍单层省份重复 |
| T2 | 编码与 tooltip 一致 | REAL | 9/A | composite + display 单测 |
| T3 | 折线/面积/双轴一致 | PARTIAL | 5/C | 线有 CHAIN；面积/双轴无多层断言 |
| T4 | 横向柱多层 | STUB | 3/D | 无 `drawHierarchical` on Y |
| T5 | 编辑器真机 | UNVERIFIED | 2/F | 修后未 MCP/browser 复验 |

## 3b. 前端控件下钻表（本功能无独立按钮）

本特性由**数据槽位拖字段**触发，无专用「多层轴」开关。

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 类别轴多字段拖入 | `ChartDataSlots` → `appendAxisField` | 4 字段 → 复合类目 + 多层轴 | 编码通；轴目视未达标（用户反馈） | 2 | 1 | 2 | 2 | 2 | 7 | PARTIAL | 对话 + CHAIN 单测 |

Out：样式 Tab 滑块、图例开关等（非本 scope）

功能块映射：T1,T5 → B1

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| composite-encoding | 编码层 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `encodeCartesian.test.ts` · `buildDatasetEncoding.test.ts` |
| hierarchical-core | 轴算法 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `hierarchicalAxis.test.ts` 12/12 |
| axes-thinning | 抽稀辅助 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `axes.test.ts` 13/13 |
| bar / bar-stack / bar-group / bar-group-stack / percentage-bar-stack | 纵向柱族 | ❌ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | 共用 `renderBar.ts`；`renderBar.test.ts` 1 tiered case |
| line | 折线 | ❌ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `renderD3LineChart.test.ts` tiered 3-level |
| area / area-stack | 面积 | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | `renderArea.ts` 已接线；无 tiered 单测 |
| chart-mix / chart-mix-group / chart-mix-stack / chart-mix-dual-line | 双轴族 | ❌ | ⚠️ | ❌ | GATE | 1 | 0 | STUB | `renderDualAxes.test.ts` 仅 legend；无 tiered |
| bar-horizontal / bar-stack-horizontal / percentage-bar-stack-horizontal | 横向柱族 | ❌ | ❌ | ❌ | GATE | 1 | 0 | STUB | `drawCartesianHorizontalBandAxes` 无分层 |
| waterfall / stock-line | 带轴柱图 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 未验多维复合类目场景 |
| dashboard-4dim-preview | 真机 | ❌ | ❌ | ❌ | NONE | 1 | 0 | BROKEN→待复验 | 用户截图：省份重复、缺完整四层 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 10 |
| GATE only | 3（area、双轴族、横向柱） |
| CHAIN | 4（encoding、core、axes、bar/line） |
| UI / BROWSER | 0 |
| NONE（未验） | 2（waterfall/stock、真机复验） |
| REAL 达标 | 3/10 |
| **逐一校验** | **否** — 已 CHAIN 4/10；真机 0/10；横向柱与面积/双轴多层未验 |
| **总体可否 REAL** | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| B1 | 2 | 1 | 2 | 2 | 2 | 7 | B | PARTIAL | 链路通，目视正确性未验收 |
| T1 | — | — | — | — | — | 6 | C | PARTIAL | 依赖 B1 + 无 BROWSER |

**打通但不对**（L≥2 且 C≤1）：B1、T1（用户二次截图）

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `npx vitest run` 分层轴相关 6 文件 | 全绿 | 37 tests passed | ✅ | 2026-08-05 15:08 命令输出 |
| 2 | `renderBar.test` 4 维 | `.vs-axis-x-tiered` + 多标签 + 含日期 | tiered 存在；labels>4；含 2025 | ⚠️ | 未断言省/商品/类目分行 |
| 3 | 用户编辑器柱图 4 维 | 四层分行 | 仅省份重复 + 孤立日期（修前/修中） | ❌ | 用户截图 15:55 |
| 4 | MCP browser 修后复验 | 目视四层 | **未执行** | — | — |

## 5. 修复文档（P0）

### T1 / B1 — 柱图 4 维多层轴目视未达标

**判定 / 得分**：PARTIAL 6/10（C=1）  
**期望 vs 实际**：期望日期→省→商品→类目多行合并+底行抽稀；实际用户仍见单层省份重复。  
**根因（待 BROWSER 确认）**：

- CHAIN 单测未覆盖「4 activeLevels 各行均有可见合并标签」
- 修后无真机复验，无法确认是否已部署到用户环境
- 横向/面积/双轴路径未同标准验收

**修复方向**（须用户批准后实施）：

1. **BROWSER**：仪表盘编辑页 4 维柱图 snapshot，断言 `.vs-axis-x-tiered text` 行数与内容
2. **单测加强**：`renderBar.test` 断言 4 行标签含省名合并段 + 类目叶级
3. **面积/双轴**：补 tiered 单测或共用 `renderBar.test` 夹具
4. **横向柱**：实现 `drawHierarchicalCategoryAxis` 的 Y 向变体或文档明确 Out

**修后验收**：BROWSER 目视 OK；C≥2；T1 REAL

### T4 — 横向柱多层轴

**判定**：STUB 3/10  
**根因**：`drawCartesianHorizontalBandAxes` 仍 `resolveHorizontalCategoryAxisLayout` 单行抽稀  
**优先级**：P1（若 DE 对标要求横向亦分层）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T1/B1 | 真机 4 维柱图 BROWSER 复验 + 加强 CHAIN 断言 |
| P0 | T5 | 修后编辑器预览与用户期望对齐 |
| P1 | T3 | area / dual-axes tiered 单测 |
| P1 | T4 | 横向柱分层 Y 轴（或登记 Out） |
| P2 | waterfall/stock | 多维复合类目是否需分层（待产品确认） |

## 7. 交接

- 建议：批准 P0 后 `root-first-solve` 或继续 agent 实现 **BROWSER 走查 + 单测加强**
- 用户批准修复：**否**（本次仅审计）
- **结论：功能未完成 REAL** — 算法与柱/线 CHAIN 有进展，但**正确性（C）与真机（BROWSER）未达标**，面积/双轴/横向柱未逐一验多层。
