# M11 嵌入式/时序/文档连接器 companion 质量推分 r41 设计 — CONN-014/011/012/006/013

```yaml
date: 2026-07-04
milestone: M11
round_target: docs/superpowers/evolution/2026-07-04-round-target-r41.md
prd_ids: [CONN-014, CONN-011, CONN-012, CONN-006, CONN-013]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` | category | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|--------|----------|:--------:|------------|----------|
| 1 | MongoDB collection/database 元数据与 `MONGODB_*` 错误域闭合 | CONN-014 | `mongodb` | `document` | 1（簇最低分 **86.1**） | 完整度 **76%→≥88%**；可靠性 **92%→≥94%** | 错误 database、凭证失败、端点不可达返回可定位 `MONGODB_*`；库/集合骨架稳定 |
| 2 | InfluxDB org/bucket 错误与 schema limit 守卫闭合 | CONN-011 | `influxdb` | `timeseries` | 2 | 完整度 **78%→≥88%**；可靠性 **92%→≥94%** | 非法 org/bucket、HTTP 不可达、凭证失败返回 `INFLUX_*`；measurement list 有 limit |
| 3 | TDengine 超级表/子表元数据与 `TDENGINE_*` 错误域闭合 | CONN-012 | `tdengine` | `timeseries` | 3 | 完整度 **78%→≥88%**；测试覆盖 **98%→≥100%** | host/库/凭证错误可定位 `TDENGINE_*`；超级表/子表元数据骨架可列举 |
| 4 | SQLite 路径穿越/只读守卫与 schema/types 边界闭合 | CONN-006 | `sqlite` | `embedded` | 4 | 完整度 **80%→≥90%**；安全性 **88%→≥90%** | 文件不存在、路径穿越、只读库返回 `SQLITE_*`；test_connection 成功/失败可感知 |
| 5 | TimescaleDB hypertable 元数据与 `TIMESCALE_*` 错误域闭合 | CONN-013 | `timescaledb` | `timeseries` | 5（簇最高仍 <90 **88.8**） | 完整度 **80%→≥88%**；可靠性 **94%→≥96%** | 非法 database、扩展未安装、连接超时返回 `TIMESCALE_*`；普通表与 hypertable 区分 |

**依赖链**：`errors.py` 五前缀错误域补全（尤其 `MONGODB_UNKNOWN_DATABASE` 映射缺口）→ 五 connector schema/types 边界巩固 → registry HTTP test + metadata 4xx/502 链 → `test_connectors_gov_r41.py` 全绿 → r40 43/43 + r39 33/33 + r37 40/40 + r36 37/37 回归 → P5 目标加权总分 **≥90**（五 ID STUCK 清零）。

**上轮已交付（本轮不重复 L1 骨架）**：r40 五方言 L1 kickoff（registry + test_connection + schema 自省 + types catalog + `test_connectors_gov_r40.py` 43 条）；r39 QUERY-008/CONN-022/META-003/CONN-017/CONN-010 companion 破 90；r37 关系型/OLAP 五方言 companion 模式（HTTP metadata 400/502 链、`_*_MAX_COLUMNS=500`）。

**STUCK 说明**：五 ID 各连续 1 轮未破 90（86.1–88.8）；本轮 companion 质量推分闭合 r40 遗留的 test_connection/schema/types 边界、结构化 `MONGODB_`/`INFLUX_`/`TDENGINE_`/`SQLITE_`/`TIMESCALE_*` 错误域完整度与 registry HTTP 链缺口。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11 连接器扩展簇；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `dialects/mongodb.py` | L1 完整；**无** `MONGODB_UNKNOWN_DATABASE` test_connection 测、空 collection `list_columns`/`list_tables` smoke、BSON 类型枚举 smoke、HTTP 失败/metadata 链 |
| `dialects/influxdb.py` | L1 完整；**无** `INFLUX_TIMEOUT`/`INFLUX_UNKNOWN_BUCKET` test_connection 测、`list_columns` 类型枚举 smoke、HTTP 链 |
| `dialects/tdengine.py` | `TDENGINE_MAX_COLUMNS=500` 已有；**无** `TDENGINE_TIMEOUT`/`TDENGINE_UNKNOWN_DATABASE` test_connection 测、`list_columns` limit/类型 smoke、HTTP 链 |
| `dialects/sqlite.py` | 路径穿越/permission 已有；**无** `SQLITE_READONLY` 测、非法路径 `open_connection` 守卫测、`list_columns` 类型枚举 smoke、HTTP 链 |
| `dialects/timescaledb.py` | hypertable 标记已有；**无** `TIMESCALE_TIMEOUT`/`TIMESCALE_CONN_REFUSED` 测、`TIMESCALE_MAX_COLUMNS` limit 断言、空 schema hypertable 边界、HTTP 链 |
| `dialects/errors.py` | 五前缀常量与 `map_*` 已有；**`map_mongodb_error` 未返回 `MONGODB_UNKNOWN_DATABASE`**（常量悬空） |
| `metadata/service.py` | 空 schema 400；连接失败 502/504；**可复用** r37 companion 模式做五 type metadata smoke |
| `test_connectors_gov_r40.py` | 43 条 L1 mock；**无** HTTP test_connection 失败链、metadata tables/columns 4xx/502 链 |

