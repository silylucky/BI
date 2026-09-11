# M11 关系型/OLAP 连接器 L1 kickoff r36 设计 — CONN-003/007/005/008/004

```yaml
date: 2026-07-04
milestone: M11
round_target: docs/superpowers/evolution/2026-07-04-round-target-r36.md
prd_ids: [CONN-003, CONN-007, CONN-005, CONN-008, CONN-004]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` | category | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|--------|----------|:--------:|------------|----------|
| 1 | Hive 连通 + schema/types 骨架 | CONN-003 | `hive` | `lake` | 1（最低分 12.3） | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 登记 Hive 源可 test_connection；失败有 `HIVE_*` code + traceId；库/表骨架可浏览 |
| 2 | ClickHouse 连通 + schema/limit | CONN-007 | `clickhouse` | `olap` | 2 | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 连通性检测；宽表列元数据有 limit 守卫；与 QUERY-004 方言 type 对齐 |
| 3 | SQL Server 连通 + schema/TLS L1 | CONN-005 | `sqlserver` | `relational` | 3 | 完整度 **5%→≥60%**；安全性 **10%→≥40%** | 实例/库/凭证错误可定位；dbo 与自定义 schema 可列 |
| 4 | Doris 连通 + schema（StarRocks 契约） | CONN-008 | `doris` | `olap` | 4 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | FE 不可达不 500；非法 catalog 边界清晰 |
| 5 | Oracle 连通 + owner/table schema | CONN-004 | `oracle` | `relational` | 5（最低分 11.8） | 完整度 **5%→≥60%**；测试覆盖 **0%→≥50%** | SID/service name 错误可感知；owner/table 层级自省 |

**依赖链**：五方言 connector 模块 + `errors.py` 扩展 → `register_builtin_dialects()` 注册 → `export_type_catalog()` 五 type 出现 → `test_connectors_gov_r36.py` smoke → r35 35/35 + r34 15/15 回归 → P5 目标加权总分 **≥80**（r37 companion **≥90**）。

**上轮已交付（本轮不重复）**：r34/r35 TiDB/StarRocks/ES L1 + companion；QUERY-004 `clickhouse` **SQL 方言**（`query/dialects/clickhouse.py`）已存在，**本轮补 CONN-007 数据源连接器**，二者 `type` 均为 `clickhouse` 但职责分离（连接器 vs 查询方言）。

**PRD 分片漂移注记**（真理源优先级：`round-target` > `prd.md` hub > `prd/F04-CONN.md`）：

| PRD ID | hub / round-target | F04-CONN.md / plan.archive §M7（陈旧） |
|--------|-------------------|--------------------------------------|
| CONN-003 | **Hive** | MariaDB |
| CONN-004 | **Oracle** | SQL Server |
| CONN-005 | **SQL Server** | Oracle |

本轮实现以 **hub + round-target** 为准；P5 须同步 `F04-CONN.md` 描述与代码锚点。SRS §3.6 类型枚举尚无 `hive`，P5 评估是否回流 SRS 附录（非 P3 阻塞项）。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11 连接器扩展簇；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `datasources/__init__.py` | 仅注册 mysql/postgresql/tidb/starrocks/elasticsearch |
| `dialects/errors.py` | MySQL/PG/TIDB 别名；**无** HIVE/SQLSERVER/ORACLE/CLICKHOUSE/DORIS |
| `query/dialects/clickhouse.py` | QUERY-004 SQL 方言已注册；**无** datasources 侧 connector |
| `registry.py` | `ConnectorRegistry` + `export_type_catalog()` 就绪；NFR-04 插件模式 |
| `metadata/service.py` | schema 空参数 400；连接失败 502/504；不泄露密码 |
| `service.py` `_run_test` | `test_connection` 返回 200 + `ok=false` + `code`（与 r34 一致）；未知 type 创建/测试 → 422 |
| `pyproject.toml` | 无 pyhive/pymssql/oracledb/clickhouse-connect；拟增 `connectors-ext` optional 组 |
| `test_connectors_gov_r34/r35` | 15 + 35 条；本轮新建 r36 套件，不删旧套件 |

