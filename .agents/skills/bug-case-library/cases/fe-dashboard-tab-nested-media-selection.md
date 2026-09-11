# Tab 内嵌媒体点击无法打开配置栏

## 症状

- 页签（Tabs）容器内拖入图片组件后，点击画布中的媒体占位「在右侧配置图片」
- 右侧仍显示页签配置或整栏无响应，无法进入 `MediaEditRail`

## 根因

1. **`MediaWidget` 未 `stopPropagation`**：点击冒泡到 `TabsWidget` 的 `onClick`，最终选中的是页签宿主而非子组件
2. **像素画布 `PixelShape` 内层 `onPointerDown`**：在 `click` 之前已将选中设为 tabs shape（`FilterWidget` 已有 `pointerDown` 拦截，媒体没有）
3. **拖入 Tab 后默认选中宿主**：`commitPixelPaletteInsert` 在 Tab 内插入后 `handleSelect(tabsHost.id)`，未选中新建子组件

## 修复

- `MediaWidget`：`onClick` / `onPointerDown` 均 `stopPropagation`
- `DashboardCanvasWidgetRenderer`：`nested` 时走 `onNestedSelect`
- `TabsWidget`：子组件容器 `data-tab-child-widget`，面板空白点击才不抢子组件选中
- `DashboardEditPage`：Tab 内插入后选中 `draft.id` 并 `setChartRailOpen(true)`

## 锚点

- `fe/src/components/dashboard/MediaWidget.tsx`
- `fe/src/components/dashboard/TabsWidget.tsx`
- `fe/src/components/dashboard/dashboard-edit/DashboardCanvasWidgetRenderer.tsx`
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`

## 回归

- `fe/src/components/dashboard/MediaWidget.test.tsx`
