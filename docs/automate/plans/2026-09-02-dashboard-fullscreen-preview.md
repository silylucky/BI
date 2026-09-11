# 仪表板全屏预览

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute

## 背景

大屏已有 `/admin/data-screens/:id/preview`（`DataScreenPreviewPage`）。普通仪表板编辑页「预览」仍跳转 view 模式（壳层内只读），缺少独立全屏投放页与浏览器全屏入口。

## 目标

为普通仪表板新增全屏预览路由与三处入口，交互对齐大屏预览。

## 改动清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `fe/src/lib/dataScreenLayout.ts` | 新增 `dashboardPreviewPath` / `dashboardEditPath` / `dashboardViewPath` |
| 2 | `fe/src/pages/admin/dashboard/DashboardPreviewPage.tsx` | 新建全屏预览页 |
| 3 | `fe/src/routes.tsx` | 注册 `dashboards/:id/preview` |
| 4 | `fe/src/pages/admin/dashboard/DashboardEditPage.tsx` | 编辑预览链 + view 模式「全屏预览」 |
| 5 | `fe/src/components/dashboard/DashboardListCard.tsx` | 列表「预览」链到 preview |
| 6 | 测试 + `docs/ui/layout.md` | smoke 与路由文档 |

## 验收

1. `/admin/dashboards/:id/preview` 展示顶栏（返回编辑、缩放、全屏、刷新）与只读画布
2. 编辑页「预览」、view「全屏预览」、列表卡片「预览」均进入 preview 路由
3. `pnpm vitest run DashboardPreviewPage.smoke.test.tsx dataScreenLayout.test.ts` 通过

## 整体验证方案

```bash
cd fe && pnpm vitest run src/pages/admin/dashboard/DashboardPreviewPage.smoke.test.tsx src/lib/dataScreenLayout.test.ts
```

## 八维度自审

| 维度 | 结论 |
|------|------|
| 范围 | 仅 FE 路由与页面，无 API |
| 复用 | `ScreenPreviewChrome`、`DataScreenPresenter`、`useDocumentFullscreen` |
| 风险 | 低；可逆 |
| 测试 | smoke 覆盖挂载与 chrome |
| 文档 | `docs/ui/layout.md` 登记 preview 路由 |
| 边界 | 大屏 layout 重定向至 data-screen preview |
| 性能 | 与 view 模式相同查数路径 |
| 安全 | 沿用 admin 鉴权壳 |
