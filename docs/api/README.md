# HTTP 路由索引

> **定位**：VitalSpan 对外/对内 HTTP 路由登记簿；与 [arch.md](../arch.md) §5 同步。
> **维护**：新增或修改路由时在本文件补一行；实现后把「状态」改为 `已实现` 并填代码锚点。（arch-inspect Case 2.1 验收 touch）
> **真理源**：行为需求见 [SRS §6](../srs/全生命周期系统需求规格说明书.md#6-接口需求)；功能项见 [PRD API-001~007](../automate/prd/F13-API.md)。

```yaml
version: 1.0.16
last_updated: 2026-08-18
api_prefix: /api/v1
openapi_docs: /docs
redoc: /redoc
```

## 约定

| 项 | 规则 |
|----|------|
| 前缀 | `/api/v1/`；破坏性变更升 `v2` |
| 认证 | `Authorization: Bearer <token>`（一期 BOOT-003 后启用） |
| 查询类 | 只读；禁止经 API 写入外部数据源 |
| 分页 | `?page=&page_size=`（三期起统一；前期可省略） |
| 错误体 | `{ "code": "...", "message": "...", "detail": ... }` |
| 成功体例外 | `POST/PUT/GET /ai-viz/artifacts` 成功为裸 `AiVizArtifactOut`（含 `warnings[]` · `styleComplianceTier`；不含 `{code,message}`）；`DELETE .../artifacts/{id}` 默认 **204**；`DELETE .../artifacts/{id}?unlink=true` 返回 `AiVizArtifactDeleteOut`（含从 layout 移除的看板摘要）；`GET .../entry` 为 HTML |

**运行时 OpenAPI**：`http://localhost:8000/docs` · `http://localhost:8000/redoc`

### 联调可消费附录（D3）

面向 Postman / 网关 / 冒烟；**非**端点目录替代。完整登记仍以本文件各 § 为准。

| 模块 | 文档 | 说明 |
|------|------|------|
| 认证 | [auth.md](./auth.md) | 登录、me、改密、冒烟 |
| 数据源 | [datasources.md](./datasources.md) | CRUD、test、types、schemas |
| 查询 | [query.md](./query.md) | execute、bindings、execute-plan 边界 |

环境与运维：[service/backend.md](../service/backend.md) · 鉴权步骤见 [auth.md](./auth.md)。

---

## 0. 系统

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/health` | 健康检查（`AuthMiddleware.PUBLIC_PATHS` 免鉴权） | — | P0 | BOOT-001 | 已实现 | `backend/app/main.py` |
| GET | `/docs` | Swagger UI（`docs_url="/docs"`；`AuthMiddleware.PUBLIC_PATHS` 免鉴权，且 `path.startswith("/docs")` 覆盖子资源） | — | 一期 | API-007 | 已实现 | `backend/app/main.py` · `backend/app/auth/middleware.py` |
| GET | `/redoc` | ReDoc（`redoc_url="/redoc"`；`AuthMiddleware.PUBLIC_PATHS` 免鉴权） | — | 一期 | API-007 | 已实现 | `backend/app/main.py` · `backend/app/auth/middleware.py` |
| GET | `/openapi.json` | OpenAPI 规范（IF-01~04/06 tag 后处理；`x-api-version-policy`；r44 IF operationId 前缀；`AuthMiddleware.PUBLIC_PATHS` 免鉴权） | IF-06 | 一期 | API-001, API-002, API-007 | 已实现 | `backend/app/openapi/extensions.py` · `backend/app/openapi/version_policy.py` · `backend/app/auth/middleware.py` |

---

## 1. 认证与会话

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/me` | 当前用户资料（`id`/`username`/`displayName`/`email`/`roles`） | 内部 | P0 | BOOT-003 | 已实现 | `backend/app/api/v1/me.py` · `backend/app/auth/profile/` |
| PATCH | `/api/v1/me` | 自服务更新 `displayName`/`email`（审计 `profile.update`）；实现追溯：BUG-001 · Account Self-Service plan | 内部 | 一期 | — | 已实现 | `backend/app/api/v1/me.py` |
| POST | `/api/v1/auth/login` | 登录，返回 token（`AuthMiddleware.PUBLIC_PATHS` 免鉴权，唯一业务路径公开项） | 内部 | 一期 | BOOT-003 | 已实现 | `backend/app/api/v1/auth.py` |
| POST | `/api/v1/auth/change-password` | 自服务修改密码（`currentPassword`/`newPassword`；204 成功；401 可为鉴权 `UNAUTHORIZED` 或业务码 `AUTH_INVALID_CURRENT_PASSWORD`，客户端按 `code` 区分；422 为 schema/长度/`AUTH_PASSWORD_UNCHANGED`；审计 `password.change`）；实现追溯：BUG-001 · Account Self-Service plan | 内部 | 一期 | — | 已实现 | `backend/app/api/v1/auth.py` · `backend/app/auth/profile/service.py` |
| POST | `/api/v1/auth/dev-switch` | 开发环境切换用户身份（`vitalspan_env=development`） | 内部 | 一期 | — | 已实现 | `backend/app/api/v1/auth.py` |
| POST | `/api/v1/auth/logout` | 注销 | 内部 | 一期 | BOOT-003 | 规划 | `backend/app/api/v1/auth.py` |
| GET | `/api/v1/auth/me` | 当前用户与角色；二期正式路径，M1 占位见 `GET /api/v1/me` | 内部 | 一期 | AUTH-003 | 规划 | `backend/app/api/v1/auth.py` |

---

## 2. 权限（M7 · IF-06 配套）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET/POST | `/api/v1/roles` | 角色列表/创建（`?code_prefix=&limit=&offset=`；响应 `total`；`RoleOut` 输出 camelCase `isActive`/`isRoot`/`isSystem`/`permissionVersion`） | 内部 | 一期 | AUTH-001 | 已实现 | `backend/app/api/v1/roles.py` |
| GET/PUT/DELETE | `/api/v1/roles/{id}` | 角色详情/更新/删除（PUT body 可选 `is_active`） | 内部 | 一期 | AUTH-001 | 已实现 | `backend/app/api/v1/roles.py` |
| GET | `/api/v1/permissions` | 权限目录全集（`PermissionListOut`；`system:role.read`） | 内部 | M7 | AUTH-001 | 已实现 | `backend/app/api/v1/permissions.py` |
| GET | `/api/v1/roles/{id}/permissions` | 角色权限绑定（`RolePermissionsOut`；root 返回 `allPermissions=true`；`system:role.read`） | 内部 | M7 | AUTH-001 | 已实现 | `backend/app/api/v1/roles.py` |
| PUT | `/api/v1/roles/{id}/permissions` | 角色权限全量替换（`expectedVersion` 乐观锁；冲突 409 `ROLE_PERMISSION_VERSION_CONFLICT`；root 禁改 409 `AUTH_ROOT_ROLE_IMMUTABLE`；`system:role.manage`） | 内部 | M7 | AUTH-001 | 已实现 | `backend/app/api/v1/roles.py` |
| GET/POST | `/api/v1/users` | 用户列表/创建（POST body `{username, displayName?, email?, orgId?, roleIds, initialPassword}`；列表项含 `imAccounts`；保存 SM3 hash（`$sm3$`），不返回密码；`system:user.manage`） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| PATCH | `/api/v1/users/{id}` | 用户信息/角色更新（`{displayName?, email?, orgId?, roleIds?, imAccounts?}`；`imAccounts` 为 `{dingtalk?, feishu?}`，空串解绑；根管理员保护；`system:user.manage`） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| DELETE | `/api/v1/users/{id}` | 删除用户（204；不可删当前登录账号；最后一个 root 管理员保护 409 `AUTH_ROOT_ADMIN_REQUIRED`；`system:user.manage`） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| POST | `/api/v1/users/{id}/disable` · `/enable` · `/unlock` | 用户启停/解锁（解锁清零失败计数与 `lockedUntil`；`system:user.manage`） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| POST | `/api/v1/users/{id}/reset-password` | 管理员重置密码（返回 `{temporaryPassword, passwordChangedAt}`；`Cache-Control: no-store`；`token_version+1`；审计无明文；`system:user.password.reset`） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| PUT | `/api/v1/users/{id}/roles` | 用户角色绑定（deprecated，等价 PATCH `roleIds`；`system:user.manage`） | 内部 | 一期 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| GET | `/api/v1/users/{id}/roles` | 用户已绑角色列表 | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| POST | `/api/v1/users/{id}/roles/{role_id}` | 增量绑定单角色 | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| DELETE | `/api/v1/users/{id}/roles/{role_id}` | 增量移除单角色（204） | 内部 | M7 | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` |
| PUT/GET/DELETE | `/api/v1/users/{id}/org` | 用户组织归属 | 内部 | 一期 | AUTH-002 | 已实现 | `backend/app/api/v1/users.py` |
| GET/PUT/DELETE | `/api/v1/users/{id}/resource-grants` | 用户级资源例外授权（add/deny；有效 = 角色 ∪ add − deny） | 内部 | Phase C | AUTH-003 | 已实现 | `backend/app/api/v1/users.py` · `user_overrides/service.py` |
| GET/PUT/DELETE | `/api/v1/users/{id}/dimension-overrides` | 用户级维度例外（add/deny） | 内部 | Phase C | AUTH-006 | 已实现 | `backend/app/api/v1/users.py` |
| GET/POST/DELETE | `/api/v1/column-masks` | 列脱敏策略（hide/partial/hash；`dataset:mask.manage`） | 内部 | Phase C | — | 已实现 | `backend/app/api/v1/column_masks.py` |
| GET | `/api/v1/auth-integration/status` | 外部认证集成状态摘要 | 内部 | Phase C | — | 已实现 | `backend/app/api/v1/auth_integration.py` |
| POST | `/api/v1/auth-integration/oidc/callback` | OIDC 回调占位（501 未配置） | 内部 | Phase C | — | 规划 | `backend/app/auth/login/oidc.py` |
| GET/POST | `/api/v1/orgs` | 组织树节点列表/创建（`q` · `limit` · `offset`） | 内部 | 一期 | AUTH-002 | 已实现 | `backend/app/api/v1/orgs.py` |
| GET/PUT/DELETE | `/api/v1/orgs/{org_id}` | 组织节点详情/更新/删除 | 内部 | 一期 | AUTH-002 | 已实现 | `backend/app/api/v1/orgs.py` |
| GET | `/api/v1/platform/delivery/email/slots` | QQ / 163 双槽位 SMTP 摘要列表 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| GET | `/api/v1/platform/delivery/email` | QQ 槽位 SMTP 摘要（兼容旧路径） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| GET | `/api/v1/platform/delivery/email/{slot}` | 单槽位 SMTP 摘要（`slot`=qq\|163） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| PUT | `/api/v1/platform/delivery/email` | 保存 QQ 槽位 SMTP 并探测 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| PUT | `/api/v1/platform/delivery/email/{slot}` | 保存指定槽位 SMTP 并探测 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| DELETE | `/api/v1/platform/delivery/email` | 清空 QQ 槽位 SMTP | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| DELETE | `/api/v1/platform/delivery/email/{slot}` | 清空指定槽位 SMTP（清空后忽略 env 回落） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| GET | `/api/v1/platform/delivery/im/slots` | 钉钉/飞书 IM 应用摘要 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| GET | `/api/v1/platform/delivery/im/{channel}` | 单通道 IM 应用摘要 + 探测 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| PUT | `/api/v1/platform/delivery/im/{channel}` | 保存 IM 配置并探测；钉钉为 `group_webhook` + `webhookUrl`（可选 `webhookSecret` 加签），探测真 POST `robot/send` | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| DELETE | `/api/v1/platform/delivery/im/{channel}` | 清空 IM 通道（清空后忽略 env） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/platform_delivery.py` |
| GET | `/api/v1/me/im-bindings` | 当前用户钉钉/飞书绑定状态 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| GET | `/api/v1/me/im-bindings/{channel}/authorize` | 发起 OAuth 授权跳转（浏览器直链，须 Cookie/Bearer） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| POST | `/api/v1/me/im-bindings/{channel}/authorize-url` | 返回 OAuth 授权 URL（SPA 带 Bearer 后跳转） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| DELETE | `/api/v1/me/im-bindings/{channel}` | 解绑指定 IM 通道 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| POST | `/api/v1/me/im-bindings/feishu/device-auth/start` | 飞书 device-code 绑定启动（user_delegated；body 可选 `{ scope }` 增量补授权） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| POST | `/api/v1/me/im-bindings/feishu/device-auth/complete` | 飞书 device-code 轮询完成（返回 `needsReauth` / `suggestedScope` 驱动自动补授权） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| GET | `/api/v1/me/im-bindings/feishu/capability` | 飞书 user_delegated 推送能力探测（绑后/调度失败补授权） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| POST | `/api/v1/me/im-bindings/{channel}/scan-bind/start` | 钉钉 user_delegated 内嵌扫码参数（主路径钉钉为群发，通常 422） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| POST | `/api/v1/me/im-bindings/{channel}/scan-bind/complete` | 钉钉内嵌扫码完成 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/me_im_bindings.py` |
| GET | `/api/v1/auth/im/{channel}/callback` | IM OAuth 回调（公开路径，state 校验） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/im_auth.py` |
| GET/POST | `/api/v1/resource-grants` | AUTH-004 资源授权列表/创建 | 内部 | 一期 | AUTH-004 | 已实现 | `backend/app/api/v1/resource_grants.py` |
| DELETE | `/api/v1/resource-grants/{grant_id}` | 删除单条资源授权（204） | 内部 | 一期 | AUTH-004 | 已实现 | `backend/app/api/v1/resource_grants.py` |
| GET/POST | `/api/v1/rls/dimensions` | 权限维度类型（写操作 admin 守卫 → 403 `DIMENSION_FORBIDDEN`） | 内部 | 一期 | AUTH-005 | 已实现 | `backend/app/api/v1/rls.py` |
| GET/PUT/DELETE | `/api/v1/rls/dimensions/{dim_id}` | 维度类型详情/更新/删除 | 内部 | 一期 | AUTH-005 | 已实现 | `backend/app/api/v1/rls.py` |
| GET | `/api/v1/audit/events` | 审计事件查询（`?target_id=&action=&target_type=&actor_id=&created_after=&created_before=&limit=&offset=` ISO8601 时间窗；admin 守卫；detail 脱敏） | 内部 | 一期 | AUTH-003, AUTH-008 | 已实现 | `backend/app/api/v1/audit.py` |
| GET/POST | `/api/v1/rls/groups` | 维度分组列表/创建 | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/rls.py` |
| GET/PUT/DELETE | `/api/v1/rls/groups/{id}` | 分组详情/更新/删除 | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/rls.py` |
| GET/POST/PUT/DELETE | `/api/v1/rls/groups/{id}/values` | 分组成员值列表/添加/全量替换/删除集合 | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/rls.py` |
| DELETE | `/api/v1/rls/groups/{id}/values/{value}` | 删除分组内单个成员值（204） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/rls.py` |
| GET/POST | `/api/v1/rls/column-bindings` | RLS 列映射列表/创建 | 内部 | 一期 | AUTH-007 | 已实现 | `backend/app/api/v1/rls.py` |
| DELETE | `/api/v1/rls/column-bindings/{id}` | 删除列映射（204） | 内部 | 一期 | AUTH-007 | 已实现 | `backend/app/api/v1/rls.py` |
| POST | `/api/v1/rls/preview` | RLS SQL 片段预览 | 内部 | 一期 | AUTH-007 | 已实现 | `backend/app/api/v1/rls.py` |
| GET | `/api/v1/roles/{id}/dimension-values` | 角色直绑维度值（`?dimensionTypeId=`；`RoleDimensionValuesOut` 含 `version`） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/roles.py` |
| PUT | `/api/v1/roles/{id}/dimension-values` | 角色直绑维度值全量替换（`expectedVersion` 乐观锁；`confirmEmpty`；成功 **200** + `RoleDimensionValuesOut`；冲突 409 `RLS_BINDING_VERSION_CONFLICT`；空绑定 422 `RLS_EMPTY_CONFIRM_REQUIRED`） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/roles.py` |
| GET | `/api/v1/roles/{id}/dimension-groups` | 角色分组绑定（`RoleDimensionGroupsOut` 含 `groupIds`/`version`） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/roles.py` |
| PUT | `/api/v1/roles/{id}/dimension-groups` | 角色分组绑定全量替换（`expectedVersion`/`confirmEmpty`；成功 **200** + `RoleDimensionGroupsOut`；冲突/空绑定同上） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/roles.py` |
| GET | `/api/v1/roles/{id}/effective-dimensions` | 角色有效维度集（**deprecated**；只读派生端点，供 RLS 引擎/查询；管理 UI 改用 GET dimension-values/groups） | 内部 | 一期 | AUTH-006 | 已实现 | `backend/app/api/v1/roles.py` |

> **Admin 权限工作流（FE 下轮）**：`GET /roles` → `GET /rls/dimensions` → `GET /rls/groups` → `PUT /roles/{id}/dimension-groups` → `GET /audit/events`

---

## 3. 数据源（IF-06 · 连接层）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/datasources/types` | 已注册连接器类型清单（含 M11：`starrocks`/`trino`/`presto`/`influxdb`/`tdengine`/`timescaledb`；**r249** `rest_api`/`excel`/`csv`/`db2`/`impala`；**r250** `redshift`（category=olap）；**CONN-028** `roapi`（category=api）；`type`、`displayName`、`category`、`capabilities`、**`displayGroup`**（`oltp`/`olap`/`warehouse`/`file`/`api`/`extension`）、**`categoryLabel`**（中文组名）） | IF-06 | 一期 | DS-007 · CONN-023~028 | 已实现 | `backend/app/api/v1/datasources.py` |
| POST | `/api/v1/datasources` | 创建数据源；请求/响应可选 `connectionOptions`（charset/collation/sslMode/connectTimeoutSec/readTimeoutSec） | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| GET | `/api/v1/datasources` | 数据源列表（`?limit=&offset=&type=&q=&includeManaged=`）；默认不含托管分析库；`includeManaged=true` 才返回 | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| GET | `/api/v1/datasources/{id}` | 数据源详情（无明文密码）；含 `connectionOptions` | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| PUT | `/api/v1/datasources/{id}` | 更新数据源 | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| PATCH | `/api/v1/datasources/{id}` | 部分更新数据源；支持部分更新 `connectionOptions` | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| DELETE | `/api/v1/datasources/{id}` | 软删数据源（引用中 409 `DATASOURCE_IN_USE`） | IF-06 | 一期 | DS-002 | 已实现 | `backend/app/api/v1/datasources.py` |
| POST | `/api/v1/datasources/test` | 连通性测试（草稿配置；响应含可选 `code`（`MYSQL_*`/`KINGBASE_*`）、`traceId`；**r67** kingbase 参数预校验 422；inflight 并发 429） | IF-06 | 一期 | DS-003 | 已实现 | `backend/app/api/v1/datasources.py` |
| POST | `/api/v1/datasources/{id}/test` | 连通性测试（已保存；同上；inflight 测试完成即释放槽位） | IF-06 | 一期 | DS-003 | 已实现 | `backend/app/api/v1/datasources.py` |
| GET | `/api/v1/datasources/{id}/schemas` | Schema 列表（ACL 过滤；连接失败 502 `METADATA_CONNECTION_FAILED`） | IF-06 | 一期 | DS-004 | 已实现 | `backend/app/api/v1/datasources.py` · `backend/app/datasources/metadata/service.py` |
| GET | `/api/v1/datasources/{id}/tables` | 表列表（`schema` 必填；缺参 400 `METADATA_INVALID_REQUEST`） | IF-06 | 一期 | DS-004 | 已实现 | `backend/app/api/v1/datasources.py` · `backend/app/datasources/metadata/service.py` |
| GET | `/api/v1/datasources/{id}/columns` | 列列表（`schema`+`table` 必填） | IF-06 | 一期 | DS-004 | 已实现 | `backend/app/api/v1/datasources.py` · `backend/app/datasources/metadata/service.py` |

**方言实现（r25）**：`mysql` → `backend/app/datasources/dialects/mysql.py`（CONN-001）；`postgresql` → `backend/app/datasources/dialects/postgres.py`（CONN-002）；`gbase` → `backend/app/datasources/dialects/gbase.py`（CONN-019）；`kingbase` → `backend/app/datasources/dialects/kingbase/`（CONN-018，PG 协议委托，默认 port 54321）。

**信创 companion r242（CONN-017~021）**：`dm`/`kingbase`/`gbase`/`oceanbase`/`tidb` — Admin `DatasourceFormPage` 可选五型 + `probe_readonly_sql` 只读探针；集成测 `tests/test_mfinal_fc_r242.py`。

**GaussDB companion r243（CONN-022）**：`probe_readonly_sql`（psycopg `SELECT 1`）+ Admin `DatasourceFormPage` hints；集成测 `tests/test_mfinal_fc_r242.py` T-CONN-R242-022-*。

---

## 3b. NFR 横切（r46 L1 + r51 companion）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/nfr/plugin-extension-points` | 连接器插件扩展点清单 | 内部 | 一期 | NFR-005 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/plugin-extension/drill` | 连接器扩展演练（`drill_stub` 注册 + `connectivityOk`/`readonlyQueryOk` + zeroInvasion；pytest/DRILL_MODE） | 内部 | 四期 | NFR-005 | 已实现（r248） | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/dashboard-availability/report` | 核心看板可用性复合报告（SLA + 首屏 P95；strict 503） | 内部 | 四期 | NFR-003 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/dashboard-availability/smoke` | 核心看板批量可用性 smoke（`CORE_DASHBOARD_IDS`；`simulateBreach`；strict→503） | 内部 | 四期 | NFR-003 | 已实现（r248） | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/push-config` | 推送配置契约（不泄露 webhook 明文） | 内部 | 一期 | NFR-006 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/xinchuang/compliance` | 信创合规检查清单（strict 违规 → 422） | 内部 | 一期 | NFR-007 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/xinchuang/deployment-report` | 信创部署验收报告（`format=json\|markdown`；`schemaVersion`/`missingExpectedTypes` + compose 方言 smoke） | 内部 | 四期 | NFR-007 | 已实现（r248） | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/browser-matrix` | 浏览器兼容矩阵 + 可选 UA 探测 | 内部 | 一期 | NFR-006 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/notifications` | 站内推送通知创建（mock 投递） | 内部 | 三期 | NFR-006 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/notifications/{id}` | 推送通知状态查询 | 内部 | 三期 | NFR-006 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/push-probe` | 推送通道 mock 探测（不发送真实 HTTP） | 内部 | 一期 | NFR-006 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/registration-path/{connector_type}` | 连接器插件登记路径文档 | 内部 | 一期 | NFR-005 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/runtime-compliance` | 零 DE/SS 运行时合规扫描报告（`policyVersion=nfr08-l1`） | 内部 | 一期 | NFR-008 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/runtime-compliance/assert` | strict 模式违规 → 503 `NFR_RUNTIME_VIOLATION`；permissive → 200 | 内部 | 一期 | NFR-008 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/runtime-compliance/deployment-report` | 零 DE/SS 部署验收（`format=json\|markdown`；`schemaVersion`/`composeServices`/`forbiddenComposeHits`） | 内部 | 一期 | NFR-008 | 已实现（r249） | `backend/app/core/nfr/deployment_report.py` |
| POST | `/api/v1/nfr/report-query-perf/probe` | 报表查询性能 mock probe（`withinBudget` + `elapsedMs` stub；**r67** enterprise ACL + `simulateFailure`） | 内部 | 一期 | NFR-002 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/report-query-perf/validate` | 报表查询性能配置校验（`REPORT_PERF_*`；**r67** `sampleQueryId` pattern） | 内部 | 一期 | NFR-002 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/dashboard-first-screen/validate` | NFR-001 首屏配置校验（**r67** enterprise ACL + `dashboardId` pattern） | 内部 | 一期 | NFR-001 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/dashboard-first-screen/probe` | NFR-001 首屏 mock probe（**r67** enterprise ACL） | 内部 | 一期 | NFR-001 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/dashboard-sla/validate` | NFR-003 SLA 配置校验（**r68** enterprise ACL + `dashboardId` pattern） | 内部 | 一期 | NFR-003 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/dashboard-sla/probe` | NFR-003 SLA mock probe（**r68** actor 透传） | 内部 | 一期 | NFR-003 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/dashboard-sla/alerts` | NFR-003 SLA 告警配置（**r68** `thresholdPercent` query） | 内部 | 一期 | NFR-003 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/https-audit/status` | NFR-004 HTTPS 策略探测 | 内部 | 一期 | NFR-004 | 已实现 | `backend/app/api/v1/nfr.py` |
| POST | `/api/v1/nfr/https-audit/mask-probe` | NFR-004 脱敏审计 mock（**r68** `auditScope` ACL + `simulateAuditFailure`） | 内部 | 一期 | NFR-004 | 已实现 | `backend/app/api/v1/nfr.py` |
| GET | `/api/v1/nfr/https-audit/audit-probe` | NFR-004 响应审计 ring buffer probe | 内部 | 一期 | NFR-004 | 已实现 | `backend/app/api/v1/nfr.py` |

---

## 4. 查询执行（IF-06 · M3-LITE）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| POST | `/api/v1/query/execute` | 只读查询（`mode=sql\|table\|native`）；**非图表/报表出图路径**（管理预览/探针） | IF-06 | 一期 | QUERY-001/003 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/translate` | 可视化查询配置→参数化 SQL | IF-06 | 一期 | QUERY-008 | 已实现 | `backend/app/api/v1/query.py` |
| GET | `/api/v1/query/routing/modes` | 连接器路由模式（search/document/timeseries→native，其余→sql） | IF-06 | 一期 | QUERY-003 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/native/validate` | Native 查询守卫（`QUERY_NATIVE_*`；禁止 sql 字段） | IF-06 | 一期 | QUERY-003 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/readonly-guard` | 只读 SQL / native 路由守卫 smoke | IF-06 | 一期 | QUERY-003 | 已实现 | `backend/app/api/v1/query.py` |
| GET | `/api/v1/query/bindings` | 图表直连绑定列表（**deprecated**，新图表勿用） | IF-06 | 一期 | QUERY-005 | deprecated | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/bindings` | 创建绑定（**deprecated**，新图表勿用） | IF-06 | 一期 | QUERY-005 | deprecated | `backend/app/api/v1/query.py` |
| GET | `/api/v1/query/bindings/{bindingId}` | 绑定详情（**deprecated**） | IF-06 | 一期 | QUERY-005 | deprecated | `backend/app/api/v1/query.py` |
| PUT | `/api/v1/query/bindings/{bindingId}` | 更新绑定（**deprecated**） | IF-06 | 一期 | QUERY-005 | deprecated | `backend/app/api/v1/query.py` |
| DELETE | `/api/v1/query/bindings/{bindingId}` | 删除绑定（**deprecated**） | IF-06 | 一期 | QUERY-005 | deprecated | `backend/app/api/v1/query.py` |
| GET | `/api/v1/query/dataset/routing` | Dataset 第三路径路由文档（sql/native/dataset） | IF-06 | 一期 | QUERY-009 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/dataset/validate` | Dataset 路径 ACL/readonly 守卫（`QUERY_DATASET_*`/`QUERY_PATH_AMBIGUOUS`） | IF-06 | 一期 | QUERY-009 | 已实现 | `backend/app/api/v1/query.py` |
| POST | `/api/v1/query/dataset/execute-plan` | Dataset execute-plan 四步链 companion（`dataset-plan-v1`；调试/契约用；**生产出数走 `/dataset/execute`**） | IF-06 | 一期 | QUERY-009 | 已实现 | `backend/app/api/v1/query.py` |
| GET/PUT | `/api/v1/query/configs` | 配置元模型存取（`configType`/`schemaVersion`/`refType`/`refId`；可选 `expectedRevision` 乐观锁；revision upsert；payload >256KB → 413 `CONFIG_PAYLOAD_TOO_LARGE`；revision 冲突 → 409 `CONFIG_VERSION_CONFLICT`） | 内部 | 一期 | QUERY-007 | 已实现 | `backend/app/api/v1/query_configs.py` |
| GET | `/api/v1/query/configs/{config_id}` | 按 id 读取配置记录 | 内部 | 一期 | QUERY-007 | 已实现 | `backend/app/api/v1/query_configs.py` |
| POST | `/api/v1/query/configs/{config_id}/translate` | 已存 `dataset_query` 配置翻译为参数化 SQL | 内部 | 一期 | QUERY-008 | 已实现 | `backend/app/api/v1/query_configs.py` |
| POST | `/api/v1/query/dataset/execute` | `dataSourceId` + `configId` 存储→翻译→执行；可选 `encoding`（维/指/过滤器/时间范围 → `chart_sql` WHERE→聚合→LIMIT） | IF-06 | 一期 | QUERY-009 | 已实现 | `backend/app/api/v1/query.py` · `backend/app/query/dataset/chart_sql.py` |
| GET | `/api/v1/designer/fields` | 设计器字段注册表 + glossary + dataset 字段 | 内部 | 四期 | DESIGN-001 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/preview/translate` | 三块配置合并 SQL 预览（含规则注释） | 内部 | 四期 | DESIGN-001 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/submit-workflow` | 快照 + 工单实例 + 自动 submit | 内部 | 四期 | DESIGN-004 | 已实现 | `backend/app/api/v1/designer.py` |
| GET | `/api/v1/designer/snapshots/{snapshotId}` | 设计器快照读取（owner/admin ACL；`DESIGN_SNAPSHOT_FORBIDDEN`） | 内部 | 四期 | DESIGN-004 | 已实现 | `backend/app/api/v1/designer.py` |
| GET/PUT | `/api/v1/designer/design-mode` | 可视化/SQL 模式切换（`config_type=design_mode`） | 内部 | 四期 | DESIGN-005 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/conditions/validate` | 查询条件配置校验（不落库；422 含 `detail.fields`；`DESIGN_UNKNOWN_FIELD`/`DESIGN_INVALID_CROSS_FIELD`） | 内部 | 一期 | DESIGN-001 | 已实现 | `backend/app/api/v1/designer.py` |
| PUT/GET | `/api/v1/designer/conditions` | 查询条件保存/读取（挂载 QUERY-007；可选 `expectedRevision`） | 内部 | 一期 | DESIGN-001 | 已实现 | `backend/app/api/v1/designer.py` |
| PUT/GET | `/api/v1/designer/compute-rules` | 运算规则保存/读取（挂载 QUERY-007；`DESIGN_RULE_TYPE_MISMATCH`/`DESIGN_RULE_BROKEN_CHAIN`/`DESIGN_INVALID_AGGREGATE`） | 内部 | 一期 | DESIGN-002 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/sql-mode/validate` | SQL 只读校验（`DESIGN_SQL_NOT_READONLY`/`DESIGN_SQL_EMPTY`） | 内部 | 一期 | DESIGN-005 | 已实现 | `backend/app/api/v1/designer.py` |
| GET | `/api/v1/designer/sql-mode/capabilities` | SQL 模式能力（`maxSqlLength=65536`） | 内部 | 一期 | DESIGN-005 | 已实现 | `backend/app/api/v1/designer.py` |
| PUT/GET | `/api/v1/designer/sql-mode` | SQL 模式持久化（`config_type=sql_mode`；`?refId=`） | 内部 | 一期 | DESIGN-005 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/output-fields/validate` | 输出字段/聚合校验（`DESIGN_EMPTY_OUTPUT_FIELDS`/`DESIGN_UNKNOWN_FIELD`/`DESIGN_INVALID_AGGREGATE`） | 内部 | 一期 | DESIGN-003 | 已实现 | `backend/app/api/v1/designer.py` |
| PUT/GET | `/api/v1/designer/output-fields` | 输出字段持久化（`config_type=output_fields`；`?refId=`） | 内部 | 一期 | DESIGN-003 | 已实现 | `backend/app/api/v1/designer.py` |
| POST/PUT/GET/DELETE | `/api/v1/designer/workflow-link` | 设计器项与工单实例关联 validate/save/get/delete（双向 query；draft 可撤回） | 内部 | 四期 | DESIGN-004 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/designer/workflow-link/validate` | 设计器↔工单关联校验（不落库） | 内部 | 四期 | DESIGN-004 | 已实现 | `backend/app/api/v1/designer.py` |
| POST | `/api/v1/query/preview` | 查询预览（设计器/图表配置） | 内部 | 二期 | QUERY-005 | 规划 | `backend/app/api/v1/query.py` |

---

## 4b. 图表配置（M5 · VIZ）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| POST | `/api/v1/charts/validate` | ChartViewConfig 预校验；422 时 `detail.fields: [{field, message}]`；`chartType=gis-map` 时 `nativeBody.gisProject` 可含 `layers[]`/`activeLayerId`/`halo`/`fog`（FE 归一化，BE 透传） | 内部 | 一期 | VIZ-001 | 已实现 | `backend/app/api/v1/charts.py` |
| GET | `/api/v1/charts/types` | 图表类型 catalog（~40 DE type + deprecated/migratesTo）；只读 | 内部 | 一期 | VIZ-003 | 已实现 | `backend/app/api/v1/charts.py` · `backend/app/viz/builtin/` |
| POST | `/api/v1/charts/render-spec` | 校验并归一为引擎无关 render-spec；非法 type → 422 `CHART_INVALID_TYPE` | 内部 | 一期 | VIZ-008 | 已实现（骨架） | `backend/app/api/v1/charts.py` |
| POST | `/api/v1/charts/embed/validate` | 图表嵌入配置校验（目标唯一性 + origin 白名单） | 内部 | 一期 | VIZ-006 | 已实现（骨架） | `backend/app/api/v1/charts.py` |
| POST | `/api/v1/charts/sdk/validate` | SDK portal init 配置校验（`VIZ_SDK_*`） | 内部 | 一期 | VIZ-007 | 已实现 | `backend/app/api/v1/charts.py` |
| POST | `/api/v1/charts/sdk/lifecycle` | SDK lifecycle manifest（init/destroy） | 内部 | 一期 | VIZ-007 | 已实现 | `backend/app/api/v1/charts.py` |
| GET | `/api/v1/charts/sdk/capabilities` | SDK 支持的 targetType/authMode 列表 | 内部 | 一期 | VIZ-007 | 已实现 | `backend/app/api/v1/charts.py` |
| GET | `/api/v1/tile-services` | 已登记 PMTiles 瓦片服务列表（`gis-map` 底图） | 内部 | 二期 | VIZ-003 | 已实现 | `backend/app/api/v1/tile_services.py` |
| GET | `/api/v1/tile-services/{serviceId}/resolve` | 解析同机 PMTiles + `/basemaps-assets` glyphs/sprite（无公网 CDN 默认值） | 内部 | 二期 | VIZ-003 | 已实现 | `backend/app/api/v1/tile_services.py` |
| POST | `/api/v1/tile-services` | 登记瓦片服务（管理员） | 内部 | 二期 | VIZ-003 | 已实现 | `backend/app/api/v1/tile_services.py` |
| PATCH | `/api/v1/tile-services/{serviceId}` | 更新瓦片服务（管理员） | 内部 | 二期 | VIZ-003 | 已实现 | `backend/app/api/v1/tile_services.py` |

> M9 r42 新增校验错误码：`CHART_INVALID_STYLE_VARIANT`（VIZ-004）、`CHART_FIELD_REQUIREMENT`（VIZ-005）；嵌入错误码 `EMBED_MISSING_TARGET`/`EMBED_TARGET_CONFLICT`/`EMBED_INVALID_ORIGIN`/`EMBED_INVALID`（VIZ-006）。域附录见 [services/viz.md](../services/viz.md)。

---

## 5. Dashboard 与视图（M5 · FR-VIEW）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET/POST | `/api/v1/dashboards` | Dashboard 列表/创建；列表返回 `layoutJson`+`previewSummary`+`widgetCount`+`surfaceKind`+`thumbnailUrl`；可选 `surfaceKind` 过滤；可选 `q` 按名称/标识/描述模糊搜索；SQL 分页 | 内部 | 一期 | DASH-001 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT/GET | `/api/v1/dashboards/{id}/thumbnail` | 列表缩略图上传/读取（保存时客户端截图 webp/png） | 内部 | 一期 | DASH-001 | 已实现 | `backend/app/api/v1/dashboards.py` |
| GET/PUT/DELETE | `/api/v1/dashboards/{id}` | Dashboard CRUD | 内部 | 一期 | DASH-001 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT | `/api/v1/dashboards/{id}/layout` | 双版本布局：v1 `colSpan/rowSpan/gridX/gridY`；v2 `canvas` + `x/y/width/height`（仪表板默认 `1440×≥900`；`styleConfig.surfaceKind=data-screen` 时默认 **`1920×1080`**）；`styleConfig.surfaceKind` 写入 layout 区分仪表板/数据大屏；`styleConfig.canvasBackgroundImageFit` / `canvasBackgroundImagePosition` 与 FE `WidgetBackgroundImageFit` 对齐持久化；禁止跨版本字段混用；422 码：`VIEW_LAYOUT_BOUNDS` / `DASH_INVALID_LAYOUT` / `DASH_DUPLICATE_WIDGET` / `DASH_MISSING_CHART_CONFIG` / `DASH_CHART_ID_MISMATCH` | 内部 | 一期 | DASH-002 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT | `/api/v1/dashboards/{id}/editor-save` | **事务型编辑保存**：一次提交 `name` + `layoutJson` + `globalFilters`；部分失败整体回滚；成功后可 GET/刷新/进程重启回读一致 | 内部 | 一期 | DASH-002 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/service.py` |
| POST | `/api/v1/dashboards/theme-analysis/execute-plan` | 主题分析 execute-plan 四步链（`theme-plan-v1`；yoy/mom compareWindow） | 内部 | 一期 | DASH-006 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/theme-analysis/validate` | 实体主题分析 config 校验（`DASH_THEME_*`） | 内部 | 一期 | DASH-006 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT/GET | `/api/v1/dashboards/theme-analysis` | 实体主题分析 config 持久化/读取（`config_type=entity_theme`） | 内部 | 一期 | DASH-006 | 已实现 | `backend/app/api/v1/dashboards.py` |
| GET | `/api/v1/dashboards/theme-analysis/chart-bindings` | chartViewBindings 联动查询（`linkedWidgetCount`） | 内部 | 一期 | DASH-006 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/theme-analysis/query` | 主题维度钻取查询（`dimensionId` → columns/rows；`DASH_THEME_DIMENSION_UNKNOWN`） | 内部 | 一期 | DASH-006 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/entity-overview/validate` | 实体总览 item 校验（`DASH_OVERVIEW_*`） | 内部 | 一期 | DASH-005 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT/GET | `/api/v1/dashboards/{id}/entity-overview` | 实体总览 save/get（`config_type=entity_overview`；含 `publishStatus` 探测） | 内部 | 一期 | DASH-005 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/global-filters/validate` | 全局筛选联动校验（`DASH_FILTER_*`） | 内部 | 一期 | DASH-004 | 已实现 | `backend/app/api/v1/dashboards.py` |
| PUT/GET | `/api/v1/dashboards/{id}/global-filters` | 全局筛选联动 save/get（`config_type=global_filter_linkage`；含 `affectedWidgetCount`） | 内部 | 一期 | DASH-004 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/{dashboard_id}/widgets/{widget_id}/execute` | M8 DASH-004 BE filter execute（linkage 合并 + SQL 参数注入） | 内部 | 一期 | DASH-004 | 已实现 | `backend/app/api/v1/dashboards.py` |
| POST | `/api/v1/dashboards/from-template` | 从可视化模板原子创建 Dashboard + layout（`templateId`） | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboards.py` |
| GET | `/api/v1/dashboards/{id}/export-layout` | 无头导出页布局（`?token=`；export token 免 Bearer） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_snapshot.py` |
| POST | `/api/v1/dashboards/export-query/execute` | 导出快照 SQL/table/native 查询代理（`X-Export-Token` + `X-Export-Dashboard-Id`） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_snapshot.py` |
| POST | `/api/v1/dashboards/export-query/dataset/execute` | 导出快照 Dataset 查询代理（同上 headers；避免 dataset/execute 401 踢登录） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_snapshot.py` |
| POST | `/api/v1/dashboards/{dashboard_id}/export-jobs` | Dashboard 异步导出任务提交（`format`；201 + job 元数据；与 Playwright 快照链分工） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_jobs.py` |
| GET | `/api/v1/dashboards/export-jobs/{job_id}` | 导出任务状态轮询 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_jobs.py` |
| GET | `/api/v1/dashboards/export-jobs/{job_id}/download` | 导出产物下载（`Content-Disposition: attachment`） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/dashboards.py` · `backend/app/dashboard/export_jobs.py` |
| GET | `/api/v1/demo-package/status` | 官方演示包就绪状态（sample_db 迁移 / demo 源 / 示例实例） | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/demo_package.py` |
| GET/POST | `/api/v1/dashboard-templates` | 可视化模板列表/创建草稿；列表查询：`surfaceKind` · `status` · `categoryKey` · `visibility` · `q` · `includeDrafts` · `limit`/`offset`；响应含 `contentRevision`（builtin 种子升级见 `seed.py` rev 25） | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| GET/PUT/DELETE | `/api/v1/dashboard-templates/{id}` | 模板详情/更新/删除；DELETE 须 `dashboard:edit`；**204** 成功；builtin → **403** `DASH_TEMPLATE_BUILTIN_READONLY`；不存在 → **404** `DASH_TEMPLATE_NOT_FOUND` | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| POST | `/api/v1/dashboard-templates/{id}/publish` | 发布模板（`dashboard:template.manage`） | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| POST | `/api/v1/dashboard-templates/{id}/archive` | 下架模板 | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| POST | `/api/v1/dashboard-templates/import` | 导入 `viz-layout` 信封为草稿 | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| GET | `/api/v1/dashboard-templates/{id}/export` | 导出 `viz-layout` 信封 | 内部 | 一期 | DASH-009 | 已实现 | `backend/app/api/v1/dashboard_templates.py` |
| GET/POST | `/api/v1/viz-components` | 组件库列表/创建草稿 | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| POST | `/api/v1/viz-components/batch-resolve` | 批量解析引用组件 payload | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| GET/PUT/DELETE | `/api/v1/viz-components/{id}` | 组件详情/更新/删除 | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| PUT/GET | `/api/v1/viz-components/{id}/thumbnail` | 组件库封面截图上传/下载 | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| POST | `/api/v1/viz-components/{id}/publish` | 发布组件（`viz:component.manage`） | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| GET | `/api/v1/viz-components/{id}/references` | 组件引用明细（看板/大屏实例列表） | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| POST | `/api/v1/viz-components/{id}/archive` | 下架组件（对标 dashboard-templates archive） | 内部 | 一期 | DASH-010 | 已实现 | `backend/app/api/v1/viz_components.py` |
| POST | `/api/v1/ai-viz/artifacts` | 注册自定义组件源码（customViz 库） | 内部 | 试点 | AIVIZ-002 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| PUT | `/api/v1/ai-viz/artifacts/{id}` | 覆盖同一组件源码；引用方刷新即新 | 内部 | 试点 | AIVIZ-009 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| GET | `/api/v1/ai-viz/artifacts` | 当前用户 artifact 列表（图表盘「自定义」） | 内部 | 试点 | AIVIZ-006 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| GET | `/api/v1/ai-viz/artifacts/{id}` | artifact 元数据；`dashboard:read` 即可（不限属主） | 内部 | 试点 | AIVIZ-002 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| GET | `/api/v1/ai-viz/artifacts/{id}/bundle` | 完整 bundle（manifest+files）；属主 + `dashboard:edit`；Agent 拉取编辑 | 内部 | 试点 | AIVIZ-019 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| GET | `/api/v1/ai-viz/artifacts/{id}/refs` | 引用该 artifact 的看板/大屏列表 | 内部 | 试点 | AIVIZ-019 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| GET | `/api/v1/ai-viz/artifacts/{id}/entry` | 组件 HTML；`dashboard:read` 即可（不限属主） | 内部 | 试点 | AIVIZ-002 | 已实现 | `backend/app/api/v1/ai_viz.py` |
| DELETE | `/api/v1/ai-viz/artifacts/{id}` | 属主从组件库删除 artifact；`?unlink=true` 时先从引用 layout 移除 widget | 内部 | 试点 | AIVIZ-018 | 已实现 | `backend/app/api/v1/ai_viz.py` |

**CustomViz Payload v1（AIVIZ-010）**：Base 挂载 entry 后向宿主注入 `.vs-cv-payload`，结构 `{ protocolVersion, bindingStatus, columns, rows, style, error? }`；`bindingStatus` 为 `unbound | bound | empty | error`。bundle 须监听 `vs-cv-payload-update`，详见 [`docs/api/vs-ai-spec/PROTOCOL.md`](vs-ai-spec/PROTOCOL.md) §Payload v1。

| POST | `/api/v1/views/validate` | DashboardView 协议校验；422 码：`VIEW_UNKNOWN_CHART_REF` / `VIEW_DEFAULT_SELF_REF` | IF-06 | 一期 | VIEW-001 | 已实现 | `backend/app/api/v1/views.py` |
| GET | `/api/v1/views/schema` | DashboardView JSON Schema | IF-06 | 一期 | VIEW-001 | 已实现 | `backend/app/api/v1/views.py` |

**DashboardView 协议字段（FR-VIEW-1 · M5 VIEW-001）**

| 模型 | 字段 | 值 | 说明 |
|------|------|-----|------|
| DashboardView | `protocolVersion` | `1` | FR-VIEW-1 视图文档版本（M5 VIEW-001） |
| DashboardLayout | `version` | `1 \| 2` | v1 网格布局与 v2 像素布局统一入口；两版均保留 `widgets`、`globalFilters` 和组件公共字段 |
| DashboardLayout v2 | `canvas` | 仪表板 `{width: 1440, height: int >= 900}`；数据大屏 `styleConfig.surfaceKind=data-screen` 时 `{width: 800–7680, height: 600–4320}` | 持久化规范坐标空间；每个组件矩形必须完整位于 canvas 内 |

| GET/PUT | `/api/v1/roles/{id}/default-views` | 角色默认视图模板 | 内部 | 二期 | VIEW-002 | 已实现 | `backend/app/api/v1/views.py` |
| GET/POST | `/api/v1/users/me/views` | 用户个人视图（持久化 `view_user_overrides` 表） | 内部 | 三期 | VIEW-003 | 已实现 | `backend/app/api/v1/views.py` · `backend/app/views/user_override_repo.py` |
| GET | `/api/v1/users/me/views/{view_id}` | 用户视图覆盖按 id 读取 | 内部 | 三期 | VIEW-003 | 已实现 | `backend/app/api/v1/views.py` |
| PUT | `/api/v1/users/me/views/{id}` | 用户视图覆盖更新 | 内部 | 三期 | VIEW-003 | 已实现 | `backend/app/api/v1/views.py` |
| DELETE | `/api/v1/users/me/views/{id}` | 用户视图覆盖删除 | 内部 | 三期 | VIEW-003 | 已实现 | `backend/app/api/v1/views.py` |
| POST | `/api/v1/embed/token` | 门户嵌入 token 签发（`chartId` 或 `dashboardId`；大屏整屏 URL `/embed/screen/{id}`） | IF-04 | 三期 | API-006 | 已实现 | `backend/app/integration/embed_token.py` |
| GET | `/api/v1/embed/sdk-params` | 按 token 解析 SDK 参数（`containerId`/`apiBase`） | IF-04 | 三期 | API-006 | 已实现 | `backend/app/api/v1/embed.py` |
| GET | `/api/v1/embed/chart-view` | 按 embed token 加载单图 `ChartViewConfig` | IF-04 | 三期 | VIZ-006 | 已实现 | `backend/app/integration/embed_resolve.py` |
| GET | `/api/v1/embed/dashboard-layout` | 按 embed token 加载看板/大屏 `layoutJson`（token 须含匹配 `dashboardId`） | IF-04 | 三期 | DASH-002 | 已实现 | `backend/app/integration/embed_resolve.py` |
| POST | `/api/v1/embed/query/execute` | 嵌入页匿名查数（Header `X-Embed-Token`） | IF-04 | 三期 | VIZ-006 | 已实现 | `backend/app/api/v1/embed.py` |
| POST | `/api/v1/embed/dataset/execute` | 嵌入页 Dataset 查数（Header `X-Embed-Token`） | IF-04 | 三期 | VIZ-006 | 已实现 | `backend/app/api/v1/embed.py` |

---

## 6. 报表（M6 · IF-03）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/reports/templates` | 模板列表（可选 `prefix`）；含 `storageRef` + `exportHook` | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/templates.py` |
| DELETE | `/api/v1/reports/templates/{templateKey}` | 删除模板；catalog 引用 → 409 `RPT_TEMPLATE_IN_USE` | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/templates.py` |
| POST | `/api/v1/reports/templates/validate` | 模板块定义校验（`RPT_TEMPLATE_*`） | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/templates.py` |
| PUT | `/api/v1/reports/templates/{templateKey}` | 模板块 upsert（**r67** viewer/enterprise ACL） | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/templates.py` |
| GET | `/api/v1/reports/templates/{templateKey}` | 模板块查询（**r67** enterprise ACL） | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/templates.py` |
| GET/POST/PATCH/DELETE | `/api/v1/reports/catalog/nodes*` | 报表模板树 catalog CRUD/move（`RPT_CATALOG_*`；template 节点可选 `templateKey` 唯一关联） | 内部 | 一期 | RPT-004 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/catalog/templates/readiness` | 模板 hub 批量就绪探测（body `nodeIds`；扩展配置/数据源绑定探测） | 内部 | 二期 | RPT-006 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/catalog/nodes/{id}/move` | 模板树节点移动（循环/深度守卫） | 内部 | 一期 | RPT-004 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST/GET | `/api/v1/reports/schedules*` | 报表调度 FSM（draft→scheduled→paused/cancelled；`RPT_SCHEDULE_*`） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| PATCH | `/api/v1/reports/schedules/{id}` | 草稿调度更新（cron/recipients/attachmentFormats/deliveryChannels/notifyGroup；仅 draft） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| DELETE | `/api/v1/reports/schedules/{id}` | 删除定时报告（停 job，并清理执行历史；`RPT_SCHEDULE_*`） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/reports/scheduler/service.py` |
| GET | `/api/v1/reports/schedules/delivery-health` | SMTP + IM App 探测（`im.{channel}.configured` 为 SDK gettoken 结果；失败含 `error`；不泄密钥） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` · `im_sdk/probe.py` |
| GET | `/api/v1/reports/schedules/export-health` | Playwright PDF 导出服务可用性探测 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/dashboard/export_render.py` · `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/schedules/executions/recent-failures` | 近期失败/降级执行列表 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/schedules/executions/{executionId}/dismiss` | 忽略单条失败提醒（不删执行历史） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/schedules/executions/recent-failures/dismiss-all` | 批量忽略失败提醒 | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/schedules` | 调度列表（可选 `catalogNodeId`） | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/schedules/{id}/executions` | 调度执行历史 | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/schedules/executions/{executionId}/retry` | 失败/降级执行重试 | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/schedules/{id}/execute` | 调度 semi-real 执行器（`X-Rpt-Semi-Real: 1`；mock 兼容默认；Idempotency-Key；`deliverySteps`） | 内部 | 一期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/schedules/executions/{executionId}/artifact` | 执行产物元数据（`RPT_ARTIFACT_FORBIDDEN` ACL） | 内部 | 一期 | RPT-005, RPT-007 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET/PUT/DELETE | `/api/v1/reports/catalog/nodes/{id}/extension` | 模板节点扩展配置 CRUD（metrics/filters/compareMode；metric 可选 `queryMode=sql\|dataset` + `datasetId`/`boundConfigId`；`RPT_EXT_*` ACL） | 内部 | 二期 | RPT-006 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/catalog/nodes/{id}/extension/compare-preview` | 同比环比预览槽位（yoy/mom slots） | 内部 | 二期 | RPT-004 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/catalog/nodes/{id}/extension/render-spec` | 扩展配置渲染规格（`renderVersion=1.0`；`compareMetrics`/`compareVersion`） | 内部 | 二期 | RPT-006 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/catalog/nodes/{id}/extension/revisions` | 扩展配置修订历史（changeNote 审计） | 内部 | 二期 | RPT-006 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/batch/dry-run` | 批量创建预检（冲突/无效行，不写库） | 内部 | 三期 | RPT-007 | 已实现 | `backend/app/reports/batch/service.py` |
| POST | `/api/v1/reports/batch` | 批量创建模板节点（Idempotency-Key；`RPT_BATCH_*`） | 内部 | 三期 | RPT-007 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/batch/export` | 异步批量导出任务提交（202 pending） | 内部 | 三期 | RPT-007 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/jobs/{id}` | 批量导出任务轮询（pending→processing→ready） | 内部 | 三期 | RPT-007 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/jobs/{id}/download` | 批量导出产物下载 | 内部 | 三期 | RPT-007 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| POST | `/api/v1/reports/templates/{id}/run` | 手工执行报表（M3-LITE：`dataSourceId`+extension → 真实 sections；无 ds → placeholder 回归 r60） | 内部 | 二期 | RPT-001 | M3-LITE 已实现 | `backend/app/api/v1/reports/engine.py` |
| GET | `/api/v1/reports/export` | 按模板/时间同步导出（`templateId`+`format`；可选 `from`/`to` ISO8601 时间窗；seed 模板 `status=ready` + `downloadUrl`；502/413 边界；429 `REPORT_EXPORT_RATE_LIMITED`；`X-RateLimit-*` 头） | IF-03 | 三期 | API-005 | 已实现（companion） | `backend/app/api/v1/reports/export.py` |
| GET | `/api/v1/reports/export/{exportId}` | 导出任务状态（未知 → 404 `REPORT_EXPORT_NOT_FOUND`） | IF-03 | 三期 | API-005 | 已实现（companion） | `backend/app/api/v1/reports/export.py` |
| GET | `/api/v1/reports/export/{exportId}/download` | 导出文件下载（`Content-Disposition: attachment`） | IF-03 | 三期 | API-005 | 已实现（companion） | `backend/app/api/v1/reports/export.py` |
| GET/PUT/DELETE | `/api/v1/reports/standard/packs*` | 标准分析包 CRUD（`RPT_STD_*`） | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/api/v1/reports/standard.py` |
| GET | `/api/v1/reports/standard/packs/{pack_key}/capabilities` | 字段能力探测与主题推荐 | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/capabilities.py` |
| POST | `/api/v1/reports/standard/packs/{pack_key}/run` | 实时运行指定主题 → renderSpec | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/service.py` |
| POST | `/api/v1/reports/standard/packs/{pack_key}/snapshots/capture` | 立即打点周期快照 | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/snapshot.py` |
| GET | `/api/v1/reports/standard/packs/{pack_key}/snapshots` | 快照列表 | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/snapshot.py` |
| GET | `/api/v1/reports/standard/packs/{pack_key}/compare?theme=` | 两期对比（可选 `baseline_period_key` / `current_period_key`） | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/compare.py` |
| GET | `/api/v1/reports/standard/packs/{pack_key}/compare/matrix?theme=&period_keys=` | 多期并排对比（逗号分隔周期键，最多 12 期） | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/reports/standard/compare.py` |
| GET/PUT | `/api/v1/reports/center/preferences` | 报表中心收藏偏好 | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/api/v1/reports/center.py` |
| POST | `/api/v1/reports/center/recent` | 记录最近访问 | 内部 | 二期 | RPT-002 | 已实现 | `backend/app/api/v1/reports/center.py` |
| POST | `/api/v1/reports/center/seed-demo` | 幂等加载示例报表模板（`report:manage`；**非 production**；无数据源时 `code=partial`） | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/api/v1/reports/center.py` · `dev_seed.py` |
| POST | `/api/v1/reports/catalog/nodes/{id}/duplicate` | 目录节点另存为（含扩展配置复制） | 内部 | 二期 | RPT-004 | 已实现 | `backend/app/reports/service.py` |
| POST | `/api/v1/reports/schedules/{id}/revise` | 激活调度生成新草稿修订 | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/reports/service.py` |
| POST | `/api/v1/reports/schedules/{id}/transition` | 调度 FSM 迁移（`action`；`RPT_SCHEDULE_*`） | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/api/v1/reports/__init__.py` |
| GET | `/api/v1/reports/schedules/executions/{executionId}/artifact/download` | 调度执行产物下载 | 内部 | 三期 | RPT-005 | 已实现 | `backend/app/reports/scheduler/executor.py` |
| GET | `/api/v1/reports/templates/{templateKey}/versions` | 模板版本历史 | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/reports/templates/versions.py` |
| POST | `/api/v1/reports/templates/{templateKey}/publish` | 发布模板版本 | 内部 | 二期 | RPT-003 | 已实现 | `backend/app/reports/templates/versions.py` |

---

## 7. 元数据与 Dataset（M1 · 四期）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET/POST | `/api/v1/metadata/glossary` | 术语字典 CRUD/list；写操作 admin/analyst only（viewer/editor → 403 `META_TERM_FORBIDDEN`） | 内部 | 四期 | META-001 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/PUT/DELETE | `/api/v1/metadata/glossary/{term_id}` | 术语详情/更新/删除（写 ACL；非法 status → 422 `META_TERM_INVALID_STATUS`） | 内部 | 四期 | META-001 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/PUT | `/api/v1/metadata/glossary/{term_id}/field-mappings` | 术语↔物理字段映射 companion（F-F） | 内部 | 四期 | META-001 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/metadata/themes` | 业务主题树 CRUD/list；写 ACL（403 `META_THEME_FORBIDDEN`） | 内部 | 四期 | META-002 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/PUT/DELETE | `/api/v1/metadata/themes/{node_id}` | 主题节点详情/更新/删除 | 内部 | 四期 | META-002 | 已实现 | `backend/app/api/v1/metadata.py` |
| POST | `/api/v1/metadata/themes/{node_id}/move` | 主题节点移动（环检测；超深 → 422 `META_THEME_MAX_DEPTH`） | 内部 | 四期 | META-002 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/metadata/dimensions` | 维度字典 list/create；可选 `themeNodeId` FK；写 ACL（403 `META_DIM_FORBIDDEN`） | 内部 | 四期 | META-003 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/dimensions/resolve?code=` | 按 code 解析维度（prefab/filters/designer 统一引用） | 内部 | 四期 | META-003 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/PUT/DELETE | `/api/v1/metadata/dimensions/{dimension_id}` | 维度详情/更新/删除（级联 values） | 内部 | 四期 | META-003 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/metadata/dimensions/{dimension_id}/values` | 枚举值 list/批量注册（重复 value code → 409 `META_DIM_VALUE_CODE_CONFLICT`） | 内部 | 四期 | META-003 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/metadata/entity-types` | 实体类型 schema list/create（`META_ENTITY_TYPE_*`） | 内部 | 二期 | META-006 | 已实现 | `backend/app/api/v1/metadata.py` |
| POST | `/api/v1/metadata/entity-types/validate` | 实体 schema 校验链（`META_ENTITY_SCHEMA_INVALID` + `detail.fields`） | 内部 | 二期 | META-006 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/entity-types/{typeCode}/query-bindings` | 只读 query bindings（`readOnly=true`；json 不可 filter） | 内部 | 二期 | META-006 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/PUT/DELETE | `/api/v1/metadata/entity-types/{typeCode}` | 实体类型详情/更新/删除（引用中 → 409 `META_ENTITY_TYPE_IN_USE`） | 内部 | 二期 | META-006 | 已实现 | `backend/app/api/v1/metadata.py` |
| POST | `/api/v1/metadata/physical-tables/register-from-schema` | M8 META-005 schema 登记（`list_columns` 真理源） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| POST | `/api/v1/metadata/physical-tables/validate` | 物理表登记草稿校验（不落库） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| POST | `/api/v1/metadata/physical-tables` | M8 META-005 直登物理表（`tableFqn` 唯一） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/physical-tables?fqn=` | M8 META-005 单条 physical 详情 | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| PUT | `/api/v1/metadata/physical-tables/{fqn}` | M8 META-005 更新 displayName/entityTypeCode | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| DELETE | `/api/v1/metadata/physical-tables/{fqn}` | M8 META-005 删除登记（GOV 引用 → 409 `META_PHYSICAL_GOV_IN_USE`） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/physical-tables/{fqn}/lineage` | 物理表 lineage stub（catalogEntryIds） | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET | `/api/v1/metadata/physical-tables?entityTypeCode=` | M8 META-005 按类型过滤物理表列表 | 内部 | 二期 | META-005 | 已实现 | `backend/app/api/v1/metadata.py` |
| DELETE | `/api/v1/metadata/dimensions/{dimension_id}/values/{value_id}` | 删除单条枚举值 | 内部 | 四期 | META-003 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/datasets` | Dataset list/create（ORM `datasets` 表 · Alembic `0023`；`META_DATASET_*`） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| GET | `/api/v1/datasets/{dataset_id}` | Dataset 详情（含 `boundConfigId`） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| PUT | `/api/v1/datasets/{dataset_id}` | Dataset 全量更新（写 ACL；403 `META_DATASET_FORBIDDEN`） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| DELETE | `/api/v1/datasets/{dataset_id}` | Dataset 删除（204） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| POST | `/api/v1/datasets/{dataset_id}/bind-query-config` | body `{configId}` 绑定 `dataset_query` 配置（非 dataset_query → 422 `META_DATASET_CONFIG_TYPE_INVALID`） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| GET | `/api/v1/datasets/{dataset_id}/transform-rules` | 读取 Dataset 查询清洗规则（外部源 query pandas） | 内部 | 四期 | META-004 | 已实现 | `backend/app/metadata/dataset/transform_rules.py` |
| PUT | `/api/v1/datasets/{dataset_id}/transform-rules` | 保存查询清洗规则（sync_job → 422 `META_DATASET_TRANSFORM_SYNC_LOCKED`） | 内部 | 四期 | META-004 | 已实现 | `backend/app/metadata/dataset/transform_rules.py` |
| POST | `/api/v1/datasets/{dataset_id}/transform-rules/auto-align` | 按物理表列元数据一键生成规则 | 内部 | 四期 | META-004 | 已实现 | `backend/app/metadata/dataset/transform_rules.py` |
| POST | `/api/v1/datasets/validate` | Dataset 草稿校验（不落库） | 内部 | 四期 | META-004 | 已实现 | `backend/app/api/v1/datasets.py` |
| GET/POST/PUT/DELETE | `/api/v1/metadata/entity-types` | 实体类型 schema CRUD（**已替代** 下方废弃路径） | 内部 | 二期 | META-006 | 已实现 | `backend/app/api/v1/metadata.py` |
| GET/POST | `/api/v1/entities/types` | **deprecated** — 无运行时路由；请用 `/api/v1/metadata/entity-types` | — | — | META-006 | 废弃 | — |
| POST | `/api/v1/datasets/migrate-binding` | 直连→datasetId 迁移 | 内部 | 四期 | QUERY-009 | 规划 | `backend/app/api/v1/datasets.py` |

---

## 8. 查询服务治理（M8 · IF-01/02）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/gov/catalog/categories` | catalog 分类列表（CAT-01~07 seed） | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/appendix-e` | 附录 E 七分法 taxonomy + schema | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/entries` | catalog 条目列表（`?category=&limit=&offset=`） | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/entries` | 创建 catalog 条目 | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/entries/{id}` | catalog 条目详情 | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| DELETE | `/api/v1/gov/catalog/entries/{entry_id}` | 删除 catalog 条目（204；CASCADE bus_registrations） | IF-06 | 一期 | GOV-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET/POST | `/api/v1/gov/catalog/classification/nodes` | 分类树节点 list/create（`?parentId=`；`CAT_CLASS_*`） | IF-06 | 一期 | CAT-004 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/classification/nodes/{id}/move` | 分类树节点移动（环检测；超深 → 422 `CAT_CLASS_MAX_DEPTH`） | IF-06 | 一期 | CAT-004 | 已实现 | `backend/app/api/v1/gov.py` |
| DELETE | `/api/v1/gov/catalog/classification/nodes/{id}` | 删除叶节点（含子节点 → 409 `CAT_CLASS_HAS_CHILDREN`） | IF-06 | 一期 | CAT-004 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/classification/m11-probe` | CAT-004 M11 集成 probe | IF-06 | 一期 | CAT-004 | 已实现 | `backend/app/api/v1/gov.py` |
| GET/POST | `/api/v1/gov/catalog/geo-regions/nodes` | 地域 geo 树 list/create（`?parentId=`；`CAT03_*`） | IF-06 | 一期 | CAT-003 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/geo-regions/m6-probe` | CAT-003 M6 集成 probe | IF-06 | 一期 | CAT-003 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/geo-regions/nodes/{id}/move` | geo 树节点移动（环检测；超深 → 422 `CAT03_MAX_DEPTH`） | IF-06 | 一期 | CAT-003 | 已实现 | `backend/app/api/v1/gov.py` |
| DELETE | `/api/v1/gov/catalog/geo-regions/nodes/{id}` | 删除叶节点（含子节点 → 409 `CAT03_HAS_CHILDREN`） | IF-06 | 一期 | CAT-003 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/tickets/validate` | 工单 stats item 校验（`CAT05_*`） | IF-06 | 一期 | CAT-005 | 已实现 | `backend/app/api/v1/gov.py` |
| POST/GET | `/api/v1/gov/catalog/tickets/items` | 工单 stats item 登记/列表 | IF-06 | 一期 | CAT-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/tickets/items/{key}/stats` | 工单 stats mock probe | IF-06 | 一期 | CAT-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/tickets/m11-probe` | CAT-005 M11 集成 probe | IF-06 | 一期 | CAT-005 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/production-stats/validate` | 生产销售 stats 校验（`CAT06_*`） | IF-06 | 一期 | CAT-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST/GET | `/api/v1/gov/catalog/production-stats` | 生产销售 stats 登记/列表 | IF-06 | 一期 | CAT-006 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/production-stats/{stats_key}/stats` | 生产销售 stats mock probe | IF-06 | 一期 | CAT-006 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/production-stats/m11-probe` | CAT-006 M11 集成 probe | IF-06 | 一期 | CAT-006 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/workno-behavior/m12-probe` | CAT-007 M12 集成 probe | IF-06 | 三期 | CAT-007 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/lifecycle-templates/validate` | CAT-001 lifecycle 校验 | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/lifecycle-templates` | CAT-001 lifecycle 创建 | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/lifecycle-templates` | CAT-001 lifecycle 列表 | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/lifecycle-templates/m6-probe` | CAT-001 M6 集成 probe | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/lifecycle-templates/{templateKey}` | CAT-001 lifecycle 按 key 查询 | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/lifecycle-templates/{templateKey}/stages/move` | CAT-001 lifecycle 阶段重排 | IF-06 | 一期 | CAT-001 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/aggregate-templates/validate` | CAT-002 aggregate 校验 | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/catalog/aggregate-templates` | CAT-002 aggregate 创建 | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/aggregate-templates` | CAT-002 aggregate 列表 | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/aggregate-templates/m6-probe` | CAT-002 M6 集成 probe | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/catalog/aggregate-templates/{aggregate_key}/attribution` | CAT-002 PoC 归属 | IF-06 | 一期 | CAT-002 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/bus/register` | 总线 PoC 半自动注册（`catalogEntryId`；需 admin；幂等 201/200；403 `BUS_REGISTER_FORBIDDEN`） | IF-06 | 一期 | GOV-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/bus/register/fsm` | GOV-002 semi-auto FSM 查询（`catalogEntryId`） | IF-06 | 一期 | GOV-002 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/bus/register/probe` | GOV-002 半自动登记 perf probe | IF-06 | 一期 | GOV-002 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/bus/auto-register` | 总线全自动注册 FSM（`catalogEntryId`；integration/admin；幂等 201/200；403 `GOV_AUTO_BUS_FORBIDDEN`） | IF-06 | 四期 | GOV-007 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/bus/auto-register/retry` | failed FSM 重试全自动注册（integration/admin；502 `BUS_REGISTER_RETRY_EXHAUSTED`） | IF-06 | 四期 | GOV-007 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/bus/auto-register/probe` | auto-register perf probe（`elapsedMs`/`withinBudget`/`ok`） | IF-06 | 四期 | GOV-007 | 已实现（companion） | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/acl/matrix` | 治理权限矩阵（admin；`describe_gov_permission_matrix`） | IF-06 | 四期 | GOV-008 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/query-design/validate` | 可视化查询设计校验（422 `detail.fields`） | IF-06 | 一期 | GOV-004 | 已实现 | `backend/app/api/v1/gov.py` |
| PUT | `/api/v1/gov/query-design` | 可视化查询设计保存（409 `CONFIG_VERSION_CONFLICT`；403 ACL） | IF-06 | 一期 | GOV-004/008 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/query-design` | 可视化查询设计读取（`?refId=`） | IF-06 | 一期 | GOV-004 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/query-design/preview-execute` | 查询设计执行预览（RLS fragment；GOV-008） | 内部 | 一期 | GOV-008 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/entries/{entry_id}/submit` | draft→pending_publish | IF-06 | 一期 | GOV-005 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/entries/{entry_id}/approve` | pending_publish→published；响应含 `busRegisterStatus`/`busRegisterErrorCode`（r248） | IF-06 | 一期 | GOV-005/007 | 已实现（r248） | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/entries/{entry_id}/reject` | pending_publish→draft | IF-06 | 一期 | GOV-005 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/entries/{entry_id}/unpublish` | published→draft；释放 entity/physical GOV 引用 | IF-06 | 四期 | META-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/entries/{entry_id}/link-physical` | 登记 catalog→physicalTableFqn 引用（lineage） | IF-06 | 四期 | META-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/publish/entries/{entry_id}/status` | 发布状态 + allowedActions | IF-06 | 一期 | GOV-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/publish/entries/{entry_id}/notifications` | 审批通知事件列表（内存 store） | IF-06 | 一期 | GOV-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET/POST | `/api/v1/gov/openapi-mappings` | 发布引擎 OpenAPI 映射 list/register（`GOV_OPENAPI_MAP_*`） | IF-06 | 四期 | GOV-006 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/openapi-mappings/{id}` | OpenAPI 映射详情 | IF-06 | 四期 | GOV-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/openapi-mappings/validate` | OpenAPI 映射校验（apiVersion/operationId/path + entityTypeRef） | IF-06 | 四期 | GOV-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/openapi-mappings/{id}/deactivate` | OpenAPI 映射停用（409 `GOV_OPENAPI_MAP_ALREADY_INACTIVE`） | IF-06 | 四期 | GOV-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/workflow/templates` | 创建自定义工单模板 | IF-06 | 四期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| PUT | `/api/v1/gov/workflow/templates/{template_id}` | 更新自定义工单模板（builtin 只读） | IF-06 | 四期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| DELETE | `/api/v1/gov/workflow/templates/{template_id}` | 删除自定义工单模板（builtin 只读） | IF-06 | 四期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/workflow/templates` | 工单流程模板列表（builtin + custom） | IF-06 | 一期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/workflow/templates/validate` | 工单模板校验 | IF-06 | 一期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/workflow/templates/{template_id}/node-roles` | 工单模板节点角色配置 | IF-06 | 一期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |
| POST/GET | `/api/v1/gov/workflow/instances` | 工单实例创建/列表（`config_type=workflow_instance`） | IF-06 | 一期 | GOV-003/004 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/workflow/instances/{id}` | 实例详情（可选 `includeDesignSnapshot`） | IF-06 | 一期 | DESIGN-004 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/workflow/instances/{id}/approved-design` | 审批态可视化查询设计投影 | IF-06 | 四期 | GOV-004 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/workflow/instances/{id}/confirm-design` | 审批通过设计确认 → `pending_publish` | IF-06 | 四期 | GOV-004 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/publish/from-workflow` | 工单实例一键发布查询服务 | IF-06 | 四期 | GOV-005 | 已实现 | `backend/app/api/v1/gov.py` |
| GET | `/api/v1/gov/publish/entries/{entryId}/openapi` | 已发布条目 OpenAPI 3.1 文档 | IF-06 | 四期 | GOV-006 | 已实现 | `backend/app/api/v1/gov.py` |
| POST | `/api/v1/gov/workflow/instances/{id}/transition` | 五态 FSM 迁移（`GOV_WORKFLOW_*`） | IF-06 | 一期 | GOV-003 | 已实现 | `backend/app/api/v1/gov.py` |

> **历史路径（无运行时路由）**：`/api/v1/governance/tickets*`、`POST /api/v1/governance/publish` 为早期规划路径；工单与发布能力已实现于 `/api/v1/gov/workflow/*` 与 `/api/v1/gov/publish/*`（见上表）。

| POST | `/api/v1/integration/bus/register` | IF-01 总线注册（`catalogEntryId`；nil UUID → 422；integration/admin；幂等 201/200；retry `maxAttempts`） | IF-01 | 四期 | API-004 | 已实现（companion） | `backend/app/api/v1/integration_bus.py` |
| POST | `/api/v1/integration/bus/register/retry` | IF-01 总线注册重试 | IF-01 | 四期 | API-004 | 已实现（companion） | `backend/app/api/v1/integration_bus.py` |
| GET | `/api/v1/services` | 已发布查询服务列表（仅 `published`；`?category=&limit=&offset=`） | IF-02 | 四期 | API-003 | 已实现（companion） | `backend/app/api/v1/services.py` |
| GET | `/api/v1/services/{serviceId}` | 已发布查询服务详情 | IF-02 | 四期 | API-003 | 已实现（companion） | `backend/app/api/v1/services.py` |
| POST | `/api/v1/services/{serviceId}/execute` | 查询服务执行（`;requires=` 参数校验；`Idempotency-Key`；502 `SERVICE_EXECUTE_FAILED`） | IF-02 | 四期 | API-003 | 已实现（companion） | `backend/app/api/v1/services.py` |
| POST | `/api/v1/services/{serviceId}/publish` | draft→published + 自动总线注册（201/200 幂等） | IF-02 | 四期 | API-003/004 | 已实现（companion） | `backend/app/api/v1/services.py` |
| GET | `/api/v1/services/{serviceId}/openapi` | 服务 OpenAPI 描述片段 | IF-02 | 四期 | API-003, GOV-006 | 已实现（companion） | `backend/app/api/v1/services.py` |

> **OpenAPI 注记（API-007）**：`GET /openapi.json` 的 `info.x-supported-versions` 含 `v1` 与 `v2`；IF-01~04 平行 `/api/v2/*` 为稳定文档面（`x-implements-version: v2`），**无**真实 `/api/v2/*` 运行时路由。

---

## 9. 已发布查询 API（IF-02 · 对外 · 四期）

> 由 M8 发布引擎根据配置动态注册；路径前缀示例，实际以发布时 OpenAPI 为准。

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/entities/{entityType}/{entityId}` | CAT-01 实体生命周期查询 | IF-02 | 一期 PoC+ | CAT-001 | 规划 | `backend/app/governance/catalog/cat01.py` |
| GET | `/api/v1/stats/aggregate` | CAT-02 统计分析聚合（`templateKey` + `groupBy` IF-02 PoC） | IF-02 | 一期 PoC+ | CAT-002 | 已实现 | `backend/app/api/v1/stats.py` · `backend/app/governance/catalog/cat02/query.py` |
| GET | `/api/v1/geo/distribution` | CAT-03 地域维度查询 | IF-02 | 一期 PoC+ | CAT-003 | 规划 | `backend/app/governance/catalog/cat03.py` |
| GET | `/api/v1/timeseries` | CAT-04 时间序列分析 | IF-02 | 二期+ | CAT-004 | 规划 | `backend/app/governance/catalog/cat04.py` |
| GET | `/api/v1/tickets/stats` | CAT-05 工单与受理统计 | IF-02 | 二期+ | CAT-005 | 规划 | `backend/app/governance/catalog/cat05.py` |
| GET | `/api/v1/production/stats` | CAT-06 生产销售统计 | IF-02 | 二期+ | CAT-006 | 规划 | `backend/app/governance/catalog/cat06.py` |
| GET | `/api/v1/workno/behavior` | CAT-07 组织行为审计（r64 companion：enterprise/viewer scope ACL + perf probe） | IF-02 | 三期+ | CAT-007 | 已实现 | `backend/app/api/v1/workno.py` |

---

## 10. 数据接入（M1B · FR-DATA / FR-ETL）

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET/POST | `/api/v1/ingestion/sync-jobs` | 同步任务列表与创建 | 内部 | M1B | DATA-001 | 已实现 | `backend/app/api/v1/ingestion/sync.py` |
| GET/PUT/DELETE | `/api/v1/ingestion/sync-jobs/{id}` | 同步任务详情、更新与删除 | 内部 | M1B | DATA-001 | 已实现 | `backend/app/api/v1/ingestion/sync.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/run` | 手动触发同步 | 内部 | M1B | DATA-002 | 已实现 | `backend/app/ingestion/sync_executor.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/cancel` | 停止当前运行中的同步（协作式：阶段边界生效） | 内部 | M1B | DATA-002 | 已实现 | `backend/app/ingestion/sync_cancel.py` |
| GET | `/api/v1/ingestion/sync-jobs/{id}/runs` | 运行历史 | 内部 | M1B | DATA-002 | 已实现 | `backend/app/api/v1/ingestion/sync.py` |
| GET/PUT | `/api/v1/ingestion/sync-jobs/{id}/etl-rules` | 清洗规则配置 | 内部 | M1B | ETL-001 | 已实现 | `backend/app/ingestion/etl_rules.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/etl-rules/auto-align` | ETL 规则与源表列自动对齐 | 内部 | M1B | ETL-001 | 已实现 | `backend/app/api/v1/ingestion/sync.py` |
| GET | `/api/v1/ingestion/sync-jobs/{id}/consume-hints` | 消费管道状态（分析库/Dataset/下一步动作） | 内部 | M1B | DATA-003 | 已实现 | `backend/app/ingestion/sync_consume.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/prepare-consume` | 幂等登记托管分析库数据源 | 内部 | M1B | DATA-003 | 已实现 | `backend/app/ingestion/sync_consume.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/ensure-dataset` | 一键创建 Dataset 并绑定 query config | 内部 | M1B | DATA-003 | 已实现 | `backend/app/ingestion/sync_consume.py` |
| POST | `/api/v1/ingestion/sync-jobs/{id}/refresh-dataset-binding` | 刷新同步产物 Dataset 显示名与出图绑定列 | 内部 | M1B | DATA-003 | 已实现 | `backend/app/ingestion/sync_consume.py` |

### SyncJobCreate（POST/PUT 请求体）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| name | string | ✓ | 任务名称 |
| target_table | string | ✓ | 托管分析库目标表 |
| source_mode | `inline` \| `datasource` | — | 默认 `inline` |
| source | SourceConnection | inline 时 ✓ | 见下表 |
| source_data_source_id | uuid | datasource 时 ✓ | 已登记 MySQL 数据源 |
| source_table | string | datasource 时 ✓ | 源表名 |
| source_schema | string | — | PostgreSQL/TimescaleDB 等 PG 系源 schema；`database` 为库名，**不**作 schema。未传时 PG 系默认 `public` |
| sync_mode | `full` \| `incremental` | — | 默认 `full` |
| primary_key | string | 增量时 ✓ | 单列主键 |
| incremental_column | string | 增量时 ✓ | 水位列 |
| schedule_cron | string | — | 可选 |
| enabled | bool | — | 默认 true |

### SourceConnection（`source_mode=inline` 时 `source` 嵌套对象）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| type | `mysql` \| `postgres` | ✓ | M1B executor 仅 mysql |
| host | string | ✓ | 源库主机 |
| port | int | ✓ | 1–65535 |
| database | string | ✓ | 库名 |
| username | string | ✓ | 用户名 |
| password | string | ✓ | 请求明文；响应 `***` |
| table | string | ✓ | 源表名 |

### 请求/响应示例

**POST `/api/v1/ingestion/sync-jobs`**（201）：

```json
{
  "name": "sample-mysql-orders",
  "source_mode": "inline",
  "source": {
    "type": "mysql",
    "host": "127.0.0.1",
    "port": 3307,
    "database": "sample_db",
    "username": "sample",
    "password": "sample",
    "table": "dirty_orders"
  },
  "target_table": "orders_clean",
  "sync_mode": "full",
  "schedule_cron": null
}
```

**数据源引用模式示例**：

```json
{
  "name": "orders-from-ds",
  "source_mode": "datasource",
  "source_data_source_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_table": "dirty_orders",
  "source_schema": "public",
  "target_table": "orders_clean",
  "sync_mode": "incremental",
  "primary_key": "id",
  "incremental_column": "updated_at"
}
```

响应 `source.password` 为 `"***"`。

**POST `/api/v1/ingestion/sync-jobs/{id}/run`**（202）：

```json
{ "run_id": "550e8400-e29b-41d4-a716-446655440000", "status": "running" }
```

并发冲突（已有 `status=running` 或 `cancelling` 的运行记录）返回 **409**：

```json
{ "code": "RUN_ALREADY_IN_PROGRESS", "message": "该任务正在运行中", "detail": null }
```

**POST `/api/v1/ingestion/sync-jobs/{id}/cancel`**（200）：将当前运行标记为 `cancelling`，执行器在拉数/清洗/写入阶段边界停止并落账 `cancelled`。若写入已开始则仍会完成并以 `succeeded` 落账。

```json
{ "run_id": "550e8400-e29b-41d4-a716-446655440000", "status": "cancelling" }
```

无进行中运行时返回 **409**：

```json
{ "code": "RUN_NOT_IN_PROGRESS", "message": "当前没有正在运行的同步可停止", "detail": null }
```

**GET `/api/v1/ingestion/sync-jobs/{id}/runs`**（200）：

```json
{
  "items": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "status": "succeeded",
      "started_at": "2026-07-03T08:00:00Z",
      "finished_at": "2026-07-03T08:00:01Z",
      "rows_synced": 4,
      "error_message": null,
      "trace_id": "e2e-trace-001",
      "retry_count": 0
    }
  ]
}
```

---

## 10. 范围外（不实现）

| 接口 | 原因 |
|------|------|
| 未登记路径 | 禁止上线；须先更新本索引 |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.16 | 2026-08-18 | AI 可视化：GET artifact 不限属主（共享看板）；成功体为裸 DTO 例外；规范包多实例 querySelector + CORS 说明 |
| 1.0.15 | 2026-08-18 | AI 可视化：customViz `runtime` 仅 html\|d3；`host.vsCv` 注入平台 d3；整包 ≤2MB；拒绝内联 d3 整库 |
| 1.0.14 | 2026-08-18 | AI 可视化：登记 CustomViz Payload v1（`protocolVersion` + `bindingStatus`）；官方 bundle 示例对齐 `vs-cv-payload-update` |
| 1.0.13 | 2026-08-13 | 用户 `imAccounts`；调度 `notifyGroup` / `feishu`；delivery-health 含 IM App 配置布尔 |
| 1.0.12 | 2026-08-13 | AI 可视化：登记 `PUT /ai-viz/artifacts/{id}`；entry 改为 Base 宿主挂载源码 |
| 1.0.11 | 2026-08-09 | D3：联调可消费附录 auth/datasources/query；链 service/backend 运维 |
| 1.0.10 | 2026-08-09 | R1 索引修补：orgs/rls/users roles/resource-grants 子路径；designer validate；viz archive；schedule transition；physical-tables validate；etl auto-align；gov 模板 `{id}`；废弃 governance/* 与 entities/types；m11/m12 probe 表列对齐；§10 数据接入 |
| 1.0.9 | 2026-08-07 | Dashboard `export-jobs` 三路由；`dashboard-templates` 列表参数与 DELETE 语义；`reports/catalog/templates/readiness`；`reports/export` 补 `from`/`to` |
| 1.0.8 | 2026-08-07 | 导出快照：登记 `export-layout` / `export-query/execute` / `export-query/dataset/execute`（RPT-005 无头 PDF） |
| 1.0.7 | 2026-07-20 | 修复 §8 用户视图表行 228 列错位；大屏 layoutJson 扩展字段见 §5 Dashboard |
| 1.0.6 | 2026-07-17 | `surfaceKind=data-screen` 画布尺寸 800–7680；Tab parked 子组件 0×0 校验放宽 |
| 1.0.5 | 2026-07-13 | Dashboard `layoutJson` 请求/响应 DTO 改为 `DashboardLayout`（v1 栅格 + v2 像素）；OpenAPI 可见 `version`/`canvas`/像素字段 |
| 1.0.4 | 2026-07-13 | BUG-001 文档纠错：`PATCH /api/v1/me` 与 `POST /api/v1/auth/change-password` PRD 列改为 `—`；说明列引用 BUG-001 + Account Self-Service plan；change-password 补充 204/401 业务码与 422 边界 |
| 1.0.3 | 2026-07-09 | F-E API-007 对账：`/docs`/`/redoc` 状态 规划→已实现（`AuthMiddleware.PUBLIC_PATHS` 已豁免且 FastAPI `docs_url`/`redoc_url` 已启用）；补 `/health`/`/openapi.json`/`/api/v1/auth/login` 免鉴权注记 |
| 1.0.2 | 2026-07-04 | M8/M12/M13 r44：IF-01~04 集成 API L1（services/integration_bus/reports/export/embed）；OpenAPI 版本策略 |
| 1.0.1 | 2026-07-03 | FR-DATA/FR-ETL 纳入 M1B；§10 数据接入 API；移除 IF-05 范围外 |
