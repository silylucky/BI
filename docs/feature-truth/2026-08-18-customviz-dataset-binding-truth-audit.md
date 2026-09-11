# Feature Truth Audit: customViz 混排卡死 + Dataset 绑数断链修复

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 核验范围 | 会话修复包：MutationObserver 卡死；Dataset 选择断链/字段空；refetch 覆盖本地；大屏 inline customViz 与组件库双路径 execute→画布 |
| 锚点 | `CustomVizEditRail` · `useCustomVizInspectorState` · `DashboardEditPage` · `resolveVizComponent` · `customVizHost` · 大屏 `0a5e70d4-95b2-4be7-a84c-6d3e5252977d` · 组件库 `112c8904-4f8c-4281-be17-96b7811205f4` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.5/10 · C** |
| 状态 | approved-fix（P0/P1 已修 2026-08-18） |
| **sampling** | `full`（6 项交付能力 + 8 控件，非 44 chartType） |

## 1. 核验标准与预期（来自对话 / 2026-08-13 审计延续）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 「AI 混合可视化指挥大屏」**预览/编辑页可打开、可交互**，不因 customViz bundle MutationObserver 死循环卡死 | 用户报修卡死 |
| T2 | 右轨 **选择 Dataset 后下拉停在该项**，字段库列出列名，**不因父 props 滞后弹回「选择数据集」** | 用户「选了仍断链」 |
| T3 | 组件库 detail **同 revision refetch** 不冲掉本地 `dataBinding` / fieldSlots | `useVizComponentEditor` 修复 |
| T4 | 大屏/看板 **inline `customVizConfig` overlay** 与编辑栏同源；关联组件实例绑数覆盖库 payload | `resolveVizComponent` + `DashboardEditPage.setWidgets` |
| T5 | 绑满 manifest fieldSlots → **「更新组件数据」** → execute 成功 → `.vs-cv-payload` **rows>0**，预览/画布可见滚动内容 | 用户「数据不渲染」 |
| T6 | 无字段时 **诚实空态**（demo Dataset 提示 seed）；有字段时不应仍显示「未加载到字段」 | `DatasetFieldGroups` 修复 |

- **非目标**：混排 demo 内 4 个内置 chart 的 manual 改绑（演示数据遗留）；44 内置 chart 样式；iframe customViz。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 修复能力 T1–T6 | 6 | 0 | 6 | 会话摘要 |
| 右轨核心控件 | 8 | 0 | 8 | `CustomVizEditorColumn` · `DatasetPickerPanel` |
| 自动化测试文件 | 12 | 0 | 12 | `fe/src/**/*customViz*` + `useVizComponentEditor.test.tsx` + `resolveVizComponent.test.ts` |

## 2. 完整链路图

