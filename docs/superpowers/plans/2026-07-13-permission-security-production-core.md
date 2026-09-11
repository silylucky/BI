# 权限与安全生产可用核心版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实施；每个任务必须经过规格符合性与代码质量复核。

**Goal:** 将现有角色编码、前端能力映射和局部鉴权升级为后端持久化权限点驱动的混合 RBAC，并补齐根管理员保护、用户生命周期、资源授权、RLS 与审计闭环。

**Architecture:** 后端以权限目录、角色权限绑定和统一 `require_permission` 依赖作为功能权限真理源；资源授权和 RLS 分别承担对象范围与行范围控制。采用 0024 schema 扩展、0025 数据回填、兼容双读、最终收口四阶段上线，避免一次性切换锁死管理员。

**Tech Stack:** FastAPI、SQLAlchemy 2、Alembic、Pydantic、React 19、TypeScript、TanStack Query、Radix/shadcn、Vitest、Pytest。

**Approved spec:** `docs/superpowers/specs/2026-07-13-permission-security-production-core-design.md`（Task 13 须同步本计划对 §5.1/§9/§13 的增补条款）

## Global Constraints

- 前端根目录只能是 `fe/`。
- API 前缀保持 `/api/v1/`；`AuthMiddleware` 继续由 `backend/app/main.py` 注册。
- 后端为权限真理源；前端路由守卫不能替代 API 鉴权。
- 保留 `admin` 根角色作为恢复入口；任何写操作都不得造成“无启用 root 用户”。
- `AuthRole.code` 全局唯一，数据库增加 `CHECK (is_root = false OR code = 'admin')`；两者共同保证最多一个 root 角色。任何取消最后一个启用 root 用户、删除/降级 root 角色的写操作，必须在同一事务中锁定相关角色、用户和绑定后重新计数，计数为 0 时返回 409。
- 权限目录固定为：`system:role.read`、`system:role.manage`、`system:user.read`、`system:user.manage`、`system:user.password.reset`、`system:grant.read`、`system:grant.manage`、`system:rls.read`、`system:rls.manage`、`system:org.read`、`system:org.manage`、`system:audit.read`、`datasource:read`、`datasource:manage`、`dashboard:read`、`dashboard:edit`、`report:read`、`report:manage`、`dataset:read`、`dataset:manage`、`metadata:read`、`metadata:manage`、`governance:read`、`governance:manage`、`theme:read`、`theme:manage`、`ingestion:read`、`ingestion:manage`。查询执行复用 `datasource:read`。
- 内置角色回填固定映射：`admin` 为 root（解析为 `*`）；`analyst` 为 `dashboard:read`、`dashboard:edit`、`report:read`、`theme:read`、`theme:manage`（`dashboard:read` 用于保留当前按角色可见的 Dashboard 列表语义）；`viewer` = `dashboard:read`、`report:read`；历史库若存在 `editor`/`owner`，均映射 `report:read`、`report:manage`；其他自定义角色默认不授予新权限。
- 迁移必须保留现有用户、角色、资源授权和 RLS 数据。
- RLS 无有效绑定时继续 fail-closed 为 `1=0`。
- 密码、token、credential、完整 SQL 不得进入审计详情。
- 密码重置或主动改密递增 `AuthUser.token_version`；JWT 携带 `tokenVersion` 声明，中间件发现令牌版本与数据库不一致即返回 401。禁用或锁定用户在下一次请求读取用户状态时立即失效。
- 功能权限拒绝统一返回顶层 JSON：`{"code","message","detail"}`（与现有 `JSONResponse` 一致），禁止 `HTTPException(detail={...})` 嵌套形态。
- 权限目录 ID 使用共享 `PERMISSION_NAMESPACE_UUID`（`backend/app/auth/permissions/constants.py`）做 UUIDv5；`catalog.py` 与 0025 migration **必须引用同一常量**，禁止各自生成。
- 通配编码（`domain:*`）仅用于运行时 `permission_matches`；`auth_role_permissions` **不得**持久化通配行，`replace_role_permissions` 对 `*: *` 返回 `PERMISSION_CODE_INVALID`。
- 资源可见性：datasource **grant-only**（root bypass）；dashboard 将持久化 `created_by` 视为**隐式 entitlement**（等同 grant，无需补录行）；report catalog 在持久化前**禁止创建 report 类型 grant**（API 返回 422 `REPORT_GRANT_NOT_PERSISTED`），节点访问用进程内 owner + 功能权限。
- 部署门禁：至少一个启用 root 用户的断言在 **`bootstrap_root` 完成之后**，不由 0025 migration 单独保证。
- 不引入 LDAP/OIDC/MFA/多租户/审批流。
- 不自动提交 git commit；仅在 Maintainer 明确要求时提交。

---

## 文件结构与职责

### 新建

- `backend/app/auth/permissions/constants.py`：`PERMISSION_NAMESPACE_UUID` 与目录 ID 辅助函数。
- `backend/app/auth/permissions/catalog.py`：权限目录常量、编码校验与通配规则。
- `backend/app/auth/permissions/service.py`：角色权限查询、全量替换、用户有效权限聚合。
- `backend/app/auth/permissions/__init__.py`：稳定导出。
- `backend/app/auth/password/service.py`：密码哈希、校验与管理员重置共用逻辑。
- `backend/app/auth/password/__init__.py`：稳定导出。
- `backend/app/auth/bootstrap_root.py`：新环境/异常历史库的一次性 root 初始化命令。
- `backend/app/api/v1/permissions.py`：权限目录与角色权限 API。
- `backend/migrations/versions/0024_auth_permission_core.py`：权限表及角色/用户扩展字段。
- `backend/migrations/versions/0025_auth_permission_backfill.py`：root 与内置角色权限回填。
- `tests/test_auth_permissions.py`：权限解析、依赖和 API 矩阵。
- `tests/test_auth_user_lifecycle.py`：用户状态、根管理员与密码生命周期。
- `tests/test_auth_resource_grants_v2.py`：资源存在性、名称、批量和 ACL。
- `tests/test_auth_rls_bindings_v2.py`：绑定读取、版本冲突、空绑定确认。
- `tests/test_auth_security_e2e.py`：root、安全管理员、分析用户三角色越权链。
- `fe/src/lib/auth-types.ts`：`/me`、权限、用户、角色、授权和 RLS 共享类型。
- `fe/src/lib/permission-codes.ts`：routes / nav / 测试共用的权限常量矩阵。
- `fe/src/pages/errors/ForbiddenPage.tsx`：明确的 403 页面。
- `fe/src/pages/admin/system/roles/RolePermissionsPanel.tsx`：角色权限矩阵。
- `fe/src/pages/admin/system/users/UserLifecycleDialogs.tsx`：启停、解锁、密码重置交互。
- `fe/src/pages/admin/system/rls/RlsRoleBindingPanel.test.tsx`：RLS 防覆盖测试。
- `fe/src/lib/capabilities.test.ts`：服务端权限匹配测试。

### 重点修改

- `backend/app/auth/models.py`、`schemas.py`、`deps.py`、`middleware.py`
- `backend/app/auth/{roles,users,resources,profile,login,rls,audit}/`
- `backend/app/api/v1/{roles,users,resource_grants,rls,audit,orgs,me,router,datasources,dashboards,datasets,metadata,gov,query}.py` 与 `backend/app/api/v1/{reports,ingestion}/`
- `backend/app/{datasources,dashboard,reports,query}/` 的 ACL 消费点与资源 resolver adapter
- `fe/src/context/auth-context.tsx`
- `fe/src/lib/{session,capabilities,resolve-nav,queryKeys}.ts`
- `fe/src/config/nav-manifest.tsx`、`fe/src/routes.tsx`
- `fe/src/components/auth/require-capability.tsx`
- 系统管理 roles/users/grants/rls/audit 页面与测试
- `docs/automate/prd/F02-AUTH.md`、`docs/services/auth.md`、`docs/api/README.md`、`docs/arch.md`
- `backend/.env.example`（bootstrap 与锁定参数）
- `tests/conftest.py`、`tests/jwt_auth.py`

