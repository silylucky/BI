# M3 数据源平台 companion kickoff r25 设计 — DS-008 / DS-007 / DS-004 / CONN-002 / DS-006

```yaml
date: 2026-07-03
milestone: M3
round_target: docs/superpowers/evolution/2026-07-03-round-target-r25.md
prd_ids: [DS-008, DS-007, DS-004, CONN-002, DS-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | 数据源授权与 M7 集成（L1） | DS-008 | 5（贯穿路由守卫） | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 列表/详情/测试/元数据仅见已授权 `dataSourceId`；越权 403 |
| 2 | 已注册类型清单 API | DS-007 | 1 | 完整度 **5%→≥60%**；用户价值 **54%→≥70%** | 建源前可查询平台支持的连接器类型（含 MySQL、PostgreSQL） |
| 3 | Schema 元数据浏览 | DS-004 | 3 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 选定数据源后可浏览 schema / table / column，无需手写 SQL |
| 4 | PostgreSQL 连接器 | CONN-002 | 2 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 可选择 `postgresql` 类型创建数据源并通过连通测试与元数据浏览 |
| 5 | 连接池按 dataSourceId 隔离 | DS-006 | 4 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 多数据源并发测试/浏览互不干扰；删源释放池 |

**依赖链**：CONN-002 `dialects/postgres.py` 注册 → DS-007 `GET /types` 暴露双方言 → DS-006 `pool.py` 隔离连接 → DS-004 元数据 API（经池 + 方言）→ DS-008 `acl.py` 守卫全部 `{id}` 路由与列表过滤 → pytest companion smoke 全绿。

**上轮已交付（本轮不重复）**：DS-001/002/003/005 + CONN-001（r22–r24）；`ConnectorRegistry` + `export_type_catalog()`；`AuthResourceGrant.resource_type=datasource`（M2）；`require_resource_visible` / `list_visible_resource_ids`（`auth/resources/service.py`）；`delete_data_source` 已检查 grant 引用（409 `DATASOURCE_IN_USE`）。

**plan.md 状态说明**：M1+M1B 全 `[x]`，无活跃 M3 节；立项来源 `plan.archive.md` §M3 剩余 5 项；**禁止**修改 `plan.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `registry.py` | `ConnectorRegistry` + `export_type_catalog()` 已存在；仅注册 `mysql` |
| `dialects/base.py` | `DialectConnector` Protocol 仅含 `test_connection`；`capabilities` L1 为 `("connectivity_test",)` |
| `service.py` | CRUD + 连通测试；**无** ACL 过滤；**无**池；直连 `connector.test_connection` |
| `api/v1/datasources.py` | 8 路由已实现；**无** `/types`、`/schemas`、`/tables`、`/columns` |
| `docs/api/README.md` | 元数据与 types 路由已登记为「规划」 |
| `pyproject.toml` | 已含 `psycopg[binary]>=3.2.0`（范围外只读确认） |
| M2 AUTH | `auth_resource_grants` + `ensure_resource_visible`；**无** admin 全局 bypass（本轮在 `acl.py` L1 补齐） |

**范围框定模块**（2）：`backend/app/datasources/`、`backend/app/api/v1/`（datasources 路由扩展）+ `tests/`。

**真理源优先级**：`round-target` > `prd/F03-DS.md` + `prd/F04-CONN.md` > `docs/api/README.md`。

**本轮性质**：M3 companion L1（类型发现 + PG 方言 + 连接池 + 元数据浏览 + 授权守卫 + pytest smoke），**纯后端 API**；不含 Admin UI、不含 M7 RLS 执行链。

## 3. 架构设计

### 3.1 目标目录结构

```
backend/app/datasources/
├── acl.py                   # DS-008：可见性守卫（薄封装 auth + admin bypass）
├── pool.py                  # DS-006：按 dataSourceId 隔离的连接池管理器
├── metadata/
│   ├── __init__.py
│   └── service.py           # DS-004：编排池 + 方言元数据查询
├── dialects/
│   ├── base.py              # 扩展 Protocol：元数据 + 连接工厂
│   ├── errors.py            # 增 PG 错误码映射
│   ├── mysql.py             # 增 schema_browser 能力与元数据 SQL
│   └── postgres.py          # CONN-002：psycopg 实现
├── registry.py              # DS-007：catalog 增 displayName
├── schemas.py               # 元数据/types 响应 DTO
├── service.py               # 集成 acl、pool、metadata；delete 释放池
└── __init__.py              # register_builtin_dialects 增 Postgres

backend/app/api/v1/
└── datasources.py           # 新路由 + UserContext 传入 service/acl
```

