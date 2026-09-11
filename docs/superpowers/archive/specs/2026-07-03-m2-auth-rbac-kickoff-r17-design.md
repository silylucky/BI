# M2 AUTH RBAC 地基 kickoff r17 设计 — AUTH-001 / AUTH-002 / AUTH-003 / AUTH-004 / AUTH-005

```yaml
date: 2026-07-03
milestone: M2
round_target: docs/superpowers/evolution/2026-07-03-round-target-r17.md
prd_ids: [AUTH-001, AUTH-002, AUTH-003, AUTH-004, AUTH-005]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | RoleRegistry 角色注册 | AUTH-001 | 1 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 租户管理员可通过 API 注册/查询平台角色 |
| 2 | 组织树配置 | AUTH-002 | 2 | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 可配置多级组织节点，支撑按组织维度的权限分配 |
| 3 | 用户角色绑定 | AUTH-003 | 3 | 完整度 **5%→≥60%**；安全性 **10%→≥40%** | 管理员可为用户分配/撤销角色；鉴权链可解析有效角色集 |
| 4 | 资源授权绑定 | AUTH-004 | 4 | 完整度 **5%→≥60%**；安全性 **11%→≥40%** | 角色可被授权访问指定资源类型与实例 |
| 5 | 权限维度类型定义 | AUTH-005 | 5 | 完整度 **5%→≥60%**；架构 **11%→≥40%** | 租户可定义权限维度类型，为后续 RLS 提供配置入口 |

**依赖链**：AUTH-001 角色表 → AUTH-002 组织树 → AUTH-003 用户-角色绑定（FK 角色）→ AUTH-004 资源授权（FK 角色）→ AUTH-005 维度类型（可引用组织维度 code）→ Alembic `0003` 单 revision 落库 → 全量 pytest smoke。

**plan.md 状态说明**：`plan.md` 当前无 M2 活跃节（M1+M1B 全 `[x]`）。本轮立项来源为 `plan.archive.md` §M2 + hub 8 维；**禁止**修改 `plan.md` 结构（SOP 红线）；P5 仅勾选已有 `- [ ]` 行。若需 M2 活跃节，须人工 `create-evolution-plan`。

**上轮已交付（本轮不重复）**：

- M1 BOOT-003：`AuthMiddleware`、`get_current_user`、`GET /api/v1/me`、`Bearer dev` 开发占位
- M1B ingestion：元库 `database_url` + Alembic `0001`/`0002` 模式可复用

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `backend/app/auth/middleware.py` | `Bearer dev` → 硬编码 `UserContext(id="dev", roles=["admin"])`；无 DB 角色解析 |
| `backend/app/auth/deps.py` | `UserContext` 为 Pydantic 占位；`get_current_user` 读 `request.state.user` |
| `backend/app/api/v1/router.py` | 仅挂载 `me`、`ingestion`；无 roles/orgs/users/rls 路由 |
| `backend/migrations/versions/` | head=`0002`（ingestion 三表）；无 auth 表 |
| `docs/api/README.md` | 已登记 `/api/v1/roles`、`/orgs`、`/users`、`/rls/dimensions` 为「规划」；**无**资源授权独立路由行（本轮 P3 同步登记） |
| `docs/services/auth.md` | M1 骨架已实现；`PermissionService`/`RlsPolicyService` 待建 |
| `tests/test_auth.py` / `test_me.py` | 鉴权矩阵与 `me` 契约已绿；无 RBAC CRUD 用例 |

**范围框定模块**（3）：`backend/app/auth/`、`backend/app/api/v1/`（auth 路由入口）、`backend/migrations/` + `tests/`。

**真理源优先级**：`round-target` > `prd/F02-AUTH.md` > `docs/api/README.md` > `docs/services/auth.md`。

**本轮性质**：M2 新功能 L1 立项（模型 + 迁移 + CRUD API + pytest smoke），**纯后端 API**；不含 Admin 权限配置 UI。

## 3. 架构设计

### 3.1 分层与目录

遵循 `common.mdc` entry → use-case → domain：

```
backend/app/auth/
├── models.py              # SQLAlchemy 元模型 + get_meta_session（复用 ingestion 模式）
├── schemas.py             # 跨子域 Pydantic DTO（Create/Update/Out）
├── roles/service.py       # RoleRegistry CRUD + code 唯一校验
├── org/service.py         # 组织树 CRUD + 环检测 + path/level 维护
├── users/service.py       # 最小用户注册 + 用户-角色绑定/解绑/列表
├── resources/service.py   # 资源授权 CRUD + check_resource_access 守卫
├── rls/dimensions/service.py  # 维度类型 CRUD + 删除保护
└── middleware.py, deps.py # 既有；deps 扩展 resolve_roles_for_user（L1 挂钩）