---

### Task 1: 建立权限核心 Schema 与 ORM

**Files:**
- Create: `backend/migrations/versions/0024_auth_permission_core.py`
- Modify: `backend/app/auth/models.py`
- Test: `tests/test_migrations.py`
- Test: `tests/test_auth_permissions.py`

**Interfaces:**
- Produces: `AuthPermission`、`AuthRolePermission`
- Produces: `AuthRole.is_system/is_root/permission_version/rls_version`
- Produces: `AuthUser.is_active/failed_login_count/locked_until/password_changed_at/updated_at/token_version`

- [ ] **Step 1: 写失败的 ORM 与迁移结构测试**

```python
def test_permission_models_have_required_constraints():
    assert AuthPermission.__table__.c.code.unique
    assert AuthRole.__table__.c.code.unique
    assert set(AuthRolePermission.__table__.primary_key.columns.keys()) == {
        "role_id", "permission_id",
    }

def test_role_and_user_security_fields_exist():
    assert {"is_system", "is_root", "permission_version", "rls_version"} <= set(
        AuthRole.__table__.c.keys()
    )
    assert {"is_active", "failed_login_count", "locked_until", "password_changed_at",
            "updated_at", "token_version"} <= set(
        AuthUser.__table__.c.keys()
    )
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py ../tests/test_migrations.py -q
```

Expected: FAIL，缺少 ORM 类型与 0024 migration。

- [ ] **Step 3: 增加 ORM**

关键定义：

```python
class AuthPermission(Base):
    __tablename__ = "auth_permissions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthRolePermission(Base):
    __tablename__ = "auth_role_permissions"
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("auth_permissions.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

字段默认值：

```python
is_system=False
is_root=False
permission_version=0
rls_version=0
is_active=True
failed_login_count=0
locked_until=None
password_changed_at=None
updated_at=server_default=func.now(), onupdate=func.now()
token_version=1
```

`AuthUser.updated_at` 必须与 `AuthRole` 一样带 `onupdate=func.now()`。

`AuthRole` 保持 code 唯一，并增加 `CheckConstraint("NOT is_root OR code = 'admin'", name="ck_auth_roles_root_code")`。root 不变量的并发保护不能只靠应用层预读计数。

- [ ] **Step 4: 编写 0024 迁移**

`revision="0024"`、`down_revision="0023"`；upgrade 创建两表和索引并添加字段，downgrade 按依赖逆序删除。不得在 0024 回填业务数据。

- [ ] **Step 5: 验证 ORM、迁移 SQL 和 auth 基线**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py ../tests/test_migrations.py -q
python -m alembic upgrade head --sql
```

Expected: 全部通过，离线 SQL 中出现 `auth_permissions` 与 `auth_role_permissions`。

同步更新 `tests/test_migrations.py`：revision 集合与 head 从 `0022` 升至 `0024`（`0023` 已存在），并增加 `test_alembic_upgrade_head_sql_contains_auth_permissions` 断言。Task 1 **不包含** root 并发不变量测试（归属 Task 3）。

---

### Task 2: 权限目录、匹配与角色权限服务

**Files:**
- Create: `backend/app/auth/permissions/constants.py`
- Create: `backend/app/auth/permissions/catalog.py`
- Create: `backend/app/auth/permissions/service.py`
- Create: `backend/app/auth/permissions/__init__.py`
- Modify: `backend/app/auth/schemas.py`
- Test: `tests/test_auth_permissions.py`

**Interfaces:**
- Produces: `PERMISSION_CATALOG: tuple[PermissionDefinition, ...]`
- Produces: `permission_matches(granted: set[str], required: str, is_root: bool) -> bool`
- Produces: `resolve_user_permissions(session, user_id) -> tuple[set[str], bool]`
- Produces: `replace_role_permissions(session, role_id, codes, expected_version, audit: AuditWriteContext) -> RolePermissionsOut`

`AuditWriteContext` 固定字段：`actor_id: str`、`actor_username: str | None`、`trace_id: str`（复用 `audit_kwargs` / `record_event` 形态）。

- [ ] **Step 1: 写权限匹配和全量替换失败测试**

必须覆盖：

```python
assert permission_matches({"system:user.read"}, "system:user.read", False)
assert permission_matches({"system:*"}, "system:user.manage", False)
assert permission_matches(set(), "system:user.manage", True)
assert not permission_matches({"system:user.read"}, "system:user.manage", False)
```

服务测试必须断言：

- 未登记编码返回 `PERMISSION_CODE_INVALID`；
- 含 `domain:*` 的 code 在 replace 时返回 `PERMISSION_CODE_INVALID`（通配仅运行时匹配，不入库）；
- root 角色权限不可替换；
- `expected_version` 不一致返回 409 `ROLE_PERMISSION_VERSION_CONFLICT`；
- 替换后 `permission_version + 1`；
- 审计 detail 记录 before/after codes，不记录无关字段。

- [ ] **Step 2: 运行失败测试**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py -q
```

- [ ] **Step 3: 实现固定权限目录**

在 `constants.py` 定义 `PERMISSION_NAMESPACE_UUID = uuid.UUID("6f3e2a1b-8c4d-5e6f-9a0b-1c2d3e4f5a6b")` 与 `permission_id_for_code(code) -> uuid.UUID`（UUIDv5）。权限编码必须包含规格 §5.1 全集以及 Global Constraints 补充的 theme/ingestion 编码。`PermissionDefinition` 至少包含 `code/name/domain/description`；catalog 初始化时验证 code 唯一且符合：

```python
PERMISSION_CODE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*:(?:\*|[a-z][a-z0-9_.]*)$")
```

- [ ] **Step 4: 实现角色权限服务**

全量替换流程：

1. 锁定并读取角色；
2. 拒绝 root；
3. 校验 expected version；
4. 校验所有 code（拒绝通配入库）；
5. 删除旧绑定、插入新绑定；
6. 增加 `permission_version`；
7. 写审计 `role.permissions.replace`；
8. 单次 commit。

`resolve_user_permissions`：`is_root=true` 时不查 `auth_role_permissions`；仅聚合**启用用户 + 启用角色**的精确权限 code。

- [ ] **Step 5: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py ../tests/test_auth_rbac_l1.py -q
```

---

### Task 3: 数据回填与根管理员不变量

**Files:**
- Create: `backend/migrations/versions/0025_auth_permission_backfill.py`
- Create: `backend/app/auth/bootstrap_root.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/auth/roles/service.py`
- Modify: `backend/app/auth/users/service.py`
- Modify: `tests/conftest.py`
- Test: `tests/test_auth_permissions.py`
- Test: `tests/test_auth_user_lifecycle.py`
- Test: `tests/test_migrations.py`

**Interfaces:**
- Produces: 唯一 `admin` root/system 角色
- Produces: `assert_root_admin_survives(session, *, excluding_user_id=None, excluding_role_id=None) -> None`

- [ ] **Step 1: 写失败测试**

覆盖：

