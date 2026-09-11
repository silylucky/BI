# datasources — 数据源与连接器

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/datasources/` |
| PRD | [F03-DS](../automate/prd/F03-DS.md) · [F04-CONN](../automate/prd/F04-CONN.md) |
| 里程碑 | 连接层（贯穿 M1–M4） |
| 状态 | **已实现（L1 companion r25）** |

## 职责

- 数据源 CRUD、凭证加密存储、连接池生命周期（按 `dataSourceId` 隔离）
- `ConnectorRegistry`：按 `type` 注册方言实现（`dialects/*`）
- 已注册类型发现 API（`GET /datasources/types`）
- 元数据探测（schema/table/column）、连通性测试
- 数据源级 ACL 可见性守卫（对接 `auth/resources` grant）
- 为 `query` 提供按 `dataSourceId` 隔离的执行上下文

## 边界

| In | Out |
|----|-----|
| 连接配置、方言适配、池化、元数据浏览 L1 API | SQL 语义解析与图表绑定（→ `query`） |
| 官方演示源 **`demo`**（显示名「示例数据」；`sample_db` 自动注册 + 启动迁移） | 生产环境业务库直连（非演示包） |
| 托管分析库 `analytics`（同步入湖目标；列表默认隐藏，`includeManaged=true` 内部可见） | 用户当普通业务源增删托管分析库 |
| CONN-014~016：`probe_readonly_*` + `execute_native_query`（MongoDB find / ES·OS search） | GridFS 写入、集群管理、OpenSearch Dashboards 嵌入 |
| CONN-023~026（**r249**）：REST API / Excel·CSV 文件 / Db2 / Impala 方言注册与连通链 | OAuth2 专用表单项、文件上传 UI、`query/native/executor` HTTP 出数（companion） |
| CONN-028（**r028**）：RoAPI 联邦查询 sidecar（`type=roapi`；schema/SQL native；compose optional profile） | ingestion 自动入湖、GraphQL 查询前端、RoAPI 动态表注册 UI |
| 连接器插件目录 `dialects/`（mysql、postgresql） | Dataset 语义层（四期 → `metadata` + `query`） |
| 数据源列表/详情 ACL 过滤（grant 可见性） | M7 完整 RLS 执行链 |
| 类型发现、schema 浏览 REST API | Admin UI 数据源管理界面 |

## 依赖

- `core`：配置、日志、DB
- `auth/resources`（M2）：`list_visible_resource_ids` / `ensure_resource_visible` 供 ACL 守卫
- 下游 M4 `query`：消费元数据与连接池

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `ConnectorRegistry` | 连接器注册表 | DS-001 | 已实现 |
| `dialects/mysql.py` | MySQL 方言 + schema_browser | CONN-001 | 已实现 |
| `dialects/mariadb.py` | MariaDB 关系型（MySQL 协议委托，`type=mariadb`） | CONN-003 | 已实现（M7 r228） |
| `dialects/relational_hints.py` | Oracle/SQL Server 标识符/分页/类型映射纯函数 | CONN-005 | 已实现（M7 r228） |
| `dialects/postgres.py` | PostgreSQL 方言 + schema_browser | CONN-002 | 已实现 |
| `dialects/tidb.py` | TiDB HTAP 方言（MySQL 协议委托，默认 port 4000；**r242** `probe_readonly_sql`） | CONN-021 | 已实现 + companion r242 |
| `dialects/starrocks.py` | StarRocks OLAP 方言（MySQL 协议，port 9030，`category=olap`） | CONN-009 | 已实现 |
| `dialects/elasticsearch.py` | Elasticsearch 搜索方言（index→schema 映射） | CONN-015 | 已实现 |
| `dialects/opensearch.py` | OpenSearch 搜索方言（镜像 ES；`register_connector_plugin`） | CONN-016 | 已实现 L1 |
| `dialects/hive.py` | Apache Hive 湖仓方言（HiveServer2，port 10000，`category=lake`） | CONN-003 | 已实现（L1 r36 + companion r37） |
| `dialects/clickhouse.py` | ClickHouse OLAP 方言（HTTP，port 8123，`CLICKHOUSE_MAX_COLUMNS=500`） | CONN-007 | 已实现（L1 r36 + companion r37） |
| `dialects/sqlserver.py` | SQL Server 关系型（pymssql，TLS L1，`category=relational`） | CONN-005 | 已实现（L1 r36 + companion r37） |
| `dialects/doris.py` | Apache Doris OLAP（MySQL 协议委托，port 9030） | CONN-008 | 已实现（L1 r36 + companion r37） |
| `dialects/oracle.py` | Oracle 关系型（oracledb thin，service name，`category=relational`） | CONN-004 | 已实现（L1 r36 + companion r37） |
| `dialects/gaussdb.py` | GaussDB 关系型（psycopg 3 委托 PostgresConnector，`GAUSSDB_*`） | CONN-022 | 已实现 L1 + companion r39 |
| `dialects/dm.py` | 达梦 DM 关系型（dmPython，`DM_*`；**r242** `probe_readonly_sql`） | CONN-017 | 已实现 L1 + companion r242 |
| `dialects/trino.py` | Trino 联邦湖仓（trino-python-client，catalog/schema 三级，`category=lake`） | CONN-010 | 已实现 L1 + companion r39 |
| `dialects/presto.py` | Presto 联邦湖仓（委托 TrinoConnector，`type=presto`） | CONN-010 | 已实现（M11 r235） |
| `dialects/mongodb.py` | MongoDB 文档型（pymongo，`category=document`） | CONN-014 | 已实现 L1 r40 + companion r41 |
| `dialects/influxdb.py` | InfluxDB 2.x 时序（influxdb-client，org/bucket 语义映射） | CONN-011 | 已实现 L1 r40 + companion r41 |
| `dialects/tdengine.py` | TDengine 时序（taospy REST，stable 标记） | CONN-012 | 已实现 L1 r40 + companion r41 |
| `dialects/sqlite.py` | SQLite 嵌入式文件源（`host=路径`，路径穿越守卫） | CONN-006 | 已实现 L1 r40 + companion r41 |
| `dialects/timescaledb.py` | TimescaleDB 时序（PG 委托 + hypertable 标记） | CONN-013 | 已实现 L1 r40 + companion r41 |
| `dialects/gbase.py` | 南大通用 GBase 8a（MySQL 协议委托，port 5258，`GBASE_*`；**r242** `probe_readonly_sql`） | CONN-019 | 已实现 L1 r46 + companion r242 |
| `dialects/oceanbase.py` | OceanBase 关系型（MySQL 协议委托，port 2881，`OCEANBASE_*`；**r242** `probe_readonly_sql`；`register_connector_plugin`） | CONN-020 | 已实现 L1 r54 + companion r242 |
| `dialects/kingbase/` | 人大金仓 KingbaseES（PG 协议委托，port 54321，`KINGBASE_*`；**r242** `probe_readonly_sql`；`register_connector_plugin`；**r67** `params.py` 预校验 + `probe.py`） | CONN-018 | companion 已实现 r67 + r242 |
| `dialects/rest_api.py` | REST API 数据源（httpx，`category=api`，`REST_API_*`；`probe_readonly_fetch` + `execute_native_query`） | CONN-023 | 已实现（r249） |
| `dialects/excel.py` · `dialects/csv_file.py` | Excel/CSV 文件源（本地路径 + HTTPS URL，`category=file`，`FILE_*`） | CONN-024 | 已实现（r249） |
| `dialects/db2.py` | IBM Db2 关系型（ibm_db，`probe_readonly_sql`，`DB2_*`） | CONN-025 | 已实现（r249） |
| `dialects/impala.py` | Apache Impala 湖仓（pyhive.hive，`category=lake`，`IMPALA_*`） | CONN-026 | 已实现（r249） |
| `dialects/redshift.py` | AWS Redshift 云数仓（psycopg3 委托 PostgresConnector，port 5439，SSL required，`category=olap`，`REDSHIFT_*`） | CONN-027 | 已实现（r250，M-FINAL F-G 收官） |
| `dialects/roapi.py` | RoAPI 联邦查询 sidecar（httpx，`category=api`，`ROAPI_*`；schema/SQL native 查询） | CONN-028 | 已实现 |
| `pool.py` | 按 dataSourceId 隔离连接池 | DS-006 | 已实现 |
| `metadata/service.py` | schema/table/column 浏览编排 | DS-004 | 已实现 |
| `acl.py` | 数据源可见性守卫 | DS-008 | 已实现 |
| `DataSourceService` | CRUD + 测试连接 + ACL | DS-001~008 | 已实现（L1 companion） |

## 关联 API

见 [api/README.md](../api/README.md) §数据源。

## 实现笔记

### RoAPI sidecar 选型（CONN-028）

| 类型 | 典型场景 | 查询方式 |
|------|----------|----------|
| **roapi** | 内网轻量 sidecar；Parquet/CSV/JSON + 少量表联邦 | DataFusion SQL / RoAPI REST |
| **trino/presto** | 已有湖仓联邦集群 | Trino SQL |
| **rest_api** | 业务系统不规则 JSON API | path + jsonPath |

本地 PoC：`docker compose --profile roapi up -d roapi` → `http://127.0.0.1:8086/api/schema`。


- **物理库**：compose `sample-mysql:3307` / `sample_db`；首次 init 见 `docker/demo-mysql/tables.sql`；**存量卷**由启动时 `ensure_sample_db_schema()` 应用 `docker/demo-mysql/migrations/` 增量迁移（含 `vs_official_*` 视图；`004` 将事实表补齐至少 600 行）
- **元库注册**：启动顺序 `ensure_sample_db_schema` → `ensure_official_demo_datasource()`（`ENSURE_OFFICIAL_DEMO_DATASOURCE`，默认开）幂等写入 code **`demo`**；legacy `official-demo-mysql` 一次性 rename；`delete` 对 `demo` 返回 409
- **示例实例**：`seed_demo_instances()` 预置中文 slug「官方示例-*」看板/大屏（绑定「示例数据」源；legacy `demo-*` slug 自动迁移）
- **就绪 API**：`GET /api/v1/demo-package/status`（Hub 横幅 / 运维探测）
- **SQL 契约**：内置模板 chart 须引用 `backend/app/dashboard/templates/official_demo_sql.py` + 占位 `__demo:sample_db__`
- **验收模板**：`builtin-viz-component-gallery`（Hub 默认隐藏，43 种 chartType 各一 widget）

- L1：`data_sources` 表 + CRUD + 凭证 SM4（Fernet 遗留双读，见 `core/crypto/` · ADR-06）+ 双连通测试端点；首期方言 `mysql`；不含连接池与 schema 浏览。
- r23：`ConnectorRegistry.unregister` + `register_usage_checker` 引用保护；MySQL `dialects/errors.py` 稳定错误码（`MYSQL_*`）；`deleted_at` 软删 L1；列表分页/PATCH；连通性测试进程内 2s 防重 L1（单 worker）；`CredentialDecryptError` 结构化解密失败；test 响应 `traceId`。

### r24 质量推分（2026-07-03）

- **CONN-001**：MySQL `connection_options` 消费 — SSL 三态、charset/collation、connect/read 分层 timeout；`TestConnectionResult.code` 结构化 `MYSQL_*`
- **DS-001**：`ConnectorRegistry` `RLock`；`export_type_catalog()` DS-007 预留形状
- **DS-002**：`connection_options` JSON 列；软删后 `code` 可复用（PostgreSQL 部分唯一索引 + service 层检测）
- **DS-003**：inflight acquire + finally release；测试日志 `datasource_test` + `traceId`
- **DS-005**：凭证 `password_encrypted` 仅 SM4（`sm4:` 前缀）；部署前运行 `scripts/migrate-credentials-to-sm4.py`

### r25 companion kickoff（2026-07-03）

- **CONN-002**：`dialects/postgres.py`（psycopg 3）+ `schema_browser` 协议对称
- **DS-007**：`GET /api/v1/datasources/types`（`displayName` + capabilities）
- **DS-006**：`pool.py` 按 `dataSourceId` 隔离；删除数据源 `evict_pool`
- **DS-004**：`metadata/` schema/table/column 只读 API；502 不泄露密码
- **DS-008**：`acl.py` admin bypass + grant 过滤列表/守卫单条与测试

### r34 connector kickoff（2026-07-04）

- **CONN-021**：`dialects/tidb.py` — MySQL 协议委托；独立 `type=tidb`；默认 port 4000；`category=relational`
- **CONN-009**：`dialects/starrocks.py` — MySQL 协议委托；独立 `type=starrocks`；默认 port 9030；`category=olap`；超时映射 `STARROCKS_*`（与 MySQL `MYSQL_*` 边界分离）
- **CONN-015**：`dialects/elasticsearch.py` — 非 SQL 映射：`list_schemas`→index、`list_tables`→`_doc` 伪表、`list_columns`→mapping 字段；`category=search`
- **CONN-016**：`dialects/opensearch.py` — 镜像 ES 映射；`type=opensearch`；`register_connector_plugin(OpensearchConnector())`；`OPENSEARCH_*` 错误域；`opensearch-py>=2.4.0`（connectors-ext）

### r52 companion 质量推分（CONN-016）

- **CONN-016**：`errors.map_opensearch_error` 单出口（含 `OPENSEARCH_INDEX_NOT_FOUND`）；空 indices `list_schemas`→`[]`；空 properties `list_columns`→`[]`；`probe_list_columns_mock`（<100ms smoke）

### r35 companion 质量推分（CONN-021/009/015）

- **TiDB**：`test_connection` 返回 `TIDB_TIMEOUT`/`TIDB_CONN_REFUSED`/`TIDB_AUTH_FAILED`/`TIDB_UNKNOWN_DATABASE`；空库 `list_schemas` 与未知表 `list_columns` 返回 `[]`
- **StarRocks**：补全 `STARROCKS_CONN_REFUSED`/`STARROCKS_AUTH_FAILED` pytest；`list_tables(schema="")` 返回 `[]`；`list_columns` 宽表切片 `STARROCKS_MAX_COLUMNS=500`
- **Elasticsearch**：`ES_AUTH_FAILED`/`ES_CONNECTION_REFUSED`/`ES_TIMEOUT`；`list_schemas` 多索引过滤 `.` 前缀；`_normalize_es_type` 映射 BI 类型；`ES_MAX_MAPPING_FIELDS=500`；port 443 使用 https

### r36 connector kickoff（2026-07-04）

- **CONN-003/007/005/008/004**：五方言 L1 — Hive/ClickHouse/SQL Server/Doris/Oracle 注册至 `ConnectorRegistry`；`test_connection` + schema 自省 + `export_type_catalog()` 可见
- **可选依赖**：`pyproject.toml` `[project.optional-dependencies] connectors-ext`（pyhive、pymssql、oracledb、clickhouse-connect）
- **错误码**：`HIVE_*` / `CLICKHOUSE_*` / `SQLSERVER_*` / `DORIS_*` / `ORACLE_*` 结构化失败路径；连通性测试 HTTP 200 + `ok=false` + `code` + `traceId`
- **PRD 对账**：`F04-CONN.md` 验收条款 P5 重评（非 P3）

### r37 companion 质量推分（2026-07-04）

五方言 companion 边界闭合（CONN-003/004/005/007/008）：

| 方言 | 错误域上浮 | 列 limit | 边界闭合 |
|------|-----------|---------|---------|
| Oracle | `errors.map_oracle_error`（含 ORA-12505） | `ORACLE_MAX_COLUMNS=500` | 未知 owner → `[]`；多 owner schema 过滤 SYS/SYSTEM |
| Doris | `errors.map_doris_operational_error`（含 `DORIS_UNKNOWN_DATABASE`） | `DORIS_MAX_COLUMNS=500` | 空用户库 schemas → `[]` |
| SQL Server | `errors.map_sqlserver_operational_error` | `SQLSERVER_MAX_COLUMNS=500` | dbo/自定义 schema；`ssl_mode=disabled` → `encrypt=False` |
| Hive | `errors.map_hive_error` | `HIVE_MAX_COLUMNS=500` | 全空库 schemas → `[]`；unknown database |
| ClickHouse | `errors.map_clickhouse_error` | `CLICKHOUSE_MAX_COLUMNS=500`（r36） | 未知 table columns → `[]` |

- 测试套件：`tests/test_connectors_gov_r37.py`（≥28 条 T-CONN-R37-* / T-REG-R37-*）
- HTTP 契约：test_connection 失败 200 + `ok=false` + `{PREFIX}_*`；metadata 缺参 400 `METADATA_INVALID_REQUEST`；连接失败 502 `METADATA_CONNECTION_FAILED`
- 回归：r36 37/37 + r35 35/35 + r34 15/15 不删旧套件

### r38 connector kickoff（2026-07-04）

| type | display_name | category | driver | 状态 |
|------|--------------|----------|--------|------|
| gaussdb | GaussDB | relational | psycopg 3（PG 兼容委托） | 已实现 L1 |
| dm | 达梦 DM | relational | dmPython | 已实现 L1 |
| trino | Trino | lake | trino-python-client | 已实现 L1 |

- 错误码前缀：`GAUSSDB_*`、`DM_*`、`TRINO_*`
- 可选依赖：`connectors-ext` 增 `dmPython`、`trino`
- 测试套件：`tests/test_query_meta_conn_r38.py`（CONN-010/017/022 段）

### r39 companion 质量推分（2026-07-04）

- **CONN-010 Trino**：`TRINO_*` timeout/auth 全路径 pytest；catalog 空→[]；`TRINO_MAX_COLUMNS=500`；HTTP test + metadata tables 缺 schema 400
- **CONN-022 GaussDB**：`GAUSSDB_MAX_COLUMNS=500`；`GAUSSDB_TIMEOUT`/`GAUSSDB_AUTH_FAILED` HTTP 链；委托 PG schema 过滤；**r243** `probe_readonly_sql` + FE hints port 5432
- **CONN-017 DM**：多 owner `list_schemas` 过滤 SYS/SYSDBA；`DM_TIMEOUT`；HTTP test 响应不泄露请求 password；metadata 400 链
- 回归：`test_query_meta_conn_r39.py` ≥30 条 + r38 36/36

### r40 connector kickoff（2026-07-04）

- 五方言 L1 — MongoDB/InfluxDB/TDengine/SQLite/TimescaleDB；`export_type_catalog()` 18 types
- 错误码前缀：`MONGODB_*` / `INFLUX_*` / `TDENGINE_*` / `SQLITE_*` / `TIMESCALE_*`
- 可选依赖：`connectors-ext` 增 pymongo、influxdb-client、taospy
- 测试套件：`tests/test_connectors_gov_r40.py`（≥35 条 T-CONN-R40-* / T-REG-R40-*）
- 回归修复：`test_datasources_l1.py::test_invalid_connector_type` 改用未注册 `couchdb`（CONN-014 注册后 `mongodb` 为合法 type）
- PRD 对账：`F04-CONN.md` 验收条款 P5 重评（非 P3）

### r41 companion 质量推分（2026-07-04）

五方言 companion 边界闭合（CONN-006/011/012/013/014）：

| 方言 | 错误域闭合 | 列 limit | 边界闭合 |
|------|-----------|---------|---------|
| MongoDB | `map_mongodb_error` 补 `MONGODB_UNKNOWN_DATABASE`（code 26 / ns not found） | `MONGODB_MAX_FIELDS=500` | 空库/空 collection → `[]`；BSON 六类型枚举 |
| InfluxDB | `INFLUX_TIMEOUT`/`INFLUX_UNKNOWN_BUCKET` test_connection 全路径 | `INFLUX_MAX_MEASUREMENTS=500` | 空 bucket measurements → `[]`；fieldKeys/tagKeys 类型枚举 |
| TDengine | `TDENGINE_TIMEOUT`/`TDENGINE_UNKNOWN_DATABASE` test_connection 全路径 | `TDENGINE_MAX_COLUMNS=500` | 空库 SHOW 零行 → `[]`；DESCRIBE 类型枚举 |
| SQLite | `SQLITE_READONLY` + `open_connection` 路径穿越对称 | `SQLITE_MAX_COLUMNS=500` | 只读/非法路径/空库边界 |
| TimescaleDB | `TIMESCALE_TIMEOUT`/`TIMESCALE_CONN_REFUSED` test_connection 全路径 | `TIMESCALE_MAX_COLUMNS=500` | 空 schema → `[]`；hypertable 标记保留 r40 |

- 测试套件：`tests/test_connectors_gov_r41.py`（35 条 T-CONN-R41-* / T-REG-R41-*）
- HTTP 契约：test_connection 失败 200 + `ok=false` + `{PREFIX}_*` + `traceId`；metadata tables 缺 schema 400 `METADATA_INVALID_REQUEST`；schemas 连接失败 502 `METADATA_CONNECTION_FAILED`
- 回归：r40 43/43 + r39 33/33 + r37 40/40 + r36 37/37 不删旧套件
- PRD 对账：`F04-CONN.md` CONN-006/011/012/013/014 验收 P5 重评（非 P3）

### r55 companion 质量推分（CONN-020）

- **CONN-020**：空库 `list_schemas` → `[]`（对称 GBase companion）；`OCEANBASE_MAX_COLUMNS=500` 列截断；HTTP test 200 `ok=false` + `code` + `traceId`；metadata tables 缺 schema 400 `METADATA_INVALID_REQUEST`；schemas 连接失败 502 `METADATA_CONNECTION_FAILED`；`probe_test_connection_budget_ms=100`

### r67 companion 质量推分（CONN-018）

- **CONN-018**：`kingbase/params.py` — `validate_kingbase_connection_params`；`KINGBASE_INVALID_PARAMS` / `KINGBASE_PORT_OUT_OF_RANGE`；HTTP `POST /datasources/test` kingbase 类型在 Pydantic 前预校验 → 422 + `detail.fields`；`kingbase/probe.py` — `probe_test_connection_budget_ms` ≤50ms（mock inner）

### M7 r228 集成验收（2026-07-06）

- **CONN-003**：`MariadbConnector` 注册；可选 compose `sample-mariadb:3308`
- **CONN-004~005**：Oracle/SQL Server mock HTTP 链 + `relational_hints` 列类型归一化
- **CONN-006**：`tests/fixtures/m7/sample.db` 只读集成
- **CONN-007**：可选 compose `sample-clickhouse:8124`
- 集成测：`tests/test_connectors_m7_r228.py`（`@pytest.mark.integration`，无 compose 时分层 skip）

### M7 r229 集成验收（CONN-008 · 2026-07-06）

- **M7 r229** (`tests/test_connectors_m7_r229.py`): CONN-008 Doris M7 收官 — types catalog + HTTP test/metadata mock 链 + optional 9030 compose skip

### M11 r235 集成验收（CONN-009~013 · 2026-07-07）

- **CONN-009**：`STARROCKS_UNKNOWN_DATABASE` 对称 Doris；`tests/test_connectors_m11_r235.py` HTTP test/metadata mock + optional 9030 skip
- **CONN-010**：`PrestoConnector` 委托 `TrinoConnector`（`type=presto`）；`metadata/service.py` 对 `trino`/`presto` 传 `catalog=row.database`
- **CONN-011**：InfluxDB **2.x only**（`username=org`, `password=token`, `database=bucket`）；**不支持** InfluxDB 1.x / InfluxQL；连接器级只读 Flux `limit(n:1)` 探测
- **CONN-012**：`taospy>=2.7.0`（`connectors-ext`）；HTTP metadata stable 类型标记
- **CONN-013**：`probe_readonly_sql` → `SELECT 1`；hypertable 元数据标记；compose 专用服务 **`sample-timescaledb:5434`** / 库 `ops_tsdb`（与 `analytics-postgres:5433` 分离）
- 集成测：`tests/test_connectors_m11_r235.py`（`@pytest.mark.integration`，无 compose 时分层 skip）
- 回归：r34~r35、r38~r39、r40~r41 不删旧套件

### CONN-013 运维时序样例库（2026-07-17）

- **compose**：`sample-timescaledb` 宿主机 **5434** → 库 `ops_tsdb`（TimescaleDB 2.x + PG16）
- **schema**：`docker/sample-timescaledb/01-schema.sql`（hypertable：`host_metrics`、`service_metrics`、`k8s_pod_metrics` 等）
- **维度种子**：`docker/sample-timescaledb/02-dimensions.sql`
- **灌数**：`scripts/seed-ops-timescaledb.py`（`--days N` / `--truncate`）；PowerShell 启动器 `scripts/seed-ops-timescaledb.ps1`
- **集成测**：`tests/test_ops_tsdb_compose.py`（`@pytest.mark.integration`；`conftest` `timescaledb.port=5434`）
- **与 analytics 边界**：`analytics-postgres:5433` 为 ingestion 托管分析库，**无** Timescale 扩展；CONN-013 compose 验收须连 **5434**

### r242 companion 收官（CONN-017~021 · 2026-07-07）

- **r242 companion（CONN-017~021）**：五型 `probe_readonly_sql`（DM `SELECT 1 FROM DUAL`；Kingbase psycopg `SELECT 1`；GBase/OceanBase/TiDB pymysql `SELECT 1`）；FE `CONNECTOR_FIELD_HINTS` 默认端口 5236/54321/5258/2881/4000；集成测 `tests/test_mfinal_fc_r242.py` ≥25 断言
- **CONN-017**：`probe_readonly_sql` + Admin 表单可选达梦（port 5236）
- **CONN-018**：`KingbaseConnector.probe_readonly_sql` + FE hints port 54321
- **CONN-019**：`GbaseConnector.probe_readonly_sql` + FE hints port 5258
- **CONN-020**：`OceanbaseConnector.probe_readonly_sql` + FE 租户提示文案
- **CONN-021**：`TidbConnector.probe_readonly_sql` + FE hints port 4000（独立 `type=tidb`）
- 集成测：`tests/test_mfinal_fc_r242.py`（25 passed / 6 skipped compose 占位）
- FE smoke：`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`（T-CONN-R242-FE-01~04）
