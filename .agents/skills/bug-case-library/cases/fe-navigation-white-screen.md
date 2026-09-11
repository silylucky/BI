# FE 切换页面整页白屏

## 症状

- 侧栏点击或路由切换后 `#root` 变空，整页白屏
- Console 可能有 `ReferenceError` / `TypeError`，也可能无红错（Vite HMR/编译）

## 根因（分层）

| 层级 | 原因 |
|------|------|
| L0 编译 | 非法 import、HMR 全量刷新失败 |
| L1 运行时 | 目标页 mount 抛错，无 Error Boundary → React 卸载整树 |
| L2 架构 | 仅 widget 级隔离，无路由/应用级兜底 |
| L3 质量 | 未 import（如 `Checkbox`、`DashboardEditCanvas`）、批量 codemod 破坏 import |

## 修复

- `RouteErrorBoundary`：包裹 `AdminLayout` / `EmbedLayout` 的 `<Outlet />`，pathname 变化自动 reset
- `AppErrorBoundary`：包裹 `AppRoutes`，捕获 Provider 级崩溃
- `FilterWidgetControls.tsx`：补 `Checkbox` import
- **`DashboardEditPage.tsx`**：保存前未 flush 焦点输入 / debounce 样式，首击读到旧 state；补 ref 同步 + blur + `toast.success`；联动变更纳入 `isDirty`

## 锚点

- `fe/src/components/ui/route-error-boundary.tsx`
- `fe/src/layouts/AdminLayout.tsx`（`dashboardEditMatch` / `dashboardDetailMatch`）
- `fe/src/App.tsx`
- 回归：`route-error-boundary.test.tsx`、`routes.smoke.test.tsx` T-NAV-01、`AdminLayout.smoke.test.tsx` T-NAV-02

## 预防

- 新页面接入路由 smoke；`tsc --noEmit` CI 门禁
- codemod 改 import 必须 AST 级；禁止在 `import type {` 块内插入 import