**范围框定模块**（1）：`backend/app/datasources/` 方言与注册（CONN-003/004/005/007/008）。

**范围框定文件列表**（16 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/hive.py` | CONN-003 | 新建 |
| `backend/app/datasources/dialects/clickhouse.py` | CONN-007 | 新建 |
| `backend/app/datasources/dialects/sqlserver.py` | CONN-005 | 新建 |
| `backend/app/datasources/dialects/doris.py` | CONN-008 | 新建 |
| `backend/app/datasources/dialects/oracle.py` | CONN-004 | 新建 |
| `backend/app/datasources/dialects/errors.py` | CONN-005/004 | 修改（`map_sqlserver_*` / `map_oracle_*`） |
| `backend/app/datasources/dialects/__init__.py` | 全部 | 修改：导出五 connector |
| `backend/app/datasources/__init__.py` | 全部 | 修改：`register_builtin_dialects()` |
| `backend/pyproject.toml` | 全部 | 修改：`[project.optional-dependencies] connectors-ext` |
| `tests/test_connectors_gov_r36.py` | 全部 | 新建（≥25 条断言函数） |
| `docs/services/datasources.md` | 全部 | 修改：五方言登记 |
| `docs/automate/prd/F04-CONN.md` | 全部 | **P5 对账**（非 P3） |

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F04-CONN.md` > `docs/services/datasources.md` > `docs/api/README.md`（本轮无新 HTTP 路由）。

**本轮性质**：M11 **L1 kickoff**（registry + test_connection + schema 自省 + types catalog + pytest mock smoke）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、真实 compose 集成环境。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/
├── __init__.py                    # +5 register_dialect(...)
└── dialects/
    ├── hive.py                    # CONN-003：HiveServer2 / pyhive
    ├── clickhouse.py              # CONN-007：HTTP clickhouse-connect
    ├── sqlserver.py               # CONN-005：pymssql
    ├── doris.py                   # CONN-008：MySQL 协议委托
    ├── oracle.py                  # CONN-004：oracledb thin
    ├── errors.py                  # +SQLSERVER_* / ORACLE_* mappers
    └── __init__.py                # 导出