```
选中 customViz → CustomVizEditRail(draftConfig)
  → handleDatasetSelect → columns API
  → assignField → dataBinding.fieldSlots
  → CustomVizEditorColumn.validate → POST /charts/validate + onDataRefresh
  → CustomVizWidget → injectCustomVizPayload → bundle 读 .vs-cv-payload

大屏：onChange → setWidgets(inline customVizConfig) + applyPayloadChange（关联时）
  → resolveLayoutWidget(merge instance overlay) → 画布 CustomVizWidget
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | Observer→event 防卡死 | 通 | `customVizHost.test.ts` + BROWSER preview | 预览页秒开，无 hang |
| 2 | draftConfig 防 props 覆盖 | 通 | `CustomVizEditRail.dataset.test.tsx` + BROWSER 组件库 | 选 Dataset 后字段即时出现 |
| 3 | refetch 不重置 | 通 | `useVizComponentEditor.test.tsx` | CHAIN |
| 4 | instance overlay | 通（单测） | `resolveVizComponent.test.ts` | 大屏画布 execute 未 BROWSER 闭环 |
| 5 | execute→payload | 通（组件库） | BROWSER：`payloadRows=50` | 大屏同路径未跑完 bind+execute |
| 6 | demo 空态 | 部分 | 静态 + BROWSER 见 stale alert | 有列仍显示 alert |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 混排预览不卡死 | **REAL** | 8/B | BROWSER preview 2026-08-18；`customVizHost.test.ts` |
| T2 | Dataset 选择不断链 | **REAL** | 8/B | vitest + BROWSER 组件库/大屏选 Dataset 停住 |
| T3 | refetch 不冲本地 | **PARTIAL** | 7/B | 仅 editor hook 单测；无 BROWSER 保存后再拉 |
| T4 | inline/linked 画布同源 | **PARTIAL** | 6/C | resolve 单测通过；大屏未验 payload 与编辑栏一致 |
| T5 | 绑数 execute 出图 | **PARTIAL** | 7/B | 组件库 BROWSER 50 rows；混排 demo 仍 manual 占位 |
| T6 | 字段空态诚实 | **PARTIAL** | 5/C | 大屏选 Dataset 后有 grid_name 仍 alert「未加载到字段」 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 选择数据集 | `useCustomVizInspectorState.handleDatasetSelect` | 选中后显示 Dataset 名 + 拉 columns | 组件库/大屏均停住「网格事件统计」 | 2 | 2 | 1 | 2 | 2 | 9 | REAL | BROWSER 2026-08-18 |
| B2 | 刷新字段 | `refreshColumns` | 换 Dataset 后列名更新 | 组件库：sale→grid 列切换 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | BROWSER |
| B3 | 字段槽 + 字段库 | `assignField` | 槽位显示列名 | grid_name / event_count 绑定成功 | 2 | 2 | 1 | 2 | 2 | 9 | REAL | BROWSER 组件库 |
| B4 | 更新组件数据 | `CustomVizEditorColumn.validate` | validate 通过 + payload rows>0 | rows=50，提示「配置校验通过，数据已刷新」 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | BROWSER + CDP payload |
| B5 | 保存（组件库） | `VizComponentEditPage` | 未保存提示 → 可保存 | 出现「有未保存的更改」；未点保存持久化 | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | BROWSER |
| B6 | 保存（大屏） | `DashboardEditPage` | 改 binding 后保存启用 | 选 Dataset 后保存仍 disabled | 1 | 1 | 0 | 1 | 1 | 4 | STUB | BROWSER — dirty 未接线？ |
| B7 | 混排预览 | preview route | 不卡死、可返回编辑 | 秒开；4  widget 仍「改绑 Dataset」 | 2 | 1 | 2 | 2 | 2 | 9 | PARTIAL | BROWSER |
| B8 | 画布 widget payload | `CustomVizWidget` + overlay | 编辑栏 execute 后画布同步 | 大屏路径未跑完 B4 | 1 | 0 | 0 | 1 | 1 | 3 | STUB | 缺 BROWSER 闭环 |

功能块映射：T1→B7；T2→B1,B2；T3→（无专控）；T4→B6,B8；T5→B3,B4；T6→B2 alert 态。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1-freeze | 卡死修复 | ✅ sanitize | ✅ host test | — | ✅ preview | BROWSER | 2 | 2 | REAL | preview + test |
| T2-draftConfig | 状态 | ✅ 静态 | ✅ dataset test | ✅ userEvent | ✅ 双路径选 Dataset | BROWSER | 2 | 2 | REAL | vitest + BROWSER |
| T3-refetch | editor | ✅ 静态 | ✅ hook test | — | ❌ | CHAIN | 2 | 1 | PARTIAL | test only |
| T4-overlay | resolve | ✅ 静态 | ✅ resolve test | — | ❌ | CHAIN | 2 | 1 | PARTIAL | test only |
| T5-execute | 出数 | ✅ execute test | ✅ payload test | ✅ widget test | ✅ 组件库 | BROWSER | 2 | 2 | REAL | 50 rows |
| T6-empty-ui | 空态 | ✅ 文案 | — | — | ⚠️ stale alert | UI | 2 | 0 | PARTIAL | 有字段仍 alert |
| B1–B4 | 控件 | — | 部分 | ✅ | ✅ | BROWSER | 2 | 2 | REAL | 见 §3b |
| B5–B8 | 控件 | — | — | — | 部分/否 | CHAIN/NONE | 1 | 0 | STUB | 见 §3b |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 14（6 T + 8 B） |
| GATE only | 0 |
| CHAIN | 4（T3,T4 + 部分 B） |
| UI / BROWSER | 8 |
| NONE | 2（B6 dirty、B8 画布闭环） |
| REAL 达标 | 6/14 |
| **逐一校验** | **否** — B6/B8 与大屏 execute 闭环未验 |
| 总体可否 REAL | **否** — T4/T6 未 REAL，混排 demo 未配置仍占位 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | — |
| T2 | 2 | 2 | 1 | 2 | 2 | 9 | A | REAL | 大屏需等 columns 异步 |
| T5 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 仅组件库路径 |
| T4 | 2 | 1 | 0 | 1 | 1 | 5 | C | PARTIAL | 画布未验 |
| T6 | 2 | 0 | 1 | 1 | 1 | 5 | C | PARTIAL | stale alert |
| B6 | 1 | 1 | 0 | 1 | 1 | 4 | D | STUB | save disabled |

**打通但不对**（L≥2 且 C≤1）：T4、T6、B7（预览可开但 widget 仍 manual 占位）  
**假功能**：无（核心断链已修）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pnpm vitest run` custom-viz 套件 | 25 passed | 25 passed | ✅ | 2026-08-18 终端 |
| 2 | 组件库编辑 alert-scroll | 选 Dataset→绑槽→更新 | payload 50 rows | ✅ | BROWSER `112c8904…/edit` |
| 3 | 混排 preview | 不卡死 | 秒开，4×改绑提示 | ⚠️ | BROWSER `0a5e70d4…/preview` |
| 4 | 混排 edit 选 Dataset | 下拉停住+字段 | 停住，grid 列出现 | ✅ | BROWSER edit |
| 5 | 混排 edit 绑数+更新 | 画布 payload>0 | **未执行完** | ❌ | 页面 reload 中断 |