**范围框定模块**（1–2）：`backend/app/datasources/dialects/`（sqlite/influxdb/tdengine/timescaledb/mongodb）+ `dialects/errors.py`。

**范围框定文件列表**（16 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/errors.py` | 全部 | 修改：`map_mongodb_error` 补 `MONGODB_UNKNOWN_DATABASE` 路径；五前缀 timeout/auth 映射注释巩固 |
| `backend/app/datasources/dialects/mongodb.py` | CONN-014 | 修改：空 collection `list_columns` 显式 `[]`；`list_tables` 空库 smoke 巩固 |
| `backend/app/datasources/dialects/influxdb.py` | CONN-011 | 修改：空 bucket `list_tables`/`list_columns` 边界注释巩固 |
| `backend/app/datasources/dialects/tdengine.py` | CONN-012 | 修改：`list_columns` limit 切片巩固（已有常量，补行为一致性） |
| `backend/app/datasources/dialects/sqlite.py` | CONN-006 | 修改：`open_connection` 非法路径与 `test_connection` 对称守卫；只读错误路径文档化 |
| `backend/app/datasources/dialects/timescaledb.py` | CONN-013 | 修改：`list_columns` 委托后 `TIMESCALE_MAX_COLUMNS` 切片巩固 |
| `backend/app/datasources/dialects/__init__.py` | 全部 | 修改：导出巩固（若新增常量需 `__all__` 对齐） |
| `tests/test_connectors_gov_r41.py` | 全部 | 新建（≥28 条断言函数） |
| `docs/services/datasources.md` | 全部 | 修改：五方言 r41 companion 边界登记 |
| `docs/automate/prd/F04-CONN.md` | CONN-* | **P5 对账**（非 P3） |

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F04-CONN.md` > `docs/services/datasources.md` > `docs/api/README.md`（本轮无新 HTTP 路由）。

**本轮性质**：M11 **companion 质量推分**（边界闭合 + pytest + 文档），**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、QUERY-009、CONN-016~020、生产级时序 HA、真实 compose 集成环境。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/dialects/
├── errors.py              # map_mongodb_error + MONGODB_UNKNOWN_DATABASE；五前缀映射路径巩固
├── mongodb.py             # 空 collection/database 边界 + BSON 类型枚举
├── influxdb.py            # org/bucket 错误路径 + measurement/field/tag 类型枚举
├── tdengine.py            # stable/table + columns limit/类型枚举
├── sqlite.py              # 只读/非法路径守卫对称
├── timescaledb.py         # hypertable 边界 + TIMESCALE_MAX_COLUMNS + PG 类型对齐
└── __init__.py            # 导出巩固

