# FE 像素画布拖动/点击坐标漂移

- **ID**: CASE-2026-07-17-001
- **状态**: 已修复
- **影响**: fe / dashboard pixel canvas / 编辑态交互
- **首次发现**: 2026-07-17

## 症状

- 画布左侧大块留白，组件视觉上偏右
- 拖动、点击后组件与鼠标落点不一致，或整块布局「滑」到一侧
- 浅色/深色背景分界与 1440px 画板不对齐

## 根因

1. **坐标参照系错误**：`resolveClientToCanvas` 用 `pixel-canvas-host` + 手算 `horizontalGutter`/`stageLeft`，未计入 `stage` 的 `transform: scale()` 与 flex 居中
2. **测量宽度偏差**：`scaledCanvasMetrics` 用 `clientWidth`，与 `padding-right:20px` 藏条 hack 的视觉外框不一致
3. **预览期宽度覆盖**：`syncPreviewStageMetrics` 拖动中写 `content.style.width`，与 React 状态冲突引发布局跳变

## 修复（勿回退）

- `clientPointToCanvasFromStage`：以 `stage.getBoundingClientRect()` 为唯一换算入口
- `resolvePixelCanvasMeasureWidth`：`getBoundingClientRect().width` 优先
- 预览期仅同步 `content.style.height`
- 编辑态强制 `scaleMode: canvas`（见 `PixelCanvas` `effectiveScaleMode`）

## 验证

- `vitest run src/components/dashboard/pixelCanvas/geometry.test.ts`
- `vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx`
- 人工：拖放/点击/滚轮后落点与视觉一致

## 关联

- `fe/src/components/dashboard/pixelCanvas/geometry.ts`
- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- `docs/automate/plans/2026-07-17-pixel-canvas-coordinate-parity.md`
