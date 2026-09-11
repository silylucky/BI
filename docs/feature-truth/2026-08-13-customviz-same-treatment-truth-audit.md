# Feature Truth Audit: customViz 与内置 chart 同等待遇

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-13 |
| 核验范围 | 会话目标：AI 组件上画布/大屏、图表盘「自定义」、432px 右轨、手配数据+execute、styleSchema 样式、viz-components 收录；禁 iframe / 禁进 `GET /charts/types` |
| 锚点 | `CustomVizWidget` · `CustomVizEditRail` · `ChartPickerPopover` · `GET /api/v1/ai-viz/artifacts` · `viz-components` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7.5/10 · B** |
| 状态 | draft（P0–P2 已修，主路径 BROWSER 已验） |
| **sampling** | `full`（8 项交付能力全量矩阵，非 44 chartType） |

## 1. 核验标准与预期（来自对话 / F17 / PROTOCOL）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | `CustomVizWidget` 同页挂载 entry HTML（无 iframe），注入 `--dashboard-*` | 对话 / AIVIZ-005 |
| T2 | 图表盘左侧 **「自定义」** 分区列出 artifact，点击/拖拽插入 `type:customViz`；**不进** `GET /charts/types` | 对话 |
| T3 | 选中 customViz 打开 **432px 双列右轨**：数据/样式/高级 + 右侧数据集 | 对话 |
| T4 | 手配维度/指标/过滤/刷新/结果条数 → `query/execute` 出数 → 宿主 `.vs-cv-payload` + `--vs-style-*` | 对话 / AIVIZ-007 / PROTOCOL |
| T5 | 样式 Tab 按 manifest `styleSchema` 编辑 layout `style`（非 deStyle） | 对话 |
| T6 | 可 **发布/关联** 进 viz-components，编辑页可再插入、linked 同步 | 对话 / AIVIZ-006 |
| T7 | `GET /api/v1/ai-viz/artifacts` 列表供图表盘 | 对话 / API README |
| T8 | 看板 + 数据大屏编辑画布均可插入与编辑（共用 `CanvasEditToolbar`） | 对话 / layout v2 |

- **非目标**：49 内置 chart 迁 D3；iframe 沙箱；新 chartType 进 plugin catalog；bundle 内 CDN。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 交付能力 T1–T8 | 8 | 0 | 8 | 会话摘要 + F17 |
| 右轨核心控件 | 12 | 0 | 12 | `CustomVizEditorColumn` / `DatasetPickerPanel` / `ChartPickerPopover` 静态枚举 |
| 自动化测试文件 | 6 | 0 | 6 | grep `customViz` in tests |

## 2. 完整链路图

