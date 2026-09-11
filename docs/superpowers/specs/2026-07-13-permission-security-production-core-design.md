# 权限与安全生产可用核心版设计

日期：2026-07-13  
状态：待用户评审  
范围：`backend/app/auth/`、相关 API、前端系统管理页面及权限消费链

## 1. 背景

VitalSpan 已有角色、用户角色绑定、资源授权、组织、RLS 和审计的基础闭环，但当前实现仍混合使用固定角色编码、前端 capability 映射与后端局部守卫，尚不能视为生产级权限系统。

主要问题：

1. 部分角色、用户和资源授权写 API 只校验登录，未统一校验管理权限。
2. 自定义角色没有后端持久化权限点，前端 `BUILTIN_ROLE_CAPABILITIES` 仍是主要能力来源。
3. RLS 角色绑定缺少已有绑定读取，页面从空状态全量覆盖，存在误删风险。
4. 用户缺少启停、锁定、解锁和管理员重置密码等生命周期管理。
5. 资源授权要求手工输入 UUID，且资源存在性、显示名称和批量操作不足。
6. 审计主要覆盖 auth 域，文档与已落地 UI 状态存在漂移。

## 2. 目标

本轮建设“生产可用核心版”权限系统：

- 建立后端持久化的权限点目录和角色权限绑定。
- 保留不可误删的安全根管理员，同时让普通角色完全由权限点配置。
- 所有敏感 API 通过统一依赖进行权限校验，前端守卫仅承担交互优化。
- 打通用户生命周期、资源授权、RLS 和审计的安全闭环。
- 通过兼容迁移保留现有角色、用户和授权数据，避免一次性切换造成系统不可用。

## 3. 非目标

- LDAP、OIDC、SAML、SCIM 等外部身份源。
- MFA、短信/邮件发送、用户自助找回密码。
- 多租户隔离模型。
- 权限申请审批流、临时授权和按时间失效授权。
- 完整 SIEM、审计冷归档与合规报表。
- 字段级脱敏策略和列级权限。

## 4. 方案选择

采用“渐进式混合 RBAC”：

```text
用户
  └─ 用户角色
      └─ 角色
          ├─ 权限点：允许执行哪些操作
          ├─ 资源授权：允许访问哪些具体资源
          └─ RLS：允许看到哪些数据行

root admin
  └─ 安全兜底：固定拥有全部权限，禁止删除、禁用或移除最后一个根管理员
```

不采用纯补丁方案，因为它无法消除前后端权限真理源分裂；不采用一次性重写，因为 auth 被 datasources、query、dashboard、reports、governance 等多个域依赖，直接切换回归风险过高。

## 5. 权限模型

### 5.1 权限点

权限点使用稳定字符串编码，后端维护目录：

- `system:role.read`、`system:role.manage`
- `system:user.read`、`system:user.manage`、`system:user.password.reset`
- `system:grant.read`、`system:grant.manage`
- `system:rls.read`、`system:rls.manage`
- `system:org.read`、`system:org.manage`
- `system:audit.read`
- `datasource:read`、`datasource:manage`
- `dashboard:read`、`dashboard:edit`
- `report:read`、`report:manage`
- `dataset:read`、`dataset:manage`
- `metadata:read`、`metadata:manage`
- `governance:read`、`governance:manage`

支持 `domain:*` 通配，但数据库只保存经过目录校验的编码。权限目录由代码注册，角色绑定关系由数据库管理，避免管理员创建无法被程序理解的任意权限字符串。

### 5.2 安全根管理员

- 在 `auth_roles` 增加 `is_system` 和 `is_root`。
- 系统只允许一个 `is_root=true` 的内置 `admin` 角色。
- 根角色不可删除、不可禁用、不可修改 code。
- 至少保留一个启用且绑定根角色的用户。
- 根角色视为拥有全部权限，无需在角色权限表复制所有记录。
- 所有根管理员保护失败返回明确的 `AUTH_ROOT_ADMIN_REQUIRED` 或 `AUTH_ROOT_ROLE_IMMUTABLE`。

### 5.3 数据模型

新增：

- `auth_permissions`
  - `id`、`code`、`name`、`description`、`domain`、`created_at`
  - `code` 唯一
- `auth_role_permissions`
  - `role_id`、`permission_id`、`created_at`
  - 复合主键，角色删除时级联

扩展 `auth_roles`：

- `is_system: bool`
- `is_root: bool`

扩展 `auth_users`：

