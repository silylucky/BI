# M3 数据源平台 kickoff r22 设计 — DS-001 / DS-002 / DS-005 / DS-003 / CONN-001

```yaml
date: 2026-07-03
milestone: M3
round_target: docs/superpowers/evolution/2026-07-03-round-target-r22.md
prd_ids: [DS-001, DS-002, DS-005, DS-003, CONN-001]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | ConnectorRegistry 插件注册表 | DS-001 | 1 | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 平台可发现已注册连接器类型（首期 `mysql`）；新增连接器不改核心框架 |
| 2 | 数据源 CRUD API | DS-002 | 2 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 管理员通过 API 创建/查询/更新/删除数据源，获得 `dataSourceId` |
| 3 | 凭证加密存储 | DS-005 | 3 | 完整度 **5%→≥60%**；安全性 **8%→≥50%** | 密码 Fernet 加密入库；API 与日志永不返回明文 |
| 4 | 连通性测试 | DS-003 | 4 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 保存后可测试连通，成功/失败有明确原因 |
| 5 | MySQL 连接器 | CONN-001 | 1（与 DS-001 并行基建） | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 可选择 `mysql` 类型创建数据源并通过连通性测试 |

**依赖链**：DS-001 `ConnectorRegistry` + CONN-001 `dialects/mysql` 注册 → DS-005 `credentials.py` 加解密 → DS-002 `DataSource` 模型 + Alembic `0008` + CRUD API → DS-003 连通性测试（草稿 `/test` + 已保存 `/{id}/test`）→ pytest smoke 全绿。

**plan.md 状态说明**：`plan.md` 当前无 M3 活跃节（M1+M1B 全 `[x]`）。本轮立项来源为 `plan.archive.md` §M3 首批 5 项 + hub 8 维；**禁止**修改 `plan.md` 结构（SOP 红线）；P5 仅勾选已有 `- [ ]` 行。

**上轮已交付（本轮不重复）**：

- M1B ingestion：`SourceConnectionIn/Out`、`encrypt_password`/`decrypt_password`（`ingestion/models.py`）；`SyncJob.source_data_source_id` 预留 FK 位，本轮不桥接
- M2 AUTH：`Bearer dev` + `get_current_user`；`auth_resource_grants.resource_type=datasource` 已为 M7 预留
- `pyproject.toml` 已含 `pymysql>=1.1.0`；`CREDENTIAL_FERNET_KEY` 校验已在 `core/config.py`

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `backend/app/datasources/` | **不存在**（绿field；`docs/services/datasources.md` 登记为骨架） |
| `backend/app/api/v1/router.py` | 挂载 auth + ingestion；**无** datasources router |
| `backend/migrations/versions/` | head=`0007`（`0007_auth_role_active_audit_idx`）；无 datasources 表 |
| `docs/api/README.md` | 已登记 datasources 全路由为「规划」；测试路径为 `/{id}/test`（非 `test-connection`） |
| `backend/app/ingestion/models.py` | Fernet 加解密与连接字段模式可参照；**本轮不抽取**至 `core/`（超范围） |
| `tests/test_migrations.py` | T-MIG-15/34/35 断言 head=`0007`；P3 扩展至 `0008` |
| `tests/conftest.py` | `client` / `auth_headers` fixture 契约可复用 |

**范围框定模块**（3）：`backend/app/datasources/`、`backend/app/api/v1/`（datasources 路由入口）、`backend/migrations/` + `tests/`。

**真理源优先级**：`round-target` > `prd/F03-DS.md` + `prd/F04-CONN.md` > `docs/api/README.md` > `docs/services/datasources.md`。

**本轮性质**：M3 新功能 L1 立项（注册表 + 模型 + 迁移 + CRUD + 连通测试 + MySQL 方言 + pytest smoke），**纯后端 API**；不含 Admin 数据源配置 UI。

## 3. 架构设计

### 3.1 分层与目录

遵循 `common.mdc` entry → use-case → domain：

```
backend/app/datasources/
├── __init__.py              # register_builtin_dialects() 模块导入时执行
├── registry.py              # ConnectorRegistry：register / get / list_types
├── credentials.py           # Fernet 加解密（复用 Settings.credential_fernet_key）
├── models.py                # SQLAlchemy DataSource ORM + get_meta_session
├── schemas.py               # Create/Update/Out/TestConnection* DTO
├── service.py               # CRUD + test_connection 编排
└── dialects/
    ├── __init__.py
    ├── base.py              # DialectConnector Protocol + TestConnectionResult
    └── mysql.py             # CONN-001：pymysql 实现 + register_dialect()