```
图表盘「自定义」→ createPaletteWidget(customViz)
  → layout v2 widget
  → 选中 → CustomVizEditRail（数据/样式/高级 + DatasetPickerPanel）
  → customVizBindingToChartConfig → POST query/execute
  → CustomVizWidget injectCustomVizPayload
  → bundle 读 .vs-cv-payload

发布 → extractWidgetPayload(customVizConfig) → POST viz-components
  → componentRef 插入 → resolveLayoutWidget
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | artifact 注册/entry | 通 | `test_ai_viz_hybrid.py` 6 passed | POST/PUT/GET entry |
| 2 | layout customViz | 通 | `test_validate_layout_custom_viz_widget` | schema 校验 |
| 3 | 宿主挂载 | 通（mock） | `CustomVizWidget.test.tsx` 3 passed | 未 mock execute 时亦需 apiFetch |
| 4 | 图表盘插入 | 通 | `ChartPickerPopover.test.tsx` + `dashboardDnd.customViz.test.ts` | 自定义分区 UI + DnD payload |
| 5 | 右轨编辑 | 通（smoke） | `CustomVizEditRail.smoke.test.tsx` | 无 userEvent 深度 |
| 6 | execute→payload | 通 | `customVizPayload.test.ts` · `CustomVizWidget.payload.test.tsx` | 无 bundle 消费断言 |
| 7 | viz-components 入库 | 通 | `test_create_publish_and_resolve_custom_viz` + EditPage/LivePreview | 无 BROWSER |
| 8 | 真机走查 | **部分** | BROWSER 2026-08-13 | 看板插入+右轨+payload 已验；大屏/绑数 execute 未深验 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | Base 同页挂载 | PARTIAL | 6/C | vitest 挂载 HTML；无 iframe 静态确认；payload 未验 |
| T2 | 图表盘「自定义」 | PARTIAL | 8/B | ChartPicker vitest + BROWSER 插入 tile |
| T3 | 432px 右轨 | PARTIAL | 7/B | smoke 通过；无 userEvent 深度 |
| T4 | execute + 宿主喂数 | PARTIAL | 7/B | payload/execute 单测 + Widget 集成 mock |
| T5 | styleSchema 样式 | PARTIAL | 5/C | `CustomVizStyleForm` 静态；无 schema 驱动 UI 测 |
| T6 | viz-components 全链路 | PARTIAL | 8/B | EditPage/LivePreview 已接；roundtrip pytest |
| T7 | artifacts 列表 API | PARTIAL | 7/B | `test_ai_viz_artifact_list` 通过 |
| T8 | 看板/大屏画布 | PARTIAL | 7/B | 看板 BROWSER 通；大屏未走查 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 图表盘·自定义 tile | `ChartPickerPopover:CustomVizTile` | 插入 customViz widget | click 调 onInsertCustomViz | 1 | 2 | — | — | 1 | 6 | PARTIAL | `ChartPickerPopover.test.tsx` |
| B2 | 自定义 tile 拖拽 | `setCustomVizDragData` | 画布 drop 创建 widget | DnD payload 单测 | 1 | 2 | — | — | 1 | 6 | PARTIAL | `dashboardDnd.customViz.test.ts` |
| B3 | Tab·数据 | `ChartInspectorTabs` | 展示字段/过滤/刷新 | 静态挂载 | 1 | 0 | — | — | 1 | 4 | STUB | 无 smoke |
| B4 | 维度/指标槽 | `CustomVizDataSlots` | 按 manifest 绑字段 | indexed 多槽 | 1 | 2 | — | — | 1 | 6 | PARTIAL | `customVizFieldSlots.test.ts` |
| B5 | 过滤 | `ChartConfigPanel section=filters` | 写入 binding.filters | 静态 onChange 映射 | 1 | 0 | — | — | 1 | 4 | STUB | 未动态验 |
| B6 | 刷新/结果条数 | `CustomVizDataOptions` | patch refreshMode/resultLimit | 静态 | 1 | 0 | — | — | 1 | 4 | STUB | |
| B7 | 更新组件数据 | `CustomVizEditorColumn:validate` | validate+refresh+executeKey | 调 `/charts/validate` | 1 | 0 | — | 1 | 1 | 5 | PARTIAL | 无 execute 结果断言 |
| B8 | Tab·样式 | `CustomVizStyleForm` | 按 styleSchema 改 layout.style | 静态表单 | 1 | 0 | — | — | 1 | 4 | STUB | |
| B9 | Tab·高级 | `WidgetSurfaceAppearanceFields` | widgetStyle 持久化 | 静态 | 1 | 0 | — | — | 1 | 4 | STUB | |
| B10 | 删除组件 | `WidgetInspectorDelete` | 删 widget | 与 chart 同路径 | 1 | 1 | — | — | 1 | 5 | PARTIAL | 未单独测 |
| B11 | 数据集选择 | `DatasetPickerPanel` | 绑 datasetId/configId | hook 存在 | 1 | 0 | — | — | 1 | 4 | STUB | |
| B12 | 字段库点击 | `onFieldClick→assignField` | 写入 active 槽 | activeKind 仅 dim/metric 两态 | 1 | 0 | — | — | 1 | 4 | STUB | 多槽 manifest 不准 |

功能块映射：T2→B1,B2；T3→B3–B12；T4→B4–B7,B11,B12；T5→B8；T6→（缺）组件库编辑页控件。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| T1 Base 挂载 | 能力 | ✅ 无 iframe 代码 | ✅ vitest mount | ❌ | CHAIN | 2 | 1 | PARTIAL | `CustomVizWidget.test.tsx` |
| T2 图表盘自定义 | 能力 | ✅ 静态 | ✅ vitest | ❌ | CHAIN | 2 | 2 | PARTIAL | `ChartPickerPopover.test.tsx` |
| T3 432px 右轨 | 能力 | ✅ 静态 | ✅ smoke | ❌ | CHAIN | 2 | 2 | PARTIAL | `CustomVizEditRail.smoke.test.tsx` |
| T4 execute+payload | 能力 | ✅ 静态 | ✅ vitest | ❌ | CHAIN | 2 | 2 | PARTIAL | `customVizPayload` + `CustomVizWidget.payload` |
| T5 styleSchema | 能力 | ✅ 静态 | ❌ | ❌ | GATE | 1 | 0 | STUB | `CustomVizStyleForm.tsx` |
| T6 viz-components | 能力 | ✅ BE/FE | ✅ pytest | ❌ | CHAIN | 2 | 2 | PARTIAL | EditPage + roundtrip |
| T7 list API | API | — | ✅ pytest | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_ai_viz_artifact_list` |
| T8 双画布 | 能力 | ✅ 共用 Toolbar | ❌ | ❌ | GATE | 1 | 0 | STUB | `DashboardEditWorkspace.tsx` |
| M1 pytest hybrid | 测试 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 6 passed |
| M2 vitest widget | 测试 | — | ✅ mock | ❌ | CHAIN | 2 | 1 | PARTIAL | 3 passed |
| M3 vitest create | 测试 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 2 passed |
| M4 vitest publishable | 测试 | — | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | 类型断言 only |
| M5 EditRail smoke | 测试 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 1 passed |
| M6 payload unit | 测试 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 5+ passed |
| M7 viz-comp roundtrip | 测试 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_create_publish_and_resolve_custom_viz` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 15 |
| GATE only | 5（T2,T3,T4,T5,T6,T8 中 5 项仅静态） |
| CHAIN | 6 |
| UI / BROWSER | 1（看板插入+右轨） |
| NONE（未验） | 0 |
| REAL 达标 | 0/15 |
| **逐一校验** | **否** — 仍缺 BROWSER；自动化 CHAIN 已覆盖主路径 |
| 总体可否 REAL | **否**（待 BROWSER） |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 1 | 1 | 1 | 6 | C | PARTIAL | 挂载通，payload 正确性未证 |
| T2 | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | 无 UI 证据 |
| T3 | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | 无 smoke |
| T4 | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | 打通未验 |
| T5 | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | |
| T6 | 1 | 0 | 1 | 0 | 0 | 2 | F | STUB | 编辑页断 |
| T7 | 2 | 2 | 2 | 2 | 1 | 9 | A | PARTIAL | 仅 API 子集 |
| T8 | 1 | 0 | 1 | 1 | 1 | 4 | D | STUB | |
| **T 汇总（最低分）** | — | — | — | — | — | **5.5** | **C** | **PARTIAL** | 取 T2–T6 拉低 |

**打通但不对**（L≥2 且 C≤1）：T1（payload 未证）  
**假功能/壳**（STUB）：T2,T3,T4,T5,T6,T8  
**文档与 PRD 自相矛盾**：F17 Out 表仍写「viz-components 收录 M2」「查询桥后续」，但 AIVIZ-006/007 已勾选 — 不能作为 REAL 依据。

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pytest tests/test_ai_viz_hybrid.py` | 6 passed | 6 passed | ✅ | 2026-08-13 运行输出 |
| 2 | `vitest custom-viz/ + ChartPicker + DnD + payload` | 14+ passed | 14 passed | ✅ | 2026-08-13 P1 |
| 3 | 绑 dataset+字段 → execute → `.vs-cv-payload` rows 非空 | rows 与 API 一致 | mock 单测通过 | ⚠️ | `CustomVizWidget.payload.test.tsx` |
| 4 | 发布 customViz 到组件库 → 编辑页预览 | LivePreview 渲染 + EditRail | pytest + 静态接线 | ⚠️ | 无 BROWSER |
| 5 | manifest 多 metric 槽 | 各槽独立绑字段 | indexed 读写 | ✅ | `customVizFieldSlots.test.ts` |
| 6 | BROWSER 看板走查 | 自定义分区+插入+三 Tab 右轨 | **通过** | ✅ | MCP snapshot + CDP payload |

