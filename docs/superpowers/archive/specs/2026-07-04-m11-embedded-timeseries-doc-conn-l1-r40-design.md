# M11 嵌入式/时序/文档连接器 L1 kickoff r40 设计 — CONN-014/011/012/006/013

```yaml
date: 2026-07-04
milestone: M11
round_target: docs/superpowers/evolution/2026-07-04-round-target-r40.md
prd_ids: [CONN-014, CONN-011, CONN-012, CONN-006, CONN-013]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` | category | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|--------|----------|:--------:|------------|----------|
| 1 | MongoDB 连通 + database/collection 骨架 | CONN-014 | `mongodb` | `document` | 1（最低分 11.5） | 完整度 **5%→≥60%**；架构 **8%→≥40%** | 登记 MongoDB 源可 test_connection；失败有 `MONGODB_*` code + traceId；库/集合骨架可浏览 |
| 2 | InfluxDB 连通 + bucket/org 骨架 | CONN-011 | `influxdb` | `timeseries` | 2 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 连通性检测；非法 org/bucket 不 500；元数据 list 有 limit 守卫 |
| 3 | TDengine 连通 + 库/超级表骨架 | CONN-012 | `tdengine` | `timeseries` | 3 | 完整度 **5%→≥60%**；测试覆盖 **0%→≥50%** | host/库/凭证错误可定位 `TDENGINE_*`；超级表/子表元数据骨架可列举 |
| 4 | SQLite 文件连通 + schema 骨架 | CONN-006 | `sqlite` | `embedded` | 4 | 完整度 **5%→≥60%**；安全性 **11%→≥40%** | 文件路径数据源 test_connection 成功/失败可感知；路径穿越/权限拒绝返回 `SQLITE_*` |
| 5 | TimescaleDB 连通 + hypertable 骨架 | CONN-013 | `timescaledb` | `timeseries` | 5 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | PG 兼容层连通性；schema 自省区分普通表与 hypertable；凭证失败可定位 |

**依赖链**：五方言 connector + `errors.py` 扩展 → `register_builtin_dialects()` 注册 → `export_type_catalog()` 五 type 出现 → `test_connectors_gov_r40.py` smoke → r39 33/33 + r37 40/40 + r36 37/37 回归 → **修复** `test_datasources_l1.py::test_invalid_connector_type`（P4 已知 blocker）→ P5 目标加权总分 **≥80**（r41 companion **≥90**）。

**上轮已交付（本轮不重复）**：r39 QUERY-008/CONN-022/META-003/CONN-017/CONN-010 companion 破 90；r37/r36 关系型/OLAP 五方言；r35 TiDB/StarRocks/ES；**不含** Admin UI、QUERY-009 Dataset 路径、OpenSearch/信创簇。

**PRD 分片锚点漂移注记**（真理源：`round-target` > `prd.md` hub > `prd/F04-CONN.md`）：

| 项 | hub / round-target | F04-CONN.md（陈旧） |
|----|-------------------|---------------------|
| 代码锚点路径 | 扁平 `dialects/<type>.py`（与 r36 一致） | 子目录 `dialects/<type>/` |
| CONN-006 category | `embedded`（文件型嵌入式源） | `relational` |

本轮实现以 **hub + round-target + 现有扁平 dialects 惯例** 为准；P5 回写 F04-CONN 锚点与 category。SRS §3.6 类型枚举尚无 `mongodb`/`influxdb` 等，P5 评估是否回流附录（非 P3 阻塞项）。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11 连接器扩展簇；**禁止**修改 `plan.md` / `goal.md` 结构。

