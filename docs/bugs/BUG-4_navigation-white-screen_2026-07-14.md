# BUG-4：切换页面整页白屏

> 登记：2026-07-14 · 状态：**fixed（Phase 0）**

## 症状

- 侧栏切换路由后 `#root` 空白，侧栏/顶栏一并消失
- 与单 widget 崩溃（侧栏仍在）不同，属于整树卸载

## 根因

目标页 mount 抛错 + **无路由/应用级 Error Boundary** → React 卸载整 app。

## 修复（Phase 0）

- `RouteErrorBoundary`：`AdminLayout` / `EmbedLayout` 的 `<Outlet />`
- `AppErrorBoundary`：`App.tsx` 包裹 `AuthProvider`
- `FilterWidgetControls`：补 `Checkbox` import

## 锚点

- `fe/src/components/ui/route-error-boundary.tsx`
- `fe/src/layouts/AdminLayout.tsx`
- `fe/src/App.tsx`

## 后续（Phase 1+）

- CI 强制 `tsc --noEmit`
- 路由 lazy 分域
- Playwright 跨页导航验收