tests/
└── test_connectors_gov_r41.py   # T-CONN-R41-* / T-REG-R41-*
```

**共享 companion 契约**（五 connector 均满足）：

| 契约项 | r40 已有 | r41 增量 |
|--------|----------|----------|
| 结构化 `code` | 基础路径 | 补全 timeout/unknown_database/readonly 全路径单测 |
| schema 空/未知边界 | 部分 mock | 空库/空 collection/空 bucket、未知 database/schema、零行 columns |
| 列元数据 limit | MongoDB/Influx/Timescale 部分 | TDengine/Timescale `list_columns` 500 切片断言；Influx field/tag 枚举 |
| types catalog | 五 type 已注册 | 断言 `category`/`capabilities`/`displayName` 完整字段（巩固） |
| HTTP 链 | **无** | 每方言 ≥1 失败 test（200 `ok=false`+`code`+`traceId`）+ ≥1 metadata 链（400 或 502） |
| 只读 | 是 | 不变 |
| 回归 | r40 43/43 | r40 + r39 + r37 + r36 全量回归不删旧套件 |

### 3.2 CONN-014 — MongoDB companion

#### 3.2.1 方案比选

| 方案 | unknown database | 空 collection | 结论 |
|------|------------------|---------------|------|
| A 巩固 `map_mongodb_error` + mock HTTP 链 | OperationFailure ns not found → `MONGODB_UNKNOWN_DATABASE` | `find_one` None → `[]` | **采用** — 与 r37 Hive unknown database 对称 |
| B test_connection 显式 `list_database_names` 校验 database 存在 | 额外 round-trip | 同左 | 否决 — 改变 L1 语义、增加延迟 |
| C 真实 mongod compose | — | — | 否决 — 无集成环境 |

#### 3.2.2 实现要点

**文件**：`mongodb.py`、`errors.py`

- `map_mongodb_error`：新增路径 — `database` + (`not found`/`does not exist`/`ns not found`) → `MONGODB_UNKNOWN_DATABASE`；`OperationFailure` code 26（NamespaceNotFound）优先映射。
- `list_tables`：未知 database 已返回 `[]`（r40）；补空库 `list_collection_names` → `[]` smoke。
- `list_columns`：空 collection（`find_one` None）→ `[]`；mock 文档含 `str`/`int`/`bool`/`datetime`/`dict`/`list` → `data_type` 分别为 `string`/`number`/`boolean`/`datetime`/`json`/`json`。
- HTTP：POST `/api/v1/datasources/{id}/test` mock `OperationFailure` auth → 200 `ok=false` `MONGODB_AUTH_FAILED` + `traceId`；GET `/{id}/tables?schema=` → 400 `METADATA_INVALID_REQUEST`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R41-014-01 | mock `database "missing" does not exist` → `code=MONGODB_UNKNOWN_DATABASE` |
| T-CONN-R41-014-02 | mock 空 collection `list_columns` → `[]` |
| T-CONN-R41-014-03 | mock 空库 `list_tables` → `[]` |
| T-CONN-R41-014-04 | mock BSON 六类型 → `data_type` 枚举覆盖 string/number/boolean/datetime/json |
| T-CONN-R41-014-05 | types catalog `mongodb` `category=document` + `schema_browser` 字段完整 |
| T-CONN-R41-014-06 | HTTP POST test mock auth fail → 200 `ok=false` `MONGODB_AUTH_FAILED` + `traceId` |
| T-CONN-R41-014-07 | HTTP GET tables 无 schema → 400 `METADATA_INVALID_REQUEST` |

### 3.3 CONN-011 — InfluxDB companion

#### 3.3.1 方案比选

| 方案 | bucket 错误 | types | 结论 |
|------|-------------|-------|------|
| A 巩固 `map_influx_error` + Flux mock 链 | `bucket not found` → `INFLUX_UNKNOWN_BUCKET` | fieldKeys/tagKeys 枚举 | **采用** |
| B test_connection 显式 list buckets 校验 | 额外 API 调用 | 同左 | 否决 — L1 仅 ping |
| C InfluxDB 1.x 兼容 | — | — | 否决 — 超范围 |

#### 3.3.2 实现要点

**文件**：`influxdb.py`、`errors.py`

- `map_influx_error`：`timeout`/`timed out` → `INFLUX_TIMEOUT`（已有映射，补单测）；`bucket not found` → `INFLUX_UNKNOWN_BUCKET`（已有映射，补 test_connection 单测）。
- `list_tables`：空 bucket Flux 零行 → `[]`（与 unknown 区分：mock 空 records vs query 异常）。
- `list_columns`：mock fieldKeys + tagKeys → `data_type` 为 `number`/`string` 各 ≥1。
- HTTP：POST test mock `401` → 200 `ok=false` `INFLUX_AUTH_FAILED`；GET tables 无 schema → 400。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R41-011-01 | mock timeout → `code=INFLUX_TIMEOUT` |
| T-CONN-R41-011-02 | mock `bucket not found: metrics` → `code=INFLUX_UNKNOWN_BUCKET` |
| T-CONN-R41-011-03 | mock 空 bucket measurements → `list_tables` `[]` |
| T-CONN-R41-011-04 | mock fieldKeys/tagKeys → 类型枚举 number+string |
| T-CONN-R41-011-05 | HTTP POST test mock 401 → 200 `ok=false` `INFLUX_AUTH_FAILED` + `traceId` |
| T-CONN-R41-011-06 | HTTP GET tables 无 schema → 400 `METADATA_INVALID_REQUEST` |

### 3.4 CONN-012 — TDengine companion

#### 3.4.1 方案比选

| 方案 | unknown database | stable/table | 结论 |
|------|------------------|--------------|------|
| A 巩固 `map_tdengine_error` + DESCRIBE mock | connect 异常 message → `TDENGINE_UNKNOWN_DATABASE` | SHOW STABLES/TABLES 合并 | **采用** |
| B REST API 替代 taospy | — | — | 否决 — r40 已选 taospy |
| C 子表层级展开 | — | — | 否决 — 超范围 |

#### 3.4.2 实现要点

**文件**：`tdengine.py`、`errors.py`

- `map_tdengine_error`：`timeout` → `TDENGINE_TIMEOUT`（补单测）；`database not exist` → `TDENGINE_UNKNOWN_DATABASE`（test_connection 补测）。
- `list_tables`：空库 SHOW 零行 → `[]`；stable+table 类型区分回归（r40 已有，r41 保留）。
- `list_columns`：mock DESCRIBE `INT`/`NCHAR`/`TIMESTAMP` 类型枚举；600 列 → 返回 `TDENGINE_MAX_COLUMNS`（500）。
- HTTP：POST test mock auth fail → 200 `ok=false` `TDENGINE_AUTH_FAILED`；GET schemas patch `list_schemas` 失败 → 502 `METADATA_CONNECTION_FAILED`。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R41-012-01 | mock timeout → `code=TDENGINE_TIMEOUT` |
| T-CONN-R41-012-02 | mock `database not exist` → `code=TDENGINE_UNKNOWN_DATABASE` |
| T-CONN-R41-012-03 | mock 空库 `list_tables` → `[]` |
| T-CONN-R41-012-04 | mock DESCRIBE 类型枚举 ≥3 种 `data_type` |
| T-CONN-R41-012-05 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R41-012-06 | HTTP POST test mock auth fail → 200 `ok=false` `TDENGINE_AUTH_FAILED` + `traceId` |
| T-CONN-R41-012-07 | HTTP GET schemas mock 连接失败 → 502 `METADATA_CONNECTION_FAILED` |

### 3.5 CONN-006 — SQLite companion

#### 3.5.1 方案比选

| 方案 | 只读守卫 | 非法路径 | 结论 |
|------|----------|----------|------|
| A `_validate_db_path` 对称 + `map_sqlite_error` readonly | `OperationalError` readonly → `SQLITE_READONLY` | `open_connection` 同 test 守卫 | **采用** |
| B 写模式连接测只读 | 需写后只读文件 | — | 否决 — 平台只读策略，test 用 `mode=ro` |
| C 禁止相对路径 | 仅绝对路径 | — | 否决 — 破坏合法相对路径用例 |

#### 3.5.2 实现要点

**文件**：`sqlite.py`、`errors.py`

- `test_connection`：mock `sqlite3.OperationalError("attempt to write a readonly database")` → `SQLITE_READONLY`（`map_sqlite_error` 已有映射，补单测）。
- `open_connection`：非法路径（`../../etc/passwd`）→ `ValueError(SQLITE_PATH_TRAVERSAL)` 与 test_connection 对称。
- `list_columns`：mock `PRAGMA table_info` 含 `INTEGER`/`TEXT`/`REAL` 类型枚举 smoke。
- HTTP：POST test 不存在文件 → 200 `ok=false` `SQLITE_FILE_NOT_FOUND` + `traceId`；GET tables 缺 schema → 400。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R41-006-01 | mock readonly OperationalError → `code=SQLITE_READONLY` |
| T-CONN-R41-006-02 | `open_connection` 路径穿越 → `ValueError` 含 `SQLITE_PATH_TRAVERSAL` |
| T-CONN-R41-006-03 | mock PRAGMA 类型枚举 integer/text/real |
| T-CONN-R41-006-04 | 空库 `list_tables` → `[]` |
| T-CONN-R41-006-05 | HTTP POST test 缺失文件 → 200 `ok=false` `SQLITE_FILE_NOT_FOUND` + `traceId` |
| T-CONN-R41-006-06 | HTTP GET tables 无 schema → 400 `METADATA_INVALID_REQUEST` |

### 3.6 CONN-013 — TimescaleDB companion

#### 3.6.1 方案比选

| 方案 | hypertable | types | 结论 |
|------|------------|-------|------|
| A PG 委托 + `_hypertable_names` + `TIMESCALE_MAX_COLUMNS` | 空 schema 无 hypertable → 全 `table` | 委托 PG `varchar`/`int4`/`timestamptz` | **采用** |
| B 独立 psycopg 实现 | — | — | 否决 — r40 已选委托 |
| C 连续聚合元数据 | — | — | 否决 — 超范围 |

#### 3.6.2 实现要点

**文件**：`timescaledb.py`、`errors.py`

- `map_timescale_error`：`PG_TIMEOUT` → `TIMESCALE_TIMEOUT`；`connection refused` → `TIMESCALE_CONN_REFUSED`（补单测）。
- `list_tables`：空 schema 零表 → `[]`；无 hypertable 时全为 `table` 类型。
- `list_columns`：委托后切片 `TIMESCALE_MAX_COLUMNS`；mock `varchar`/`int4`/`timestamptz` 类型 smoke。
- HTTP：POST test mock `28P01` → 200 `ok=false` `TIMESCALE_AUTH_FAILED`；GET tables 无 schema → 400。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R41-013-01 | mock timeout → `code=TIMESCALE_TIMEOUT` |
| T-CONN-R41-013-02 | mock connection refused → `code=TIMESCALE_CONN_REFUSED` |
| T-CONN-R41-013-03 | mock 空 schema `list_tables` → `[]` |
| T-CONN-R41-013-04 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R41-013-05 | mock PG 类型枚举 ≥3 种 |
| T-CONN-R41-013-06 | HTTP POST test mock auth fail → 200 `ok=false` `TIMESCALE_AUTH_FAILED` + `traceId` |
| T-CONN-R41-013-07 | HTTP GET tables 无 schema → 400 `METADATA_INVALID_REQUEST` |

### 3.7 注册表回归（T-REG-R41）

| ID | 断言 |
|----|------|
| T-REG-R41-01 | `export_type_catalog()` 仍返回 18 种 type（五新 type 不退化） |
| T-REG-R41-02 | 五 type `connectivity_test` + `schema_browser` capabilities 完整 |

## 4. 与 PRD 8 维薄弱项对齐

| PRD ID | 最薄弱维 | r40 分 | r41 目标 | 设计闭合手段 |
|--------|----------|--------|----------|--------------|
| CONN-014 | 完整度 76% | 86.1 | ≥90 | `MONGODB_UNKNOWN_DATABASE` 映射 + 空库/collection 边界 + BSON 类型枚举 + HTTP 链 |
| CONN-011 | 完整度 78% | 86.8 | ≥90 | `INFLUX_TIMEOUT`/`INFLUX_UNKNOWN_BUCKET` 测 + field/tag 类型枚举 + HTTP 链 |
| CONN-012 | 完整度 78% / 测试 98% | 87.9 | ≥90 | `TDENGINE_TIMEOUT`/`TDENGINE_UNKNOWN_DATABASE` 测 + columns limit/类型 + HTTP 502 链 |
| CONN-006 | 完整度 80% / 安全 88% | 88.4 | ≥90 | `SQLITE_READONLY` + 路径守卫对称 + HTTP 链 |
| CONN-013 | 完整度 80% / 可靠性 94% | 88.8 | ≥90 | `TIMESCALE_TIMEOUT`/`TIMESCALE_CONN_REFUSED` + columns limit + hypertable 空边界 + HTTP 链 |

**推分逻辑**（companion 轮次惯例）：完整度 +2~4%、可靠性 +1~2%、测试覆盖 +1~2%、安全性 +1~2%（CONN-006）→ 加权总分各 ≥90。

## 5. 测试策略

### 5.1 新套件

- **文件**：`tests/test_connectors_gov_r41.py`
- **夹具**：复用 r40 `sqlite+pysqlite` module fixture 模式（`connectors_gov_r41` 内存库名隔离）；HTTP 用例复用 r37 `_create_typed_ds` 辅助（扩展五 type 默认 port/host 语义：sqlite `host=tmp_path`）
- **规模**：≥28 条（CONN-014 ~7 + CONN-011 ~6 + CONN-012 ~7 + CONN-006 ~6 + CONN-013 ~7 + REG ~2）
- **命名**：`T-CONN-R41-014-*`、`T-CONN-R41-011-*`、`T-CONN-R41-012-*`、`T-CONN-R41-006-*`、`T-CONN-R41-013-*`、`T-REG-R41-*`

### 5.2 回归

| 套件 | 期望 |
|------|------|
| `test_connectors_gov_r40.py` | 43/43 |
| `test_query_meta_conn_r39.py` | 33/33 |
| `test_connectors_gov_r37.py` | 40/40 |
| `test_connectors_gov_r36.py` | 37/37 |
| 全量 `pytest` | 无新增 skip；ruff clean |

### 5.3 HTTP 契约（复用 r37 模式）

- 创建 `type=mongodb|influxdb|tdengine|sqlite|timescaledb` 数据源 → POST `/api/v1/datasources/{id}/test` mock 失败 → 200 + `ok=false` + `{PREFIX}_*` + `traceId`
- GET `/api/v1/datasources/{id}/metadata/tables` 缺 `schema` → 400 `METADATA_INVALID_REQUEST`
- GET `/api/v1/datasources/{id}/metadata/schemas` patch `list_schemas` 抛错 → 502 `METADATA_CONNECTION_FAILED`（至少 tdengine 或 mongodb 一条）
- SQLite HTTP test 使用 `tmp_path` 真实文件或 mock `SqliteConnector.test_connection`

## 6. 非目标（明确不做）

- 不修改 `goal.md`、`plan.md` 结构
- 不实现 Admin UI、VIZ-004/008、QUERY-009、CONN-016~020
- 不扩展 `ConnectionOptions` Pydantic schema（留后续 companion 评估）
- 不引入真实 MongoDB/InfluxDB/TDengine/TimescaleDB compose 集成环境
- 不实现五方言 **只读查询 execute** 集成测（留 M4/M11 后续）
- 不修改 r39 已破 90 的 QUERY-008/CONN-022/META-003/CONN-017/CONN-010 簇（仅回归）
- 不新增 Alembic migration（`data_sources.type` 为自由字符串）
- 生产级时序 HA、MongoDB 副本集自动发现、InfluxDB 1.x、SQLite SQLCipher/写模式

## 7. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 companion 质量推分，不触及 `fe/` 或壳层 IA。

## 8. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/datasources.md` | P3 | 五方言 r41 companion 边界（HTTP 链、错误域完整度） |
| `docs/automate/prd/F04-CONN.md` | P5 | CONN-006/011/012/013/014 验收勾选与锚点补 `test_connectors_gov_r41` |
| `docs/api/README.md` | — | 无新路由，通常无需改 |