## 5. 修复文档（P0）

### T6 — viz-components customViz 全链路

**判定 / 得分**：STUB 2/10，C=0  
**期望 vs 实际**：发布/linked 插入后，组件库编辑页应同 432px 右轨编辑 customVizConfig；列表卡片可预览。  
**实际**：`VizComponentEditPage` 的 `ComponentEditRail` 对 customViz **return null**；`VizComponentLivePreview` **无** `CustomVizWidget` 分支；hub `widgetTypeLabel` / 筛选无 customViz。  
**根因**：`fe/src/pages/admin/viz-components/VizComponentEditPage.tsx:93` · `VizComponentLivePreview.tsx`（无 customViz）  
**修复方向**：接 `CustomVizEditRail`；Preview 挂 `CustomVizWidget`；hub 文案/筛选补 `customViz`；补 backend `test_viz_components_custom_viz.py` roundtrip。  
**修后验收**：C≥2，总分≥8，T6 REAL。

### T4 — execute → 宿主 payload 正确性

**判定**：STUB 4/10  
**期望 vs 实际**：手配字段后 `useChartExecute` 出 rows，`injectCustomVizPayload` 写入 JSON；bundle 可读并渲染。  
**根因**：无 `customVizPayload.test.ts` / 无 integration；vitest 全 mock apiFetch。  
**修复方向**：单测 assert `injectCustomVizPayload` DOM；`customVizExecute` + mock execute 断言 columns/rows；可选 smoke 含 fake bundle 读 `.vs-cv-payload`。  
**修后验收**：T4 CHAIN + C≥2。

