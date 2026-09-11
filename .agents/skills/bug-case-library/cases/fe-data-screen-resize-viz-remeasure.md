# 大屏编辑 resize 后图表尺寸不同步

## 症状

- 路由：`/admin/data-screens/:id/edit`
- 操作：拖八向手柄 resize chart widget，松手
- 表现：`.pixel-shape-outer` 尺寸已变，但 S2/G2Plot 仍按旧 `clientWidth/Height` 渲染；样式 Tab 改色画布无反馈（viz 未重绘）

## 根因

1. **交互期** `usePixelShapePlayer` 跳过 RO；松手后 RO 在 imperative 外框已写时可能 silent
2. **G2Plot** create/update 后未 `changeSize`
3. **S2** remeasure 被 `isShapePlaying` 阻断或 commit 总线未强制触发
4. **Inspector 感知**：`LayerPanel` 未走 `selectWidgetOnCanvas`，右栏未展开

## 修复

- `dispatchPixelLayoutGeometryCommitted` + `useEmbeddedChartLiveResize.forceResize`（commit 绕过 playing）
- `layoutFootprint`（`pixelSize`）prop → G2Plot/S2 remeasure
- `useG2Plot.applyContainerSize` 于 create/update/visualScale/layoutFootprint
- `useElementSize` 用 `clientWidth/Height`
- `selectWidgetOnCanvas` 含 `text`；图层选组件走同一入口

## 回归

```bash
cd fe
pnpm exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
pnpm exec vitest run src/components/dashboard/ChartEditRail.smoke.test.tsx
pnpm exec playwright test e2e/data-screen-resize-content.spec.ts
```

## 锚点

- `fe/src/hooks/useEmbeddedChartLiveResize.ts`
- `fe/src/components/charts/ChartRenderer.tsx`（`layoutFootprint`）
- `fe/src/components/charts/engine/antv/useG2Plot.ts`
- `fe/src/components/charts/engine/antv/s2/AntvS2View.tsx`
- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