**P3/P4 先行实现注记**（automation memory）：上一轮 P3 已在分支交付五方言 + `test_connectors_gov_r40`（153/153），P4 因 `test_invalid_connector_type` 仍用 `mongodb` 作非法 type 样例而失败（期望 422，得 201）。**本轮设计将修复纳入验收**；P3 若已存在实现，implementer 以本 spec 对账补缺，勿重复造轮子。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `datasources/__init__.py` | 注册 13 种方言（mysql…trino）；**无** sqlite/influxdb/tdengine/timescaledb/mongodb |
| `dialects/errors.py` | 至 TRINO_*；**无** SQLITE/INFLUX/TDENGINE/TIMESCALE/MONGODB |
| `dialects/gaussdb.py` | Postgres 委托模式（TimescaleDB 可对齐） |
| `dialects/elasticsearch.py` | 非 SQL index→schema 映射参考（MongoDB 文档型可对齐） |
| `registry.py` | `ConnectorRegistry` + `export_type_catalog()` 就绪；NFR-04 插件模式 |
| `metadata/service.py` | schema 空参数 400；连接失败 502/504；不泄露密码 |
| `service.py` `_resolve_connector` | 未知 type → 422 `UNKNOWN_CONNECTOR_TYPE` |
| `schemas.py` `ConnectionOptions` | charset/ssl/timeout/pool；**无** influx org 专用字段（L1 用既有字段语义映射，不扩 schema） |
| `pyproject.toml` `connectors-ext` | pyhive/pymssql/oracledb/clickhouse-connect/dmPython/trino；**无** pymongo/influxdb-client/taospy |
| `test_datasources_l1.py` | `test_invalid_connector_type` 使用 `type=mongodb` 作非法样例 — **与 CONN-014 注册冲突** |
| `test_connectors_gov_r36/r37/r39` | 37 + 40 + 33 条；本轮新建 r40 套件，不删旧套件 |

**范围框定模块**（1–2）：`backend/app/datasources/` 方言与 `dialects/` 子包扩展。

**范围框定文件列表**（17 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/mongodb.py` | CONN-014 | 新建 |
| `backend/app/datasources/dialects/influxdb.py` | CONN-011 | 新建 |
| `backend/app/datasources/dialects/tdengine.py` | CONN-012 | 新建 |
| `backend/app/datasources/dialects/sqlite.py` | CONN-006 | 新建 |
| `backend/app/datasources/dialects/timescaledb.py` | CONN-013 | 新建 |
| `backend/app/datasources/dialects/errors.py` | 全部 | 修改：`map_sqlite_*` / `map_influx_*` / `map_tdengine_*` / `map_timescale_*` / `map_mongodb_*` |
| `backend/app/datasources/dialects/__init__.py` | 全部 | 修改：导出五 connector + limit 常量 |
| `backend/app/datasources/__init__.py` | 全部 | 修改：`register_builtin_dialects()` +5 |
| `backend/pyproject.toml` | 全部 | 修改：`connectors-ext` 增 pymongo/influxdb-client/taospy |
| `tests/test_connectors_gov_r40.py` | 全部 | 新建（≥35 条断言函数） |
| `tests/test_datasources_l1.py` | 回归 | 修改：`test_invalid_connector_type` 改用未注册 type（如 `couchdb`） |
| `docs/services/datasources.md` | 全部 | 修改：五方言登记 + r40 kickoff 笔记 |

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F04-CONN.md` > `docs/services/datasources.md` > `docs/api/README.md`（本轮无新 HTTP 路由）。

**本轮性质**：M11 **L1 kickoff**（registry + test_connection + schema 自省 + types catalog + pytest mock smoke）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、真实 compose 集成环境。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/
├── __init__.py                    # +5 register_dialect(...)
└── dialects/
    ├── mongodb.py                 # CONN-014：pymongo
    ├── influxdb.py                # CONN-011：influxdb-client HTTP
    ├── tdengine.py                # CONN-012：taospy REST
    ├── sqlite.py                  # CONN-006：stdlib sqlite3
    ├── timescaledb.py             # CONN-013：psycopg 委托 + hypertable 标记
    ├── errors.py                  # +五前缀 mappers
    └── __init__.py                # 导出