tests/
└── test_connectors_gov_r36.py     # T-CONN-R36-* 新用例
```

**共享 L1 契约**（五 connector 均满足）：

| 契约项 | 要求 |
|--------|------|
| `DialectConnector` 协议 | `type` / `category` / `capabilities` / `display_name` |
| capabilities | `("connectivity_test", "schema_browser")` |
| `test_connection` | 返回 `TestConnectionResult`；失败含稳定 `{PREFIX}_*` `code` |
| schema 自省 | `list_schemas` / `list_tables` / `list_columns` 可 mock 单测 |
| 注册 | `register_builtin_dialects()` 启动时注册；`export_type_catalog()` 可见 |
| 只读 | 连接器**不**执行写 SQL；与现有 datasources 链一致 |
| 驱动加载 | 模块内 lazy import；缺驱动时 `test_connection` 返回 `ok=False` + `{PREFIX}_DRIVER_MISSING`（仅当非 mock 路径触发，pytest 全程 mock） |

### 3.2 CONN-003 — Hive 连接器

#### 3.2.1 方案比选

| 方案 | 协议 | schema | 结论 |
|------|------|--------|------|
| A `pyhive` HiveServer2 Thrift | 10000 | `SHOW DATABASES` / `SHOW TABLES` / `DESCRIBE` | **采用** — 行业默认；mock `pyhive.connect` 即可 L1 |
| B JDBC jaydebeapi | JDBC | 同左 | 否决 — JVM 依赖，违背零重型运行时 |
| C 纯 HTTP LLAP | REST | 非通用 | 否决 — 部署覆盖不足 |

#### 3.2.2 实现要点

**文件**：`backend/app/datasources/dialects/hive.py`

| 属性 | 值 |
|------|-----|
| `type` | `hive` |
| `category` | `lake` |
| `display_name` | `Apache Hive` |
| 默认 port | 10000（文档注释；连接参数由 `DataSource.port` 传入） |

**错误码**：`HIVE_CONN_REFUSED`、`HIVE_AUTH_FAILED`、`HIVE_TIMEOUT`、`HIVE_UNKNOWN_DATABASE`、`HIVE_UNKNOWN`。

**`test_connection`**：`open_connection` → 执行 `SELECT 1` 或 `cursor.execute("SELECT 1")`；捕获 `TTransportException` / `OperationalError` 映射为 `HIVE_*`。

**schema 映射**：

| 方法 | SQL / 行为 |
|------|------------|
| `list_schemas` | `SHOW DATABASES`；过滤 `information_schema` 若存在 |
| `list_tables` | `SHOW TABLES IN {schema}`；`schema=""` → `[]` |
| `list_columns` | `DESCRIBE {schema}.{table}` 解析 col_name/data_type；未知表 → `[]` |

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R36-003-01 | types catalog 含 `hive`，`category=lake`，capabilities 含 `schema_browser` |
| T-CONN-R36-003-02 | mock 成功 → `ok=True` |
| T-CONN-R36-003-03 | mock 认证失败 → `code=HIVE_AUTH_FAILED` |
| T-CONN-R36-003-04 | mock 连接拒绝 → `code=HIVE_CONN_REFUSED` |
| T-CONN-R36-003-05 | mock 超时 → `code=HIVE_TIMEOUT` |
| T-CONN-R36-003-06 | mock 空库 `SHOW DATABASES` 仅 default → `list_schemas` 过滤后 `[]` 或仅 default |
| T-CONN-R36-003-07 | mock 未知库 `list_tables` → `[]` |

### 3.3 CONN-007 — ClickHouse 连接器

#### 3.3.1 方案比选

| 方案 | 客户端 | limit | 结论 |
|------|--------|-------|------|
| A `clickhouse-connect` HTTP | 8123 | `system.columns` + 切片 | **采用** — 与 QUERY-004 语义一致；易 mock |
| B MySQL 兼容端口 9004 | pymysql | 同左 | 否决 — 非全功能元数据 |
| C 仅 native TCP | clickhouse-driver | — | 否决 — HTTP 更普适 |

#### 3.3.2 实现要点

**文件**：`backend/app/datasources/dialects/clickhouse.py`

| 属性 | 值 |
|------|-----|
| `type` | `clickhouse` |
| `category` | `olap` |
| `display_name` | `ClickHouse` |
| 默认 port | 8123 |

**错误码**：`CLICKHOUSE_CONN_REFUSED`、`CLICKHOUSE_AUTH_FAILED`、`CLICKHOUSE_TIMEOUT`、`CLICKHOUSE_UNKNOWN_DATABASE`、`CLICKHOUSE_UNKNOWN`。

**常量**：`CLICKHOUSE_MAX_COLUMNS = 500`（与 StarRocks/ES 对称）。

**schema 映射**：

| 方法 | 查询 |
|------|------|
| `list_schemas` | `SELECT name FROM system.databases WHERE name NOT IN ('system','INFORMATION_SCHEMA')` |
| `list_tables` | `SELECT name, engine FROM system.tables WHERE database = {schema}`；非法/空 database → `[]` |
| `list_columns` | `SELECT name, type FROM system.columns WHERE database=? AND table=?`；超 500 列切片 |

**types catalog 对齐**：`export_type_catalog()` 中 `clickhouse` 项 `category=olap`；与 `get_sql_dialect("clickhouse")` 的 `connector_type` 一致（T-Q-R27-004 回归不受影响）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R36-007-01 | types catalog 含 `clickhouse` `category=olap` |
| T-CONN-R36-007-02 | mock HTTP 成功 ping → `ok=True` |
| T-CONN-R36-007-03 | mock 401 → `CLICKHOUSE_AUTH_FAILED` |
| T-CONN-R36-007-04 | mock connection refused → `CLICKHOUSE_CONN_REFUSED` |
| T-CONN-R36-007-05 | mock 未知 database tables 查询 → `[]` |
| T-CONN-R36-007-06 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R36-007-07 | `get_sql_dialect("clickhouse")` 仍成功（registry 回归） |

### 3.4 CONN-005 — SQL Server 连接器

#### 3.4.1 方案比选

| 方案 | 驱动 | TLS | 结论 |
|------|------|-----|------|
| A `pymssql` | 纯 Python TDS | `ssl_mode` → `encrypt` 参数 L1 | **采用** — 无 ODBC 系统依赖 |
| B `pyodbc` | ODBC | 完整 TLS | 否决 — 部署需 unixODBC |
| C 委托 PostgreSQL | — | — | 否决 — 协议不兼容 |

#### 3.4.2 实现要点

**文件**：`backend/app/datasources/dialects/sqlserver.py` + `errors.py` 增 `map_sqlserver_operational_error`

| 属性 | 值 |
|------|-----|
| `type` | `sqlserver` |
| `category` | `relational` |
| `display_name` | `SQL Server` |
| 默认 port | 1433 |

**错误码**：`SQLSERVER_CONN_REFUSED`、`SQLSERVER_AUTH_FAILED`、`SQLSERVER_TIMEOUT`、`SQLSERVER_UNKNOWN_DATABASE`、`SQLSERVER_SSL_ERROR`、`SQLSERVER_UNKNOWN`。

**TLS L1**：`ssl_mode=required` → `pymssql.connect(..., encrypt=True)`；`disabled` → `encrypt=False`；`preferred` → 默认（驱动默认）。

**schema 映射**（`database` 字段映射为 catalog/默认库）：

| 方法 | 查询 |
|------|------|
| `list_schemas` | `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY 1`（含 `dbo` 与自定义） |
| `list_tables` | `SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s` |
| `list_columns` | `INFORMATION_SCHEMA.COLUMNS` 同 MySQL 形态 |

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R36-005-01 | types catalog 含 `sqlserver` `category=relational` |
| T-CONN-R36-005-02 | mock 成功 → `ok=True` |
| T-CONN-R36-005-03 | mock 18456 登录失败 → `SQLSERVER_AUTH_FAILED` |
| T-CONN-R36-005-04 | mock 连接拒绝 → `SQLSERVER_CONN_REFUSED` |
| T-CONN-R36-005-05 | mock 未知 database → `SQLSERVER_UNKNOWN_DATABASE` 或 `list_schemas` 在错误库下 `[]` |
| T-CONN-R36-005-06 | `ssl_mode=required` mock 断言 `encrypt=True` 传入 |

### 3.5 CONN-008 — Doris 连接器

#### 3.5.1 方案比选

| 方案 | 协议 | 错误码 | 结论 |
|------|------|--------|------|
| A MySQL 协议委托（镜像 StarRocks） | 9030 | `DORIS_*` ← `MYSQL_*` | **采用** — 与 CONN-009 对称 |
| B Doris HTTP FE API | 8030 | 独立 | 否决 — 重复实现 |
| C 纯 JDBC | — | — | 否决 — 重型依赖 |

#### 3.5.2 实现要点

**文件**：`backend/app/datasources/dialects/doris.py`（结构对称 `starrocks.py`）

| 属性 | 值 |
|------|-----|
| `type` | `doris` |
| `category` | `olap` |
| `display_name` | `Apache Doris` |
| 默认 port | 9030 |

**错误码**：`DORIS_TIMEOUT`、`DORIS_CONN_REFUSED`、`DORIS_AUTH_FAILED`、`DORIS_UNKNOWN`。

**schema**：委托 `MysqlConnector`；`list_tables(schema="")` → `[]`；连接池超时边界由 `test_connection` mock errno 2013 → `DORIS_TIMEOUT`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R36-008-01 | types catalog 含 `doris` `category=olap` |
| T-CONN-R36-008-02 | mock ping 成功 → `ok=True` |
| T-CONN-R36-008-03 | mock 2003 → `DORIS_CONN_REFUSED` |
| T-CONN-R36-008-04 | mock 1045 → `DORIS_AUTH_FAILED` |
| T-CONN-R36-008-05 | mock 非法 catalog `list_tables` → `[]` |
| T-CONN-R36-008-06 | `register_builtin_dialects` 不修改 `ConnectorRegistry` 核心类（NFR-04 smoke：registry 仍为同一实例） |

### 3.6 CONN-004 — Oracle 连接器

#### 3.6.1 方案比选

| 方案 | 连接串 | schema | 结论 |
|------|--------|--------|------|
| A `oracledb` thin mode | service name / SID via `database` 字段 | `ALL_TABLES` / `ALL_TAB_COLUMNS` | **采用** — 无 Instant Client |
| B `cx_Oracle` thick | 同左 | 同左 | 否决 — 已弃用 |
| C JDBC | — | — | 否决 |

#### 3.6.2 实现要点

**文件**：`backend/app/datasources/dialects/oracle.py` + `errors.py` 增 `map_oracle_error`

| 属性 | 值 |
|------|-----|
| `type` | `oracle` |
| `category` | `relational` |
| `display_name` | `Oracle` |
| 默认 port | 1521 |

**错误码**：`ORACLE_CONN_REFUSED`、`ORACLE_AUTH_FAILED`、`ORACLE_TIMEOUT`、`ORACLE_UNKNOWN_SERVICE`、`ORACLE_UNKNOWN`。

**连接**：`database` 字段承载 **service name**（L1 不区分 SID 子协议；错误 service → `ORACLE_UNKNOWN_SERVICE`）。

**schema 映射**（owner 即 schema）：

| 方法 | 查询 |
|------|------|
| `list_schemas` | `SELECT DISTINCT OWNER FROM ALL_TABLES WHERE OWNER NOT IN ('SYS','SYSTEM',...) ORDER BY 1` |
| `list_tables` | `SELECT TABLE_NAME, 'TABLE' FROM ALL_TABLES WHERE OWNER = :owner` |
| `list_columns` | `ALL_TAB_COLUMNS`；空 owner → `[]` |

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R36-004-01 | types catalog 含 `oracle` `category=relational` |
| T-CONN-R36-004-02 | mock 成功 → `ok=True` |
| T-CONN-R36-004-03 | mock ORA-01017 → `ORACLE_AUTH_FAILED` |
| T-CONN-R36-004-04 | mock ORA-12514 未知 service → `ORACLE_UNKNOWN_SERVICE` |
| T-CONN-R36-004-05 | mock 连接拒绝 → `ORACLE_CONN_REFUSED` |
| T-CONN-R36-004-06 | mock 空 owner `list_columns` → `[]` |

### 3.7 联合 registry 回归

| ID | 断言 |
|----|------|
| T-REG-R36-01 | `export_type_catalog()` 同时含 mysql/tidb/starrocks/elasticsearch + 五新 type（共 10 项） |
| T-REG-R36-02 | `POST /api/v1/datasources/test` + `type=hive` mock 成功 → 200 `ok=true` + `traceId` 非空 |
| T-REG-R36-03 | `POST /api/v1/datasources` + `type=clickhouse` 创建成功；`GET /types` 含五项新 type |
| T-REG-R36-04 | 既有 mysql test_connection mock 成功不回归（r34/r35 兼容） |

## 4. 依赖与 optional 包

**文件**：`backend/pyproject.toml`

```toml
[project.optional-dependencies]
connectors-ext = [
    "pyhive>=0.7.0",
    "pymssql>=2.3.0",
    "oracledb>=2.5.0",
    "clickhouse-connect>=0.7.0",
]
```

- CI / 默认 `dev` 安装**不强制** `connectors-ext`；pytest 全程 `@patch` 驱动入口。
- 生产部署按需 `pip install vitalspan-backend[connectors-ext]`。
- Doris/Hive 无额外包（Doris 用 pymysql；Hive L1 测试 mock pyhive）。

## 5. 测试策略

### 5.1 新套件

**文件**：`tests/test_connectors_gov_r36.py`

- 独立 SQLite DB：`connectors_gov_r36`（fixture 模式同 r34/r35）。
- 命名：`T-CONN-R36-*` / `T-REG-R36-*`。
- 目标 **≥25** 条独立断言函数（上表合计 32 条，实施可参数化合并，计划阶段承诺 ≥25）。
- 保留 `test_connectors_gov_r35.py`（35 条）与 `test_connectors_gov_r34.py`（15 条）不删；Task 末全量回归 **50/50** r34+r35 + r36 全绿。

### 5.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v
```

