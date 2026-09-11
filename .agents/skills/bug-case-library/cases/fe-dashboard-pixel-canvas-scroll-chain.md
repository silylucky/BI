# 像素画布滚到组件内层顶/底后无法继续滚动

- **ID**: CASE-2026-07-16-002
- **状态**: 已修复
- **影响**: fe · 看板编辑 · 像素画布
- **首次发现**: 2026-07-16

## 症状

- 看板编辑页像素画布整体很高（`editor-canvas-main` 缩放后仍超出视口），但在表格等组件上滚轮滚到内层顶/底后，**画布不再继续滚动**
- 用户感觉「整体画布滑到顶或底就卡住」，尤其鼠标悬停在 `embedded-chart-table-host` / `pixel-shape-inner` 上时

## 根因

| 层级 | 原因 |
|------|------|
| 内层滚动 | `EmbeddedChartTable` 等组件使用 `overflow-auto overscroll-contain`，滚到边界后 `overscroll-behavior: contain` 阻止链式滚动 |
| 编辑态语义 | 对标 DE，编辑态应优先滚 `pixel-canvas-host`，而非组件内纵向滚动 |
| 被动监听 | 需 `passive: false` 才能在边界时 `preventDefault` 并改 `host.scrollTop` |

## 修复方式

1. `pixelCanvasWheelScroll.ts`：`routePixelCanvasWheel` 在内层仍可滚时交给内层；内层到顶/底或指针落在 `overflow-hidden` 组件子树上时，主动滚 `pixel-canvas-host`
2. `PixelCanvas.tsx`：`wheel` 监听使用 `capture: true` + `passive: false`，确保组件上方滚轮不会丢失
3. **勿**在编辑态对表格设 `overflow-y: hidden`（会导致内层与画布均无法滚）
4. 组件内滚动区 `overscroll-behavior-y: auto` 辅助链式滚动

## 验证

- `pixelCanvasWheelScroll.test.ts` 顶/底链式滚动用例
- 编辑页：鼠标在表格组件上，内层到顶后继续向上滚应滚动画布；到底后继续向下滚同理

## 关联

- `fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx`
- `fe/src/components/charts/adapters/EmbeddedChartTable.tsx`
- `fe-dashboard-edit-double-scrollbar.md`（页面级双滚动条，不同问题）