tests/
├── test_connectors_gov_r40.py     # T-CONN-R40-*
└── test_datasources_l1.py         # T-DS-C08 修复非法 type 样例
```

**共享 L1 契约**（五 connector 均满足）：

| 契约项 | 要求 |
|--------|------|
| `DialectConnector` 协议 | `type` / `category` / `capabilities` / `display_name` |
| capabilities | `("connectivity_test", "schema_browser")` |
| `test_connection` | 返回 `TestConnectionResult`；失败含稳定 `{PREFIX}_*` `code` |
| schema 自省 | `list_schemas` / `list_tables` / `list_columns` 可 mock 单测 |
| 注册 | `register_builtin_dialects()` 启动时注册；`export_type_catalog()` 可见 |
| 只读 | 连接器**不**执行写操作；与现有 datasources 链一致 |
| 驱动加载 | 模块内 lazy import；缺驱动时 `test_connection` 返回 `ok=False` + `{PREFIX}_DRIVER_MISSING`（pytest 全程 mock 不触发） |
| limit 守卫 | 列/字段枚举上限 **500**（与 ES/ClickHouse/Oracle 对称） |

### 3.2 连接参数语义映射（五方言统一约定）

现有 `DataSourceCreate` 字段不变；各 connector 在 L1 按下表解释：

| 字段 | MongoDB | InfluxDB 2.x | TDengine | SQLite | TimescaleDB |
|------|---------|--------------|----------|--------|-------------|
| `host` | 主机名/IP | 主机名/IP | 主机名/IP | **文件系统路径**（绝对或相对工作目录） | PG 主机 |
| `port` | 27017 | 8086 | 6041（REST） | **忽略**（存 1 满足校验） | 5432 |
| `database` | 认证默认库 | **bucket** 名 | 库名 | 附加库名或 `main` | PG database |
| `username` | 用户名（可空→无认证） | **org** 名 | 用户名 | 忽略（存 `sqlite`） | PG 用户 |
| `password` | 密码 | **token** | 密码 | 忽略（存占位） | PG 密码 |

InfluxDB/TDengine 的 org/catalog 等扩展语义 **不新增** `ConnectionOptions` 字段；document 于 connector 模块 docstring，P5 评估是否在 companion 轮扩展 `connection_options` JSON。

### 3.3 CONN-014 — MongoDB 连接器

#### 3.3.1 方案比选

| 方案 | 客户端 | schema | 结论 |
|------|--------|--------|------|
| A `pymongo` sync | 27017 | `list_database_names` / `list_collection_names` / 采样 `$sample` 字段 | **采用** — 生态默认；易 mock `MongoClient` |
| B `motor` async | 同左 | 同左 | 否决 — datasources 链同步 L1 |
| C 纯 HTTP Atlas API | REST | 云专用 | 否决 — 覆盖不足 |

#### 3.3.2 实现要点

**文件**：`backend/app/datasources/dialects/mongodb.py`

| 属性 | 值 |
|------|-----|
| `type` | `mongodb` |
| `category` | `document` |
| `display_name` | `MongoDB` |
| 默认 port | 27017 |

**错误码**（`errors.py`：`map_mongodb_error`）：`MONGODB_CONN_REFUSED`、`MONGODB_AUTH_FAILED`、`MONGODB_TIMEOUT`、`MONGODB_UNKNOWN_DATABASE`、`MONGODB_INVALID_HOST`、`MONGODB_UNKNOWN`。

**常量**：`MONGODB_MAX_FIELDS = 500`。

**schema 映射**：

| 方法 | 行为 |
|------|------|
| `list_schemas` | `client.list_database_names()`；过滤 `admin`/`local`/`config` |
| `list_tables` | `db.list_collection_names()`；`schema=""` → `[]`；未知库 → `[]` |
| `list_columns` | `db[collection].find_one()` 或 `list_indexes` 推断字段名+BSON 类型简化为 `string`/`number`/`datetime`/`json`/`unknown`；超 500 字段切片 |

**`test_connection`**：`MongoClient(..., serverSelectionTimeoutMS=timeout)` → `admin.command("ping")`；`ServerSelectionTimeoutError` → `MONGODB_TIMEOUT`；`OperationFailure` 认证 → `MONGODB_AUTH_FAILED`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R40-014-01 | types catalog 含 `mongodb`，`category=document`，capabilities 含 `schema_browser` |
| T-CONN-R40-014-02 | mock ping 成功 → `ok=True` |
| T-CONN-R40-014-03 | mock 认证失败 → `code=MONGODB_AUTH_FAILED` |
| T-CONN-R40-014-04 | mock 连接拒绝 → `code=MONGODB_CONN_REFUSED` |
| T-CONN-R40-014-05 | mock 超时 → `code=MONGODB_TIMEOUT` |
| T-CONN-R40-014-06 | mock 空库 `list_schemas` 过滤系统库后仅业务库 |
| T-CONN-R40-014-07 | mock 未知 database `list_tables` → `[]` |
| T-CONN-R40-014-08 | mock 600 字段文档 → `list_columns` 返回 500 |

### 3.4 CONN-011 — InfluxDB 连接器

#### 3.4.1 方案比选

| 方案 | 客户端 | 版本 | 结论 |
|------|--------|------|------|
| A `influxdb-client` HTTP | 8086 | InfluxDB 2.x | **采用** — 官方 SDK；`PingService`/`BucketsService` 易 mock |
| B InfluxQL 1.x | 8086 | 1.x | 否决 — hub 未区分版本，2.x 为主流 |
| C 纯 requests | REST | 2.x | 否决 — 重复造轮子 |

#### 3.4.2 实现要点

**文件**：`backend/app/datasources/dialects/influxdb.py`

| 属性 | 值 |
|------|-----|
| `type` | `influxdb` |
| `category` | `timeseries` |
| `display_name` | `InfluxDB` |
| 默认 port | 8086 |

**错误码**：`INFLUX_CONN_REFUSED`、`INFLUX_AUTH_FAILED`、`INFLUX_TIMEOUT`、`INFLUX_UNKNOWN_ORG`、`INFLUX_UNKNOWN_BUCKET`、`INFLUX_UNKNOWN`。

**常量**：`INFLUX_MAX_MEASUREMENTS = 500`（`list_tables` 上限）。

**schema 映射**（Influx 2.x 概念对齐 VitalSpan 三级 browse）：

| 方法 | 映射 |
|------|------|
| `list_schemas` | 列出 org 下 buckets（`BucketsService.find_buckets`）→ `SchemaInfo(name=bucket)` |
| `list_tables` | 对 bucket 执行 `SHOW MEASUREMENTS` 或 API 查询 measurement 列表；非法 bucket → `[]` |
| `list_columns` | 对 measurement 执行 `SHOW FIELD KEYS` + `SHOW TAG KEYS` 合并；类型映射为 `number`/`string`/`datetime` |

**`test_connection`**：`InfluxDBClient(url, token, org).ping()` 或 health check；401/403 → `INFLUX_AUTH_FAILED`；未知 org → `INFLUX_UNKNOWN_ORG`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R40-011-01 | types catalog 含 `influxdb` `category=timeseries` |
| T-CONN-R40-011-02 | mock ping 成功 → `ok=True` |
| T-CONN-R40-011-03 | mock 401 → `INFLUX_AUTH_FAILED` |
| T-CONN-R40-011-04 | mock connection refused → `INFLUX_CONN_REFUSED` |
| T-CONN-R40-011-05 | mock 非法 org → `INFLUX_UNKNOWN_ORG` |
| T-CONN-R40-011-06 | mock 未知 bucket measurements → `[]` |
| T-CONN-R40-011-07 | mock 600 measurements → `list_tables` 返回 500 |

### 3.5 CONN-012 — TDengine 连接器

#### 3.5.1 方案比选

| 方案 | 协议 | 端口 | 结论 |
|------|------|------|------|
| A `taospy` REST | HTTP | 6041 | **采用** — 无 native 库依赖更重；REST 易 mock |
| B `taospy` native | TCP | 6030 | 否决 — 部署防火墙常封 6030 |
| C JDBC jaydebeapi | JDBC | — | 否决 — JVM 依赖 |

#### 3.5.2 实现要点

**文件**：`backend/app/datasources/dialects/tdengine.py`

| 属性 | 值 |
|------|-----|
| `type` | `tdengine` |
| `category` | `timeseries` |
| `display_name` | `TDengine` |
| 默认 port | 6041 |

**错误码**：`TDENGINE_CONN_REFUSED`、`TDENGINE_AUTH_FAILED`、`TDENGINE_TIMEOUT`、`TDENGINE_UNKNOWN_DATABASE`、`TDENGINE_UNKNOWN`。

**常量**：`TDENGINE_MAX_COLUMNS = 500`。

**schema 映射**：

| 方法 | SQL / 行为 |
|------|------------|
| `list_schemas` | `SHOW DATABASES`；过滤 `information_schema` |
| `list_tables` | `SHOW STABLES` + `SHOW TABLES` 合并；stable 标记 `type=stable`，普通表 `type=table` |
| `list_columns` | `DESCRIBE {db}.{table}` 解析 col/类型；未知表 → `[]` |

**`test_connection`**：REST `SELECT server_version()` 或 taospy `connect` + 简单查询；登录失败 → `TDENGINE_AUTH_FAILED`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R40-012-01 | types catalog 含 `tdengine` `category=timeseries` |
| T-CONN-R40-012-02 | mock 成功 → `ok=True` |
| T-CONN-R40-012-03 | mock 认证失败 → `TDENGINE_AUTH_FAILED` |
| T-CONN-R40-012-04 | mock 端点不可达 → `TDENGINE_CONN_REFUSED` |
| T-CONN-R40-012-05 | mock 未知 database `list_tables` → `[]` |
| T-CONN-R40-012-06 | mock stable+table 列表含 `type` 区分 |
| T-CONN-R40-012-07 | registry 插件注册不修改 `ConnectorRegistry` 核心类（NFR-04 结构断言） |

### 3.6 CONN-006 — SQLite 连接器

#### 3.6.1 方案比选

| 方案 | 库 | 安全 | 结论 |
|------|-----|------|------|
| A stdlib `sqlite3` | 内置 | 路径校验模块内 | **采用** — 零额外依赖；政企离线场景 |
| B `apsw` | 第三方 | 同左 | 否决 — 不必要依赖 |
| C SQLAlchemy URL | 已有 | 混淆托管库 | 否决 — 数据源连接器语义为**外部文件** |

#### 3.6.2 实现要点

**文件**：`backend/app/datasources/dialects/sqlite.py`

| 属性 | 值 |
|------|-----|
| `type` | `sqlite` |
| `category` | `embedded` |
| `display_name` | `SQLite` |

**错误码**：`SQLITE_FILE_NOT_FOUND`、`SQLITE_PATH_TRAVERSAL`、`SQLITE_PERMISSION_DENIED`、`SQLITE_READONLY`、`SQLITE_CORRUPT`、`SQLITE_UNKNOWN`。

**路径安全 L1**（`_validate_db_path(host: str) -> Path`）：

1. 拒绝含 `..` 片段的路径字符串（`SQLITE_PATH_TRAVERSAL`）
2. 拒绝不存在文件（`SQLITE_FILE_NOT_FOUND`）
3. `os.access(path, R_OK)` 失败 → `SQLITE_PERMISSION_DENIED`
4. 以 `mode=ro` URI 打开探测；仅当显式只读失败且文件可写时仍允许连接（L1 不强制 WAL）

**schema 映射**：

| 方法 | SQL |
|------|-----|
| `list_schemas` | 单文件库返回 `[SchemaInfo(name="main")]` |
| `list_tables` | `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'` |
| `list_columns` | `PRAGMA table_info({table})`；未知表 → `[]` |