全量基线：r35 后 **777 passed** + 4 skipped；本轮目标 **≥802 passed** + 4 skipped。

### 5.3 HTTP 语义说明

- `test_connection` 失败路径：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 DS-003 既有契约一致）；round-target「4xx」指 **metadata** 非法参数（400）、未知 type（422）、连接失败（502）及 **结构化 code 可定位**，不改为 test 端点抛 4xx。
- schema API：空 `schema` query → 400 `METADATA_INVALID_REQUEST`（已有，五方言复用）。

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | L1 目标 | r37 companion 目标 |
|--------|------------------|--------------|---------|---------------------|
| CONN-003 | 完整度 5%、可靠性 0%、测试 0% | registry + `HIVE_*` + schema mock 7 测 | 完整度 ≥60%、可靠性 ≥40%、测试 ≥50% | 总分 ≥90 |
| CONN-007 | 完整度 5%、架构 8%、测试 0% | HTTP connector + limit + QUERY type 对齐 7 测 | 完整度 ≥60%、架构 ≥40% | 总分 ≥90 |
| CONN-005 | 完整度 5%、安全性 10%、测试 0% | pymssql + TLS L1 + `SQLSERVER_*` 6 测 | 完整度 ≥60%、安全性 ≥40% | 总分 ≥90 |
| CONN-008 | 完整度 5%、可靠性 0%、测试 0% | Doris MySQL 委托 + `DORIS_*` 6 测 | 完整度 ≥60%、可靠性 ≥40% | 总分 ≥90 |
| CONN-004 | 完整度 5%、测试 0% | oracledb thin + owner schema 6 测 | 完整度 ≥60%、测试 ≥50% | 总分 ≥90 |