- 不能删除、禁用、改 code 的 root 角色；
- 不能禁用或移除最后一个 root 用户；
- 有第二个启用 root 用户时允许停用第一个；
- 迁移重复执行不产生重复权限/绑定；
- analyst/viewer/editor/owner 严格按“Global Constraints”映射回填，自定义角色默认空权限；
- 空库、有用户但无 admin 绑定、admin 用户已禁用三种状态不会被 migration 静默指派用户；
- 两个事务并发移除最后 root 绑定时，至少一个返回 409，提交后仍有启用 root。

- [ ] **Step 2: 编写 0025 回填**

回填顺序：

1. 使用 permission code 的 UUIDv5 确定性 ID upsert “Global Constraints”中的完整权限目录；
2. 将 `code='admin'` 标为 `is_system/is_root=true`；
3. 若无 admin 角色则创建；
4. 不在 migration 中自动选择、启用或重置任何用户；分别记录“已有启用 root”“缺 root 待 bootstrap”状态；
5. 按固定映射回填 analyst/viewer，以及存在时的 editor/owner；
6. 不给自定义角色自动扩权。

0025 `upgrade()` 在线执行；`alembic upgrade head --sql` 离线输出须使用**确定性 ID**（引用 `PERMISSION_NAMESPACE_UUID`）与 `INSERT ... ON CONFLICT DO NOTHING` / `UPDATE ... WHERE code = :code` 子查询，不得依赖运行时 Python 查 role ID。模板示例（SQLite/PostgreSQL 共用形态）：

```sql
INSERT INTO auth_permissions (id, code, name, domain, description)
VALUES ('<uuidv5(system:role.read)>', 'system:role.read', '...', 'system', '...')
ON CONFLICT (code) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
JOIN auth_permissions p ON p.code = 'dashboard:read'
WHERE r.code = 'analyst'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: 实现一次性 root bootstrap**

- `Settings` 增加可选 `vitalspan_bootstrap_admin_username`、`vitalspan_bootstrap_admin_password: SecretStr | None` 与 `vitalspan_bootstrap_allow_existing: bool=False`；
- `python -m app.auth.bootstrap_root` 仅在当前不存在启用 root 用户时读取上述环境变量：用户名不存在则创建启用用户并绑定 `admin`；用户名已存在时默认拒绝，只有显式设置 `VITALSPAN_BOOTSTRAP_ALLOW_EXISTING=true` 才允许重置该用户密码、启用并绑定 admin；变量缺失时 fail closed；并发后已出现 root 则回滚本次变更并以“已初始化”退出；
- 新环境部署顺序固定为 `alembic upgrade head` → `python -m app.auth.bootstrap_root` → 启动应用；已有库无 admin 绑定或 admin 已禁用时，也必须由运维显式指定用户名运行命令。

`AUTH_ROOT_NOT_INITIALIZED` 503 门禁在 **Task 4** `middleware.py` 实现；本 Task 只负责 bootstrap CLI 与不变量，不在 middleware 落地。

0025 offline 模式只生成 schema-independent INSERT/UPDATE SQL，不读取数据库或断言用户存在；fresh install 与已有数据的分支判断全部在在线 upgrade/幂等 SQL 和 bootstrap 中完成。重复运行 bootstrap 在已有启用 root 时只返回成功状态，不修改用户、密码或绑定。与 Approved spec §13 的差异由 Task 13 同步规格：部署门禁改为 **bootstrap 完成后**断言至少一个启用 root。

- [ ] **Step 4: 实现根管理员保护**

所有角色和用户生命周期写操作在 commit 前调用统一不变量检查；错误码：

```text
AUTH_ROOT_ROLE_IMMUTABLE
AUTH_ROOT_ADMIN_REQUIRED
```

检查必须在同一事务中锁定 admin 角色、相关用户与用户角色绑定，再按“启用用户 + root 绑定”重算；禁止以事务外预读计数代替锁定。数据库的 root code CHECK 作为第二道防线。

- [ ] **Step 5: 验证迁移、bootstrap 和不变量**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py ../tests/test_auth_user_lifecycle.py ../tests/test_migrations.py -q
```

测试环境为 bootstrap 命令注入专用环境变量；同步更新 `tests/conftest.py` 的 root seed 与 revision head。验证空库可初始化、异常历史库不被自动选人、重复执行无副作用、并发执行只留下一个 root 角色。

---

### Task 4: UserContext、Middleware 与统一权限依赖

**Files:**
- Modify: `backend/app/auth/deps.py`
- Modify: `backend/app/auth/middleware.py`
- Modify: `backend/app/auth/jwt.py`
- Modify: `backend/app/auth/profile/schemas.py`
- Modify: `backend/app/auth/profile/service.py`
- Modify: `backend/app/api/v1/me.py`
- Modify: `backend/app/main.py`（注册 `PermissionDeniedError` handler）
- Modify: `tests/conftest.py`
- Modify: `tests/jwt_auth.py`
- Test: `tests/test_auth.py`
- Test: `tests/test_me.py`
- Test: `tests/test_auth_permissions.py`

**Interfaces:**
- Produces: `UserContext.permissions: set[str]`
- Produces: `UserContext.is_root: bool`
- Produces: `require_permission(permission: str)`
- Produces: `require_any_permission(*permissions: str)`
- `/api/v1/me` 返回 `permissions` 和 `isRoot`
- JWT `tokenVersion` 与数据库 `AuthUser.token_version` 必须一致

- [ ] **Step 1: 写失败的鉴权矩阵**

覆盖匿名 401、登录无权限 403、精确权限成功、通配成功、root 成功、禁用用户 403、锁定用户 403、JWT `tokenVersion` 与 DB 不一致 401、权限数据库异常 fail-closed。`tokenVersion` 的 JWT 编解码与中间件校验在本 Task 完成；密码变更递增 `token_version` 的写路径归属 Task 6，本 Task 测试通过直接更新 DB `token_version` 模拟撤销。

- [ ] **Step 2: 删除危险回退并实现部署门禁**

`AuthMiddleware` 的数据库角色解析失败不得回退为 `["admin"]`；改为记录 traceId 后返回 503 `AUTH_CONTEXT_UNAVAILABLE`。

若无启用 root 用户（bootstrap 未完成），除公开路径、`/api/v1/auth/login` 与健康检查外，受保护 API 返回 503 `AUTH_ROOT_NOT_INITIALIZED`。

更新 `tests/jwt_auth.py` 与 `tests/conftest.py`：测试 JWT 必须携带 `tokenVersion` 声明，移除依赖 middleware admin fallback 的 fixture。

JWT 缺少 `tokenVersion` 的历史 token 在兼容发布窗口内按版本 1 解析；0024 部署完成并重新登录窗口结束后删除兼容分支。数据库版本不一致统一返回 401 `TOKEN_REVOKED`。`jwt.py` 在本 Task 增加 `tokenVersion` 编解码；登录发放带版本声明的 JWT 在 Task 6 与 `auth.py` 一并收口。

- [ ] **Step 3: 扩展上下文并实现依赖**

```python
class PermissionDeniedError(Exception):
    def __init__(self, permission: str) -> None:
        self.permission = permission


def require_permission(permission: str):
    async def dependency(user: Annotated[UserContext, Depends(get_current_user)]) -> UserContext:
        if not permission_matches(user.permissions, permission, user.is_root):
            raise PermissionDeniedError(permission)
        return user
    return dependency
```

在 `main.py` 或 `core/errors.py` 注册 handler，将 `PermissionDeniedError` 转为顶层 `{"code":"PERMISSION_DENIED","message":...,"detail":null}`。禁止 `HTTPException(detail={...})` 嵌套形态；Task 7 全部复用同一 handler。

- [ ] **Step 4: 扩展 `/me`**

响应字段使用 camelCase 契约：