### 3.2 DS-007 — 已注册类型清单 API

**路由**：`GET /api/v1/datasources/types`（须在 `/{data_source_id}` 之前注册，避免路径冲突）。

**响应体**：

```json
{
  "items": [
    {
      "type": "mysql",
      "displayName": "MySQL",
      "category": "relational",
      "capabilities": ["connectivity_test", "schema_browser"]
    },
    {
      "type": "postgresql",
      "displayName": "PostgreSQL",
      "category": "relational",
      "capabilities": ["connectivity_test", "schema_browser"]
    }
  ]
}
```

**实现**：

- `DialectConnector` 增 `@property display_name -> str`（默认：type 首字母大写映射表；MySQL → `MySQL`，postgresql → `PostgreSQL`）。
- `ConnectorDescriptor` / `export_type_catalog()` 输出 `displayName`（camelCase 序列化）。
- `types.py` **不单独建文件**；逻辑落在 `registry.export_type_catalog()` + `schemas.ConnectorTypeOut`（PRD 锚点 `types.py` 由 registry + schemas 承担，避免超 12 文件/目录软约束）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-DS-TY01 | 默认注册表 `GET /types` 返回 200，`items` 含 `mysql` 与 `postgresql` 各一项 |
| T-DS-TY02 | 每项含 `type`、`displayName`、`category`、`capabilities`；`capabilities` 含 `connectivity_test` |
| T-DS-TY03 | `registry._connectors` 清空后（测试 fixture）`GET /types` 返回 `items: []` |
| T-DS-TY04 | 未认证 → 401 |

### 3.3 CONN-002 — PostgreSQL 连接器

**文件**：`dialects/postgres.py`（单文件；PRD `postgresql/` 子包留远期）。

**注册**：`type = "postgresql"`，`category = "relational"`，`capabilities = ("connectivity_test", "schema_browser")`，`display_name = "PostgreSQL"`。

**驱动**：`psycopg.connect`（项目既定 `psycopg[binary]`）。

**连接参数对齐 DS-002**：

| 字段 | PG 映射 |
|------|---------|
| `host` / `port` / `database` / `username` / `password` | 直连 |
| `connect_timeout_sec` | `connect_timeout`（秒，clamp 1–30） |
| `ssl_mode` | `sslmode`：`disabled`→`disable`，`preferred`→`prefer`，`required`→`require` |
| `charset` / `collation` | L1 忽略（PG 用 database encoding）；不报错 |

**默认端口**：文档与测试草稿使用 `5432`（schema 默认仍由调用方传入 port）。

**错误映射**（`dialects/errors.py` 扩展）：

| 码 | 场景 |
|----|------|
| `PG_CONN_REFUSED` | 连接拒绝 / 主机不可达 |
| `PG_AUTH_FAILED` | 28P01 等认证失败 |
| `PG_TIMEOUT` | 超时 |
| `PG_UNKNOWN_DATABASE` | 3D000 invalid catalog |
| `PG_SSL_ERROR` | SSL 相关 |
| `PG_UNKNOWN` | 其他 OperationalError |

**元数据 SQL（L1）**：

- schemas：`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY 1`（或 `pg_namespace` 等价）
- tables：`information_schema.tables` WHERE `table_schema = $schema` AND `table_type IN ('BASE TABLE','VIEW')`
- columns：`information_schema.columns` WHERE `table_schema` + `table_name`

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-P01 | `registry.get("postgresql")` 成功；`capabilities` 含 `schema_browser` |
| T-CONN-P02 | `test_connection` mock `psycopg.connect` 成功 → `ok=true` |
| T-CONN-P03 | mock `psycopg.OperationalError` 认证失败 → `ok=false`，`code=PG_AUTH_FAILED`，message 无密码 |
| T-CONN-P04 | `list_schemas` / `list_tables` / `list_columns` 单元测试（mock cursor）返回结构化列表 |

**MySQL 对称扩展**：`mysql.py` 同步实现 `list_schemas/tables/columns`（`INFORMATION_SCHEMA`），`capabilities` 增 `schema_browser`。

### 3.4 DS-006 — 连接池按 dataSourceId 隔离