backend/app/api/v1/
├── datasources.py           # entry：薄路由，Depends(get_current_user)
└── router.py                # include datasources router
```

**元库**：与 auth/ingestion 共用 `Settings.database_url`；表名 `data_sources`（避免与 SQL 保留字 `datasources` 混淆）。

### 3.2 ConnectorRegistry（DS-001）

**核心 API**：

```python
@dataclass(frozen=True)
class ConnectorDescriptor:
    type: str                    # "mysql"
    category: str                # "relational"
    capabilities: tuple[str, ...]  # L1: ("connectivity_test",)

class ConnectorRegistry:
    def register(self, connector: DialectConnector) -> None: ...
    def get(self, type: str) -> DialectConnector: ...  # 未知 → ConnectorNotFoundError
    def list_types(self) -> list[ConnectorDescriptor]: ...
```

**模块级单例**：`registry = ConnectorRegistry()`；`register_dialect(connector)` 为 `registry.register` 别名。

**方言契约**（`dialects/base.py`）：

```python
@dataclass
class TestConnectionResult:
    ok: bool
    message: str
    latency_ms: int | None

class DialectConnector(Protocol):
    @property
    def type(self) -> str: ...
    @property
    def category(self) -> str: ...
    @property
    def capabilities(self) -> tuple[str, ...]: ...
    def test_connection(
        self,
        *,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        timeout_sec: float = 5.0,
    ) -> TestConnectionResult: ...