**`test_connection`**：校验路径 → `sqlite3.connect(f"file:{path}?mode=ro", uri=True)` → `SELECT 1`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R40-006-01 | types catalog 含 `sqlite` `category=embedded` |
| T-CONN-R40-006-02 | tmp 文件 mock/真实 → `ok=True` |
| T-CONN-R40-006-03 | 不存在路径 → `SQLITE_FILE_NOT_FOUND` |
| T-CONN-R40-006-04 | `../../etc/passwd` 样式 → `SQLITE_PATH_TRAVERSAL` |
| T-CONN-R40-006-05 | mock 无读权限 → `SQLITE_PERMISSION_DENIED` |
| T-CONN-R40-006-06 | `list_schemas` 返回 `main` |
| T-CONN-R40-006-07 | 未知表 `list_columns` → `[]` |

### 3.7 CONN-013 — TimescaleDB 连接器

#### 3.7.1 方案比选

| 方案 | 实现 | hypertable | 结论 |
|------|------|------------|------|
| A psycopg 委托 + 扩展查询 | 同 PostgresConnector | `timescaledb_information.hypertables` | **采用** — 与 GaussDB 模式一致 |
| B 独立 timescaledb 驱动 | 无官方 | — | 否决 |
| C 复用 `type=postgresql` | 无独立 type | 无 hypertable 标记 | 否决 — hub 要求独立 `timescaledb` type |