**模块**：`pool.py` — `DataSourcePoolManager` 单例 `pool_manager`。

**核心 API**：

```python
@contextmanager
def pooled_connection(
    data_source_id: uuid.UUID,
    *,
    connector: DialectConnector,
    connect_kwargs: dict,
) -> Iterator[Connection]: ...

def evict_pool(data_source_id: uuid.UUID) -> None: ...
def active_pool_count() -> int: ...  # 测试断言用
```

**隔离语义**：

- 内部 `dict[UUID, _PoolEntry]`，`threading.RLock` 保护。
- 每个 `dataSourceId` 独立 `_PoolEntry`：`queue.Queue` 持有最多 `pool_size` 条原生连接（pymysql / psycopg connection 对象）。
- **禁止**跨 `dataSourceId` 复用连接或混用 connect_kwargs。
- `evict_pool(id)`：`queue` 排空并 `close()` 全部连接，删除 dict 项；`delete_data_source` **必须**调用。

**池参数（L1 可配置）**：

- `ConnectionOptions` 增可选 `pool_size: int = Field(default=2, ge=1, le=10, alias="poolSize")`。
- 未指定时用模块默认 `DEFAULT_POOL_SIZE = 2`。
- **不**新增 `Settings` 字段（超 `datasources/` 范围）。

**调用链**：

- `test_connection_by_id` / `test_connection_draft`：**保持直连**（短生命周期，不经池），避免池污染草稿参数。
- `metadata/service.py` 浏览路径：**必须**经 `pooled_connection`。
- 凭证路径：`service` 层 `decrypt_credential` 后传入 `connect_kwargs`；**禁止** pool 模块触达 ORM 或密文。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-DS-PL01 | 同一 `dataSourceId` 连续两次 `pooled_connection` 复用队列中连接（mock connect 计数） |
| T-DS-PL02 | 不同 `dataSourceId` 各调一次 → `connect` 参数 host/database 不同，互不混用 |
| T-DS-PL03 | `evict_pool(id)` 后 `active_pool_count` 减 1；连接 `close` 被调用 |
| T-DS-PL04 | 并发 4 线程同一 `dataSourceId` 获取连接无异常（threading smoke） |
| T-DS-PL05 | `delete_data_source` 成功后对应池条目不存在 |

### 3.5 DS-004 — Schema 元数据浏览

**路由**（与 `docs/api/README.md` 一致）：

| 方法 | 路径 | 查询参数 | 响应 |
|------|------|----------|------|
| GET | `/api/v1/datasources/{id}/schemas` | — | `{ "items": [{ "name": "public" }] }` |
| GET | `/api/v1/datasources/{id}/tables` | `schema`（required） | `{ "items": [{ "name": "users", "type": "table" }] }` |
| GET | `/api/v1/datasources/{id}/columns` | `schema`, `table`（required） | `{ "items": [{ "name": "id", "dataType": "uuid", "nullable": false }] }` |

**编排**（`metadata/service.py`）：

1. 加载 `DataSource` 行；解密密码。
2. `acl.assert_visible(session, roles, data_source_id)`。
3. `registry.get(row.type)`；检查 `schema_browser` ∈ capabilities，否则 422 `METADATA_NOT_SUPPORTED`。
4. `with pool_manager.pooled_connection(...)` 调用方言 `list_schemas|tables|columns`。
5. 异常映射为 `DataSourceError`（4xx），message 脱敏。

**错误语义**：

| code | HTTP | 场景 |
|------|:----:|------|
| `DATASOURCE_NOT_FOUND` | 404 | 软删或不存在 |
| `RESOURCE_FORBIDDEN` | 403 | DS-008 未授权 |
| `CREDENTIAL_DECRYPT_FAILED` | 500 | 密钥异常 |
| `METADATA_NOT_SUPPORTED` | 422 | 方言无 `schema_browser` |
| `METADATA_CONNECTION_FAILED` | 502 | 目标库不可达（包装方言错误，无密码） |
| `METADATA_TIMEOUT` | 504 | 超时 |
| `METADATA_INVALID_REQUEST` | 400 | 缺 `schema`/`table` 参数 |

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-DS-MD01 | mock 方言 `list_schemas` → `GET .../schemas` 200 + 非空 items |
| T-DS-MD02 | `GET .../tables` 无 schema → 400 |
| T-DS-MD03 | `GET .../columns?schema=s&table=t` mock 返回列定义 |
| T-DS-MD04 | 错误凭据 mock → 502 + `METADATA_CONNECTION_FAILED`，响应体无 `password` 子串 |
| T-DS-MD05 | 未授权用户 → 403 `RESOURCE_FORBIDDEN` |