```

**启动注册**：`datasources/__init__.py` 调用 `register_builtin_dialects()`；`api/v1/datasources.py` 顶层 `import app.datasources` 触发（**不修改** `main.py`，遵守范围框定）。

### 3.3 数据模型（Alembic `0008_datasources_table.py`）

| 列名 | 类型 | 约束 |
|------|------|------|
| `id` | UUID | PK，即 `dataSourceId` |
| `name` | VARCHAR(120) | NOT NULL |
| `code` | VARCHAR(64) | UNIQUE NOT NULL |
| `type` | VARCHAR(32) | NOT NULL；须 registry 已注册 |
| `host` | VARCHAR(255) | NOT NULL |
| `port` | INTEGER | NOT NULL |
| `database` | VARCHAR(128) | NOT NULL |
| `username` | VARCHAR(128) | NOT NULL |
| `password_encrypted` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | server_default now() |
| `updated_at` | TIMESTAMPTZ | onupdate now() |

**code 规则**：`^[a-z][a-z0-9_-]{1,63}$`（与 auth role code 风格一致）。

**与 ingestion 字段对齐**：`type`/`host`/`port`/`database`/`username`/`password` 语义与 `SourceConnectionIn` 一致；ingestion `type` 用 `postgres` 而 datasources 首期仅 `mysql`（CONN-002 再增 `postgresql`）。

### 3.4 凭证加密（DS-005）

`credentials.py` 提供：

- `encrypt_credential(plain: str) -> str`
- `decrypt_credential(cipher: str) -> str`（`InvalidToken` → `ValueError`）

实现与 `ingestion/models.py` 相同 Fernet 通道（`get_settings().credential_fernet_key`），**独立副本**避免跨域 import 重构。

**写入路径**：`service.create` / `service.update`（password 非空时加密写入 `password_encrypted`）。

**读取路径**：仅 `service.test_connection` 与内部连库路径调用 `decrypt_credential`；**禁止**在 schemas Out 层解密。

**脱敏策略**：

- `DataSourceOut.password` 固定 `"***"`（与 `SourceConnectionOut` 一致）
- 列表/详情 JSON 不含 `password_encrypted` 列
- 日志禁止打印明文 password

**无密钥启动**：`Settings` 已在 validator 拒绝非法 Fernet key；补充测试：环境变量移除 `CREDENTIAL_FERNET_KEY` 时 `Settings` 构造失败（复用 `test_ci_env_contract` 模式）。

### 3.5 API 契约

错误体统一：`{"code": "<SNAKE>", "message": "...", "detail": ...}`。

| 方法 | 路径 | PRD | 行为摘要 |
|------|------|-----|----------|
| GET | `/api/v1/datasources` | DS-002 | 列表 `items[]`；每项含 `id`（dataSourceId）、连接字段、脱敏 password |
| POST | `/api/v1/datasources` | DS-002 | 创建；未知 `type` → 422 `UNKNOWN_CONNECTOR_TYPE`；重复 `code` → 409 `DATASOURCE_CODE_CONFLICT`；重复 `name` → 409 `DATASOURCE_NAME_CONFLICT` |
| GET | `/api/v1/datasources/{id}` | DS-002 | 详情；不存在 → 404 `DATASOURCE_NOT_FOUND` |
| PUT | `/api/v1/datasources/{id}` | DS-002 | 更新；`code`/`type` 不可变；`password=""` 表示保留原密文 |
| DELETE | `/api/v1/datasources/{id}` | DS-002 | 删除；不存在 → 404 |
| POST | `/api/v1/datasources/test` | DS-003 | 草稿连通测试（body 同 Create，不落库）；未知 type → 422 |
| POST | `/api/v1/datasources/{id}/test` | DS-003 | 已保存实例测试；404 若不存在 |

> **路径说明**：`round-target` 列举 `/{id}/test-connection` 为等价表述；实现采用 `docs/api/README.md` 已登记的 `/{id}/test` 与 `/test`。

**连通性响应体**（HTTP 200，含失败场景）：

```json
{
  "ok": true,
  "message": "Connection successful",
  "latencyMs": 42
}
```

失败时 `ok: false`，`message` 为方言映射后的可读原因（如 `Access denied`、`Connection refused`、`timed out`），**不含**密码或完整连接串。

**鉴权（L1）**：全部路由 `Depends(get_current_user)`；不实现 DS-008 数据源级 ACL（M7）。

### 3.6 MySQL 连接器（CONN-001）

`dialects/mysql.py`：

- `type = "mysql"`，`category = "relational"`，`capabilities = ("connectivity_test",)`
- 驱动：`pymysql.connect(..., connect_timeout=int(timeout_sec), read_timeout=..., write_timeout=...)`
- 成功：`SELECT 1` 或 `connection.ping(reconnect=False)` 后关闭
- 异常映射：`pymysql.err.OperationalError` → `ok=False` + 脱敏 message；不向上抛出未捕获栈至 API（记录 traceId 日志）

`register_dialect(MysqlConnector())` 在 `register_builtin_dialects()` 内调用。

### 3.7 方案比选（摘要）

#### 3.7.1 凭证模块位置

| 方案 | 说明 | 结论 |
|------|------|------|
| A `datasources/credentials.py` 独立副本 | 零 ingestion 改动；与 round-target 锚点一致 | **采用** |
| B 抽取 `core/credentials.py` | 需改 ingestion import；超范围 | 否决 |
| C CRUD 内联 Fernet | 难测、重复 | 否决 |

#### 3.7.2 元库 Session

| 方案 | 说明 | 结论 |
|------|------|------|
| A `datasources/models.py` 独立 `get_meta_engine`（复制 auth/ingestion 模式） | ≤30 行重复；域自治 | **采用** |
| B 统一 `core/meta_db.py` | 超范围 | 否决 |

#### 3.7.3 连通测试 HTTP 语义

| 方案 | 说明 | 结论 |
|------|------|------|
| A 测试端点恒 200 + `ok` 字段 | 管理端常见；结构化失败满足 round-target | **采用** |
| B 失败 HTTP 4xx | 与「测试」语义混用 transport/business 层 | 否决作默认；404 仅用于资源不存在 |

#### 3.7.4 MySQL 方言文件布局

| 方案 | 说明 | 结论 |
|------|------|------|
| A 单文件 `dialects/mysql.py` | round-target 允许「或等价」；L1 足够 | **采用** |
| B 子包 `dialects/mysql/` 多文件 | PRD 远期锚点；L1 过度 | 留 CONN-002 对称扩展 |

#### 3.7.5 连通测试 mock 策略

| 方案 | 说明 | 结论 |
|------|------|------|
| A `unittest.mock.patch` 拦截 `pymysql.connect` | CI 无 Docker 依赖；默认 pytest 路径 | **采用** |
| B `@pytest.mark.integration` + compose MySQL | 可选补充；标记 `integration` | 可选，不阻塞 L1 |

## 4. 范围框定文件清单（17 项）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/datasources/__init__.py` | DS-001, CONN-001 | 新建：`register_builtin_dialects` |
| `backend/app/datasources/registry.py` | DS-001 | 新建 |
| `backend/app/datasources/dialects/__init__.py` | CONN-001 | 新建 |
| `backend/app/datasources/dialects/base.py` | DS-001, CONN-001 | 新建：Protocol + TestConnectionResult |
| `backend/app/datasources/dialects/mysql.py` | CONN-001 | 新建 |
| `backend/app/datasources/credentials.py` | DS-005 | 新建 |
| `backend/app/datasources/models.py` | DS-002 | 新建：ORM + session |
| `backend/app/datasources/schemas.py` | DS-002, DS-003 | 新建 |
| `backend/app/datasources/service.py` | DS-002, DS-003, DS-005 | 新建 |
| `backend/app/api/v1/datasources.py` | DS-002, DS-003 | 新建 |
| `backend/app/api/v1/router.py` | 全部 | 修改：注册 datasources router |
| `backend/migrations/versions/0008_datasources_table.py` | DS-002 | 新建 revision |
| `tests/test_datasources_l1.py` | 全部 | 新建：五域 smoke 合集 |
| `tests/test_migrations.py` | DS-002 | 修改：head=`0008`、`data_sources` SQL 断言 |
| `docs/api/README.md` | DS-002, DS-003 | 修改：状态列 → 已实现（P3 同步） |
| `docs/services/datasources.md` | 全部 | 修改：状态与类型表（P3 同步） |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/ingestion/models.py` | Fernet 与连接字段参照 |
| `backend/app/api/v1/ingestion/sync.py` | entry 薄层 + `_db()` 模式 |
| `backend/app/auth/models.py` | 元库 engine/session 模式 |
| `backend/app/core/config.py` | `credential_fernet_key` 校验 |
| `tests/conftest.py` | `client` / `auth_headers` |
| `docs/automate/prd/F03-DS.md` | 验收与代码锚点 |
| `docs/automate/prd/F04-CONN.md` | CONN-001 验收 |
| `docs/api/README.md` | 路由路径真理源 |

**文件计数**：新建 **12** + 修改 **3** + 文档 **2**（P3）= **17 ≤ 20**。

## 5. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- DS-004/006/007/008（元数据浏览、连接池隔离、类型清单 API、M7 授权集成）
- CONN-002 PostgreSQL 及 CONN-003~022
- QUERY/VIZ 查询出数链、`backend/app/query/` 执行器扩展
- Admin 数据源配置 UI（`fe/` 无改动）
- `ingestion` 与 `data_sources` 双向桥接（`source_data_source_id` 填充逻辑留后续）
- 抽取 `core/credentials.py` 或重构 ingestion 加解密
- 修改 `backend/app/main.py`（方言注册经 router import 触发）
- 连接池（DS-006）、schema 浏览（CONN-001 PRD 第二验收条留 DS-004）
- OpenAPI 以外的 GraphQL/gRPC
- 生产环境数据源级 RBAC / 越权 403（DS-008）

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 | 可测验收信号 |
|--------|------------------|--------------|--------------|
| DS-001 | 完整度 5%；架构 8%；测试 0% | `ConnectorRegistry` + Protocol + mysql 注册；未知 type 422 | T-DS-R01~04 全绿 |
| DS-002 | 完整度 5%；可靠性 0%；测试 0% | `data_sources` 表 + 全 CRUD + code/name 冲突 409 | T-DS-C01~08 全绿 |
| DS-005 | 完整度 5%；安全性 8%；测试 0% | Fernet 落库 + Out 脱敏 + 无密钥 Settings 失败 | T-DS-K01~04 全绿 |
| DS-003 | 完整度 5%；可靠性 0%；测试 0% | 草稿/已保存双端点 + 超时/拒连/错凭据结构化 message | T-DS-T01~05 全绿 |
| CONN-001 | 完整度 5%；可靠性 0%；测试 0% | pymysql 方言 + mock 成功/失败 + DS-003 集成 | T-CONN-M01~04 全绿 |

**P5 重评预期**：DS-001~005 + CONN-001 完整度由 5% 升至 L1 档位（≥60% 由评分器计算）；可靠性/安全性/测试覆盖由 smoke 支撑。具体分值不在设计预设。

## 7. 子项详细设计与验收标准

### 7.1 DS-001 — ConnectorRegistry

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-DS-R01 | `list_types()` 含 mysql | descriptor.type==`mysql`；category==`relational` |
| T-DS-R02 | `get("mysql")` 返回方言实例 | `test_connection` 可调用 |
| T-DS-R03 | `get("unknown")` 抛 `ConnectorNotFoundError` | 服务层转 422 `UNKNOWN_CONNECTOR_TYPE` |
| T-DS-R04 | 重复 register 同 type | 第二次 register → 409 式错误或覆盖策略：L1 **拒绝重复**抛 `ConnectorAlreadyRegisteredError` |

**验收标准（可测试）**：

- [ ] `backend/app/datasources/registry.py` 存在且导出 `registry` / `register_dialect`
- [ ] `pytest tests/test_datasources_l1.py -k R01` 段全绿
- [ ] `GET /openapi.json` paths 含 `/api/v1/datasources`

### 7.2 DS-002 — 数据源 CRUD

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-DS-C01 | POST 创建 mysql 数据源 | 201；响应 `id` UUID；字段 roundtrip |
| T-DS-C02 | GET 列表含刚创建项 | `items` 非空；`password` 为 `"***"` |
| T-DS-C03 | GET 详情 | 200；无明文 password |
| T-DS-C04 | PUT 更新 name/host | 200；`code`/`type` 不变 |
| T-DS-C05 | DELETE 后 GET 404 | 204/200 DELETE；随后 404 |
| T-DS-C06 | 重复 code | 第二次 POST → 409 `DATASOURCE_CODE_CONFLICT` |
| T-DS-C07 | 重复 name | 409 `DATASOURCE_NAME_CONFLICT` |
| T-DS-C08 | 非法 type | POST type=`oracle` → 422 |

**验收标准（可测试）**：

- [ ] `data_sources` 表存在于 `0008` migration
- [ ] T-DS-C01~08 全绿
- [ ] `cd backend && ruff check .` 无新增违规

### 7.3 DS-005 — 凭证加密存储

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-DS-K01 | 加解密 round-trip | `decrypt(encrypt(p)) == p` |
| T-DS-K02 | DB 存密文非明文 | 直查 `password_encrypted` ≠ 明文 |
| T-DS-K03 | API 响应无泄露 | GET 详情 JSON 无 `password_encrypted`；`password` 为 `***` |
| T-DS-K04 | 无 CREDENTIAL_FERNET_KEY | `Settings(...)` 缺 key → ValidationError |

**验收标准（可测试）**：

- [ ] `credentials.py` 独立模块；service 经其读写
- [ ] T-DS-K01~04 全绿

### 7.4 DS-003 — 连通性测试

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-DS-T01 | POST `/datasources/test` mock 成功 | 200；`ok:true`；`latencyMs` 为整数 |
| T-DS-T02 | mock 拒绝连接 | 200；`ok:false`；message 含可读原因；无 password |
| T-DS-T03 | POST `/{id}/test` 已保存实例 | 200；mock 成功 |
| T-DS-T04 | 错误凭据 mock | 200；`ok:false`；message 不含密码子串 |
| T-DS-T05 | 不存在 id | POST `/{random_uuid}/test` → 404 |

**验收标准（可测试）**：

- [ ] 双测试端点 OpenAPI 可见
- [ ] T-DS-T01~05 全绿

### 7.5 CONN-001 — MySQL 连接器

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CONN-M01 | 方言属性 | type/category/capabilities 符合契约 |
| T-CONN-M02 | mock connect 成功 | `TestConnectionResult.ok is True` |
| T-CONN-M03 | mock OperationalError | `ok is False`；message 脱敏 |
| T-CONN-M04 | 端到端：创建 mysql + test | T-DS-C01 + T-DS-T03 串联全绿 |

**验收标准（可测试）**：

- [ ] `dialects/mysql.py` 使用 `pymysql`
- [ ] 连接参数与 `DataSource` 模型字段对齐（host/port/database/username/password）
- [ ] T-CONN-M01~04 全绿

### 7.6 迁移与测试基建

**`0008_datasources_table.py`**：`down_revision = "0007"`；`upgrade` 创建 `data_sources` 及 `code` 唯一索引；`downgrade` drop 表。

**`tests/test_datasources_l1.py` 基建**：

```python
_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_l1_test?mode=memory&cache=shared&uri=true"
# module autouse: DATABASE_URL + get_settings/get_meta_engine cache_clear
# create_all DataSource Base.metadata
# clean data_sources between tests
```

**`tests/test_migrations.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-MIG-36 | revision 链 head=`0008` | heads 含 0008；0008.down_revision==0007 |
| T-MIG-37 | upgrade --sql 含 data_sources | subprocess alembic upgrade head --sql |