- `is_active: bool`
- `failed_login_count: int`
- `locked_until: datetime | null`
- `password_changed_at: datetime | null`
- `updated_at: datetime`

不删除现有 `password_hash`、`org_node_id`、角色绑定、资源授权和 RLS 表。

## 6. 后端鉴权架构

### 6.1 用户上下文

`UserContext` 扩展：

```python
class UserContext(BaseModel):
    id: str
    username: str
    roles: list[str]
    permissions: set[str]
    is_root: bool = False
```

`AuthMiddleware` 在认证成功后加载启用角色和有效权限。禁用或锁定用户直接返回 403，不进入业务 handler。

### 6.2 统一依赖

新增：

```python
def require_permission(permission: str) -> Callable[..., Awaitable[UserContext]]
def require_any_permission(*permissions: str) -> Callable[..., Awaitable[UserContext]]
```

匹配规则：

1. `is_root=true` 直接通过。
2. 精确权限编码匹配。
3. `domain:*` 覆盖同域权限。
4. 失败统一返回 403：

```json
{
  "code": "PERMISSION_DENIED",
  "message": "Permission system:user.manage is required",
  "detail": null
}
```

API handler 不再自行判断 `"admin" in actor.roles`。资源可见性和 RLS 仍由各自服务处理，形成“功能权限 → 资源范围 → 行范围”三层校验。

### 6.3 敏感 API 收口

- `/roles`：读使用 `system:role.read`，写使用 `system:role.manage`
- `/users`：读使用 `system:user.read`，写和角色/组织绑定使用 `system:user.manage`
- `/resource-grants`：读写分别使用 `system:grant.read/manage`
- `/rls/*`：读写分别使用 `system:rls.read/manage`
- `/audit/events`：使用 `system:audit.read`
- `/orgs`：读写分别使用 `system:org.read/manage`

前端路由守卫不能替代这些后端校验。

## 7. 用户生命周期

管理员可执行：

- 创建用户：用户名、显示名、邮箱、初始密码、组织、初始角色。
- 启用/禁用用户。
- 锁定/解锁用户。
- 重置密码；密码只返回一次，不写审计详情。
- 更新显示名、邮箱和组织。

约束：

- 禁止禁用当前唯一根管理员。
- 禁止删除用户；生产核心版采用停用，保留审计引用。
- 密码规则复用现有密码服务，不在用户 service 中复制哈希逻辑。
- 重置密码后更新 `password_changed_at` 并清零失败次数。

## 8. 角色与权限管理

角色页面增加“权限”配置区域：

- 按域分组展示权限点。
- 支持域级全选和单项勾选。
- 加载角色已有权限后才能保存。
- 保存采用全量替换 API，并带 `expected_version` 或 `updated_at` 做乐观并发检查。
- 根角色权限只读展示为“全部权限”。

新增 API：

- `GET /api/v1/permissions`
- `GET /api/v1/roles/{id}/permissions`
- `PUT /api/v1/roles/{id}/permissions`

角色启停、删除和权限变更均写审计事件。

## 9. 资源授权

资源授权保留“角色 × 资源类型 × 资源 ID”模型，但改进交互和校验：

- 新建授权时根据资源类型加载可选资源，显示名称和 ID。
- 服务端验证资源真实存在且未软删除。
- 列表返回 `resourceName`，不存在的历史资源显示“已删除资源”。
- 支持勾选多个资源后批量授权；服务端事务内原子写入。
- 撤销仍逐条确认，批量撤销需二次确认。
- datasource、dashboard、report 的列表和详情 API 必须统一消费资源可见性。

不在本轮引入允许/拒绝冲突规则；授权模型保持“无显式授权则不可见，root 例外”。

## 10. RLS 安全闭环

新增读取接口：

- `GET /api/v1/roles/{id}/dimension-groups`
- `GET /api/v1/roles/{id}/dimension-values`

前端选择角色时必须先加载已有绑定；加载失败时禁止保存。全量替换请求增加：

- `expectedUpdatedAt` 或等价版本字段；
- 明确的空绑定确认，防止误清空；
- 后端事务与审计前后差异。

维度类型页面补齐编辑、删除和引用冲突提示。删除被分组、角色或其他模块引用的维度返回 409。

查询链继续使用 fail-closed：需要 RLS 但没有有效绑定时生成 `1=0`，不得自动放宽。

## 11. 审计

覆盖以下写操作：