backend/app/api/v1/
├── roles.py
├── orgs.py
├── users.py               # 用户绑定 + 最小用户 POST（供测试 FK）
├── resource_grants.py     # AUTH-004 专用入口
├── rls.py                 # dimensions 子路由
└── router.py              # 注册新 router
```

**元库**：与 ingestion 共用 `Settings.database_url` 平台元库；表名统一 `auth_*` 前缀，避免与 `ingestion_*` 冲突。

### 3.2 数据模型（Alembic `0003_auth_tables.py`）

| 表名 | 用途 | 关键字段与约束 |
|------|------|----------------|
| `auth_roles` | AUTH-001 | `id` UUID PK；`code` VARCHAR(64) UNIQUE NOT NULL；`name`；`description` TEXT nullable；`created_at`/`updated_at` |
| `auth_org_nodes` | AUTH-002 | `id` UUID PK；`parent_id` UUID FK self nullable；`name`；`path` VARCHAR(512) NOT NULL；`level` INT NOT NULL；`created_at` |
| `auth_users` | AUTH-003 最小用户 | `id` UUID PK；`username` VARCHAR(128) UNIQUE NOT NULL；`created_at` |
| `auth_user_roles` | AUTH-003 绑定 | `user_id` FK `auth_users`；`role_id` FK `auth_roles`；UNIQUE(`user_id`,`role_id`)；`created_at` |
| `auth_resource_grants` | AUTH-004 | `id` UUID PK；`role_id` FK；`resource_type` VARCHAR(32)；`resource_id` UUID；UNIQUE(`role_id`,`resource_type`,`resource_id`)；`created_at` |
| `auth_dimension_types` | AUTH-005 | `id` UUID PK；`code` UNIQUE；`name`；`value_type` VARCHAR(32)；`org_dimension` BOOL default false；`description` nullable；`created_at` |

**组织树 path 策略（L1）**：邻接表 + 物化路径。根节点 `parent_id=NULL`，`path='/{id}'`，`level=0`；子节点 `path=parent.path + '/{id}'`，`level=parent.level+1`。移动节点时递归更新子树 path（单事务）。

**资源类型枚举（L1）**：`Literal["datasource", "dashboard", "report"]`；`resource_id` 为 UUID 占位，与 M3 `dataSourceId` 兼容；不做跨表 FK 至未实现域。

**维度 value_type 枚举（L1）**：`string` | `number` | `boolean` | `org_ref`。当 `value_type=org_ref` 时，`org_dimension=true` 且服务层校验 `auth_org_nodes` 至少存在一棵非空树（软关联 via code 命名约定：`org` 维度类型 code 建议 `organization`）。

### 3.3 API 契约（对齐 `docs/api/README.md` 并补 AUTH-004）

错误体统一：`{"code": "<SNAKE>", "message": "...", "detail": ...}`（与 ingestion/auth 既有 401 体一致）。

| 方法 | 路径 | PRD | 行为摘要 |
|------|------|-----|----------|
| GET | `/api/v1/roles` | AUTH-001 | 列表（分页 L1 可省略，返回 `items[]`） |
| POST | `/api/v1/roles` | AUTH-001 | 创建；重复 `code` → 409 `ROLE_CODE_CONFLICT` |
| GET | `/api/v1/roles/{id}` | AUTH-001 | 详情；不存在 → 404 |
| PUT | `/api/v1/roles/{id}` | AUTH-001 | 更新 name/description；`code` 不可变 |
| DELETE | `/api/v1/roles/{id}` | AUTH-001 | 删除；若存在 user_role 或 resource_grant 引用 → 409 `ROLE_IN_USE` |
| GET | `/api/v1/orgs` | AUTH-002 | 扁平列表含 `parent_id`/`path`/`level`（L1 不做嵌套 JSON 树） |
| POST | `/api/v1/orgs` | AUTH-002 | 创建节点；非法 `parent_id` → 404；环 → 409 `ORG_CYCLE` |
| GET | `/api/v1/orgs/{id}` | AUTH-002 | 详情 |
| PUT | `/api/v1/orgs/{id}` | AUTH-002 | 更新 name 或 `parent_id`（移节点）；有子节点删除 → 409 `ORG_HAS_CHILDREN` |
| DELETE | `/api/v1/orgs/{id}` | AUTH-002 | 有子节点 → 409 `ORG_HAS_CHILDREN` |
| POST | `/api/v1/users` | AUTH-003 | 最小用户创建（测试与绑定前置）；重复 username → 409 |
| GET | `/api/v1/users/{id}/roles` | AUTH-003 | 用户角色列表 |
| PUT | `/api/v1/users/{id}/roles` | AUTH-003 | body `{ "role_ids": [uuid, ...] }` 全量替换绑定 |
| POST | `/api/v1/users/{id}/roles/{role_id}` | AUTH-003 | 单条绑定；幂等重复 → 200 不变 |
| DELETE | `/api/v1/users/{id}/roles/{role_id}` | AUTH-003 | 解绑；不存在 → 404 `BINDING_NOT_FOUND` |
| GET | `/api/v1/resource-grants` | AUTH-004 | 可按 `role_id`/`resource_type` query 过滤 |
| POST | `/api/v1/resource-grants` | AUTH-004 | 创建授权；非法 role → 404；重复三元组 → 409 |
| DELETE | `/api/v1/resource-grants/{id}` | AUTH-004 | 撤权 |
| GET | `/api/v1/rls/dimensions` | AUTH-005 | 维度类型列表 |
| POST | `/api/v1/rls/dimensions` | AUTH-005 | 注册；重复 code → 409 |
| GET/PUT/DELETE | `/api/v1/rls/dimensions/{id}` | AUTH-005 | 详情/更新/删除；被维度分组引用保护留 AUTH-006（L1 仅检查 code 被 `org_dimension` 配置引用时禁止删） |

**鉴权（L1）**：所有上表路由经 `AuthMiddleware` + `Depends(get_current_user)`；不实现管理员角色校验（全员 `Bearer dev` 可操作，与 M1 一致）。资源守卫通过 `resources/service.check_resource_access(role_codes, resource_type, resource_id) -> bool` 供测试与后续 query 域消费。

**`get_current_user` 挂钩（AUTH-003 L1）**：

- 新增 `resolve_user_roles(session, user_id: str) -> list[str]`：查 `auth_user_roles` JOIN `auth_roles` 返回 role `code` 列表。
- `AuthMiddleware` 在 `Bearer dev` 分支：若 `auth_users` 存在 `username='dev'`，用 DB 角色覆盖硬编码；否则保持 `["admin"]` 向后兼容。
- `GET /api/v1/me` 响应 `roles` 反映 DB 解析结果（现有 `test_me` 用例须在无 dev 用户时仍断言 `["admin"]`）。

### 3.4 方案比选（摘要）

#### 3.4.1 元库 Session 复用

| 方案 | 说明 | 结论 |
|------|------|------|
| A `auth/models.py` 独立 `get_meta_engine`（复制 ingestion 模式） | 零跨域重构；≤30 行重复 | **采用** |
| B 抽取 `core/meta_db.py` 统一引擎 | 需改 ingestion import；超范围 | 否决 |
| C 每请求新建 engine | 性能差 | 否决 |

#### 3.4.2 组织树存储

| 方案 | 说明 | 结论 |
|------|------|------|
| A 邻接表 + 物化 `path`/`level` | 与 round-target 验收一致；移节点 O(subtree) 可接受 L1 | **采用** |
| B 嵌套集合 | 写放大复杂 | 否决 |
| C 仅邻接表无 path | 不满足 round-target path/level 条款 | 否决 |

#### 3.4.3 用户模型范围

| 方案 | 说明 | 结论 |
|------|------|------|
| A 最小 `auth_users` 表 + 绑定 API | 满足非法 userId 4xx；不实现完整 IAM | **采用** |
| B 纯字符串 user_id 无用户表 | 无法区分非法用户 | 否决 |
| C 完整用户 CRUD + 密码 | 超 round-target；留后续 | 否决 |

#### 3.4.4 资源授权路由

| 方案 | 说明 | 结论 |
|------|------|------|
| A 独立 `/api/v1/resource-grants` | 清晰；P3 补 `docs/api/README.md` 一行 | **采用** |
| B 嵌套 `/api/v1/roles/{id}/grants` | 与 README 未登记 | 否决（可作未来别名） |

## 4. 范围框定文件清单（18 项）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/auth/models.py` | 全部 | 新建：6 表 ORM + session |
| `backend/app/auth/schemas.py` | 全部 | 新建：请求/响应 DTO |
| `backend/app/auth/roles/service.py` | AUTH-001 | 新建 |
| `backend/app/auth/org/service.py` | AUTH-002 | 新建 |
| `backend/app/auth/users/service.py` | AUTH-003 | 新建 |
| `backend/app/auth/resources/service.py` | AUTH-004 | 新建 |
| `backend/app/auth/rls/dimensions/service.py` | AUTH-005 | 新建 |
| `backend/app/auth/deps.py` | AUTH-003 | 扩展 `resolve_user_roles` |
| `backend/app/api/v1/roles.py` | AUTH-001 | 新建 |
| `backend/app/api/v1/orgs.py` | AUTH-002 | 新建 |
| `backend/app/api/v1/users.py` | AUTH-003 | 新建 |
| `backend/app/api/v1/resource_grants.py` | AUTH-004 | 新建 |
| `backend/app/api/v1/rls.py` | AUTH-005 | 新建 |
| `backend/app/api/v1/router.py` | 全部 | 注册 5 个 router |
| `backend/migrations/versions/0003_auth_tables.py` | 全部 | 新建 revision |
| `tests/test_auth_rbac_l1.py` | 全部 | 新建：五域 smoke 合集 |
| `tests/test_migrations.py` | 全部 | 扩展：head=`0003`、SQL 含 `auth_roles` |
| `docs/api/README.md` | AUTH-004 | 登记 `resource-grants` 路由行（P3 同步） |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/auth/middleware.py` | 鉴权链；dev token 分支 |
| `backend/app/api/v1/me.py` | `UserContext` 响应契约 |
| `backend/app/ingestion/models.py` | 元库 engine/session 模式 |
| `backend/app/api/v1/ingestion/sync.py` | entry 薄层 + `_db()` 依赖模式 |
| `tests/conftest.py` | `client`/`auth_headers` fixture |
| `tests/test_auth.py` | 既有鉴权矩阵（保持绿） |
| `docs/automate/prd/F02-AUTH.md` | 验收与代码锚点 |
| `docs/services/auth.md` | 域边界（P3 更新状态） |

**文件计数**：新建 **15** + 修改 **3** = **18 ≤ 20**。

## 5. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- AUTH-006/007/008（维度分组、RLS 注入、审计日志）
- M3+ 数据源/连接器实现
- Admin 权限配置 UI（`fe/` 无改动）
- 完整用户 IAM（登录、密码、会话签发 — BOOT-003 login 仍规划）
- 租户多实例隔离 / 多租户 schema
- 预置业务角色或场景包（goal G4：平台不预置）
- PRD AUTH-003「变更有审计记录」（依赖 AUTH-008，留 r18+）
- 生产环境管理员角色校验 / 水平越权完整拦截（AUTH-004 L1 仅 service 级 smoke）
- 组织用户绑定（PRD AUTH-002 第二条留后续）
- OpenAPI 以外的 GraphQL/gRPC

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 | 可测验收信号 |
|--------|------------------|--------------|--------------|
| AUTH-001 | 完整度 5%；可靠性 0% | 6 字段 Role 模型 + 全 CRUD + code 唯一 409 + 422 校验 | T-AUTH-R01~06 全绿 |
| AUTH-002 | 完整度 5%；架构 8% | path/level 物化路径；环/孤儿/有子删除 409 | T-AUTH-O01~06 全绿 |
| AUTH-003 | 完整度 5%；安全性 10% | FK 校验；绑定幂等；`resolve_user_roles` 挂钩 me | T-AUTH-U01~06 全绿 |
| AUTH-004 | 完整度 5%；安全性 11% | resource_type 枚举；`check_resource_access` smoke | T-AUTH-G01~05 全绿 |
| AUTH-005 | 完整度 5%；架构 11% | 可扩展 value_type；org_ref 与组织树软关联 | T-AUTH-D01~05 全绿 |

**P5 重评预期**：AUTH-001~005 完整度由 5% 升至 L1 档位（≥60% 由评分器计算）；可靠性/安全性/测试覆盖由 0% 获得 smoke 支撑。具体分值不在设计预设。

## 7. 子项详细设计与验收标准

### 7.1 AUTH-001 — RoleRegistry

**服务规则**：

- `code`：`^[a-z][a-z0-9_]{1,63}$`（与 BI 资源 code 风格一致）
- 删除前检查 `auth_user_roles` 与 `auth_resource_grants` 引用

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-R01 | POST 创建角色 roundtrip | 201；GET 列表含 id；字段 code/name/description 一致 |
| T-AUTH-R02 | 重复 code | 第二次 POST → 409 `ROLE_CODE_CONFLICT` |
| T-AUTH-R03 | 非法 code（大写/空格） | POST → 422 |
| T-AUTH-R04 | PUT 更新 name | 200；GET 详情 name 变更；code 不变 |
| T-AUTH-R05 | DELETE 空闲角色 | 204；GET → 404 |
| T-AUTH-R06 | OpenAPI 含 `/api/v1/roles` | `GET /openapi.json` paths 含 roles CRUD |

**验收标准（可测试）**：

- [ ] `auth_roles` 表存在于 `0003` migration
- [ ] `pytest tests/test_auth_rbac_l1.py -k R01` 段全绿
- [ ] `cd backend && ruff check .` 无新增违规

### 7.2 AUTH-002 — 组织树

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-O01 | 建根 + 子节点 | 根 level=0 path=`/{id}`；子 level=1 path 含父 |
| T-AUTH-O02 | 非法 parent_id | POST → 404 `ORG_PARENT_NOT_FOUND` |
| T-AUTH-O03 | 移节点成环 | PUT parent 指向子孙 → 409 `ORG_CYCLE` |
| T-AUTH-O04 | 删除有子节点 | DELETE → 409 `ORG_HAS_CHILDREN` |
| T-AUTH-O05 | 移节点更新子树 path | 移中间节点后子孙 path 前缀正确 |
| T-AUTH-O06 | GET 列表含 parent_id/path/level | 字段齐全 |

**验收标准（可测试）**：

- [ ] `auth_org_nodes` 表含 `parent_id`/`path`/`level`
- [ ] T-AUTH-O01~06 全绿

### 7.3 AUTH-003 — 用户角色绑定

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-U01 | 创建用户 + 绑定角色 | POST user；POST bind；GET roles 含 code |
| T-AUTH-U02 | 绑定幂等 | 重复 POST bind → 200；DB 仅一行 |
| T-AUTH-U03 | 非法 roleId | bind 随机 UUID → 404 |
| T-AUTH-U04 | 解绑不存在 | DELETE → 404 `BINDING_NOT_FOUND` |
| T-AUTH-U05 | PUT 全量替换 role_ids | 旧绑定清除；新列表生效 |
| T-AUTH-U06 | me 角色解析 | 创建 dev 用户并绑定 `viewer`；GET /me roles 含 `viewer`（专用 fixture 隔离） |

**验收标准（可测试）**：

- [ ] `auth_users` + `auth_user_roles` 表存在
- [ ] T-AUTH-U01~06 全绿；`test_me.py` 既有用例无回归

### 7.4 AUTH-004 — 资源授权

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-G01 | POST 授权 datasource | 201；GET 列表含条目 |
| T-AUTH-G02 | 重复授权 | 409 `GRANT_ALREADY_EXISTS` |
| T-AUTH-G03 | 非法 role_id | 404 |
| T-AUTH-G04 | check_resource_access 正向 | 授权角色 → True |
| T-AUTH-G05 | check_resource_access 负向 | 未授权角色 → False |

**验收标准（可测试）**：

- [ ] `auth_resource_grants` 含 `resource_type`/`resource_id`/`role_id`
- [ ] `resource_type` 接受 `datasource` 且拒绝未知类型 422
- [ ] T-AUTH-G01~05 全绿

### 7.5 AUTH-005 — 权限维度类型

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-D01 | POST 注册维度类型 | 201；code/name/value_type 回显 |
| T-AUTH-D02 | 重复 code | 409 |
| T-AUTH-D03 | org_ref 类型 | `value_type=org_ref` 时 `org_dimension=true` |
| T-AUTH-D04 | PUT 更新 name | 200 |
| T-AUTH-D05 | DELETE 空闲类型 | 204 |

**验收标准（可测试）**：

- [ ] `auth_dimension_types` 表存在
- [ ] 可创建 code=`organization` 的 org 维度类型（与 AUTH-002 软关联）
- [ ] T-AUTH-D01~05 全绿

### 7.6 迁移与测试基建

**`0003_auth_tables.py`**：`down_revision = "0002"`；`upgrade` 创建 6 表及索引；`downgrade` 逆序 drop。

**`tests/test_auth_rbac_l1.py` 基建**：

```python
# 模块级 sqlite shared memory（对齐 test_ingestion_api.py）
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///file:auth_rbac_test?mode=memory&cache=shared&uri=true"
# autouse fixture: auth Base.metadata.create_all(get_meta_engine())
```

**`tests/test_migrations.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-MIG-32 | revision 链 head=`0003` | heads 输出含 0003；0003.down_revision==0002 |
| T-MIG-33 | upgrade --sql 含 auth_roles | subprocess alembic upgrade head --sql |