#### 3.7.2 实现要点

**文件**：`backend/app/datasources/dialects/timescaledb.py`

| 属性 | 值 |
|------|-----|
| `type` | `timescaledb` |
| `category` | `timeseries` |
| `display_name` | `TimescaleDB` |
| 委托 | 内部 `PostgresConnector()` 实例 |

**错误码**（`map_timescale_error` 委托 `map_postgres_operational_error` 再映射）：`TIMESCALE_CONN_REFUSED`、`TIMESCALE_AUTH_FAILED`、`TIMESCALE_TIMEOUT`、`TIMESCALE_UNKNOWN_DATABASE`、`TIMESCALE_EXTENSION_MISSING`、`TIMESCALE_UNKNOWN`。

**`test_connection`**：委托 `SELECT 1`；额外 `SELECT 1 FROM pg_extension WHERE extname='timescaledb'` — 无行 → `ok=False` + `TIMESCALE_EXTENSION_MISSING`（L1 区分「PG 可连但非 Timescale」）。

**schema 映射**：

| 方法 | 行为 |
|------|------|
| `list_schemas` | 委托 `list_schemas` |
| `list_tables` | 委托 `list_tables` 后 LEFT JOIN hypertable 集合；匹配行 `type=hypertable`，否则保留 `table`/`view` |
| `list_columns` | 委托 + `TIMESCALE_MAX_COLUMNS=500` 切片 |

