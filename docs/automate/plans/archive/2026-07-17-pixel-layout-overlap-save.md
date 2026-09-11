# Headless Automation Plan — 像素画布保存后组件叠放

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute

## 背景

编辑页拖动/Tab 操作后画布看似正常，**一保存**即出现多组件（图表、表格、Tab、媒体）同区域叠放。

## 根因（分层）

| 层 | 问题 | 证据 |
|----|------|------|
| **持久化** | `persistDashboardLayout` 仅 `compactPixelLayoutWhenZeroGap`，**不**修复重叠、不 park Tab 子组件 | `stylePipeline.ts` |
| **保存后内存** | `handleSave` → `resetLayout(normalizedLayout)` **未**走 `preparePixelLayoutForDisplay` | `DashboardEditPage.tsx` L800 |
| **Tab 双轨渲染** | `childWidgetIds` 已登记但 widget 无 `parentTabsId` + 仍带顶层 x/y/w/h → 顶层 PixelShape 与页签内同时渲染 | `getTabChildWidgets` 兜底路径 |
| **运行时泄漏** | `insertPixelPaletteWidget`（工具栏点插）未 `resolvePixelCollisions` | `createPixelWidget.ts` |
| **编辑消毒缺失** | `setPixelLayout` 未 `syncParkedTabChildren` / `repairUnparkedTabChildren` | `useDashboardCanvasState.ts` |
| **保存后 reset** | `resetLayout` → `prepareDashboardLayout` 仅 compact、不 pack → 叠放回显 | `dashboardCanvasMode.ts` |
| **间隙压实** | `compactPixelLayoutOuterRects` 对 Tab 0×0 子组件参与运算，可能扰动顶层坐标 | `gapCompaction.ts` |
| **预览残留** | 拖动 preview DOM 坐标在 layout 外部更新后未 reset | `PixelCanvas.tsx` |

设计注释「保存不再 pack、保证 WYSIWYG」在**有重叠脏数据**时反噬：若 422 阻断保存，脏坐标仍留在内存/DB。

## 方案

### 单一路径 `sanitizePixelLayoutGeometry`

1. `compactPixelLayoutWhenZeroGap`
2. `reconcileTabPaneChildIdsInPixelLayout`
3. `repairUnparkedTabChildren` → `syncParkedTabChildren`
4. `layoutsOverlap` 则 `packPixelLayoutSeamless`

### 接入点

| 时机 | 函数 | pack? |
|------|------|-------|
| 加载/预览 | `preparePixelLayoutForDisplay` | 有重叠时 |
| 保存 PUT 前 | `persistDashboardLayout` | 有重叠时 |
| 保存成功后 reset | `preparePixelLayoutForDisplay` | 有重叠时 |
| 每次 `setPixelLayout` | `repairPixelLayoutTabState` | 否（避免拖动中整版重排） |

### 运行时补强

- `insertPixelPaletteWidget` → `resolveInsert`
- 碰撞：Tab 与普通组件同一套 `resolvePixelCollisions`（已完成）

### 后端契约（422 修复）

- `LayoutWidget`：`parentTabsId` + `tabPaneId` 时允许 `width=0, height=0`；非 Tab 子组件仍 `≥120×32`
- `validate_versioned_bounds`：Tab parked 子组件跳过画布越界检查

## 验收

- [x] `layoutSanitize.test.ts` 绿
- [x] `test_pixel_layout_accepts_tab_parked_child_zero_size` 绿
- [ ] 手测：叠放画布 → 保存 → 无重叠
- [ ] 手测：Tab 内媒体/图表 → 保存 → 仅页签内可见，画布无幽灵块
- [ ] 手测：工具栏连续插入组件 → 无重叠

## 后续（可选）

- 保存前若 pack 触发，toast 提示「已自动整理重叠组件」
- DE 式增量推挤替代 `packPixelLayoutSeamless`（保留用户纵向顺序，仅推开冲突块）
