# Dashboard RGL 交互失败 → 像素画布迁移

- **ID**: CASE-2026-07-13-003
- **状态**: 已修复（代码）；真实浏览器 Pointer QA 待执行
- **影响**: fe / admin-ui
- **首次发现**: 2026-07-13

## 症状

- 看板编辑页「只能看」：拖移/八向缩放无效或松手回弹；Phase A 修补后人工门控仍为 FAIL。

## 根因

1. **交互层**：`applyLiveLayout` 每帧 `compactLayoutVertical` 与 RGL 受控 `layout` 打架，拖移被压缩回弹。
2. **持久化层**：后端 `LayoutWidget` 无 `gridX`/`gridY`，保存剥离坐标（见 `be-dashboard-layout-grid-coordinates.md`）。
3. **架构层**：RGL 12 列栅格与 DE 像素画布心智不一致；继续堆补丁无法通过真实 Pointer 门控。

## 错误做法（避免）

- Phase A FAIL 后继续叠加 RGL 补丁或 `compactLayoutVertical` 时序 hack。
- v2 布局消费面仍假设只有 `colSpan`/`rowSpan`，忽略 `x/y/width/height`。
- 在 `pixel off + v2` 时允许保存或降回 v1。

## 修复方式

- Phase A：回滚交互压缩；补齐 v1 坐标持久化与手柄 UX。
- Phase B：`layout version:2` + `pixelCanvas/` 自研引擎；四象限接线（`dashboardCanvasMode.ts`）；v1 内存迁移首存 v2；`VITE_DASHBOARD_PIXEL_CANVAS` 默认开启。

## 验证

- `pytest tests/test_dashboard_pixel_layout.py tests/test_dashboard_layout_grid_xy.py -q`
- `vitest run src/components/dashboard/ src/pages/admin/dashboard/`（含 smoke、share、ReuseWidgetDialog、PixelCanvas）
- 人工 Pointer QA（契约 Q2=A）：拖标题栏、八向缩放、保存刷新保持、DE chrome 结构

## 关联

- `docs/bugs/BUG-2_dashboard-drag-resize-unusable_2026-07-13.md`
- `fe/src/components/dashboard/pixelCanvas/`
- `backend/app/dashboard/schemas.py`、`layout_migration.py`