**types catalog 与 PG 族**：`timescaledb` 独立 catalog 项；`postgresql` 回归不受影响。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R40-013-01 | types catalog 含 `timescaledb` `category=timeseries` |
| T-CONN-R40-013-02 | mock PG ping 成功 + 扩展存在 → `ok=True` |
| T-CONN-R40-013-03 | mock 认证失败 → `TIMESCALE_AUTH_FAILED` |
| T-CONN-R40-013-04 | mock 扩展缺失 → `TIMESCALE_EXTENSION_MISSING` |
| T-CONN-R40-013-05 | mock 未知 database → 委托 PG 行为 / `TIMESCALE_UNKNOWN_DATABASE` |
| T-CONN-R40-013-06 | mock tables 含 hypertable 标记 `type=hypertable` |
| T-CONN-R40-013-07 | `postgresql` types catalog 仍独立存在（联合回归） |

### 3.8 errors.py 扩展

在 `backend/app/datasources/dialects/errors.py` 追加五组常量与 `map_*` 函数；**禁止**在各方言文件内复制错误码字符串。`__all__` 同步导出。

映射原则：

| 前缀 | 来源异常线索 |
|------|-------------|
| `MONGODB_*` | `ServerSelectionTimeoutError`、`OperationFailure` code 13/18 |
| `INFLUX_*` | HTTP 401/404、`ApiException` message |
| `TDENGINE_*` | taospy `ConnectionError`、`ProgrammingError` |
| `SQLITE_*` | 路径校验、`sqlite3.OperationalError` |
| `TIMESCALE_*` | PG 异常 + 扩展探测逻辑 |