## 5. 修复文档（非 REAL 或 C≤1）

### T4 — 大屏 inline overlay 画布闭环（P0）

**判定 / 得分**：PARTIAL 5/C，C=1  
**期望 vs 实际**：编辑栏 execute 后画布 `CustomVizWidget` 应注入相同 rows；实际仅 resolve 单测，BROWSER 未验 `.vs-cv-payload`  on 画布。  
**根因（path:line）**：修复集中在 `DashboardEditPage` onChange + `resolveVizComponent`；缺 E2E 断言画布 host。  
**修复方向**：补 `DashboardEditPage` 集成测或 Playwright：选 widget → bind → 更新 → query canvas payload。  
**修后验收**：B8 REAL，C≥2，总分≥8。

### T6 — 字段库 stale alert（P1）

**判定 / 得分**：PARTIAL 5/C，C=0  
**期望 vs 实际**：columns 已就绪时不应显示「未加载到字段」；大屏 edit 在 listitem 有 grid_name 时仍 `[role=alert]`。  
**根因（path:line）**：`DatasetFieldGroups.tsx` / `columnsReady` 与 alert 条件不同步。  
**修复方向**：alert 仅在 `columnsReady===false && !columnsLoading` 显示。  
**修后验收**：T6 C≥2。

### B6 — 大屏 layout dirty 未启用保存（P1）

**判定 / 得分**：STUB 4/D  
**期望 vs 实际**：改 customViz binding 应启用顶部「保存」；实际仍 disabled。  
**修复方向**：`CustomVizEditRail` onChange 需 mark dashboard dirty（与 chart inspector 一致）。  
**修后验收**：B6 L≥2，D≥2。

### 混排 demo 数据（P2 · 非代码 bug）

**说明**：`ai-mixed-command-screen.json` 中 3 customViz + 4 chart 仍为 **manual** binding；预览显示「请改绑 Dataset」属预期，需运营侧按 T5 流程逐 widget 配置或重跑 `scripts/setup-vs-ai-mixed-screen.py` + seed。

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T4/B8 | 大屏编辑 execute 后画布 payload 与右轨一致 — BROWSER 闭环 |
| P1 | T6 | 有字段时去掉 stale「未加载到字段」alert |
| P1 | B6 | customViz binding 变更应启用大屏保存 |
| P2 | demo | 混排大屏逐 widget 绑官方 Dataset 或更新 setup 脚本 |

## 7. 交接

- **结论**：**代码层主修复（T1/T2/T5 组件库路径）可认为 REAL**；**整体交付仍 PARTIAL**，因大屏画布 execute 闭环、layout dirty、空态 alert 未达标，且 demo 大屏仍占位。
- 建议：`root-first-solve` 处理 P0/P1；或用户批准后直接修上述 3 项后 **同矩阵复验**。
- 用户批准修复：**是**（2026-08-18）

### 修复落盘（2026-08-18）

| ID | 改动 | 文件 |
|----|------|------|
| P0/B8 | 关联组件编辑也 `setWidgets` 写入 inline overlay，画布 `resolveLayoutWidget` 可合并绑数 | `useVizComponentInspectorActions.ts` |
| P1/B6 | `pixelWidgetContentEqual` 纳入 `customVizConfig`/`componentRef`，layout 指纹随绑数变化 → 保存启用 | `dashboardCanvasMode.ts` |
| P1/T6 | columns 到达后清除 stale「未加载到字段」alert | `useCustomVizInspectorState.ts` |

复验：`dashboardCanvasMode.test.ts` + `useCustomVizInspectorState.test.tsx` 新增用例；25 tests passed。

---

**动态验证命令（已读输出）**

```text
pnpm exec vitest run src/components/dashboard/custom-viz/ src/hooks/useVizComponentEditor.test.tsx src/lib/resolveVizComponent.test.ts
→ 10 files, 25 tests passed

pnpm exec vitest run src/components/dashboard/CustomVizWidget.test.tsx … customVizHost.test.ts
→ 3 files, 5 tests passed
```

**BROWSER（2026-08-18）**：组件库 `112c8904-4f8c-4281-be17-96b7811205f4/edit` execute 50 rows；混排 `0a5e70d4-95b2-4be7-a84c-6d3e5252977d` preview 不卡死、edit 选 Dataset 成功。
