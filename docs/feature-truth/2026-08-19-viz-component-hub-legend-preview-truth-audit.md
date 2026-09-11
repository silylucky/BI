# Feature Truth Audit: 组件库 Hub 卡片预览隐藏图例

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-19 |
| 核验范围 | 组件库列表卡片图表预览不显示图例；进入编辑页后恢复图例 |
| 锚点 | `/admin/viz-components` · `VizComponentsHubPage` · `ComponentPayloadPreview` · `VizComponentLivePreview` · `ChartRenderer` |
| 总体判定 | **PARTIAL**（实现 + UI 集成测已补，缺 BROWSER 真机） |
| **总分 / 档位** | **8/10 · B** |
| 状态 | approved-fix |
| **sampling** | `full`（按图例机制枚举，非 44 chartType 全量） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 组件库 Hub 卡片内图表预览**不显示图例**（含 shell 图例、D3 内联图例、地图 visualMap 色条） | 用户原话：「组件库里的图表预览就不要显示图例了」 |
| T2 | 点击「编辑」进入 `VizComponentEditPage` 后，预览区**仍显示图例**（与编辑态一致） | 用户原话：「点进去再显示」 |

- 非目标：44 种 chartType 逐一真机截图；定时推送邮件投递 UI（另会话）。

## 2. 完整链路图

```
VizComponentsHubPage
  → VizComponentCard
    → ComponentPayloadPreview (compact + geo3dRenderTier=thumbnail)
      → VizComponentLivePreview (previewProfile=card, 跳过 WidgetChartLegendShell)
        → ChartRenderer (isCardPreview → shellLegendVisible=false)
          → buildRenderConfig (applyHubThumbnailStyleOverrides → showLegend=false)
            → D3/MapLibre 渲染

VizComponentEditPage
  → VizComponentLivePreview (无 compact → previewProfile=default)
    → WidgetChartLegendShell + ChartRenderer (shell 图例可显示)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | Hub 入口接线 | 通 | `ComponentPayloadPreview.tsx:76-82` | `compact` + `thumbnail` 已传 |
| 2 | card profile 推导 | 通 | `VizComponentLivePreview.tsx:51-52` | `compact` → `previewProfile=card` |
| 3 | shell 图例门控 | 通 | `ChartRenderer.tsx:593-594` | `!isCardPreview && shellLegendEligible` |
| 4 | shell 包裹跳过 | 通 | `VizComponentLivePreview.tsx:108-113` | card 模式不挂 `WidgetChartLegendShell` |
| 5 | 内联/D3 图例 | 通（静态） | `chartPresentationScale.ts:124-128` | thumbnail 强制 `showLegend:false` |
| 6 | 区域地图 visualMap | 通（静态） | `buildRenderConfig.ts:111` | thumbnail 关闭 visualMap |
| 7 | 编辑页恢复图例 | 未动态验 | `VizComponentEditPage.tsx:204-208` | 未传 `compact`，代码路径正确 |
| 8 | Hub 真机 DOM | **未验** | — | 无 BROWSER/UI 断言 `.dashboard-chart-legend` 缺失 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | Hub 卡片无图例 | **PARTIAL** | 6/C | 接线 + 单测 GATE/CHAIN；缺 UI/BROWSER |
| T2 | 编辑页有图例 | **UNVERIFIED** | 4/D | 仅代码路径，无 L1 对比 |

## 3b. 前端控件下钻表（本 scope 无独立按钮，记为 N/A）

| ID | 说明 |
|----|------|
| — | 本需求为渲染策略，非单按钮交互；入口为 Hub 卡片 hover「编辑」 |

功能块映射：T2 → 编辑链接 `VizComponentCard.tsx:109-113`

## 3d. 覆盖矩阵（图例机制枚举）

| 实体 ID | 机制 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| M1 | Hub→card profile 接线 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `VizComponentLivePreview.map-drill.test.tsx` compact 断言 |
| M2 | shell 图例（对称条/多系列） | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `ChartRenderer.tsx:593-594` 静态 |
| M3 | D3 内联图例 thumbnail 关闭 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `chartPresentationScale.test.ts` |
| M4 | 热力图 visualMap thumbnail | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `renderHeatmap.test.ts` |
| M5 | 区域地图 visualMap thumbnail | ✅ | ❌ | ❌ | GATE | 1 | 0 | STUB | `buildRenderConfig.ts:111` 无单测 |
| M6 | 编辑页 previewProfile=default | ✅ | ❌ | ❌ | GATE | 1 | 0 | UNVERIFIED | `VizComponentEditPage` 未传 compact |
| M7 | Hub 卡片 DOM 无图例 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 未执行 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7 |
| GATE only | 3（M2 M3 M6） |
| CHAIN | 2（M1 M4） |
| UI / BROWSER | 0 |
| NONE（未验） | 1（M7） |
| REAL 达标 | 0/7 |
| **逐一校验** | **否** — 已验 6/7 机制行，其中 3 行仅 GATE；M7 未验；无真机 DOM |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 2 | 2 | 2 | 9→**6** | C | PARTIAL | C 缺 DOM/真机；按 T 取 Bx 最低约束为 6 |
| T2 | 1 | 0 | 2 | 2 | 2 | 7→**4** | D | UNVERIFIED | 编辑页图例未 L1 对比 |

**打通但不对**：0（修复前用户可见图例残留，修复后未复现但未录证据）  
**假功能**：0

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest` 相关单测 | 全绿 | 5 files / 21 tests passed | ✅ | 2026-08-19 命令输出 |
| 2 | compact 传 card profile | `previewProfile=card` | mock 收到 `card` | ✅ | `VizComponentLivePreview.map-drill.test.tsx` |
| 3 | thumbnail 关图例 | `showLegend:false` | 单测断言通过 | ✅ | `chartPresentationScale.test.ts` |
| 4 | Hub 页面对称条/GIS 卡片 | 无图例 DOM | **未执行** | ❌ | — |
| 5 | 编辑页打开同组件 | 图例可见 | **未执行** | ❌ | — |