### 3.9 注册与 types catalog

`register_builtin_dialects()` 追加顺序（与执行顺序一致）：

```python
register_dialect(MongodbConnector())
register_dialect(InfluxdbConnector())
register_dialect(TdengineConnector())
register_dialect(SqliteConnector())
register_dialect(TimescaledbConnector())
```

`export_type_catalog()` 应返回 **18** 种 type（原 13 + 5）；联合 pytest 断言五新 type 均含 `connectivity_test` + `schema_browser`。

## 4. P4 回归修复 — `test_invalid_connector_type`

**根因**：`tests/test_datasources_l1.py::test_invalid_connector_type`（T-DS-C08）使用 `type: "mongodb"` 验证 422；CONN-014 注册后 `mongodb` 为合法 type，创建返回 201。

**修复**（纳入 P3 Task「回归门控」）：

```python
bad = {**_payload(), "type": "couchdb", "code": "couch_ds"}
```

选用 **未注册** 且非未来计划 type 的字符串 `couchdb`；断言仍为 `422` + `UNKNOWN_CONNECTOR_TYPE`。**禁止**从 registry 移除 `mongodb` 来迁就测试。

## 5. 测试策略

### 5.1 新套件

**文件**：`tests/test_connectors_gov_r40.py`

- 独立 SQLite 元库：`connectors_gov_r40`（fixture 模式同 r36/r37/r39）。
- 命名：`T-CONN-R40-*` / `T-REG-R40-*`。
- 目标 **≥35** 条独立断言函数（上表五方言合计 36 条，实施可参数化合并，计划阶段承诺 ≥35）。
- 保留 r39（33）+ r37（40）+ r36（37）不删；Task 末全量回归 **110/110** 连接器 gov 套件 + r40 全绿。

### 5.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  tests/test_connectors_gov_r40.py \
  tests/test_connectors_gov_r39.py \
  tests/test_connectors_gov_r37.py \
  tests/test_connectors_gov_r36.py \
  tests/test_datasources_l1.py::test_invalid_connector_type \
  -v
