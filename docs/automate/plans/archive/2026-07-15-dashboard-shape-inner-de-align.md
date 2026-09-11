# Headless Automation Plan · shape-inner DE 对齐

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
Date: 2026-07-15

## 目标

将 `WidgetShapeChrome`（标题+备注）移入 `pixel-shape-inner`，与图表共享同一容器样式（padding / 背景 / 圆角 / deStyle），对标 DataEase `shape-inner`。

## 任务

### T1 — 合并 inner 样式管线
- `mergeShapeInnerPresentation()`：`shell.outer` + `shell.inner` 合并到 inner
- `pixel-shape-body` 仅保留结构描边，不再承载 widget 背景/padding

### T2 — PixelShape DOM 重构
- `pixel-shape-inner`：`flex flex-col`
- 顺序：背景层 → `WidgetShapeChrome` → `pixel-shape-content`（children）

### T3 — CSS
- `shape-title` 在 inner 内：取消重复水平 padding，仅保留标题与图表间距
- `isPlayer` 选择器改为 `.pixel-shape-content`
- inner 无 padding 时给 DE 默认内边距（~9.5px 逻辑）

### T4 — 验证
- `WidgetShapeChrome.test.tsx`
- `PixelShape*.test.tsx`
- `chartDeStyle` 单测（若新增 helper）
