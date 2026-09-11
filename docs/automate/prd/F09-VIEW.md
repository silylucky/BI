# F09-VIEW 用户视图

> 模块：FR-VIEW · 8 维评分见 [`../prd.md`](../prd.md)

### [VIEW-001] DashboardView 视图协议 FR-VIEW-1

- **状态**：已实现（M5 FR-VIEW-1）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：DashboardView 视图协议 FR-VIEW-1（SRS 追溯项）。
- **验收标准**：
  - [x] 全 BI 页面基于 DashboardView（F-F companion：`dashboardLayoutToView` 适配 + Dashboard PUT DashboardView 校验；`fe/src/lib/dashboardLayoutToView.ts` · `backend/app/views/adapter.py` · `docs/ui/layout.md`）
  - [x] DashboardView schema + `POST /api/v1/views/validate`（r30 L1）
  - [x] layout 与 DASH-001~003 互操作（委托 `dashboard.service.validate_layout`）
  - [x] validate 边界：空 widgets、colSpan/order 越界、chartRef 环检测（r31，`VIEW_LAYOUT_BOUNDS`/`VIEW_CHART_REF_CYCLE`）
  - [x] `protocolVersion` + `round_trip_view_document`（M5：`VIEW_PROTOCOL_VERSION` + `test_view_m5_protocol.py` 往返/破坏性用例）
  - [x] 扩展 widget 类型校验 map/heatmap/kpi/timeline + `CHART_FIELD_REQUIREMENT`（M5 r219：`validate.py` + `test_view_m5_protocol.py` T-VIEW-001-01~04）
  - [x] `VIEW_PROTOCOL_UNSUPPORTED` protocolVersion=2 守卫 + `GET /api/v1/views/schema`（M5 r219）
  - [x] Dashboard `PUT/GET layoutJson` 存储 round-trip（`test_view_m5_protocol.py` T-VIEW-001-05）
  - [ ] defaultViewId 持久化与角色默认视图（VIEW-002）
- **代码锚点**：`backend/app/views/schemas.py` · `backend/app/views/protocol.py` · `backend/app/views/adapter.py` · `backend/app/views/validate.py` · `backend/app/api/v1/views.py` · `fe/src/lib/dashboardLayoutToView.ts` · `tests/test_view_m5_protocol.py` · `tests/test_ff_track_e_view_nfr_e95d.py`
- **演化建议**：M5 FR-VIEW-1 已闭合扩展 widget 校验、protocolVersion 守卫与存储 round-trip；后续补全 BI 页面统一协议层与 defaultViewId 存储
- **里程碑对齐**：M5 · 已完成 · 2026-07-06
### [VIEW-002] 角色默认模板 FR-VIEW-3

- **状态**：已实现（M10 r234）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：二期
- **描述**：角色默认模板 FR-VIEW-3（SRS 追溯项）。
- **验收标准**：
  - [x] 角色绑定默认 Dashboard/报表（r60 L1：`PUT/GET /api/v1/roles/{id}/default-views` + `resolve_defaults_for_roles`；admin 写/viewer 403 `VIEW_DEFAULT_*`）
  - [x] companion bounds + perf probe（r63：`maxWidgetCount` [1,64] 域校验 `VIEW_DEFAULT_OUT_OF_BOUNDS`；`probe_resolve_defaults_budget_ms` ≤50ms；空 roles 默认 maxWidgetCount=24）
  - [x] companion inheritFromRoleId cycle + enterprise GET scope + put probe（r68：`VIEW_DEFAULT_ROLE_CYCLE` 422；`set_user_role_default_scope` enterprise GET 403；`probe_role_default_put_budget_ms` ≤50ms；r63 bounds 回归保留）
  - [x] M10 FE 默认报表模板绑定与登录落地（r234：`RoleListPage` `reportTemplateNodeId` Select；`defaultViewResolve.ts` Dashboard 优先后 fallback `/admin/reports/templates/{nodeId}`；vitest 优先级用例）
  - [x] 新用户 onboarding 自动继承全链（F-F companion：`view_role_defaults` DB 持久化 + 首次 `GET /users/me/views` 继承角色默认；`tests/test_ff_track_e_view_nfr_e95d.py` T-VIEW-E95D-003）