- 用户创建、资料修改、启停、锁定、解锁、密码重置；
- 角色创建、修改、启停、删除和权限替换；
- 用户角色、用户组织绑定；
- 资源授权创建、批量创建和撤销；
- RLS 维度、分组、成员值和角色绑定变更。

审计 `detail` 只保存非敏感差异：

```json
{
  "before": {"isActive": true},
  "after": {"isActive": false}
}
```

密码、token、credential、完整 SQL 不得进入审计详情。审计写入与业务写入使用同一事务，避免业务成功但审计缺失。

## 12. 前端权限消费

- `/api/v1/me` 返回有效权限和 `isRoot`。
- `resolveUserCapabilities` 改为消费服务端权限集合。
- 保留内置角色映射仅用于迁移期开发环境；迁移完成后删除。
- `resolveNavGroups`、`RequireCapabilityName` 和按钮级禁用统一使用服务端权限。
- 无权限访问时展示 403 页面，不静默跳转。

页面调整：

- 角色管理：权限矩阵。
- 用户管理：状态、组织、角色、重置密码、启停/解锁。
- 资源授权：资源选择器和批量授权。
- 行级权限：安全读取已有绑定、维度完整 CRUD。
- 审计日志：补充权限、资源授权和 RLS 动作标签。

## 13. 迁移与上线

采用四阶段兼容迁移：

1. **Schema 扩展**：新增表和字段，旧代码仍可运行。
2. **数据回填**：
   - 标记现有 `admin` 角色为 root/system；
   - 建立权限目录；
   - 按现有 `BUILTIN_ROLE_CAPABILITIES` 将 analyst/viewer 能力映射为角色权限；
   - 自定义角色默认不授予功能权限，需管理员显式配置。
3. **双读迁移**：后端优先读数据库权限；仅开发环境对未回填内置角色使用旧映射，并记录警告。
4. **收口**：所有 API 使用 `require_permission`，前端删除生产态硬编码映射。

迁移必须验证：

- 存在 root 角色；
- 至少一个启用用户绑定 root；
- 权限编码全部在目录中；
- 迁移降级时只删除新增关系和字段，不删除原角色、用户、资源授权与 RLS 数据。

## 14. 测试与验收

### 后端

- 权限匹配：精确、通配、root、缺权限 403。
- 每组敏感 API：匿名 401、已登录无权限 403、有权限成功。
- 根管理员不可删除、禁用或移除最后绑定。
- 用户启停、锁定、解锁、密码重置。
- 角色权限读取/替换与并发冲突。
- 资源不存在拒绝授权；批量授权事务回滚。
- RLS 已有绑定读取、空绑定确认、并发覆盖保护。
- RLS 查询 fail-closed。
- 审计不含密码和 credential。
- Alembic upgrade/downgrade 与数据回填。

### 前端

- `/me` 权限驱动侧栏、路由和按钮。
- 角色权限矩阵读取与保存。
- 用户状态和生命周期操作。
- 资源选择器、批量授权和已删除资源显示。
- RLS 选择角色后回显已有绑定，加载失败时保存禁用。
- 审计动作显示。

### 端到端

至少建立三类真实用户：

1. root：admin全功能。
2. 安全管理员：可管理用户/角色/RLS，但无数据源业务访问。
3. 分析用户：可读指定 Dashboard 和数据源，仅看到其 RLS 范围内数据。

验收必须从 API 直接发起越权请求，不能只依赖前端路由测试。

## 15. 风险与回退

- **锁死管理员**：迁移和写操作均守卫“至少一个启用 root 用户”。
- **自定义角色迁移后失权**：上线前生成角色权限差异报告；自定义角色由管理员确认后启用。
- **权限查询性能**：用户登录时聚合并放入 `UserContext`；本轮不引入 Redis。
- **前后端切换不同步**：先上线兼容后端，再上线前端，最后关闭旧映射。
- **资源授权扩大回归面**：按 datasource → dashboard → report 顺序逐域接入并运行 ACL 回归。
- **RLS 错配**：坚持 fail-closed，并记录拒绝原因但不记录敏感行值。

## 16. 文档同步

实现时同步：

- `docs/automate/prd/F02-AUTH.md`
- `docs/services/auth.md`
- `docs/api/README.md`
- `docs/ui/layout.md`（若导航或页面 IA 调整）
- `fe/src/components/README.md`（公共鉴权组件 API 变化）

现有 PRD 中 RLS 配置 UI、审计浏览页仍标为未完成，但代码已存在；实施前先校正文档状态，再登记本轮新增验收项。