```json
{
  "roles": ["security_admin"],
  "permissions": ["system:user.manage"],
  "isRoot": false
}
```

- [ ] **Step 5: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth.py ../tests/test_me.py ../tests/test_auth_permissions.py -q
```

---

### Task 5: 权限目录与角色权限 API

**Files:**
- Create: `backend/app/api/v1/permissions.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/app/api/v1/roles.py`
- Modify: `backend/app/auth/schemas.py`
- Test: `tests/test_auth_permissions.py`

**Interfaces:**
- `GET /api/v1/permissions` → `PermissionListOut`
- `GET /api/v1/roles/{role_id}/permissions`
- `PUT /api/v1/roles/{role_id}/permissions`
- `GET /api/v1/roles` 的 `RoleOut` 扩展 `isRoot`、`isSystem`、`permissionVersion`

- [ ] **Step 1: 写 API 失败测试**

必须断言：

- `system:role.read` 可读取目录/角色绑定；
- `system:role.manage` 才可替换；
- 无权限 403；
- root 返回 `allPermissions=true` 且不可 PUT；
- PUT 必须携带 `expectedVersion`；
- 冲突返回 409。

- [ ] **Step 2: 实现 Schema**

```python
class PermissionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    id: uuid.UUID
    code: str
    name: str
    domain: str
    description: str | None = None


class PermissionListOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    items: list[PermissionOut]


class RolePermissionsReplace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    permission_codes: list[str] = Field(alias="permissionCodes")
    expected_version: int = Field(alias="expectedVersion", ge=0)


class RolePermissionsOut(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )
    role_id: uuid.UUID = Field(alias="roleId")
    permission_codes: list[str] = Field(alias="permissionCodes")
    version: int
    all_permissions: bool = Field(alias="allPermissions")
```

`RoleOut` 增加 `is_root/isRoot`、`is_system/isSystem`、`permission_version/permissionVersion`（camelCase 输出）。角色列表与 `GET .../permissions` 均为前端判断 root 只读与 version 冲突的真理源。

本任务新增的所有 request/response schema 都显式设置 `ConfigDict(populate_by_name=True, serialize_by_alias=True)`；ORM 输出再加 `from_attributes=True`。API 测试必须同时断言 snake_case/camelCase 两种构造均可解析、HTTP 响应只输出 camelCase。

- [ ] **Step 3: 注册路由并使用统一依赖**

不得在 handler 内重复 `"admin" in roles` 判断。

- [ ] **Step 4: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py -q
```

---

### Task 6: 密码服务与用户生命周期

**Files:**
- Create: `backend/app/auth/password/service.py`
- Create: `backend/app/auth/password/__init__.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/auth/login/service.py`
- Modify: `backend/app/api/v1/auth.py`
- Modify: `backend/app/auth/jwt.py`
- Modify: `backend/app/auth/middleware.py`
- Modify: `backend/app/auth/profile/service.py`
- Modify: `backend/app/auth/users/service.py`
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/api/v1/users.py`
- Test: `tests/test_auth_login.py`
- Test: `tests/test_auth_profile.py`
- Test: `tests/test_auth_user_lifecycle.py`

**Interfaces:**
- Produces: `hash_password`、`verify_password`、`validate_password_policy`（从现有 Pydantic 改密规则抽取为共享函数）
- API：用户创建/更新/启停/解锁/管理员重置密码；`auth.py` 登录 JWT 携带 `tokenVersion`

- [ ] **Step 1: 写生命周期失败测试**

覆盖：

- 创建需要初始密码并保存 hash；
- 连续失败增加计数，达到阈值设置 `locked_until` 并写审计 `user.lock`；
- 成功登录清零失败次数；
- 禁用/锁定用户登录 403；
- 管理员解锁；
- 重置密码后旧密码失效、`password_changed_at` 更新；
- 重置/主动改密后旧 JWT 因 `token_version` 不匹配返回 401；
- 审计不含明文密码/hash；
- 根管理员保护。

- [ ] **Step 2: 抽取密码服务**

从 login/profile service 移除重复 bcrypt 调用；在 `password/service.py` **新建** `validate_password_policy(password: str) -> None`（不满足则抛 `PasswordPolicyError`），规则与现有 `ChangePasswordRequest` 字段校验一致。创建用户、管理员重置、用户主动改密均调用此函数。

- [ ] **Step 3: 固化锁定与临时密码安全参数**

- `Settings.auth_max_failed_logins=5`、`Settings.auth_lock_minutes=15`、`Settings.auth_temporary_password_length=20`；配置校验分别要求 `3..20`、`1..1440`、`16..64`；
- 失败计数按“连续失败”定义：成功登录清零；达到第 5 次后 `locked_until=now+15min`。锁定未到期直接拒绝且不继续增加计数；到期后的首次失败从 1 重新计数；
- 临时密码使用 `secrets` 从大小写字母、数字和策略允许的符号中生成，生成后必须通过现有 `validate_password_policy`，不得使用固定默认密码。

- [ ] **Step 4: 扩展用户服务与精确 API 契约**

端点与契约固定为：

```text
POST  /api/v1/users
      body: {username, displayName?, email?, orgId?, roleIds, initialPassword}
      response: UserOut（不返回密码）
PATCH /api/v1/users/{id}
      body: {displayName?, email?, orgId?, roleIds?}
POST  /api/v1/users/{id}/disable
POST  /api/v1/users/{id}/enable
POST  /api/v1/users/{id}/unlock
POST  /api/v1/users/{id}/reset-password
      body: {}
      response: {temporaryPassword: string, passwordChangedAt: datetime}
```

创建、更新、启停、解锁依赖 `system:user.manage`；重置密码只依赖更严格的 `system:user.password.reset`。`PUT /api/v1/users/{id}/roles` **保留兼容**：继续可用，权限与 `PATCH .../users/{id}` 的 `roleIds` 相同（`system:user.manage`），文档标记 deprecated，不在本 Task 删除。重置响应设置 `Cache-Control: no-store`，明文只存在于本次响应且不得进入日志/审计。主动改密和管理员重置均递增 `token_version`；`auth.py` 登录与 dev 测试入口发放的新 JWT 必须携带当前 `tokenVersion`。

- [ ] **Step 5: 保证事务内审计**

业务变更、审计写入和 commit 必须在同一 service 调用中完成。

- [ ] **Step 6: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_login.py ../tests/test_auth_profile.py ../tests/test_auth_user_lifecycle.py -q
```

---

### Task 7: 敏感 API 全面权限收口

