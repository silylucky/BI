# Dashboard 编辑页僵尸态 + 画布拖放闪烁

- **ID**: CASE-2026-07-09-001
- **状态**: 已修复
- **影响**: fe / admin-ui
- **首次发现**: 2026-07-09

## 症状

- 编辑页顶部出现 `Dashboard not found`，画布上组件仍在，保存/删除全部失败
- 在已有组件上继续拖入新组件时画布持续闪烁
- 画布角落出现错位的「配置」碎片

## 根因

1. **僵尸编辑态**：`DELETE /dashboards/:id` 已返回 204，但页面未可靠离开；本地仍持有脏布局。后续 `PUT layout` / `DELETE` 全部 404，错误只挂横幅，不清空画布。
2. **RGL isDroppable 与受控 layout 冲突**：`react-grid-layout` 拖放占位节点写入内部 layout，与父组件受控 `layout` 来回同步，触发持续重排闪烁；占位节点也可能渲染出残缺 UI。

## 错误做法（避免）

- 删除/404 后只 `setError`，继续渲染可编辑画布
- 用 RGL `isDroppable` + 受控 `layout` 同时驱动外部拖入
- 依赖 `WidthProvider` 在可滚动父级里反复测宽

## 修复方式

- `DashboardEditPage`：引入 `missing` 态；删除成功或 `DASH_NOT_FOUND` 时清脏状态并 `navigate` 回列表；加载 404 时不渲染僵尸画布
- `DashboardGrid`：关闭 `isDroppable`，改用原生 HTML5 drop + 坐标换算落点；`useCSSTransforms={false}`
- `apiError`：登记 `DASH_NOT_FOUND` 中文文案

## 验证

- 删除看板后应进入列表，不应再停留在可编辑画布
- 打开已删除 ID 应显示「看板不存在」空态，无组件卡片
- 在已有组件上拖入新类型，画布不应持续闪烁
- `vitest`：`dashboard.smoke.test.tsx` 含 T-DASH-DELETE-01/02

## 关联

- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- `fe/src/components/dashboard/DashboardGrid.tsx`
- `fe/src/lib/apiError.ts`
- 后端日志：`DELETE 204` 后连续 `PUT/DELETE 404`
