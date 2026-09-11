# F02-AUTH 权限子系统

> 模块：M7 · 8 维评分见 [`../prd.md`](../prd.md)

## 账户自服务实现追溯（非新增功能项）

SRS 与 AUTH-001～008 **未**定义独立「账户资料 / 修改密码」功能 ID。下列能力已在代码与测试中实现，**不属于** [AUTH-003](#auth-003-用户角色绑定)（用户角色绑定）：

| 能力 | 追溯 |
|------|------|
| 资料读取 / 更新 | [`backend/app/auth/profile/`](../../../backend/app/auth/profile/) · `GET/PATCH /api/v1/me` · [`plans/archive/2026-07-08-account-self-service.md`](../plans/archive/2026-07-08-account-self-service.md) |
| 修改密码 | `profile/service.py::change_password` · `POST /api/v1/auth/change-password` · [`BUG-001`](../../bugs/BUG-001_account-password-security_2026-07-13.md) |
| 前端 | `fe/src/pages/admin/account/` · `ChangePasswordSection` · `ChangePasswordSection.smoke.test.tsx` · `ChangePasswordSession.integration.test.tsx` |
| 后端测试 | `tests/test_auth_profile.py` |

API 登记见 [`docs/api/README.md`](../../api/README.md) §认证（PRD 列 `—`）。

### [AUTH-001] RoleRegistry 角色注册

- **状态**：已实现（M-FE-3 FE companion）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：RoleRegistry 角色注册（SRS 追溯项）。
- **验收标准**：
  - [x] 管理员可 CRUD 角色 code/显示名/描述
  - [x] 平台不预置业务角色
  - [x] M-FE-3 Admin UI：`/admin/system/roles` 列表/新建/编辑/删除 + 默认 Dashboard 绑定（`roles.smoke.test.tsx` T-AUTH-001-01~02）
- **代码锚点**：`backend/app/auth/roles/service.py` · `backend/app/api/v1/roles.py` · `fe/src/pages/admin/system/roles/RoleListPage.tsx` · `tests/test_auth_rbac_l1.py` T-AUTH-R01~R12 · `fe/src/pages/admin/system/roles/roles.smoke.test.tsx`
- **演化建议**：生产管理员鉴权守卫；与 AUTH-008 全平台审计联动；Playwright E2E 留 companion
- **里程碑对齐**：M-FE-3 · 已完成 · 2026-07-06

### [AUTH-002] 组织树配置

- **状态**：已实现（r19 quality push）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：组织树配置（SRS 追溯项）。
- **验收标准**：
  - [x] 可配置组织树节点
  - [x] 用户可绑定组织
- **代码锚点**：`backend/app/auth/org/service.py` · `backend/app/api/v1/orgs.py` · `backend/app/api/v1/users.py` · `tests/test_auth_rbac_l1.py` T-AUTH-O01~O11 · T-AUTH-OU01~OU04
- **演化建议**：Admin UI 组织树；生产 IAM 集成
- **里程碑对齐**：

### [AUTH-003] 用户角色绑定

- **状态**：已实现（M-FE-3 FE companion）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：用户角色绑定（SRS 追溯项）。
- **验收标准**：
  - [x] 用户与角色多对多绑定
  - [x] 变更有审计记录
  - [x] M-FE-3 Admin UI：`GET /api/v1/users` 列表 + `/admin/system/users` 角色绑定（`users.smoke.test.tsx` T-AUTH-003-01~02）
- **代码锚点**：`backend/app/auth/users/service.py` · `backend/app/auth/audit/service.py` · `backend/app/api/v1/users.py` · `fe/src/pages/admin/system/users/UserListPage.tsx` · `tests/test_auth_rbac_l1.py` T-AUTH-U01~U10 · `fe/src/pages/admin/system/users/users.smoke.test.tsx`
- **演化建议**：AUTH-008 全平台敏感操作审计；生产登录与用户生命周期；Playwright E2E 留 companion
- **里程碑对齐**：M-FE-3 · 已完成 · 2026-07-06

### [AUTH-004] 资源授权绑定

- **状态**：已实现
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **里程碑对齐**：M-FINAL · 已完成 · 2026-07-07
- **描述**：资源授权绑定（SRS 追溯项）；M-FINAL F-B 补齐 Admin UI（`/admin/system/grants` 列表 + 绑定/撤销表单）。
- **验收标准**：
  - [x] 角色可绑定数据源/Dashboard/报表资源
  - [x] 未授权资源不可见
  - [x] `/admin/system/grants` 路由注册，manifest 系统管理分组可见（admin）
  - [x] 对接 `GET/POST /api/v1/resource-grants`，列表展示角色×资源类型×资源 ID
  - [x] 表单校验与高危撤销确认；成功后列表刷新
  - [x] `grants.smoke.test.tsx` T-AUTH-004-FE-01~04 PASS
  - [x] Phase A：root-only bypass（`auth/bypass.py`）；dashboard 子路由 `assert_dashboard_access`；report catalog grant 过滤；`tests/test_auth_resource_acl_matrix.py`
- **代码锚点**：`backend/app/auth/resources/service.py` · `backend/app/auth/deps.py` · `backend/app/api/v1/resource_grants.py` · `backend/app/auth/bypass.py` · `backend/app/reports/catalog/grant_acl.py` · `tests/test_auth_rbac_l1.py` T-AUTH-G01~G12 · `tests/test_auth_resource_acl_matrix.py` · `fe/src/pages/admin/system/grants/GrantsPage.tsx` · `fe/src/pages/admin/system/grants/grants.smoke.test.tsx` · `fe/src/lib/permission-codes.ts`
- **演化建议**：vitest 208/208（F-B grants smoke 4 用例）；M3 数据源 API 接入 `require_resource_visible` 过滤未授权资源列表；二期 Playwright E2E

### [AUTH-005] 权限维度类型定义

- **状态**：已实现（r21 quality push）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：权限维度类型定义（SRS 追溯项）。
- **验收标准**：
  - [x] 可定义物理对象/地域/时间/自定义维度
  - [x] 维度类型可扩展注册
- **代码锚点**：`backend/app/auth/rls/dimensions/service.py` · `backend/app/api/v1/rls.py` · `tests/test_auth_rbac_l1.py` T-AUTH-D01~D14
- **演化建议**：AUTH-006 维度分组；AUTH-007 RLS 谓词消费维度元数据
- **里程碑对齐**：

### [AUTH-006] 权限维度分组与角色关联

- **状态**：已实现（r21 quality push；**M-DEPTH F-C 深度 companion 已闭合** · 2026-07-29）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：权限维度分组与角色关联（SRS 追溯项）。后端 API 已全实现；M-DEPTH 补 Admin 可视化配置面。
- **验收标准**：
  - [x] 维度分组可关联角色
  - [x] 用户继承角色权限（有效维度集 = 直绑 ∪ 分组展开）
  - [x] **M-DEPTH F-C**：RLS 维度分组配置 UI（接 `/rls/groups*` + 角色 `dimension-groups` 绑定；admin 可完成分组 CRUD 与角色关联）（完成于 2026-07-29 · `RlsAdminPage.tsx`）
  - [x] **Phase B**：角色 `dimension-values` 直绑 UI（`RlsDimensionValuesPanel`）；`org_ref` 维度类型创建与组织选择器
- **代码锚点**：`backend/app/auth/rls/groups/service.py` · `backend/app/auth/rls/bindings/service.py` · `backend/app/api/v1/rls.py` · `backend/app/api/v1/roles.py` · `tests/test_auth_rbac_l1.py` T-AUTH-GP01~GP15
- **演化建议**：M-DEPTH F-C 闭合 Admin UI；生产维度值校验扩展
- **里程碑对齐**：r21 · 已完成；**M-DEPTH F-C · 已闭合 · 2026-07-29**

### [AUTH-007] RLS 谓词生成与注入

- **状态**：已实现（Phase B 列映射扩展 · 2026-08-24）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：RLS 谓词生成与注入（SRS 追溯项）。Phase B 增加列映射表、预览 API 与查询执行时自动加载 `column_by_dimension_id`。
- **验收标准**：
  - [x] 查询执行前合并 WHERE 谓词（`get_query_rls_fragment` hook）
  - [x] 越权 smoke test 通过
  - [x] **Phase B**：`auth_rls_column_bindings` 列映射 CRUD + `POST /rls/preview`；dataset 保存可选同步绑定；`execute_config` 多维 RLS
- **代码锚点**：`backend/app/auth/rls/predicate.py` · `backend/app/auth/rls/hooks.py` · `backend/app/auth/rls/column_bindings/service.py` · `backend/app/auth/rls/variables.py` · `backend/app/query/rls/guard.py` · `fe/src/pages/admin/system/rls/RlsColumnBindingsPanel.tsx` · `tests/test_auth_rls_column_bindings.py` T-RLS-COL-01~04
- **演化建议**：M4 `query` 全方言 SQL 改写；生产 RLS 策略扩展
- **里程碑对齐**：

### [AUTH-008] 操作审计日志

- **状态**：已实现（r21 quality push；**M-DEPTH F-C 深度 companion 已闭合** · 2026-07-29）
- **goal_ref**：goal.md §2.4（G4）
- **期次**：一期
- **描述**：操作审计日志（SRS 追溯项）。后端查询 API 已实现；M-DEPTH 补审计浏览页。
- **验收标准**：
  - [x] 权限变更写入审计日志（auth 域写路径挂钩）
  - [x] 敏感操作可追溯（admin 守卫分页查询）
  - [x] **M-DEPTH F-C**：审计事件浏览页（接 `GET /audit/events` 时间窗过滤；detail 脱敏展示）（完成于 2026-07-29 · `AuditLogPage.tsx`）
- **代码锚点**：`backend/app/auth/audit/write_hooks.py` · `backend/app/auth/audit/service.py` · `backend/app/api/v1/audit.py` · `tests/test_auth_rbac_l1.py` T-AUTH-AU01~AU13 · T-AUTH-A01~A09 回归
- **演化建议**：M-DEPTH F-C 闭合浏览 UI；非 auth 域写操作扩展；生产留存策略
- **里程碑对齐**：r21 · 已完成；**M-DEPTH F-C · 已闭合 · 2026-07-29**

## Phase C（C1–C5 · 2026-08-24）

> 计划文件不修改；本节为交付对账。

| ID | 能力 | 状态 | 代码锚点 |
|----|------|------|----------|
| C1 | 组织范围管理员 `system:org_scoped.manage` | 已实现 | `org_scope.py` · `users/service.py` · `tests/test_auth_org_scoped_admin.py` |
| C2 | 用户级资源/维度例外授权 | 已实现 | `user_overrides/service.py` · `UserManageSheet`「例外授权」Tab · `tests/test_auth_user_overrides.py` |
| C3 | 列脱敏 + 域删除/发布审计扩展 | 已实现 | `masking/service.py` · `query/service.py` · `audit/write_hooks.py` · `AuditLogPage` 预设筛选 |
| C5 | LDAP/OIDC 规格 + UI 骨架 | 已实现（骨架） | `docs/specs/auth-ldap-oidc-integration.md` · `auth-integration` 导航 · `login/oidc.py` |
