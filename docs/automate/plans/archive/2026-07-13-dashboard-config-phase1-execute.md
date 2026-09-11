# DASH-008 Phase 1：仪表板配置栏（主题·整体·背景·联动）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-13  
母计划：`docs/automate/plans/2026-07-13-dashboard-config-inspector-de-full.md`  
真理源：`docs/automate/prd/F07-DASH.md` · DataEase [§5.1–5.3、§5.7](https://dataease.cn/docs/v2/user_manual/dashboard_basicfunctions/)

> **dev-autopilot 契约**：本文件为 **A5 直接执行** 的合同；Phase 2+（图表样式/配色/标题/数字格式/高级样式）不在本计划范围。

---

## 背景与目标

**问题描述**：点击画布空白时右侧已展示 DataEase 风格「仪表板配置」手风琴，但 6 个分组仍为占位，已有 3 个分组能力不完整；`styleConfig` 未在 View/Share 全链路消费，筛选联动分组在无 filter 时隐藏。

**成功标准**：

1. **DASH-008-01a**：`colorScheme` 在编辑画布、View 页、Share 页一致生效；保存布局后刷新回读一致。
2. **DASH-008-02a**：栅格模式支持间隙预设（无/小/中/大/自定义 0–48px）；像素模式可选 `pixelGutter` 0–12（默认 0）。
3. **DASH-008-02b**：v2 画布 `scaleMode` 可在「按画布比例」「按组件比例」间切换，编辑与预览行为与选项一致。
4. **DASH-008-03a**：仪表板背景支持色板快捷色 + 文本/取色输入 + 一键清除。
5. **DASH-008-10d**：「筛选联动」分组**常显**（无 filter 时空态引导，不隐藏整个分组）。
6. BE `styleConfig` schema 与 FE round-trip 测试通过；PRD 登记 **DASH-008** Phase 1 验收项。

**非目标（本 Phase 不做）**：

- 图表样式/配色/标题/查询组件样式/数字格式/高级样式（Phase 2–4）
- 背景图片上传、刷新频率、defaultQueryLimit、themeAccent、fontFamily
- 移除占位分组 UI（Phase 4 统一处理）
- 合并/发布双版本、外部参数 Ticket

---

## 整体方案

1. **扩展 `DashboardStyleConfig`**（FE `layoutUtils` + BE `schemas.py` + `persistedStyle`）新增 `gapPreset`、`pixelGutter`、`scaleMode`；`colorScheme` 已在 FE，补 BE 字段。
2. **`DashboardContextInspector`** 替换简陋输入：间隙 Select、缩放 Radio、背景色板、联动常显空态。
3. **消费链**：`DashboardEditCanvas` / `PixelCanvas` / `geometry.scaledCanvasMetrics` 读 `scaleMode`；`DashboardGrid` 读 `gapPreset`；`DashboardLayoutPreview` + `DashboardSharePage` 包 `colorScheme` + `canvasBackground`。
4. **PRD**：`F07-DASH.md` 新增 DASH-008 分片条目 Phase 1 勾选。

---

## 关键决策

| # | 决策 | 备选 | 理由 |
|---|------|------|------|
| D1 | `scaleMode: 'canvas' \| 'component'` | 仅 canvas | 对标 DE §5.2 两种缩放；component = `min(scaleX,scaleY)` |
| D2 | 间隙预设映射 px：0/4/8/16/custom | 仅自由数字 | 对标 DE 大中小；custom 保留现有 `widgetGap` |
| D3 | 像素 `pixelGutter` 独立字段 | 复用 widgetGap | v2 当前 gap=0 无缝；不与栅格语义混用 |
| D4 | 背景图 Phase 1 不做 | 本 Phase 做 URL | 无上传 API 契约，避免半实现 |
| D5 | 主题保存合并「保存布局」 | 独立保存 API | 与已收口交互契约一致 |
| D6 | 占位分组保留 disabled | 本 Phase 全实现 | 范围可控；Phase 4 再清零占位 |

---

## 改动清单

### Task 1 — 类型与持久化契约

| 项 | 内容 |
|----|------|
| 位置 | `fe/src/components/dashboard/layoutUtils.ts` |
| 改动 | `DashboardStyleConfig` 增加 `gapPreset?: 'none'\|'sm'\|'md'\|'lg'\|'custom'`、`pixelGutter?: number`、`scaleMode?: 'canvas'\|'component'`；导出 `resolveWidgetGap(config)`、`GAP_PRESET_PX` 常量 |
| 位置 | `fe/src/components/dashboard/dashboardCanvasMode.ts` |
| 改动 | `persistedStyle()` 识别新字段；`buildDashboardLayoutForSave` 不变 |
| 位置 | `backend/app/dashboard/schemas.py` |
| 改动 | `DashboardStyleConfig` 增加 `color_scheme`、`gap_preset`、`pixel_gutter`、`scale_mode`（camelCase alias） |
| 验证 | `pytest tests/test_dash_m5_widgets.py -q -k style` 或新增 `test_dashboard_style_config_roundtrip` |

### Task 2 — 配置栏 UI（Inspector）

| 项 | 内容 |
|----|------|
| 位置 | `fe/src/components/dashboard/DashboardContextInspector.tsx` |
| 改动 | 「整体配置」：Select 间隙预设 + custom 时显示 number；RadioGroup `scaleMode`；像素模式显示 `pixelGutter`；「仪表板背景」：6 色快捷色 + Input + 清除按钮 |
| 位置 | `fe/src/components/dashboard/DashboardConfigSection.tsx` |
| 改动 | 如需：支持 `data-testid` on section |
| 位置 | `fe/src/components/dashboard/DashboardContextInspector.tsx` |
| 改动 | 「筛选联动」**无条件渲染**；`filterWidgetCount===0` 时显示空态文案 + 引导拖入筛选器 |
| 验证 | `vitest run DashboardContextInspector.test.tsx` |

### Task 3 — 画布与预览消费

| 项 | 内容 |
|----|------|
| 位置 | `fe/src/components/dashboard/pixelCanvas/geometry.ts` |
| 改动 | `scaledCanvasMetrics(..., scaleMode)`：`canvas` = 宽度贴合（现状）；`component` = `min(scaleX, scaleY)` |
| 位置 | `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx` |
| 改动 | props 增加 `scaleMode`；传入 `scaledCanvasMetrics`；`pixelGutter` 影响 `PIXEL_CANVAS_GUTTER` 或 collision gap |
| 位置 | `fe/src/components/dashboard/dashboard-edit/DashboardEditCanvas.tsx` |
| 改动 | 透传 `styleConfig.scaleMode`、`pixelGutter`、`canvasBackground`、`colorScheme` |
| 位置 | `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` |
| 改动 | 向 canvas 传完整 styleConfig 字段 |
| 位置 | `fe/src/components/dashboard/DashboardGrid.tsx` |
| 改动 | `margin`/`containerPadding` 使用 `resolveWidgetGap(styleConfig)` |
| 位置 | `fe/src/components/dashboard/DashboardLayoutPreview.tsx` |
| 改动 | 读取 `layout.styleConfig`：外层 `dark` class + background style |
| 位置 | `fe/src/pages/admin/dashboard/DashboardSharePage.tsx` |
| 改动 | 同上 colorScheme/background |
| 验证 | `vitest run pixelCanvas/geometry.test.ts`；更新 viewport/scale 相关断言 |

### Task 4 — 测试与文档

| 项 | 内容 |
|----|------|
| 位置 | `fe/src/components/dashboard/DashboardContextInspector.test.tsx` |
| 改动 | 间隙预设、scaleMode、联动常显断言 |
| 位置 | `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx` |
| 改动 | 可选：保存 layout 含 styleConfig 新字段 round-trip |
| 位置 | `docs/automate/prd/F07-DASH.md` |
| 改动 | 新增 `DASH-008` 条目，Phase 1 子项勾选 |
| 位置 | `docs/ui/layout.md` |
| 改动 | 编辑页右栏「仪表板配置」IA 一行登记 |
| 验证 | 见下方整体验证方案 |

---

## 执行顺序

```
Task 1（契约）→ Task 2（UI）→ Task 3（消费链）→ Task 4（测试/PRD）
```

Task 2 可与 Task 3 中 geometry 并行，但 **合并前须完成 Task 1**。

---

## 整体验证方案

```bash
# FE
cd fe && npx vitest run \
  src/components/dashboard/DashboardContextInspector.test.tsx \
  src/components/dashboard/pixelCanvas/geometry.test.ts \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx

# BE（Task 1 完成后）
cd .. && pytest tests/test_dash_m5_widgets.py -q
```

**手工门控（Phase 1）**：

1. 编辑页点击空白 → 右栏「仪表板配置」展开，筛选联动分组可见（即使无 filter）。
2. 切换深色主题 → 画布区域变暗；保存刷新后仍深色。
3. 栅格看板切换间隙「中」→ 组件间距变化；像素看板切换 `pixelGutter` → 组件间出现缝隙。
4. 切换缩放模式 → 单组件时画布缩放明显变化（component 更小）。

---

## 八维度自审

| 维度 | 评级 | 说明 |
|------|------|------|
| 目标-实现一致性 | 🟢 | 6 条成功标准均映射 Task 1–4 |
| 必要性 | 🟢 | 无图表全局样式等同 Phase 2 范围 |
| 正确性 | 🟢 | scaleMode 两路径有 geometry 单测 |
| 完整性 | 🟡 | 背景图/刷新留 Phase 5；已声明非目标 |
| 一致性 | 🟢 | 复用 `DashboardConfigSection`、现有 save 路径 |
| 副作用 | 🟡 | scaleMode 默认 `canvas` 保持现状；component 可能留白 |
| 降级合理性 | 🟢 | 缺字段用默认值，不静默丢配置 |
| 顺序依赖 | 🟢 | Task 1 先行 |
| 可验证性 | 🟢 | vitest + pytest + 4 条手测 |

**自审结论**：可提交 plan-review（1 项 🟡 已标注为非目标承接）。

---

## 推荐执行模型

- implementer：`composer-2.5` 或默认
- spec-reviewer / code-quality：同轮 plan-execute 内置

---

## 完成后母计划状态更新

| 功能 ID | Phase 1 后预期 |
|---------|----------------|
| DASH-008-01 | 3/4（缺自定义主题） |
| DASH-008-02 | 2/6 |
| DASH-008-03 | 1/3 |
| DASH-008-10 | 3/4 |

母计划 Phase 2 计划文件：`docs/automate/plans/2026-07-13-dashboard-config-phase2-execute.md`（Phase 1 验收通过后起草）。