- **代码锚点**：`backend/app/views/role_template.py` · `backend/app/views/role_defaults_repo.py` · `backend/app/views/onboarding.py` · `backend/migrations/versions/0021_view_role_defaults.py` · `fe/src/pages/admin/system/roles/RoleListPage.tsx` · `fe/src/lib/defaultViewResolve.ts` · `fe/src/lib/defaultViewResolve.test.ts` · `tests/test_rpt_view_cat_gov_r60.py` T-VIEW-R60-002-01~06 · `tests/test_m10_report_templates_r234.py` T-VIEW-R234-002-01~02 · `tests/test_ff_track_e_view_nfr_e95d.py`
- **演化建议**：r234 闭合角色默认报表模板 FE 绑定与登录 fallback 路径；新用户 onboarding 全链与 DB 持久化留 companion
- **里程碑对齐**：M10 · 已完成 · 2026-07-07
### [VIEW-003] 用户视图覆盖 FR-VIEW-4

- **状态**：已实现（M12 r238）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：三期
- **描述**：用户视图覆盖 FR-VIEW-4（SRS 追溯项）。
- **验收标准**：
  - [x] 用户可保存个人视图（r60 L1：`POST/GET /api/v1/users/me/views` + 409 冲突守卫）
  - [x] 不突破 M7（r60 L1：`maxWidgetCount` bounds + `classificationScope` 校验 + chartRef cycle 映射 `VIEW_OVERRIDE_*`/`VIEW_CHART_REF_CYCLE`）
  - [x] companion GET by id + dashboard 404 + create probe（r63：`GET /api/v1/users/me/views/{id}` `VIEW_OVERRIDE_NOT_FOUND`；`VIEW_OVERRIDE_DASHBOARD_NOT_FOUND`；`probe_create_override_budget_ms` ≤50ms）
  - [x] M-FE-3 FE 默认视图：登录后按角色 `default-views` 重定向（`defaultViewResolve.ts` + `LoginPage`/`AdminHomePage`；`defaultViewResolve.test.ts`）
  - [x] 用户覆盖优先于角色默认（r207：`fetchUserOverridePath` + `resolveDefaultDashboardPath`；vitest 边缘 + Playwright E2E 6/6）
  - [x] Playwright E2E：登录 → 默认 Dashboard（role default / user override / mobile viewport；`fe/e2e/login-default-dashboard.spec.ts`）
  - [x] 用户视图 PUT/DELETE CRUD（r238：`PUT/DELETE /api/v1/users/me/views/{id}` + `user_override_repo.py` helpers）
  - [x] 个人设置 UI（r238：`UserViewsSection` + `AccountSettingsPage` 集成；`UserViewsSection.smoke.test.tsx`）
  - [x] 用户覆盖 DB 持久化（`view_user_overrides` 表 + Alembic `0038`；重启后配置保留；`tests/test_view_user_override_persistence.py`）
  - [ ] 完整 M7 RLS/ACL 端到端（M7 远期；无 org 绑定与发布后 RLS 联动）
- **代码锚点**：`backend/app/views/user_override.py` · `backend/app/views/user_override_repo.py` · `backend/app/views/models.py`（`ViewUserOverride`）· `backend/app/views/probe.py` · `backend/migrations/versions/0038_view_user_override_persistence.py` · `backend/app/api/v1/views.py` · `fe/src/pages/admin/account/components/UserViewsSection.tsx` · `fe/src/lib/defaultViewResolve.ts` · `fe/e2e/login-default-dashboard.spec.ts` · `tests/test_view_user_override_persistence.py` · `tests/test_m12_batch1_r238.py` T-VIEW-R238-* · `tests/test_viz_view_design_cat_r63.py` T-VIEW-R63-003-01~06 · `fe/src/lib/defaultViewResolve.test.ts`
- **演化建议**：M7 全链路 RLS 与 org 绑定留 companion；首登继承写入 DB 后，管理员改角色默认对已有个人的用户需手动删除覆盖才回落
- **里程碑对齐**：M12 · 已完成 · 2026-07-07
