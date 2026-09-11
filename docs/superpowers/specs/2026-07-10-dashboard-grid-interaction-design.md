# Dashboard 画布栅格交互修复（方案 A）

日期：2026-07-10  
状态：已批准（用户确认「同意方案 A」）  
关联：DASH-002 · `fe/src/components/dashboard/`

## 问题

1. 组件库 HTML5 拖入与 RGL 画布双轨坐标，落点不准、冲突不推开  
2. 画布内组件无法拖移/缩放（layout 状态与父组件 widgets 打架、容器宽度/overflow 干扰 RGL）  
3. 12 列蓝线参考栅格与品牌色缩放手柄干扰视觉

## 方案

保留 `react-grid-layout`，统一为单一 layout 真理源：

- 组件库拖入 → RGL `isDroppable` + `droppingItem` + `onDrop`  
- 编辑态 layout 本地受控，交互中不被 `widgets` 覆盖  
- 宽度测量 → `useContainerWidth`（替代 WidthProvider 嵌套 flex）  
- 松手 → `snapLayoutToGrid` + `compactLayoutVertical` → 回写 widgets  
- 去掉 `dashboard-grid-snap-guides`；缩放手柄仅 `se`、中性灰

## 验收

| ID | 标准 |
|----|------|
| GRID-01 | 拖标题栏可移动，松手后位置保持 |
| GRID-02 | 拖右下角可改宽高 |
| GRID-03 | 组件库拖入落点与指针一致（冲突时其他块让位） |
| GRID-04 | 无蓝线 12 列参考栅格 |
| GRID-05 | 保存后刷新位置/尺寸不变 |
| GRID-06 | smoke + grid interaction 测试通过 |

## 改动范围

- `dashboardGridRgl.tsx` · `DashboardGrid.tsx` · `dashboardDnd.ts`  
- `gridLayoutAdapter.ts` · `DashboardEditPage.tsx` · `index.css`  
- `DashboardGrid.interaction.test.tsx`（新增）