## 8. UI 设计交付

**`ui_design_skill`**: `none`（本轮范围框定不含 `fe/` 前端文件；round-target 明确「本期仅 API L1，FE 壳层后续轮次」）。

| 项 | 说明 |
|----|------|
| 页面 IA | 不适用；后续轮次在 Admin「数据管理 → 数据源」落地 |
| 视觉层级 | 不适用 |
| 组件映射 | 不适用 |
| Token 与密度 | 不适用 |
| 响应式/a11y | 不适用 |
| 视觉 QA | P4 跳过 UI 截图；仅 backend pytest |

## 9. 文档同步（P3/P5 执行，设计预登记）

| 变更 | 文档 |
|------|------|
| 新增 datasources 路由 | `docs/api/README.md` §数据源状态 → 已实现 |
| 域职责落地 | `docs/services/datasources.md` 状态与 `ConnectorRegistry`/`DataSourceService` |
| PRD 验收勾选 | `prd/F03-DS.md` DS-001~003/005 + `prd/F04-CONN.md` CONN-001（P5） |
| 架构目录 | 已与 `docs/arch.md` §4.2 一致，无需改结构 |

## 10. 验证命令（P4 参考）

```bash
cd backend && python3 -m ruff check . && python3 -m pytest -v
```

预期：既有 394+ 用例保持绿 + `test_datasources_l1.py` 新增约 25 项 + `test_migrations.py` T-MIG-36~37。

## 11. Self-review 清单

- [x] 覆盖 round-target 五项 DS-001/002/005/003 + CONN-001
- [x] 文件清单 17 项，未超范围框定模块（≤20）
- [x] 无 TBD/TODO 占位
- [x] 纯后端：`ui_design_skill: none` 已记录
- [x] 非目标与 DS-004~008 / CONN-002 边界清晰
- [x] plan.md 无 M3 活跃节已说明，不构成本轮 BLOCKED
- [x] API 路径与 `docs/api/README.md` 对齐（`/{id}/test`）