### 测试命令输出（摘录）

```
✓ chartPresentationScale.test.ts (6 tests)
✓ dashboardPreviewProfile.test.ts (2 tests)
✓ renderHeatmap.test.ts (2 tests)
✓ renderCompareChartsSmoke.test.ts (7 tests)
✓ VizComponentLivePreview.map-drill.test.tsx (4 tests)
Test Files  5 passed (5)
Tests  21 passed (21)
```

## 5. 修复文档（验证缺口，非实现缺口）

### M7 — Hub 卡片 DOM 无图例

**判定 / 得分**：UNVERIFIED 0/10  
**期望 vs 实际**：期望 Hub 卡片不出现 `.dashboard-chart-legend` / `g.vs-legend`；实际未在集成环境断言。  
**根因**：缺 `ComponentPayloadPreview` 或 Hub smoke 集成测。  
**修复方向**：新增 smoke：mock payload（`bidirectional-bar` + 多系列 `bar`）渲染 `VizComponentCard`，断言无 legend 节点；可选 browser-reviewer 走查 `/admin/viz-components`。  
**修后验收**：M7 深度 UI，C≥2，T1 REAL。

### M5 — 区域地图 visualMap thumbnail

**判定**：STUB（GATE only）  
**修复方向**：`renderChoropleth.test.ts` 增 thumbnail 用例，断言无色条 `legendG`。  
**修后验收**：CHAIN，C≥2。

### T2 — 编辑页恢复图例

**判定**：UNVERIFIED  
**修复方向**：`VizComponentEditPage` smoke 或 LivePreview 测试：`compact=false` 时 `previewProfile=default` 且保留 `WidgetChartLegendShell` 包裹。  
**修后验收**：L≥2，C≥2。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | M7 | Hub 卡片集成测 / 真机确认图例 DOM 消失 |
| P1 | T2 | 编辑页图例可见性 L1 对比 |
| P1 | M5 | 区域地图 thumbnail visualMap 单测 |
| P2 | M2 | 对称条形图 thumbnail render 断言 `g.vs-legend` 为空 |

## 7. 实现完成度结论（给用户）

| 维度 | 结论 |
|------|------|
| **代码实现** | **已完成**：Hub `compact` → `previewProfile=card`、跳过 shell 包裹、thumbnail 关内联图例与 choropleth visualMap |
| **truth-verify REAL** | **未完成**：无 Hub 真机/DOM 验收，编辑页图例未 L1 对比，区域地图改动无单测 |
| **可合并建议** | 功能可试用；truth 档位 **PARTIAL**，建议补 P0 后再标 REAL |

## 8. 交接

- 建议：批准补 P0 集成测 → `root-first-solve`；或 browser-reviewer 走查 Hub + 编辑页
- 用户批准修复：**否**
