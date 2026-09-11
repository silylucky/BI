# auth — 认证与权限

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/auth/` |
| PRD | [F02-AUTH](../automate/prd/F02-AUTH.md) · AUTH-001 ~ AUTH-008；M1 骨架 [BOOT-003](../automate/prd/F01-BOOT.md) |
| 实现追溯 | [BUG-001](../bugs/BUG-001_account-password-security_2026-07-13.md) · [Account Self-Service plan](../automate/plans/archive/2026-07-08-account-self-service.md)（profile/change-password，无独立 PRD ID） |
| 里程碑 | M7（完整 RBAC）；M1 横切鉴权骨架 |
| 状态 | **已实现** |

## 职责

- 用户认证（会话 / Token，与部署模式对齐）
- RBAC：角色、权限点、资源绑定
- 资源可见性：`ensure_resource_visible`、`list_visible_resource_ids`、`require_resource_visible` deps
- 用户-组织：`auth_users.org_node_id` FK；`assign_user_org` / `clear_user_org`
- 用户 IM 账号：`user_im_bindings`（飞书 userid 供按人投递；钉钉为群发，不消费绑定表）
- IM 应用凭证：`platform_im_connect_configs`（管理面 SM4 入库；从未保存可 env 回落；清空后忽略 env）
- 组织维度、多维行级权限（RLS）策略：维度分组、角色维度绑定、有效维度集解析
- RLS L1：`resolve_user_org_node_ids`、`build_org_rls_fragment`、`prepare_query_rls`、`get_query_rls_fragment`（供 `query/rls/guard.py` 消费）
- 绑定操作审计 L1：`auth_audit_events` + `audit/service.py`（AUTH-003 用户绑定子集）
- 全平台 auth 域写操作审计 L1：`audit/write_hooks.py` + admin 守卫查询（AUTH-008）
- 账户资料与凭证自服务（非 AUTH-003）：`auth/profile/` 提供 `GET/PATCH /api/v1/me` 与 `change_password`；见实现追溯

## 边界

| In | Out |
|----|-----|
| 身份、授权、RLS 策略定义与 L1 谓词 hook | 查询执行细节（→ `query/rls/guard.py` 消费 `prepare_query_rls`） |
| 用户资料邮箱与 IM 账号绑定（个人中心 OAuth + 管理员兜底；钉钉群发除外） | 钉钉群 webhook / 飞书 SDK 代发（→ `reports/scheduler/channels/`） |
| 租户/组织模型、用户组织归属 | 业务视图模板内容（→ `views`） |
| L1 资源可见性守卫（域 + deps） | 全方言 SQL 改写、M3 数据源实查 RLS |
| 维度分组 CRUD、角色维度/分组绑定、有效维度集 | 登录/数据源等非 auth 域审计（AUTH-008 后续扩展） |
| auth 域写路径审计挂钩与 admin 分页查询 | HTTP middleware 全自动拦截 |
| 账户资料读取/更新、自服务改密 | 忘记密码/MFA/改密后会话撤销（→ 非目标） |

## 依赖

- `core`

## 被依赖

- `datasources`、`query`（`query/rls/guard.py` 下游消费 auth RLS hook）、`dashboard`、`reports`、`governance`、`views`

## 主要类型 / 入口（M1 骨架）

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `AuthMiddleware` | ASGI 中间件；`main.py` 注册 | BOOT-003 | M1 骨架 |
| `PUBLIC_PATHS` | `/health`、`/docs`、`/redoc`、`/openapi.json` 豁免；`/template-assets` 前缀为内置素材静态资源（免鉴权） | BOOT-003 | M1 骨架 |
| `get_current_user` | `auth/deps.py`；handler 依赖注入 | BOOT-003 | M1 骨架 |
| `GET /api/v1/me` | `api/v1/me.py`；`get_current_user` 注入 `UserContext` | BOOT-003 | M1 骨架 |
| `profile/service.py` | 资料更新与 `change_password` 域逻辑 | 实现追溯 | 已实现 |
| `UserContext` | 占位用户上下文 | BOOT-003 | M1 骨架 |
| `Bearer dev` | 仅 `VITALSPAN_ENV=development` 接受 | BOOT-003 | M1 占位 |
| `audit/service.py` | 审计写入与分页查询 L1 | AUTH-003, AUTH-008 | 已实现 |
| `audit/write_hooks.py` | auth 域写操作 `record_platform_event` | AUTH-008 | 已实现 |
| `rls/groups/service.py` | 维度分组 CRUD 与成员值 | AUTH-006 | 已实现 |
| `rls/bindings/service.py` | 角色维度/分组绑定、`resolve_effective_values` | AUTH-006 | 已实现 |
| `rls/predicate.py` | 组织维度 RLS 谓词生成 | AUTH-007 | 已实现 |
| `rls/hooks.py` | `prepare_query_rls` / `get_query_rls_fragment` 查询入口 hook | AUTH-007 | 已实现 |
| `query/rls/guard.py` | L1 SQL WHERE 合并与行过滤守卫（消费 auth RLS hook） | AUTH-007 | 已实现 |
| `GET /api/v1/audit/events` | 审计列表 API（admin 守卫；`target_type`/`actor_id` 过滤） | AUTH-003, AUTH-008 | 已实现 |

## 关联 API

见 [api/README.md](../api/README.md) §认证 · §权限。

## 实现笔记

- `AuthMiddleware` 在 `backend/app/main.py` 通过 `app.add_middleware(AuthMiddleware)` 注册
- `OPTIONS` 预检直接放行，避免 CORS 被 401 拦截
- RLS L1 仅 `org_dimension` 子树展开；无绑定时 `build_org_rls_fragment` 返回 `1=0`
- Alembic `0006`：维度分组四表 + `ix_auth_audit_events_actor_created`
- Alembic `0007`：`auth_roles.is_active` + `ix_auth_audit_events_created_at`

## 资源 ACL bypass（Phase A）

- **唯一 bypass 真理源**：`backend/app/auth/bypass.py` — `bypasses_resource_acl(actor)` / `bypasses_rls(user)` 仅当 `actor.is_root` 为真
- **禁止**以 `"admin" in actor.roles` 绕过资源可见性；自定义 `admin` 角色码不再等同平台 root
- **消费点**：`datasources/acl.py` · `dashboard/acl.py` · `query/rls/guard.py` · 各域 `assert_visible` / `assert_dashboard_access` 调用链须传 `is_root=user.is_root`
- **报表目录**：`reports/catalog/grant_acl.py` 按 `resource_type=report` grant 过滤 `list_nodes` / `get_node`
- **测试**：`tests/test_auth_resource_acl_matrix.py`（dashboard 子路由 IDOR · report grant · scheduler 读保护）

## Phase C（组织范围管理 · 用户例外 · 列脱敏 · 认证集成骨架）

| 能力 | 锚点 |
|------|------|
| 组织范围管理员 | `system:org_scoped.manage` · `org_scope.py` · `users/service.py` 子树过滤 |
| 用户资源/维度例外 | `user_overrides/merge.py` 接入 `resources/service.py` · dashboard/datasource/report ACL · RLS `predicate.py`；有效集 = 角色 ∪ add − deny |
| 列脱敏 | `masking/service.py` · `dataset:mask.manage` · 查询 API 后处理 · `RlsAdminPage`「列脱敏」Tab |
| 域删除/发布审计 | `audit/write_hooks.py` `record_domain_delete/publish` · datasource/dashboard/dataset/report |
| LDAP/OIDC 规格门禁 | `docs/specs/auth-ldap-oidc-integration.md` · `login/oidc.py` 占位 |
| 测试 | `test_auth_user_override_enforcement.py` · `test_auth_security_e2e.py` · `test_auth_org_scoped_admin.py` · `test_auth_user_overrides.py` · `test_auth_column_masks.py` · `test_auth_model_cleanup.py` |

## 模型维护（2026-08-31 model-reviewer 选项 2）

- **资源删除清理**：`auth/cleanup.py` — 删除 datasource/dashboard/report/gov 节点时清理 grant；删除 datasource 时清理 masks/bindings；删除 org 节点时清理 org 维度值
- **列脱敏 scope**：`masking/service.py` 与 RLS 列绑定一致，要求 `datasourceId` 或 `datasetId`
- **grant 写路径**：`create_grant` 校验 `resource_type`；库 CHECK（`0061`）
- **`permission_version` / `rls_version`**：仅保护角色权限矩阵与 RLS 维度绑定 API 的乐观锁，不含资源 grant / 用户例外
- **审计保留**：`scripts/purge-auth-audit-events.py`（默认 365 天，`AUTH_AUDIT_RETENTION_DAYS` 可覆盖）