### T3 — CustomVizEditRail smoke

**判定**：STUB  
**期望 vs 实际**：选中 customViz 渲染三 Tab + 数据集列 + 「更新组件数据」  
**根因**：无 `CustomVizEditRail.smoke.test.tsx`（计划项未做）  
**修复方向**：参照 `ChartEditRail.smoke.test.tsx` 补 Provider/Query mock。  
**修后验收**：T3 UI 深度，L≥2 C≥2。

### T2 — 图表盘「自定义」UI 测

**判定**：STUB  
**修复方向**：`ChartPickerPopover.test.tsx` mock `fetchAiVizArtifacts`，断言「自定义」分区与 tile 点击 `onInsertCustomViz`。  
**修后验收**：T2 UI。

### B4 — manifest 多槽字段

**判定**：STUB（正确性风险）  
**期望 vs 实际**：`fieldSlots.metrics.max>1` 时应多 metric 槽；现全部映射 `metrics[0]`。  
**根因**：`CustomVizDataSlots.ts:15-43`  
**修复方向**：按 slot index 读写 dimensions/metrics 数组。  
**修后验收**：C≥2 对多槽 manifest 样例。

### DOC — PRD 与 Out 表矛盾

**判定**：文档不一致  
**根因**：`docs/automate/prd/F17-AIVIZ.md` Out 仍列 M2 未做，验收却勾选 AIVIZ-006/007  
**修复方向**：同步 Out 表与验收状态（prd-sync）  
**优先级**：P1

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T6 | 组件库编辑/预览接 CustomVizEditRail + LivePreview |
| P0 | T4 | payload/execute 单测 + 绑数 L1 对比 |
| P0 | T3 | CustomVizEditRail smoke test |
| P1 | T2 | ChartPicker 自定义分区 vitest |
| P1 | B4 | 多 fieldSlots 绑字段 |
| P1 | DOC | F17 Out 与勾选对齐 |
| P2 | T8 | 数据大屏 BROWSER 走查 |

