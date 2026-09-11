# 仪表板样式分层与背景覆盖修复

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  

日期：2026-07-14  
Bug：`docs/bugs/BUG-5_dashboard-style-overrides-background_2026-07-14.md`  
PRD：DASH-008-01 / DASH-008-03

---

## 0. 需求契约

| 字段 | 值 |
|------|-----|
| request | 仪表板风格（主题）不得覆盖用户设置的仪表板背景 |
| type | bugfix |
| goal | 建立样式分层模型，canvas/widget/theme 各司其职 |
| scope_include | dashboardStyleConfig、DashboardStyleSurface、PixelCanvas artboard、index.css chrome、DashboardLayoutPreview、单测 |
| scope_exclude | 背景图上传 API；widget 级完整 DE 配色；后端 schema 变更 |
| acceptance | BUG-3 验收清单 + vitest 绿 |
| risk_level | low |
| autonomy_policy | auto_accept_low_risk |

---

## 1. 根因摘要

见 BUG-3 文档 R1–R4。核心：**多层同时写 background，且 `dark` 类触发子节点 opaque 默认色**。

## 2. 目标架构

### 2.1 单一真理源

`canvasSurfaceStyle(config)` 负责画板可见底色：

1. `canvasBackground` 有值 → 使用该色
2. 否则 `colorScheme === dark` → `#0f172a`
3. 否则 → `#ffffff`
4. `canvasBackgroundImage` 叠加 cover

### 2.2 层职责

| 组件 | 职责 |
|------|------|
| `dashboard-canvas-surface` | 仅编辑点阵；`data-canvas-custom-bg` 时透明 |
| `DashboardStyleSurface` | 应用 `canvasSurfaceStyle` + `data-dashboard-color-scheme` |
| `pixel-canvas-artboard` | **透明**，只保留 ring；不写 bg-white/dark:bg |
| `pixel-shape-inner` | 默认透明；组件壳由 `widgetStyle` 驱动 |

### 2.3 预览链路

`DashboardLayoutPreview` 外包 `DashboardStyleSurface styleConfig={layout.styleConfig}`。

## 3. 实施任务

### T1 — `dashboardStyleConfig.ts`
- `hasCustomCanvasBackground`
- `canvasChromeUsesDotGrid`
- `canvasSurfaceStyle` 补主题默认色与优先级

### T2 — 画板层去硬编码
- `PixelCanvas` artboard 改透明
- `PixelShape` inner 移除 `bg-white dark:bg-gray-900`

### T3 — Chrome 条件化
- `DashboardStyleSurface` 输出 `data-canvas-custom-bg`
- `index.css` 自定义背景时禁用点阵

### T4 — 预览消费
- `DashboardLayoutPreview` + Share 页挂载 StyleSurface

### T5 — 单测
- `dashboardStyleConfig.test.ts`：背景优先于主题
- `DashboardStyleSurface.test.tsx`：custom-bg 标记

### T6 — 验证

```bash
cd fe && npx vitest run \
  src/components/dashboard/dashboardStyleConfig.test.ts \
  src/components/dashboard/DashboardStyleSurface.test.tsx \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
```

## 4. 八维度自审

| 维度 | 结论 |
|------|------|
| 正确性 | 🟢 明确优先级链 |
| 完整性 | 🟢 编辑+预览+像素/栅格 |
| 可维护性 | 🟢 集中 canvasSurfaceStyle |
| 风险 | 🟢 纯 FE 样式，可逆 |