## 9. P3 任务切分建议（供 planner）

| Task | 内容 | 产出文件 | 预估新测 |
|------|------|----------|----------|
| T1 | `errors.py` 五前缀映射补全（`MONGODB_UNKNOWN_DATABASE` 等） | `errors.py` | 0（被 T2–T6 覆盖） |
| T2 | MongoDB companion 边界 | `mongodb.py` | 7 |
| T3 | InfluxDB companion 边界 | `influxdb.py` | 6 |
| T4 | TDengine companion 边界 | `tdengine.py` | 7 |
| T5 | SQLite companion 边界 | `sqlite.py` | 6 |
| T6 | TimescaleDB companion 边界 | `timescaledb.py` | 7 |
| T7 | `test_connectors_gov_r41.py` 集成 + r40/r39/r37/r36 回归 | `tests/` | 28+ |
| T8 | `docs/services/datasources.md` + PRD 分片 P5 对账注记 | `docs/` | 0 |

**执行顺序**：T1 → T2∥T3∥T4∥T5∥T6（可并行）→ T7 → T8。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `map_mongodb_error` 与 PRD `MONGODB_UNKNOWN_DATABASE` 漂移 | T1 显式补映射 + T-CONN-R41-014-01 门控 |
| SQLite HTTP test 需真实文件路径 | `tmp_path` fixture 创建临时 db；失败路径用不存在文件 |
| InfluxDB Flux mock 链复杂 | patch `_query_api` 与 r40 一致，仅增类型枚举 records |
| TimescaleDB 委托 PG mock 与 r40 重复 | r41 聚焦 timeout/refused/limit；r40 用例全量回归 |
| dialects/ 目录文件数 | 本轮仅修改既有 5+errors，不新增文件 |

## 11. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 文件列表 16 ≤ 20，未超出框定模块
- [x] 无 TBD/TODO 占位
- [x] `ui_design_skill: none` 已记录
- [x] 每项含可测试验收 ID
- [x] 非目标与 r40/r39 边界清晰
- [x] 禁止生产代码（本文档仅 spec）
