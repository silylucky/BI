# 看板编辑：点击空白未切回「仪表板配置」侧栏

## 症状

- 选中组件后，点击像素画布空白（`pixel-canvas-host` / `pixel-canvas-content` 留白区）或页头空白，右侧仍显示组件配置，或未展开「仪表板风格 / 整体配置」(`DashboardContextInspector`)。
- 对标 DataEase：空白点击应回到看板级配置轨。

## 根因

1. `onClearSelection` 仅 `clearSelection()`，未 `setChartRailOpen(true)`；侧栏若已收起则仍显示折叠 Tab。
2. `PixelCanvas` 仅在 `host` / `stage` 的 `currentTarget === target` 时清选；居中缩放后 `pixel-canvas-content` 留白区点击目标为 content 节点，未触发清选。

## 修复

- `DashboardEditPage.openDashboardContext`：清选 + 关闭联动面板 + 展开配置轨；供画布清选、页头空白、工具栏空白复用。
- `PixelCanvas`：`pixel-canvas-content` 同步 `handleBlankPointerDown`。
- `AdminPageShell` / `DashboardEditWorkspace`：页头与画布顶栏空白点击回调。

## 回归

- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`：`clears selection when clicking blank canvas content outside the stage`

## 锚点

- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` — `openDashboardContext`
- `fe/src/components/dashboard/DashboardContextInspector.tsx`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