## 7. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- Admin 数据源配置全量 UI（`fe/`）
- CONN-021/009/015、GOV-004/008（r35 已破 90）
- QUERY-008/009 Dataset 路径；META-003~006
- Hive/ClickHouse/Doris **生产级 HA**、负载均衡、Kerberos/LDAP 完整认证
- Oracle thick mode、RAC、SQL Server Windows 集成认证
- 五方言 **只读查询 execute** 集成测（留 M4/M11 companion）
- 真实 Docker compose 集成测试（可选 `integration` mark，不阻塞 L1）
- 新增 Alembic migration（元库 `data_sources.type` 为自由字符串，已支持）
- MariaDB 独立连接器（CONN-003 本轮按 hub 交付 **Hive**；MariaDB 可后续独立 ID 或 SRS 回流后调整）

## 8. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/datasources.md` | P3 | 五方言 In 表 + r36 kickoff 笔记 |
| `docs/automate/prd/F04-CONN.md` | P5 | CONN-003~008 状态/验收/锚点；**修正** MariaDB/SQL Server/Oracle ID 漂移 |
| `docs/api/README.md` | — | 无新路由，通常无需改 |
| `docs/srs/全生命周期系统需求规格说明书.md` §3.6 | P5 评估 | 增 `hive` 类型行（若产品确认） |

## 9. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 L1 kickoff，不触及 `fe/` 或壳层 IA；无「UI 设计交付」小节要求项。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| PRD 分片与 hub ID 语义不一致 | P5 以 hub 为准回写 F04-CONN；设计已显式映射表 |
| 可选驱动未安装导致运行时 ImportError | lazy import + `*_DRIVER_MISSING` code；文档注明 `connectors-ext` |
| ClickHouse 连接器与 QUERY 方言同名 type 混淆 | 分模块职责；T-CONN-R36-007-07 回归 `get_sql_dialect` |
| 五文件超 `common.mdc` 单目录 12 文件软上限 | 当前 dialects/ 手写 10 文件（含 base/errors），未超限；若后续再增方言考虑 `dialects/relational/` 子包（非本轮） |