### 3.6 DS-008 — 数据源授权与 M7 集成（L1）

**策略**：复用 M2 `auth_resource_grants`（`resource_type="datasource"`），**不新增** Alembic migration；`acl.py` 为域内单一入口。

**`acl.py` API**：

```python
ADMIN_BYPASS_ROLES = frozenset({"admin"})

def list_visible_ids(session, role_codes: list[str]) -> list[uuid.UUID] | None:
    """admin → None 表示不过滤；其他角色 → grant 列表（可空）。"""

def assert_visible(session, role_codes: list[str], data_source_id: uuid.UUID) -> None:
    """不可见 → VisibilityError(RESOURCE_FORBIDDEN, 403)"""

def apply_list_filter(stmt, session, role_codes: list[str]):
    """admin 原样；否则 WHERE id IN visible_ids（空集 → 恒假过滤）"""
```

**守卫范围**：

| 路由 | 行为 |
|------|------|
| `GET /datasources` | `apply_list_filter`；非 admin 无 grant → `items: []`, `total: 0` |
| `GET/PUT/PATCH/DELETE /datasources/{id}` | `assert_visible` |
| `POST /datasources/{id}/test` | `assert_visible` |
| `GET .../schemas|tables|columns` | `assert_visible` |
| `POST /datasources` | 创建者须 `admin` 或后续由 admin 授 grant（L1 不自动授 grant；与 M2 grant API 正交） |
| `POST /datasources/test` | 草稿测试无需 dataSourceId，保持仅 `get_current_user` |

**与 M7 边界**：不实现 RLS 策略执行、行级过滤、query 链注入；仅数据源级可见性。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-DS-AC01 | admin 角色 `GET /datasources` 见全部 |
| T-DS-AC02 | viewer 角色仅 grant 的 id 出现在列表 |
| T-DS-AC03 | viewer `GET /datasources/{他人id}` → 403 `RESOURCE_FORBIDDEN` |
| T-DS-AC04 | viewer `POST /datasources/{他人id}/test` → 403 |
| T-DS-AC05 | 撤权后原可见 id → 403（复用 grant 生命周期） |

### 3.7 方案比选（摘要）

#### 3.7.1 DS-008 授权存储

| 方案 | 说明 | 结论 |
|------|------|------|
| A 复用 `auth_resource_grants` + `acl.py` | 零 migration；与 M2 一致 | **采用** |
| B `data_sources` 增 `owner_user_id` 列 | 需 migration；与 grant 双轨 | 否决（L1） |
| C 完整 M7 RLS | 超 round-target | 否决 |

#### 3.7.2 元数据协议扩展

| 方案 | 说明 | 结论 |
|------|------|------|
| A 扩展 `DialectConnector` 增 `list_*` 方法 | 与 registry get 同路径；capabilities 可发现 | **采用** |
| B 独立 `MetadataProvider` 注册表 | 过度抽象 | 否决 L1 |

#### 3.7.3 连接池实现

| 方案 | 说明 | 结论 |
|------|------|------|
| A 每 dataSourceId 队列 + 原生连接 | 轻量、与 pymysql/psycopg 直连一致 | **采用** |
| B SQLAlchemy `create_engine` per id | 需构建 URL；与现有 test 路径重复 | 否决 L1 |
| C 全局单池 | 违反 DS-006 | 否决 |

#### 3.7.4 PostgreSQL 文件布局

| 方案 | 说明 | 结论 |
|------|------|------|
| A `dialects/postgres.py` 单文件 | 与 mysql 对称；round-target 明示 | **采用** |
| B `dialects/postgresql/` 子包 | PRD 远期锚点 | 留 M7+ |

#### 3.7.5 元数据测试策略

| 方案 | 说明 | 结论 |
|------|------|------|
| A mock 方言 + mock connect | CI 无 Docker；与 r22–r24 一致 | **采用** |
| B compose PG 集成 | `@pytest.mark.integration` 可选 | 不阻塞 L1 |