**Files:**
- Modify: `backend/app/api/v1/roles.py`
- Modify: `backend/app/api/v1/users.py`
- Modify: `backend/app/api/v1/resource_grants.py`
- Modify: `backend/app/api/v1/rls.py`
- Modify: `backend/app/api/v1/audit.py`
- Modify: `backend/app/api/v1/orgs.py`
- Modify: `backend/app/api/v1/datasources.py`
- Modify: `backend/app/api/v1/query.py`
- Modify: `backend/app/api/v1/dashboards.py`
- Modify: `backend/app/api/v1/query_configs.py`
- Modify: `backend/app/api/v1/{charts,views,designer,embed,stats,nfr,services,integration_bus,workno}.py`
- Modify: `backend/app/api/v1/reports/` 与 `backend/app/api/v1/reports/export.py`
- Modify: `backend/app/core/errors.py`（或 `main.py` 异常 handler）
- Modify: `backend/app/api/v1/datasets.py`
- Modify: `backend/app/api/v1/metadata.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `backend/app/api/v1/ingestion/`
- Modify: `backend/app/auth/users/service.py`
- Modify: `backend/app/auth/audit/service.py`
- Test: `tests/test_auth_permissions.py`
- Test: `tests/test_auth_rbac_l1.py`

**Interfaces:**
- Consumes: `require_permission`
- Removes: API 层角色编码守卫

- [ ] **Step 1: 建立参数化越权测试**

```python
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/v1/roles"),
        ("POST", "/api/v1/users"),
        ("POST", "/api/v1/resource-grants"),
        ("POST", "/api/v1/rls/dimensions"),
        ("GET", "/api/v1/audit/events"),
        ("POST", "/api/v1/datasources"),
        ("POST", "/api/v1/query/bindings"),
        ("POST", "/api/v1/query-configs"),
        ("POST", "/api/v1/reports/catalog/nodes"),
        ("POST", "/api/v1/datasets"),
    ],
)
def test_sensitive_api_requires_permission(
    client, authenticated_no_permission_headers, method, path
):
    response = client.request(
        method, path, headers=authenticated_no_permission_headers, json={}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "PERMISSION_DENIED"
```

- [ ] **Step 2: 按完整矩阵为系统与业务路由绑定权限**

系统路由严格遵循规格 §6.3；业务路由固定如下，不允许只收口 auth/system：

| 路由组 | 读/执行 | 创建、更新、删除及管理动作 |
|---|---|---|
| `/datasources` | `datasource:read`（列表、详情、schema/table/column 浏览） | `datasource:manage`（创建、编辑、删除、测试连接） |
| `/query` execute/preview/validate | `datasource:read` + 资源 ACL + RLS | — |
| `/query/bindings`、dataset routing/validate/execute-plan | `dataset:read` | `dataset:manage` |
| `/query-configs/**` | `dataset:read` | `dataset:manage` |
| `/dashboards`（除 theme-analysis）、`/charts`、`/views`、`/designer` | `dashboard:read`（读取、预览、执行） | `dashboard:edit` |
| `/dashboards/theme-analysis/**` | `theme:read`（GET、query、execute-plan） | `theme:manage`（PUT、validate） |
| `/reports/**`、`/reports/export/**` | `report:read`（目录、模板、预览、导出读取） | `report:manage`（目录/模板/批处理/调度变更） |
| `/datasets` | `dataset:read` | `dataset:manage` |
| `/metadata`（包括其 themes 语义目录） | `metadata:read` | `metadata:manage`（刷新/同步/主题节点变更） |
| `/gov` | `governance:read` | `governance:manage` |
| `/ingestion/**` | `ingestion:read`（任务与状态读取） | `ingestion:manage`（创建、启动、停止、重跑） |
| `/embed/**` | 继承被嵌套 dashboard/report 的目标资源权限；无目标 ID 时 `dashboard:read` | 同读侧规则 |
| `/stats/**` | `dashboard:read`（聚合只读） | 不提供写接口 |
| `/nfr/**` | 登录即可（运维探针）；写操作 `governance:manage` | 按端点细分 |
| `/services/**`、`/integration-bus/**`、`/workno/**` | `governance:read` | `governance:manage` |
| `/views/**`（用户视图偏好） | 登录即可读写**本人**视图 | 不得越权改他人视图 |

`theme:read/manage` 专用于 Dashboard 主题分析；metadata 下的“主题目录”仍属于 `metadata:*`，避免同名概念混用。service 内保留业务不变量与资源 ACL，但删除 `assert_binding_admin` 作为功能权限判断来源。矩阵须以 `router.py` 已注册路由为准逐项勾选，新增端点默认 fail-closed。

- [ ] **Step 3: 统一错误响应**

所有功能权限拒绝复用 Task 4 `PermissionDeniedError` handler，保证顶层 `code` 字段。资源不可见和 RLS 拒绝保留各自错误码。每个矩阵行至少测试“无功能权限 403、只有功能权限但无资源授权仍拒绝、功能权限 + 资源授权成功”；root 作为独立成功用例。

- [ ] **Step 4: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_permissions.py ../tests/test_auth_rbac_l1.py ../tests/test_datasources_companion_r25.py ../tests/test_r0_acl_and_sql_safety.py -q
```

---

### Task 8: RLS 读取、版本保护与空绑定确认

**Files:**
- Modify: `backend/app/auth/rls/bindings/service.py`
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/api/v1/roles.py`
- Test: `tests/test_auth_rls_bindings_v2.py`
- Test: `tests/test_cat003_region_rls.py`

**Interfaces:**
- `GET /api/v1/roles/{roleId}/dimension-groups -> RoleDimensionGroupsOut`
- `GET /api/v1/roles/{roleId}/dimension-values?dimensionTypeId={uuid} -> RoleDimensionValuesOut`
- `PUT` 成功/no-op 均返回 **200** 与 GET 相同 Schema（含新 `version`）；废弃 204 无 body 响应
- 对应 PUT 使用角色级 `expectedVersion` 与 `confirmEmpty`
- `GET /api/v1/roles/{roleId}/effective-dimensions` **保留**为只读派生端点（供查询/RLS 引擎），管理 UI 不再依赖；文档标记 deprecated，测试保持通过

- [ ] **Step 1: 写失败测试**

覆盖：

- GET 返回已有绑定和 version；
- version 冲突返回 409 `RLS_BINDING_VERSION_CONFLICT`；
- 空列表且 `confirmEmpty=false` 返回 422 `RLS_EMPTY_CONFIRM_REQUIRED`；
- 替换成功增加 role.rls_version；
- no-op 不增加 version，但 PUT 仍返回 200 与当前状态；
- 审计记录 before/after；
- 查询无绑定保持 `1=0`。

- [ ] **Step 2: 固化 GET/PUT Schema 与读取服务**

所有 schema 使用 `ConfigDict(populate_by_name=True)`，契约固定为：

```json
GET dimension-groups
{"roleId":"uuid","groupIds":["uuid"],"version":3}

GET dimension-values?dimensionTypeId=uuid
{"roleId":"uuid","dimensionTypeId":"uuid","values":["华东"],"version":3}

PUT dimension-groups
{"groupIds":["uuid"],"expectedVersion":3,"confirmEmpty":false}

PUT dimension-values
{"dimensionTypeId":"uuid","values":["华东"],"expectedVersion":3,"confirmEmpty":false}
```

`dimensionTypeId` 是 values GET 的必填 query 参数，缺失返回 422；不存在返回 404 `RLS_DIMENSION_TYPE_NOT_FOUND`。返回值去重后稳定排序，group IDs 按 UUID 字符串排序，避免前端虚假 diff。

- [ ] **Step 3: 实现并发与空绑定保护**

`AuthRole.rls_version` 是该角色所有 direct values 与 group bindings 共享的单一聚合版本；任一真实变更均递增一次，no-op 不递增。PUT 锁定角色行，比较 `expectedVersion` 后再替换；空绑定必须显式 `confirmEmpty=true`。同一角色不同 dimension type 的并发写也因共享版本发生 409，前端必须重新 GET。

- [ ] **Step 4: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_rls_bindings_v2.py ../tests/test_cat003_region_rls.py ../tests/test_query_l1_r26.py -q
```

---

### Task 9: 资源授权增强与跨域 ACL

**Files:**
- Create: `backend/app/auth/resources/resolvers.py`
- Modify: `backend/app/auth/resources/service.py`
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/api/v1/resource_grants.py`
- Create: `backend/app/datasources/resource_adapter.py`
- Create: `backend/app/dashboard/resource_adapter.py`
- Create: `backend/app/reports/catalog/resource_adapter.py`
- Modify: `backend/app/reports/catalog/service.py`（公开 `list_node_summaries` / `get_node_summary`，禁止 adapter 读 `_nodes` 私有字典）
- Modify: `backend/app/main.py`
- Modify: `backend/app/datasources/acl.py`
- Modify: `backend/app/dashboard/service.py`
- Modify: `backend/app/reports/catalog/acl.py`
- Test: `tests/test_auth_resource_grants_v2.py`
- Test: `tests/test_datasources_companion_r25.py`
- Test: `tests/test_r0_acl_and_sql_safety.py`

**Interfaces:**
- `GET /api/v1/resource-grants/resources?type={datasource|dashboard|report}&search=&limit=`
- `POST /api/v1/resource-grants/batch` → `ResourceGrantBatchOut`
- 列表输出 `resourceName`、`resourceDeleted`
- datasource/dashboard/report 统一资源可见性（见 Global Constraints）
- ACL 消费接口显式接收完整 `UserContext`，不得仅以 `role_codes` 推断 root
- `gov_catalog_entry` 类型：禁止**新建** grant；既有行只读展示，resolver 返回 `RESOURCE_TYPE_DEPRECATED`

- [ ] **Step 1: 写失败测试**

覆盖：

- 不存在/已软删除资源拒绝授权；`type=report` 在 catalog 持久化前返回 422 `REPORT_GRANT_NOT_PERSISTED`；
- 批量包含一个非法资源时整批回滚；
- 重复授权固定为幂等成功：单条 POST 返回既有 grant（200），batch 返回 `createdIds` 与 `existingIds`，不得创建重复行；
- 列表带资源名称；
- datasource 非 root 用户只看到显式角色授权资源；dashboard/report 列表是“本人拥有 OR 角色显式授权”的并集；
- root 看到全部；
- datasource、dashboard、report 都遵循“功能权限先行、root bypass、随后按各域既有 ownership + grant 兼容规则判定”。

- [ ] **Step 2: 实现资源解析器**

`auth/resources/resolvers.py` 只定义 `ResourceSummary`、`ResourceResolver` Protocol、`register_resource_resolver(type, resolver)` 与 registry，不 import 任何业务模型：

```python
class ResourceResolver(Protocol):
    def get_summary(
        self, session: Session, resource_id: uuid.UUID
    ) -> ResourceSummary | None: ...

    def list_summaries(
        self, session: Session, *, search: str | None, limit: int
    ) -> list[ResourceSummary]: ...
```

每个域的 `resource_adapter.py` 可 import 本域模型并实现 resolver；`main.py` 作为 composition root 在启动时注册 `datasource`、`dashboard`、`report` adapters。auth service 仅按 resource type 从 registry 取 resolver，未知类型返回 422 `RESOURCE_TYPE_UNSUPPORTED`，资源不存在/软删除返回 404 `RESOURCE_NOT_FOUND`。这避免 auth 反向依赖业务模型。

跨域 ACL 签名统一为 `assert_visible(session, actor: UserContext, resource_id)` 与 `apply_list_filter(stmt, session, actor: UserContext)`；第一步始终检查 `actor.is_root`，随后才计算 ownership/role grants。禁止继续把 `"admin" in role_codes` 当 root 真理源。

- [ ] **Step 3: 实现批量事务、资源查询 API 与审计**

```python
class ResourceGrantBatchCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    role_id: uuid.UUID = Field(alias="roleId")
    resource_type: str = Field(alias="resourceType")
    resource_ids: list[uuid.UUID] = Field(alias="resourceIds")


class ResourceGrantBatchOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    created_ids: list[uuid.UUID] = Field(alias="createdIds")
    existing_ids: list[uuid.UUID] = Field(alias="existingIds")


class GrantableResourceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    id: uuid.UUID
    name: str
    resource_type: str = Field(alias="resourceType")
    deleted: bool = False
```

`GET .../resources` 依赖 `system:grant.read`，按 type 委托 resolver `list_summaries`。批量授权先解析并校验全部资源，再在单事务中插入缺失 tuple；任一非法项整批回滚。数据库唯一 tuple 约束处理并发重复，冲突后重读并归入 `existingIds`。审计 detail 只记录 roleId、resourceType、createdIds、existingIds。更新 `tests/test_auth_rbac_l1.py::test_resource_grant_duplicate_409` 为幂等 200/既有 ID 语义。

- [ ] **Step 4: 明确旧 ACL 迁移语义并分域接入**

- datasource：沿用现有 grant-only 行为，功能权限不能替代资源 grant；
- dashboard：现有 `created_by` 是持久化隐式授权；列表/详情改为 `root OR created_by=actor OR actor role grant`，不得把 owner 迁走或要求管理员补 grant；
- report catalog：进程内存 owner；**禁止**创建持久化 `report` 类型 grant（422）；节点访问 `root OR owner OR grant`；adapter 仅通过 `service.list_node_summaries` 枚举；
- report 的旧 `editor/owner` 角色码判断由 Task 3 回填出的 `report:manage` 功能权限替代，但对象级写入仍要求 owner 或 grant；`report:read` 仅通过功能门禁，不得绕过对象 ACL；
- 顺序必须为 datasource → dashboard → report；每接一个域先跑其专属回归，再继续下一域。测试分别固化 owner 保持可访问、grant 扩展访问、既非 owner 也无 grant 时 403。

- [ ] **Step 5: 验证**

```powershell
cd backend
python -m pytest ../tests/test_auth_resource_grants_v2.py ../tests/test_datasources_companion_r25.py ../tests/test_r0_acl_and_sql_safety.py -q
```

---

### Task 10: 前端权限真理源与 403

**Files:**
- Create: `fe/src/lib/permission-codes.ts`
- Create: `fe/src/lib/auth-types.ts`
- Create: `fe/src/lib/capabilities.test.ts`
- Create: `fe/src/context/auth-context.test.tsx`
- Create: `fe/src/pages/errors/ForbiddenPage.tsx`
- Modify: `fe/src/context/auth-context.tsx`
- Modify: `fe/src/layouts/AdminLayout.tsx`
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`
- Modify: `fe/src/lib/dev-user-switch.ts`
- Modify: `fe/src/lib/dev-user-switch.test.ts`
- Modify: `fe/src/pages/login/LoginPage.tsx`
- Modify: `fe/src/lib/session.ts`
- Modify: `fe/src/lib/defaultViewResolve.ts`
- Modify: `fe/src/lib/capabilities.ts`
- Modify: `fe/src/lib/resolve-nav.ts`
- Modify: `fe/src/lib/queryKeys.ts`
- Modify: `fe/src/config/nav-manifest.tsx`
- Modify: `fe/src/components/auth/require-capability.tsx`
- Modify: `fe/src/components/layout/user-dropdown.tsx`
- Modify: `fe/src/components/dev/dev-user-switcher.tsx`
- Modify: `fe/src/pages/admin/AdminHomePage.tsx`
- Modify: `fe/src/pages/datasources/DatasourceListPage.tsx`
- Modify: `fe/src/pages/dashboard/DashboardEditorPage.tsx`
- Modify: `fe/src/pages/dashboard/DashboardSharePage.tsx`
- Modify: `fe/src/hooks/useThemeAnalysis.ts`
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/routes.smoke.test.tsx`
- Test: `fe/src/lib/resolve-nav.test.ts`
- Test: `fe/src/components/auth/require-capability.test.tsx`

**Interfaces:**
- Consumes: `/me.permissions`、`/me.isRoot`
- Produces: `SessionUser.permissions`
- Produces: `hasCapability(user, required)` 以服务端权限为准

- [ ] **Step 1: 写失败测试**

覆盖：

- 自定义角色只凭 `/me.permissions` 显示菜单；
- `system:user.read` 只显示用户管理；
- root 显示全部；
- 仅 `datasource:read` 可进列表/详情但不能进入新建/编辑，`datasource:manage` 可进入管理路由；
- `matchesCapability(new Set(["*"]), anyKnownPermission)` 恒为 true；
- `theme:read/manage` 与 `ingestion:read/manage` 可正确匹配现有导航和路由；
- 无权限访问路由展示 403，不跳转；
- 生产模式不读取 `BUILTIN_ROLE_CAPABILITIES`。
- 删除或改写 `RequirePlatformAdmin`、`isAdmin()` 等角色真理源；路由守卫统一改用 `RequireCapability` + `permission-codes.ts`。
- Login 成功后只调用一次 `refreshMe()` 获取完整 `/me`（含 permissions），禁止二次请求丢弃 permissions。

- [ ] **Step 2: 集中 auth 类型、权限常量与 query keys**

`fe/src/lib/permission-codes.ts` 导出与后端目录一致的权限常量及 `ROUTE_PERMISSION_MATRIX`；`routes.tsx`、`nav-manifest.tsx`、`resolve-nav.ts` 与测试 **只能** import 此文件，禁止三处硬编码分叉。

`MeProfile`：

```typescript
export type MeProfile = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
  isRoot: boolean;
};
```

- [ ] **Step 3: 切换能力解析**

```typescript
export function resolveUserCapabilities(user: SessionUser): Set<string> {
  if (user.isRoot) return new Set(["*"]);
  return new Set(user.permissions);
}

export function matchesCapability(caps: Set<string>, required: string): boolean {
  if (caps.has("*") || caps.has(required)) return true;
  const domain = required.split(":", 1)[0];
  return caps.has(`${domain}:*`);
}
```

`SessionRole` 改为 `string`，`SessionUser` 必须携带 `permissions: string[]` 与 `isRoot: boolean`；`sessionUserFromMe`、`AuthProvider.refreshMe()`、Login 成功后的刷新链、`AdminLayout` 与 dev user switch 都不得丢弃或伪造这两个字段。dev switch 仅在 DEV 下从后端测试用户 `/me` 结果取权限，不再本地按角色生成。开发兼容回退必须受显式 DEV 条件控制并输出 warning；生产不得回退角色映射。

- [ ] **Step 4: 细化导航与路由**

导航不再以 `roles` 作为显示真理源，父项由可见子项聚合。路由矩阵固定为：

- datasource：列表/详情 `datasource:read`，新建/编辑 `datasource:manage`；
- ingestion：列表/历史 `ingestion:read`，新建/编辑/ETL 规则 `ingestion:manage`；
- dashboard：列表/查看 `dashboard:read`，编辑/分享 `dashboard:edit`；
- report：中心 `report:read`，模板/调度 `report:manage`；
- dataset：列表 `dataset:read`，新建/编辑 `dataset:manage`；
- metadata：浏览 `metadata:read`；治理浏览 `governance:read`，发布/写路径 `governance:manage`；
- entity/theme 页面至少要求 `theme:read`，任何保存动作另以 `theme:manage` 控制；
- 系统子项分别使用 `system:role.read`、`system:user.read`、`system:grant.read`、`system:rls.read`、`system:org.read`、`system:audit.read`。

`routes.tsx`、`nav-manifest.tsx`、`resolve-nav.ts` 三处必须消费 `permission-codes.ts`，禁止继续使用粗粒度 `datasource:*`/`system:*` 让只读用户进入写页面。

- [ ] **Step 5: 验证**

```powershell
cd fe
npx vitest run src/lib/capabilities.test.ts src/lib/resolve-nav.test.ts src/context/auth-context.test.tsx src/components/auth/require-capability.test.tsx src/routes.smoke.test.tsx
npx vitest run src/lib/dev-user-switch.test.ts src/layouts/AdminLayout.smoke.test.tsx
```

---

### Task 11: 角色权限与用户生命周期 UI

**Files:**
- Create: `fe/src/pages/admin/system/roles/RolePermissionsPanel.tsx`
- Create: `fe/src/pages/admin/system/users/UserLifecycleDialogs.tsx`
- Modify: `fe/src/pages/admin/system/roles/RoleListPage.tsx`
- Modify: `fe/src/pages/admin/system/users/UserListPage.tsx`
- Modify: `fe/src/pages/admin/system/roles/roles.smoke.test.tsx`
- Modify: `fe/src/pages/admin/system/users/users.smoke.test.tsx`

**Interfaces:**
- Consumes: 权限目录/角色权限 API
- Consumes: 用户创建、更新、启停、解锁、重置密码 API

- [ ] **Step 1: 写角色权限矩阵失败测试**

覆盖目录按 domain 分组、加载已有勾选、域级全选、version 冲突提示、root 只读、加载失败禁保存。

- [ ] **Step 2: 实现 `RolePermissionsPanel`**

保持 `RoleListPage.tsx` 不继续膨胀；权限矩阵独立查询、变更状态和保存 mutation。

- [ ] **Step 3: 写用户生命周期失败测试**

覆盖状态 Badge、创建完整字段、禁用确认、解锁、重置密码一次性显示、关闭后不再显示明文、无权限按钮隐藏。

- [ ] **Step 4: 实现用户 UI**

用户列表至少显示用户名、显示名、邮箱、状态、组织和角色；破坏性操作均使用确认对话框。

- [ ] **Step 5: 验证**

```powershell
cd fe
npx vitest run src/pages/admin/system/roles/ src/pages/admin/system/users/
```

---

### Task 12: 资源授权与 RLS UI 防误操作

**Files:**
- Modify: `fe/src/pages/admin/system/grants/GrantsPage.tsx`
- Modify: `fe/src/pages/admin/system/grants/useGrantsPage.ts`
- Modify: `fe/src/pages/admin/system/grants/GrantsDialogs.tsx`
- Modify: `fe/src/pages/admin/system/grants/grantFormSchema.ts`
- Modify: `fe/src/pages/admin/system/grants/grants.smoke.test.tsx`
- Modify: `fe/src/pages/admin/system/rls/RlsAdminPage.tsx`
- Modify: `fe/src/pages/admin/system/rls/RlsRoleBindingPanel.tsx`
- Create: `fe/src/pages/admin/system/rls/RlsDimensionValuesPanel.tsx`
- Create: `fe/src/pages/admin/system/rls/RlsRoleBindingPanel.test.tsx`
- Create: `fe/src/pages/admin/system/rls/RlsDimensionValuesPanel.test.tsx`

**Interfaces:**
- Consumes: `GET /resource-grants/resources`、批量授权、RLS binding GET/PUT
- Consumes: RLS 维度类型 PATCH/DELETE（引用冲突 409）

- [ ] **Step 1: 写资源选择器失败测试**

覆盖按类型调用 `GET /resource-grants/resources`、显示名称、多选、批量提交、已删除资源标记、report 类型禁用 grant 和批量回滚错误提示。

- [ ] **Step 2: 替换手工 UUID 输入**

保留 ID 作为次级信息，不允许普通路径自由输入任意 UUID；资源列表加载失败时禁止提交。

- [ ] **Step 3: 写 RLS 防覆盖与维度类型失败测试**

覆盖：

- 选角色后先 GET groups 与 dimension-values；
- 加载中/失败时保存禁用；
- 回显已有绑定；
- 空绑定保存弹二次确认；
- 409 后刷新并保留用户未提交选择；
- 维度类型编辑、删除成功；被绑定引用时删除返回 409 并提示。

- [ ] **Step 4: 实现 RLS 安全交互与维度类型 UI**

`RlsDimensionValuesPanel` 管理 direct values；`RlsRoleBindingPanel` 管理 groups。PUT 携带 `expectedVersion` 和 `confirmEmpty`；成功后更新本地 version。`RlsAdminPage` 补齐维度类型编辑/删除对话框，对接现有 `PATCH/DELETE /api/v1/rls/dimensions/{id}`。

- [ ] **Step 5: 验证**

```powershell
cd fe
npx vitest run src/pages/admin/system/grants/ src/pages/admin/system/rls/
```

---

### Task 13: 审计标签、文档与端到端验收

**Files:**
- Modify: `fe/src/pages/admin/system/audit/audit-display.ts`
- Modify: `fe/src/pages/admin/system/audit/audit-display.test.ts`
- Create: `tests/test_auth_security_e2e.py`
- Modify: `docs/superpowers/specs/2026-07-13-permission-security-production-core-design.md`（§5.1 权限目录、§9 owner/grant、§13 bootstrap 门禁）
- Modify: `docs/automate/prd/F02-AUTH.md`
- Modify: `docs/services/auth.md`
- Modify: `docs/api/README.md`
- Modify: `docs/ui/layout.md`
- Modify: `docs/arch.md`（bootstrap/锁定环境变量）
- Modify: `backend/.env.example`
- Modify: `fe/src/components/README.md`
- Modify: `tests/test_auth_rbac_l1.py`（grant 幂等、effective-dimensions 兼容）

**Interfaces:**
- Produces: 三类真实用户验收证据
- Produces: 文档与实现一致状态

- [ ] **Step 1: 补审计动作标签测试与实现**

至少覆盖（**保留现有 action 名**，新增别名仅作显示映射）：

```text
user.disable
user.enable
user.unlock
user.lock
user.password.reset
role.permissions.replace
resource_grant.batch.create
resource_grant.delete
role.group.replace          # groups PUT（保持现名，UI 标签可写「RLS 分组」）
role.dimension_values.replace # values PUT（新增，与 group 对称）
```

`audit-display.ts` 同时为 `role.rls_groups.replace` 提供显示别名指向 `role.group.replace`，避免 FE 漏翻。

- [ ] **Step 2: 写端到端越权测试**

创建：

1. root：admin全功能；
2. security_admin：显式授予 `system:role.read`、`system:role.manage`、`system:user.read`、`system:user.manage`、`system:user.password.reset`、`system:grant.read`、`system:grant.manage`、`system:rls.read`、`system:rls.manage`、`system:org.read`、`system:org.manage`、`system:audit.read`，不得授予 `system:*` 通配或任何业务域权限；
3. analyst：指定 datasource/dashboard 资源 + 指定 RLS 值。

report catalog E2E 必须在**同一测试进程**内先 `POST /reports/catalog/nodes` 创建节点（自动登记 owner），再断言 ACL；不得假设跨进程持久节点。

直接调用 API 验证 401/403/200 与 RLS 行结果，不通过浏览器模拟替代。每个 datasource/dashboard/report 资源域都必须包含三组组合用例：

1. 有功能权限、无资源 entitlement（既非 owner 也无 grant）→ 403/列表不可见；
2. 有资源 grant、无对应功能权限 → 403；
3. 同时具备功能权限与 owner/grant → 200；datasource 查询再断言 RLS 只返回授权行。

- [ ] **Step 3: 运行后端全验收**

```powershell
cd backend
python -m pytest ../tests -q
```

- [ ] **Step 4: 运行前端全验收**

```powershell
cd fe
npx vitest run src/lib/capabilities.test.ts src/lib/resolve-nav.test.ts src/components/auth/require-capability.test.tsx src/pages/admin/system/ src/routes.smoke.test.tsx src/layouts/AdminLayout.smoke.test.tsx
npm run build
```

- [ ] **Step 5: 同步文档**

必须校正：

- Approved spec §5.1/§9/§13 与计划 Global Constraints 对齐（bootstrap 门禁、dashboard 隐式 entitlement、report grant 禁止）；
- AUTH-006 RLS UI 和 AUTH-008 审计 UI 的旧未完成状态；
- 新权限、用户生命周期、资源授权和 RLS API（含 `GET /resource-grants/resources`）；
- `auth` 域职责、边界、主要类型；
- `docs/arch.md` 与 `backend/.env.example` 登记 bootstrap/锁定参数；
- 403 页面语义；
- `RequireCapability` 服务端权限消费说明；
- 被新契约推翻的旧测试（grant 409 → 幂等、JWT admin fallback 等）。

---

## 执行顺序

```text
Task 1 → Task 2 → Task 3 → Task 4 → Task 5
                         ├→ Task 6
                         └→（Task 5 与 Task 6 汇合）→ Task 7
Task 7 → Task 8 → Task 9
Task 4+5 → Task 10 → Task 11
Task 8+9+10 → Task 12
全部完成 → Task 13
```

可并行项：

- Task 6 与 Task 5 在 Task 4 后可并行，但 Task 7 必须等待二者完成并共同跑 auth 回归，避免新增 lifecycle 路由漏加权限依赖。
- Task 11 可在 Task 5/6 API 契约稳定后与 Task 8/9 后端并行。
- Task 9 的 dashboard/report ACL 必须串行逐域接入。

## 整体验证方案

### 后端门禁

```powershell
cd backend
python -m pytest ../tests -q
python -m alembic upgrade head --sql
```

### 前端门禁

```powershell
cd fe
npx vitest run src/lib/capabilities.test.ts src/lib/resolve-nav.test.ts src/components/auth/require-capability.test.tsx src/pages/admin/system/ src/routes.smoke.test.tsx src/layouts/AdminLayout.smoke.test.tsx
npm run build
```

### 手动验收

1. root 登录，确认所有系统菜单和业务资源可访问。
2. 创建安全管理员角色，只授予用户/角色/RLS/审计权限，确认不能访问数据源业务页面和 API。
3. 创建分析角色，授权单个数据源和 Dashboard，确认其他资源不可见。
4. 配置 RLS 分组，确认分析用户只能查询授权值。
5. 刷新 RLS 页面，确认已有绑定正确回显；模拟并发修改，确认第二次保存收到 409。
6. 禁用用户后确认现有 token 请求被拒；解锁后重新登录成功。
7. 查看审计详情，确认无密码、token、credential 或完整 SQL。

## 风险与回退

- 0024 只扩展 schema；若应用部署失败，可先回退应用而不降级数据库。
- 0025 回填前备份 auth 表；自定义角色不自动扩权，避免权限扩大。
- 关闭旧 capability 映射前必须确认 `/me.permissions` 已在生产稳定返回。
- 跨域 ACL 每次只接一个资源域；若回归失败，回退该域消费点，不回退权限核心。
- 任意 root 不变量测试失败时停止上线，不允许人工绕过。

## 自审结果

- **规格覆盖：** 设计 §5–§16 均有对应任务。
- **占位扫描：** 无 TBD/TODO/“适当处理”等不可执行描述。
- **类型一致性：** 统一采用 `permissionVersion`、`rlsVersion`、`expectedVersion`、`confirmEmpty`。
- **范围控制：** 未纳入 LDAP/OIDC/MFA/多租户/审批流。
- **可验证性：** 每个任务均包含失败测试、实现接口和精确命令。
- **已知依赖：** Task 9 已明确 report catalog 仍为进程内存实现；datasource grant-only、dashboard `created_by` 隐式授权、report 禁止持久 grant 已在 Global Constraints 写死；Task 13 同步 Approved spec。
- **下一步：** 计划需二次 `plan-review` 收敛后再执行。
