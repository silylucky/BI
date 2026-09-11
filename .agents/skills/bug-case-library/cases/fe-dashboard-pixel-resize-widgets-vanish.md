# 像素看板 resize 后画布组件全部消失（图层仍在）

- **ID**: CASE-2026-07-23-001
- **状态**: 未修复（仪表板邻块路径）；大屏见 BUG-12
- **影响**: fe / dashboard edit / pixel canvas v2
- **首次发现**: 2026-07-23

## 症状

- 编辑像素看板时拖动 resize 手柄调整组件大小，松手后画布上**所有组件框不可见**
- 左侧图层列表仍显示全部组件
- 刷新页面后组件恢复正确位置

## 根因（仪表板路径）

1. resize 预览期 `flushPreview` 通过 `previewRegistry.applyAll` 对邻块做 imperative 位移
2. 松手后邻块若 layout 坐标未变，`PixelShape` 的 `useLayoutEffect` 不触发，`display` 与 DOM 双轨失步
3. R4（2026-07-23）在 `PixelShape` 订阅 `PIXEL_LAYOUT_GEOMETRY_COMMITTED` 未解决大屏场景，且与 `finish()` 过早 dispatch 形成竞态

## 大屏场景

- **不走**邻块 preview（`suppressResizePreview` + overlap 模式）
- 见 [`docs/bugs/BUG-12_data-screen-resize-content-vanish_2026-07-20.md`](../../../docs/bugs/BUG-12_data-screen-resize-content-vanish_2026-07-20.md)

## 锚点

- `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