## 4. 范围框定文件清单（17 项）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/datasources/dialects/postgres.py` | CONN-002 | 新建 |
| `backend/app/datasources/dialects/errors.py` | CONN-002 | 修改：PG 错误映射 |
| `backend/app/datasources/dialects/base.py` | DS-004, CONN-002 | 修改：元数据类型 + Protocol 扩展 |
| `backend/app/datasources/dialects/mysql.py` | DS-004, CONN-001 | 修改：`schema_browser` + list_* |
| `backend/app/datasources/dialects/__init__.py` | CONN-002 | 修改：导出 Postgres |
| `backend/app/datasources/__init__.py` | CONN-002 | 修改：注册 Postgres |
| `backend/app/datasources/registry.py` | DS-007 | 修改：`displayName` in catalog |
| `backend/app/datasources/pool.py` | DS-006 | 新建 |
| `backend/app/datasources/acl.py` | DS-008 | 新建 |
| `backend/app/datasources/metadata/__init__.py` | DS-004 | 新建 |
| `backend/app/datasources/metadata/service.py` | DS-004, DS-006 | 新建 |
| `backend/app/datasources/schemas.py` | DS-004, DS-007 | 修改：元数据/types DTO；`poolSize` |
| `backend/app/datasources/service.py` | DS-006, DS-008 | 修改：acl 过滤、delete evict、metadata 入口 |
| `backend/app/api/v1/datasources.py` | 全部 | 修改：5 类新路由 + roles 传递 |
| `tests/test_datasources_companion_r25.py` | 全部 | 新建：五域 smoke（T-DS-TY/MD/PL/AC + T-CONN-P） |
| `docs/api/README.md` | DS-004, DS-007, CONN-002 | 修改：状态 → 已实现（P3 同步） |
| `docs/services/datasources.md` | 全部 | 修改：边界/能力表（P3 同步） |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/auth/resources/service.py` | `list_visible_resource_ids` / `ensure_resource_visible` 契约 |
| `backend/app/auth/deps.py` | `UserContext.roles` |
| `tests/test_datasources_l1.py` | fixture / registry reset 模式 |
| `tests/test_auth_rbac_l1.py` | grant 创建与 visibility 断言模式 |

## 5. 非目标（明确不做）

- Admin 数据源配置 UI（`fe/` 不在范围）
- M7 完整 RLS 执行链、query 层行级注入（`auth/rls`、`query/`）
- Dataset 元数据（M13）、QUERY 只读出数（M4）
- TiDB / StarRocks 等远期连接器（CONN-021/009）
- `test_connection` 草稿路径接入连接池（保持短连接）
- 创建数据源时自动写入 grant（由 admin 经 `POST /resource-grants` 授權）
- 修改 `goal.md` / `plan.md` 结构
- `dialects/postgresql/` 子包化、SQLAlchemy engine 级连接池

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对齐 | 预期提升 |
|--------|------------------|--------------|----------|
| DS-008 | 完整度 5%、架构 8%、安全性 11% | `acl.py` 列表过滤 + 403 守卫；复用 grant 模型 | 完整度 ≥60%；架构 ≥40% |
| DS-007 | 完整度 5%、用户价值 54% | `GET /types` + displayName/capabilities 可发现 | 完整度 ≥60%；用户价值 ≥70% |
| DS-004 | 完整度 5%、可靠性 0%、安全性 13% | 三级 API + 结构化 4xx/502 + 脱敏 | 完整度 ≥60%；可靠性 ≥40% |
| CONN-002 | 完整度 5%、可靠性 0% | psycopg 方言 + 错误码 + 元数据对称 | 完整度 ≥60%；可靠性 ≥40% |
| DS-006 | 完整度 5%、可靠性 0%、架构 13% | 按 id 隔离池 + evict on delete + 并发 smoke | 完整度 ≥60%；可靠性 ≥40% |

**测试覆盖维**：`test_datasources_companion_r25.py` 目标 ≥25 条 smoke，覆盖五子项成功/失败/边界路径；P4 全量 pytest 回归。

## 7. Spec self-review

- [x] 覆盖 round-target 全部 5 子项
- [x] 文件清单 ≤18（17 项），未超出 `datasources/` + `api/v1/` + tests + 文档
- [x] 无 TBD / TODO 占位
- [x] 路由与 `docs/api/README.md` 登记一致
- [x] DS-008 明确 L1 与 M7 边界
- [x] `ui_design_skill: none`（纯后端，无 UI 设计交付节）