## 7. 交接

- **结论**：**未完成（不可标 REAL）**。看板编辑主路径 **代码已落地约 70%**，但 truth 维度上多为 **GATE/CHAIN 静态或 mock**，组件库二级路径 **明确断点**，无浏览器走查。
- 建议：P0 走 `root-first-solve` 或批准 Agent 按 §5 修 T6→T4→T3。
- 用户批准修复：**是**（2026-08-13：P0 已修，见 §8）

## 8. P0 修复回执（2026-08-13）

| ID | 修复 | 证据 |
|----|------|------|
| T6 | `VizComponentEditPage` 接 `CustomVizEditRail`；`VizComponentLivePreview` 接 `CustomVizWidget`；`vizComponentPageUtils` + hub 文案 | `vizComponentPageUtils.test.ts` · `test_create_publish_and_resolve_custom_viz` |
| T4 | `customVizPayload.test.ts` · `customVizExecute.test.ts` | vitest 5 passed |
| T3 | `CustomVizEditRail.smoke.test.tsx` | vitest 1 passed |
| B4 | `expandCustomVizFieldSlotsForUi` + indexed 绑字段 | `customVizFieldSlots.test.ts` |
| DOC | F17 Out 表与 AIVIZ-006/007 对齐 | `F17-AIVIZ.md` |

**修后复验**：`vitest custom-viz/` 8 passed · pytest hybrid + custom_viz 7 passed · **仍缺 BROWSER 走查**，总体 **PARTIAL→接近 B**，不可标全 REAL。

## 9. P1 修复回执（2026-08-13）

| ID | 修复 | 证据 |
|----|------|------|
| T2 | `ChartPickerPopover.test.tsx`：自定义 nav/tile、click 插入、drag payload、无 callback 不 fetch | vitest 4 passed（含 cleanup 修复 DOM 泄漏） |
| B4 | （P0 延续）多 fieldSlots indexed 绑字段 | `customVizFieldSlots.test.ts` |
| P1-DnD | `dashboardDnd.customViz.test.ts` | vitest 1 passed |
| P1-Payload | `CustomVizWidget.payload.test.tsx` execute rows 注入 DOM | vitest 1 passed |

**P1 复验**：`vitest` 7 文件 14 passed · pytest 7 passed · **仍缺 BROWSER 走查**（T8 / 绑数真机 / bundle 消费）。

## 10. P2 修复回执（2026-08-13）

| ID | 修复 | 证据 |
|----|------|------|
| Dialog | `CreateVizComponentDialog` 接 `onInsertCustomViz`；`widgetType=customViz` 创建 payload | `CreateVizComponentDialog.test.tsx` 2 passed · `vizComponentDefaults.ts` |
| BROWSER | 看板编辑：图表盘「自定义」→ 点击「演示排名条」→ 画布 widget + 432px 右轨（数据/样式/高级） | MCP snapshot；CDP：`.vs-cv-payload` 存在、`iframeCount=0`、bundle 渲染 `ready` |

**P2 复验**：vitest 16 passed（含 Dialog）· **看板主路径 BROWSER 已验** · 仍缺：大屏画布走查、绑 dataset→execute→rows 非空真机对比。
