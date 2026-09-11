# views — DashboardView 视图协议

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/views/` |
| PRD | [F09-VIEW](../automate/prd/F09-VIEW.md) · VIEW-001 ~ VIEW-003 |
| 里程碑 | FR-VIEW |
| 状态 | **L1 kickoff (r60)** · 用户覆盖 DB 持久化（0038） |

## 职责

- DashboardView 协议 schema 与校验（layout/widgets 与 DASH 互操作）
- `POST /api/v1/views/validate` 校验入口
- 为后续角色默认视图与用户覆盖（VIEW-002/003）奠基
- `role_template.py` 角色默认视图 CRUD（GET/PUT `/roles/{id}/default-views`）
- `user_override.py` 用户覆盖 save/list + bounds/M7 stub（GET/POST `/users/me/views`）
- `user_override_repo.py` + `view_user_overrides` 表持久化用户个人视图

## 边界

| In | Out |
|----|-----|
| DashboardView 序列化、layout 校验、chart 引用检查 | 壳层渲染（前端 `fe/`） |
| `role_template.py` 角色默认视图 CRUD；`user_override.py` 用户覆盖 + bounds/M7 stub | Admin UI（→ `fe/` 个人中心） |
| `role_defaults_repo.py` + `view_role_defaults` 表；`user_override_repo.py` + `view_user_overrides` 表 | |
| `store.py` 进程内 role default 内存缓存（写穿 DB 后同步） | Dashboard CRUD 持久化（→ `dashboard`） |

## 依赖

- `core`、`dashboard`（`DashboardLayout`）、`schemas/chart_view`

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `DashboardView` | 视图协议 Pydantic 模型 | VIEW-001 | 已实现 |
| `validate_dashboard_view` | 视图校验服务 | VIEW-001 | 已实现 |
| `validate_layout_dict` | layout 校验（dashboard 委托） | VIEW-001 | 已实现 |
| `POST /api/v1/views/validate` | HTTP 校验入口 | VIEW-001 | 已实现 |
| `role_template.py` | get/put/resolve 角色默认视图（dashboard + reportTemplateNodeId） | VIEW-002 | M10 已实现 r234 |
| `user_override.py` | list/create + bounds 守卫 | VIEW-003 | L1 已实现 r60 |
| `user_override_repo.py` | `view_user_overrides` ORM 持久化 | VIEW-003 | 已实现 0038 |
| `GET/PUT /api/v1/roles/{id}/default-views` | 角色默认视图 CRUD | VIEW-002 | L1 已实现 r60 |
| `GET/POST /api/v1/users/me/views` | 用户个人视图覆盖 | VIEW-003 | L1 已实现 r60 |
| `GET /api/v1/users/me/views/{view_id}` | 用户视图按 id 读取 | VIEW-003 | r63 已实现 |

## 关联 API

见 [api/README.md](../api/README.md) §视图。

## 实现笔记

- r30 L1：`views.validate` 在 dashboard layout 规则之上增加 `VIEW_UNKNOWN_CHART_REF`、`VIEW_DEFAULT_SELF_REF`
- r31：`VIEW_LAYOUT_BOUNDS`（colSpan/rowSpan/widgets 越界）、`VIEW_CHART_REF_CYCLE`（chartRef/chartId 循环引用）
- `dashboard.service.validate_layout` 委托 `views.validate.validate_layout_dict`

## 错误码

| 码 | 说明 |
|----|------|
| `VIEW_INVALID_LAYOUT` | 通用 layout 校验失败 |
| `VIEW_LAYOUT_BOUNDS` | colSpan/rowSpan/widgets 越界 |
| `VIEW_UNKNOWN_CHART_REF` | chartRef 或 chartId 引用未知 widget |
| `VIEW_CHART_REF_CYCLE` | chartRef/chartId 循环引用 |
| `VIEW_DEFAULT_SELF_REF` | defaultViewId 等于自身 id |
| `VIEW_DEFAULT_FORBIDDEN` | 非 admin PUT 角色默认视图 |
| `VIEW_DEFAULT_EMPTY` | dashboard/report 双 null |
| `VIEW_DEFAULT_DASHBOARD_NOT_FOUND` | 未知 dashboard |
| `VIEW_DEFAULT_REPORT_NOT_FOUND` | 未知 report template |
| `VIEW_OVERRIDE_OUT_OF_BOUNDS` | widget 数超角色默认 maxWidgetCount |
| `VIEW_OVERRIDE_CLASSIFICATION_DENIED` | classificationScope 不在 allowlist |
| `VIEW_OVERRIDE_CONFLICT` | 重复视图名 |
| `VIEW_DEFAULT_OUT_OF_BOUNDS` | maxWidgetCount 不在 [1,64] |
| `VIEW_OVERRIDE_NOT_FOUND` | 用户视图 id 不存在 |
| `VIEW_OVERRIDE_DASHBOARD_NOT_FOUND` | 创建覆盖时 dashboard 不存在 |

### Companion r63（VIEW-002/003）

- `views/probe.py`：`probe_resolve_defaults_budget_ms` / `probe_create_override_budget_ms`（50ms）
- `VIEW_DEFAULT_OUT_OF_BOUNDS` [1,64] 域校验；`GET /users/me/views/{id}`；dashboard 404 / cycle 检测闭合

### r68 companion 质量推分（VIEW-002）

- **VIEW-002**：`inheritFromRoleId` 环检测（`VIEW_DEFAULT_ROLE_CYCLE`）；`set_user_role_default_scope` + enterprise GET scope（`VIEW_DEFAULT_FORBIDDEN`）；`probe_put_role_defaults_budget_ms` ≤50ms；`GET /roles/{id}/default-views` actor 透传

### M10 r234 登录落地优先级（VIEW-002）

1. 用户覆盖 Dashboard（`GET /users/me/views`）
2. 角色 Dashboard（`roles/{id}/default-views.dashboardId`）
3. 角色报表模板（`reportTemplateNodeId` → `/admin/reports/templates/{id}?panel=run`）
4. `inheritFromRoleId` 链式继承
5. `null`（无默认）

FE：`fe/src/lib/defaultViewResolve.ts` — `resolveDefaultLandingPath`；`RoleListPage` 双 Select（默认 Dashboard + 默认报表模板）