## 8. UI 设计交付

**`ui_design_skill`**: `none`（本轮范围框定不含 `fe/` 前端文件；round-target 明确「本期仅 API L1，FE 壳层后续轮次」）。

| 项 | 说明 |
|----|------|
| 页面 IA | 不适用；后续轮次在 Admin「系统设置 → 权限管理」落地 |
| 视觉层级 | 不适用 |
| 组件映射 | 不适用 |
| Token 与密度 | 不适用 |
| 响应式/a11y | 不适用 |
| 视觉 QA | P4 跳过 UI 截图；仅 backend pytest |

## 9. 文档同步（P3/P5 执行，设计预登记）

| 变更 | 文档 |
|------|------|
| 新增 auth 路由 | `docs/api/README.md` §权限 + `resource-grants` 行 |
| 域职责落地 | `docs/services/auth.md` 状态与类型表 |
| PRD 验收勾选 | `prd/F02-AUTH.md` AUTH-001~005（P5） |
| 架构目录 | `docs/arch.md` §4 auth 子目录（若与子包一致） |

## 10. 验证命令（P4 参考）

```bash
cd backend && python3 -m ruff check . && python3 -m pytest -v
```

预期：既有 273+ 用例保持绿 + `test_auth_rbac_l1.py` 新增约 28 项 + `test_migrations.py` T-MIG-32~33。

## 11. Self-review 清单

- [x] 覆盖 round-target 五项 AUTH-001~005
- [x] 文件清单 18 项，未超范围框定模块
- [x] 无 TBD/TODO 占位
- [x] 纯后端：`ui_design_skill: none` 已记录
- [x] 非目标与 AUTH-006~008 边界清晰
- [x] plan.md 无 M2 活跃节已说明，不构成本轮 BLOCKED
