# Evolution State

> 自我演化**单一状态账本**。Automations 读写；人工可审计。

## 当前轮次

| 字段 | 值 |
|------|----|
| phase | **A8_CLOSE** |
| status | **DONE** |
| request | 仪表板预览加上全屏预览功能 |
| type | feature |
| goal | 普通仪表板独立全屏预览页；编辑/view/列表三处入口；对齐大屏预览 chrome |
| plan | `docs/automate/plans/2026-09-02-dashboard-fullscreen-preview.md` |
| last_verified_command | `pnpm vitest run DashboardPreviewPage.smoke.test.tsx dataScreenLayout.test.ts` |
| last_verified_exit_code | 0 |
| repair_rounds | 0 |
| started_at | 2026-09-02 |
| completed_at | 2026-09-02 |

## 当前需求契约

- **request**: 仪表板预览加上全屏预览功能
- **type**: feature
- **goal**: 普通仪表板提供 `/admin/dashboards/:id/preview` 全屏预览页，顶栏含返回/全屏/缩放/刷新，只读画布
- **scope_include**: `DashboardPreviewPage`、路由、`dashboardPreviewPath`、编辑页预览链、view 模式全屏按钮、列表卡片预览入口
- **scope_exclude**: 后端 API 变更、embed 公开路径、大屏路由语义调整
- **acceptance**: `pnpm vitest run DashboardPreviewPage.smoke.test.tsx dataScreenLayout.test.ts` 绿；三处入口链到 preview 路由
- **risk_level**: low
- **autonomy_policy**: auto_accept_low_risk
- **assumptions**: 复用 `ScreenPreviewChrome` + `DataScreenPresenter`；大屏 layout 仍走 `data-screens/:id/preview`

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-09-02 | 启动仪表板全屏预览 Headless Plan + 执行 |
| 2026-08-30 | IM 方案 2（user_delegated）实现完成；迁移 0060；9 项单测绿 |
| 2026-08-30 | 启动 IM 方案 2 Headless Plan + 执行 |
| 2026-08-24 | 报表域收尾复验 DONE |