```

全量基线：r39 后 **924 passed** + 4 skipped；本轮目标 **≥959 passed** + 4 skipped（+35 r40 新测），且 **零失败**。

### 5.3 HTTP 语义说明

- `test_connection` 失败路径：**HTTP 200** + body `ok=false` + `code={PREFIX}_*` + `traceId`（与 DS-003 既有契约一致）；round-target「4xx」指 **metadata** 非法参数（400）、未知 type（422）、连接失败（502）及 **结构化 code 可定位**，不改为 test 端点抛 4xx。
- schema API：空 `schema` query → 400 `METADATA_INVALID_REQUEST`（五方言复用既有 metadata 链）。

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | L1 目标 | r41 companion 目标 |
|--------|------------------|--------------|---------|---------------------|
| CONN-014 | 完整度 5%、架构 8%、测试 0% | pymongo + `MONGODB_*` + 8 测 | 完整度 ≥60%、架构 ≥40%、测试 ≥50% | 总分 ≥90 |
| CONN-011 | 完整度 5%、可靠性 0%、测试 0% | influxdb-client + org/bucket 映射 + 7 测 | 完整度 ≥60%、可靠性 ≥40% | 总分 ≥90 |
| CONN-012 | 完整度 5%、测试 0% | taospy REST + stable 标记 + 7 测 | 完整度 ≥60%、测试 ≥50% | 总分 ≥90 |
| CONN-006 | 完整度 5%、安全性 11%、测试 0% | 路径穿越守卫 + `SQLITE_*` + 7 测 | 完整度 ≥60%、安全性 ≥40% | 总分 ≥90 |
| CONN-013 | 完整度 5%、可靠性 0%、测试 0% | PG 委托 + hypertable + 7 测 | 完整度 ≥60%、可靠性 ≥40% | 总分 ≥90 |

## 7. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- Admin 数据源配置全量 UI（`fe/`）
- QUERY-008/009、META-003~006、CONN-016~020 信创/OpenSearch
- VIZ-003 地图可视化
- 五方言 **只读查询 execute** 集成测（留 M4/M11 companion）
- 生产级时序 HA、分片路由、MongoDB 副本集自动发现
- InfluxDB 1.x 兼容层、TDengine 集群多 endpoint 负载均衡
- SQLite **写**连接、ATTACH 多库、加密 SQLCipher
- TimescaleDB 连续聚合/压缩策略元数据
- 真实 Docker compose 集成测试（可选 `integration` mark，不阻塞 L1）
- 新增 Alembic migration（`data_sources.type` 为自由字符串）
- 扩展 `ConnectionOptions` Pydantic schema（留 r41 companion 评估）

## 8. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/datasources.md` | P3 | 五方言 In 表 + r40 kickoff 笔记 |
| `docs/automate/prd/F04-CONN.md` | P5 | CONN-006/011/012/013/014 状态/验收/锚点；category 与扁平路径 |
| `docs/api/README.md` | — | 无新路由，通常无需改 |
| `docs/srs/全生命周期系统需求规格说明书.md` §3.6 | P5 评估 | 增五类型行（若产品确认） |

## 9. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 L1 kickoff，不触及 `fe/` 或壳层 IA；无「UI 设计交付」小节要求项。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `test_invalid_connector_type` 与 CONN-014 冲突 | §4 明确改用 `couchdb`；纳入回归门控 Task |
| P3 分支已有实现与本 spec 漂移 | P3 以 spec 对账；memory 提示 153/153 为参考，以 spec 验收表为准 |
| PRD 锚点子目录 vs 扁平文件 | 以 r36 惯例扁平 `dialects/<type>.py`；P5 回写 F04-CONN |
| 可选驱动未安装 | lazy import + `{PREFIX}_DRIVER_MISSING`；`connectors-ext` 增依赖 |
| InfluxDB org/bucket 字段语义不直观 | 模块 docstring + datasources.md 连接参数表；companion 轮评估 ConnectionOptions |
| SQLite `host` 存路径与关系型 host 语义冲突 | `category=embedded` + 文档明确；UI 层后续适配 |
| dialects/ 目录文件数逼近 12 软上限 | 当前 10 手写 + 5 新 = 15；若下轮再增考虑 `dialects/timeseries/` 子包（非本轮） |
| TimescaleDB 与 postgresql type 双注册查询混淆 | 独立 `timescaledb` type；T-CONN-R40-013-07 回归 |

## 11. 方案比选摘要（批量级）

| 维度 | 方案 A（采用） | 方案 B | 方案 C |
|------|---------------|--------|--------|
| 文件布局 | 扁平 `dialects/*.py` 对齐 r36 | PRD 子目录 `dialects/mongodb/` | 单文件 `dialects/m11_misc.py` |
| TimescaleDB | PG 委托 + 扩展探测 | 仅 `type=postgresql` | 独立 psycopg 复制 |
| 测试组织 | 新文件 `test_connectors_gov_r40.py` | 并入 r39 | 仅 HTTP e2e |
| 非法 type 回归 | 改样例为 `couchdb` | 跳过 T-DS-C08 | 特殊 case mongodb |

**推荐 A**：最小侵入、与既有演化节奏一致、P4 blocker 有明确修复路径。
