# M11 关系型/OLAP 连接器 companion 质量推分 r37 设计 — CONN-004/008/005/003/007

```yaml
date: 2026-07-04
milestone: M11
round_target: docs/superpowers/evolution/2026-07-04-round-target.md
prd_ids: [CONN-004, CONN-008, CONN-005, CONN-003, CONN-007]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|--------|:--------:|------------|----------|
| 1 | Oracle test_connection/schema/types 边界闭合 | CONN-004 | `oracle` | 1（簇最低分 86.2） | 完整度 **76%→≥88%**；可靠性 **92%→≥94%** | SID/service 错误、凭证失败返回 `ORACLE_*`；owner/table 层级自省稳定 |
| 2 | Doris 连通/schema/limit 与 FE 不可达降级 | CONN-008 | `doris` | 2 | 完整度 **78%→≥88%**；可靠性 **93%→≥94%** | FE/BE 不可达报错清晰；宽表列元数据有 limit 不 500 |
| 3 | SQL Server 实例/库/凭证/TLS 边界闭合 | CONN-005 | `sqlserver` | 3 | 完整度 **78%→≥88%**；安全性 **90%→≥92%** | 错误实例/库/凭证可定位 `SQLSERVER_*`；dbo 与自定义 schema 可列 |
| 4 | Hive catalog/schema/types 边界闭合 | CONN-003 | `hive` | 4 | 完整度 **80%→≥90%**；测试覆盖 **96%→≥98%** | 错误 catalog、凭证失败返回 `HIVE_*`；库/表/列骨架可浏览 |
| 5 | ClickHouse 元数据 limit 与不可达端点降级 | CONN-007 | `clickhouse` | 5（簇最高仍 <90） | 完整度 **78%→≥88%**；性能 **90%→≥92%** | 不可达端点、非法 database/table 返回 `CLICKHOUSE_*`；宽表 limit 守卫 |

**依赖链**：`errors.py` 五方言错误域集中导出 → 五 connector 边界补强（limit/空 schema/未知 owner）→ registry HTTP + metadata 链 smoke → `test_connectors_gov_r37.py` 全绿 → r36 37/37 + r35 35/35 + r34 15/15 回归 → P5 目标加权总分 **≥90**（五 ID STUCK 清零）。

**上轮已交付（本轮不重复 L1 骨架）**：r36 五方言 L1 kickoff（registry + test_connection + schema 自省 + types catalog + `test_connectors_gov_r36.py` 37 条）；r35 TiDB/StarRocks/ES companion 模式（`TIDB_*`/`STARROCKS_*` 独立错误域 + `STARROCKS_MAX_COLUMNS` + HTTP metadata 400/502 链）。

**STUCK 说明**：五 ID 各连续 1 轮未破 90（86.2–87.8）；本轮 companion 质量推分闭合 r36 遗留的 test_connection/schema/types 边界、结构化错误域完整度与 registry HTTP 链缺口。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `dialects/oracle.py` | L1 完整；**无** `ORACLE_TIMEOUT` 测、`list_schemas`/`list_tables` owner 层级 smoke、未知 owner 边界、HTTP 失败链 |
| `dialects/doris.py` | `DORIS_*` 仅 4 码；**无** `DORIS_UNKNOWN_DATABASE`、`DORIS_TIMEOUT` 测、**无** `DORIS_MAX_COLUMNS`（StarRocks r35 已有 500） |
| `dialects/sqlserver.py` | 错误映射在 `errors.py`；**无** `SQLSERVER_TIMEOUT`/`SQLSERVER_SSL_ERROR` 单测、空 schema/dbo+custom schema smoke、非法 `ssl_mode` 守卫测 |
| `dialects/hive.py` | `HIVE_*` 在模块内；**无** `HIVE_UNKNOWN_DATABASE` test_connection 测、全空 `list_schemas`、未知 catalog columns、HTTP 失败链 |
| `dialects/clickhouse.py` | 已有 `CLICKHOUSE_MAX_COLUMNS=500`；**无** `CLICKHOUSE_TIMEOUT` 测、非法 table `list_columns`、metadata HTTP 链 |
| `dialects/errors.py` | 含 `map_sqlserver_*` / `map_oracle_*`；**无** HIVE/CLICKHOUSE/DORIS 常量导出（分散在方言模块） |
| `metadata/service.py` | 空 schema 400；连接失败 502/504；**可复用** r25 companion 模式做五新 type metadata smoke |
| `test_connectors_gov_r36.py` | 37 条 L1；仅 1 条 HTTP 成功链（hive test）；**无** 五方言失败 HTTP、metadata tables/columns 4xx/502 链 |

**范围框定模块**（1–2）：`backend/app/datasources/` 方言与连接器注册（CONN-003/004/005/007/008）。

**范围框定文件列表**（16 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/oracle.py` | CONN-004 | 修改：未知 owner 守卫、可选 `ORACLE_MAX_COLUMNS` |
| `backend/app/datasources/dialects/doris.py` | CONN-008 | 修改：`DORIS_UNKNOWN_DATABASE`、`DORIS_MAX_COLUMNS`、timeout 映射 |
| `backend/app/datasources/dialects/sqlserver.py` | CONN-005 | 修改：非法 ssl_mode 早返回、可选列 limit |
| `backend/app/datasources/dialects/hive.py` | CONN-003 | 修改：空库守卫、列 describe 过滤加固 |
| `backend/app/datasources/dialects/clickhouse.py` | CONN-007 | 修改：非法 table 边界显式化 |
| `backend/app/datasources/dialects/errors.py` | 全部 | 修改：导出 `HIVE_*`/`CLICKHOUSE_*`/`DORIS_*` 常量与 mapper（自方言模块上浮） |
| `backend/app/datasources/dialects/__init__.py` | 全部 | 修改：导出新增常量（若上浮） |
| `tests/test_connectors_gov_r37.py` | 全部 | 新建（≥28 条断言函数） |
| `docs/services/datasources.md` | 全部 | 修改：r37 五方言边界登记 |
| `docs/automate/prd/F04-CONN.md` | CONN-* | **P5 对账**（非 P3） |

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F04-CONN.md` > `docs/services/datasources.md` > `docs/api/README.md`（本轮无新 HTTP 路由）。

**本轮性质**：M11 **companion 质量推分**（边界闭合 + pytest + 文档），**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、QUERY/META 远期项、CONN-022 GaussDB、生产级 HA/OLAP 优化、真实 compose 集成环境。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/dialects/
├── errors.py              # + HIVE_/CLICKHOUSE_/DORIS_ 常量与 map_* 上浮
├── oracle.py              # + owner/table 边界、ORACLE_MAX_COLUMNS=500
├── doris.py               # + DORIS_UNKNOWN_DATABASE、DORIS_MAX_COLUMNS=500
├── sqlserver.py           # + SQLSERVER_MAX_COLUMNS=500、ssl_mode 校验巩固
├── hive.py                # + HIVE_MAX_COLUMNS=500（宽表 DESCRIBE 切片）
├── clickhouse.py          # 非法 table 边界注释/守卫巩固
└── __init__.py            # 导出上浮常量

tests/
└── test_connectors_gov_r37.py   # T-CONN-R37-* / T-REG-R37-* 新用例
```

**共享 companion 契约**（五 connector 均满足）：

| 契约项 | r36 已有 | r37 增量 |
|--------|----------|----------|
| 结构化 `code` | 基础路径 | 补全 timeout/unknown_database/ssl 全路径单测 |
| schema 空/未知边界 | 部分 | 空 schemas、未知 owner/catalog/schema、零行 columns |
| 列元数据 limit | ClickHouse 500 | Doris/Hive/Oracle/SQL Server 对齐 **500**（与 StarRocks/ES 对称） |
| types catalog | 五 type 已注册 | 断言 `category`/`capabilities`/`displayName` 完整字段 |
| HTTP 链 | hive 成功 test | 每方言 ≥1 失败 test（200 `ok=false`+`code`）+ ≥1 metadata 链（200 或 400/502） |
| 只读 | 是 | 不变 |
| 回归 | r36 37/37 | r36+r35+r34 全量回归不删旧套件 |

### 3.2 CONN-004 — Oracle companion

#### 3.2.1 方案比选

| 方案 | SID/service | schema | 结论 |
|------|-------------|--------|------|
| A 巩固 thin `service_name` + `database` 字段承载 SID/service；errors 映射 ORA-12514/12505 | 单字段 | `ALL_*` 视图 | **采用** — 与 r36 一致，补测与 limit |
| B 新增 `connection_options.sid` 双字段 | 显式 SID | 同左 | 否决 — 超范围（需 schema/API 变更） |
| C JDBC thick mode | — | — | 否决 — 重型依赖 |

#### 3.2.2 实现要点

**文件**：`backend/app/datasources/dialects/oracle.py`、`errors.py`

- `map_oracle_error` 扩展：`ora-12505`（unknown SID）→ `ORACLE_UNKNOWN_SERVICE`（与 service name 错误共用码，message 保留原文）。
- 常量：`ORACLE_MAX_COLUMNS = 500`；`list_columns` 超 500 切片（稳定 `ORDER BY COLUMN_ID` 后切片）。
- `list_schemas`：mock 测多 owner（`HR`、`APP`）且过滤 `SYS`/`SYSTEM`。
- `list_tables(connection, "UNKNOWN_OWNER")`：mock 零行 → `[]`（非 500）。
- `list_columns(connection, "", table)` / 未知 owner：已有空守卫；补 mock 类型枚举 smoke（`VARCHAR2`/`NUMBER`/`DATE`）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R37-004-01 | mock ORA-12505 → `code=ORACLE_UNKNOWN_SERVICE` |
| T-CONN-R37-004-02 | mock timeout → `code=ORACLE_TIMEOUT` |
| T-CONN-R37-004-03 | mock 多 owner `list_schemas` 含 `HR` 不含 `SYS` |
| T-CONN-R37-004-04 | mock 未知 owner `list_tables` → `[]` |
| T-CONN-R37-004-05 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R37-004-06 | types catalog `oracle` `category=relational` + `schema_browser` |
| T-CONN-R37-004-07 | HTTP POST `/datasources/test` type=oracle mock ORA-01017 → 200 `ok=false` `code=ORACLE_AUTH_FAILED` `traceId` 存在 |

### 3.3 CONN-008 — Doris companion

#### 3.3.1 实现要点

**文件**：`backend/app/datasources/dialects/doris.py`、`errors.py`

- 新增 `DORIS_UNKNOWN_DATABASE`：映射 `MYSQL_UNKNOWN_DATABASE`（errno 1049）。
- `DORIS_MAX_COLUMNS = 500`；`list_columns` 委托后切片（镜像 `starrocks.py`）。
- `test_connection` mock errno 2013 → `DORIS_TIMEOUT`（r36 未测）。
- 非法 catalog：`list_schemas` mock 仅系统库 → 过滤后 `[]`；`list_tables(missing)` → `[]`（r36 已部分覆盖，r37 补 schemas 空链）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R37-008-01 | mock 1049 → `code=DORIS_UNKNOWN_DATABASE` |
| T-CONN-R37-008-02 | mock 2013 → `code=DORIS_TIMEOUT` |
| T-CONN-R37-008-03 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R37-008-04 | mock 空用户库 `list_schemas` → `[]` |
| T-CONN-R37-008-05 | HTTP POST `/datasources/test` mock 2003 → 200 `ok=false` `code=DORIS_CONN_REFUSED` |
| T-CONN-R37-008-06 | HTTP GET `/{id}/tables?schema=` → 400 `METADATA_INVALID_REQUEST`（doris 数据源） |

### 3.4 CONN-005 — SQL Server companion

#### 3.4.1 实现要点

**文件**：`backend/app/datasources/dialects/sqlserver.py`、`errors.py`

- 补测：`SQLSERVER_TIMEOUT`（errno 20002/20003）、`SQLSERVER_SSL_ERROR`（message 含 ssl/encrypt）。
- `SQLSERVER_MAX_COLUMNS = 500`；`list_columns` 超 500 切片。
- schema smoke：mock `list_schemas` 含 `dbo` 与 `sales`；`list_tables(conn, "dbo")` 与 `list_tables(conn, "sales")` 各返回表。
- 非法 `ssl_mode`：`ValueError` 由 `test_connection` 捕获 → `ok=False` `code=None` 或包装为 `SQLSERVER_UNKNOWN`（采用 **保持 ValueError 路径返回 code=None**，单测断言 message 含 `invalid ssl_mode`）。
- TLS：`ssl_mode=disabled` mock 断言 `encrypt=False`（与 r36 required 对称）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R37-005-01 | mock 20002 → `code=SQLSERVER_TIMEOUT` |
| T-CONN-R37-005-02 | mock ssl error message → `code=SQLSERVER_SSL_ERROR` |
| T-CONN-R37-005-03 | mock `list_schemas` 含 `dbo` 与自定义 schema |
| T-CONN-R37-005-04 | mock 空库 `list_schemas` → `[]` |
| T-CONN-R37-005-05 | mock 未知 schema `list_tables` → `[]` |
| T-CONN-R37-005-06 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R37-005-07 | `ssl_mode=disabled` → `encrypt=False` |
| T-CONN-R37-005-08 | HTTP POST `/datasources/test` mock 18456 → 200 `ok=false` `code=SQLSERVER_AUTH_FAILED` |

### 3.5 CONN-003 — Hive companion

#### 3.5.1 实现要点

**文件**：`backend/app/datasources/dialects/hive.py`、`errors.py`

- `map_hive_error` 上浮至 `errors.py`（`from errors import map_hive_error, HIVE_*`）。
- `HIVE_MAX_COLUMNS = 500`；`list_columns` DESCRIBE 结果超 500 切片。
- `test_connection` mock「database X does not exist」→ `HIVE_UNKNOWN_DATABASE`。
- `list_schemas` mock 仅 `information_schema` → `[]`（全空库）。
- `list_columns` mock 类型行 `string`/`bigint`/`double` 枚举 smoke。
- catalog 边界：`list_tables(conn, "unknown_cat")` 零行 → `[]`（r36 已有，r37 保留回归）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R37-003-01 | mock unknown database → `code=HIVE_UNKNOWN_DATABASE` |
| T-CONN-R37-003-02 | mock 全空 `list_schemas` → `[]` |
| T-CONN-R37-003-03 | mock DESCRIBE 类型枚举 ≥3 种 `data_type` |
| T-CONN-R37-003-04 | mock 600 列 → `list_columns` 返回 500 |
| T-CONN-R37-003-05 | types catalog `hive` `category=lake` |
| T-CONN-R37-003-06 | HTTP POST `/datasources/test` mock auth fail → 200 `ok=false` `code=HIVE_AUTH_FAILED` |
| T-CONN-R37-003-07 | HTTP GET `/{id}/schemas` patch `list_schemas` 失败 → 502 `METADATA_CONNECTION_FAILED` |

### 3.6 CONN-007 — ClickHouse companion

#### 3.6.1 实现要点

**文件**：`backend/app/datasources/dialects/clickhouse.py`、`errors.py`

- `map_clickhouse_error` 上浮至 `errors.py`。
- 补测：`CLICKHOUSE_TIMEOUT`；`list_columns(conn, db, "missing_table")` mock 零行 → `[]`。
- 性能 smoke：mock 600 列 + `time.perf_counter` 断言 <0.1s（纯切片，镜像 r35 StarRocks）。
- QUERY 对齐：`get_sql_dialect("clickhouse").connector_type == "clickhouse"` 回归（r36 已有，r37 保留一条 T-REG）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R37-007-01 | mock timeout → `code=CLICKHOUSE_TIMEOUT` |
| T-CONN-R37-007-02 | mock 未知 table `list_columns` → `[]` |
| T-CONN-R37-007-03 | mock 600 列 limit + perf <0.1s |
| T-CONN-R37-007-04 | types catalog `clickhouse` `category=olap` |
| T-CONN-R37-007-05 | HTTP POST `/datasources/test` mock refused → 200 `ok=false` `code=CLICKHOUSE_CONN_REFUSED` |
| T-CONN-R37-007-06 | HTTP GET `/{id}/tables` 无 schema → 400 `METADATA_INVALID_REQUEST` |
| T-CONN-R37-007-07 | `get_sql_dialect("clickhouse")` 回归 |

### 3.7 T-REG-R37 — Registry + HTTP 链巩固

| ID | 断言 |
|----|------|
| T-REG-R37-01 | `export_type_catalog()` 五新 type 均含 `displayName`/`category`/`capabilities` |
| T-REG-R37-02 | 创建五 type 各一 DataSource（mock test）→ GET `/datasources/types` 均可见 |
| T-REG-R37-03 | r36 `test_connectors_gov_r36.py` 全量回归导入无冲突 |
| T-REG-R37-04 | mysql `test_connection` mock 成功不回归（与 r36 T-REG-R36-04 同模式） |

## 4. 测试策略

### 4.1 新套件

**文件**：`tests/test_connectors_gov_r37.py`

- 独立 SQLite DB：`connectors_gov_r37`（fixture 模式同 r36）。
- 命名：`T-CONN-R37-*` / `T-REG-R37-*`。
- 目标 **≥28** 条新测（上表合计 33 条，实施时可参数化，计划阶段承诺 ≥28 独立断言函数）。
- 保留 `test_connectors_gov_r36.py` / `r35` / `r34` 不删；Task 末全量回归 r36 37/37 + r35 35/35 + r34 15/15。

### 4.2 HTTP 链约定

| 场景 | HTTP 状态 | body |
|------|-----------|------|
| `test_connection` 失败（配置/凭证/网络） | **200** | `ok=false`，`code={PREFIX}_*`，`traceId` 存在 |
| metadata 缺 schema/table 参数 | **400** | `code=METADATA_INVALID_REQUEST` |
| metadata 连接/驱动失败 | **502** | `code=METADATA_CONNECTION_FAILED` |
| metadata 超时 | **504** | `code=METADATA_TIMEOUT` |

round-target「4xx pytest」指 **metadata 无效请求 400** 与 **test_connection 结构化 code** 组合覆盖；**不**将 test_connection 失败改为 HTTP 4xx（与 r34/r36 契约一致）。

### 4.3 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r37.py tests/test_connectors_gov_r36.py tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py -v
```

全量基线：r36 后 **814 passed** + 4 skipped；本轮目标 **≥842 passed** + 4 skipped。

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | 目标 |
|--------|------------------|--------------|------|
| CONN-004 | 完整度 76%、可靠性 92% | ORA-12505/timeout + owner 层级 + columns limit + HTTP 失败链 | 完整度 ≥88%、可靠性 ≥94%、总分 ≥90 |
| CONN-008 | 完整度 78%、可靠性 93% | `DORIS_UNKNOWN_DATABASE`/timeout + columns limit + metadata 400 | 完整度 ≥88%、可靠性 ≥94%、总分 ≥90 |
| CONN-005 | 完整度 78%、安全性 90% | timeout/ssl + dbo/custom schema + TLS disabled + columns limit | 完整度 ≥88%、安全性 ≥92%、总分 ≥90 |
| CONN-003 | 完整度 80%、测试覆盖 96% | unknown database + 空库 + types smoke + metadata 502 | 完整度 ≥90%、测试覆盖 ≥98%、总分 ≥90 |
| CONN-007 | 完整度 78%、性能 90% | timeout + 未知 table + limit perf + metadata 400 | 完整度 ≥88%、性能 ≥92%、总分 ≥90 |

## 6. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- Admin 数据源配置全量 UI（`fe/`）
- QUERY-008/009、META-003~006、CONN-022 GaussDB
- Hive/ClickHouse/Doris 生产级 HA、完整 OLAP 查询优化、真实 compose 集成环境
- r35 已破 90 的 CONN-021/009/015、GOV-004/008
- 新增 Alembic migration、新 HTTP 路由
- `connection_options` 扩展 SID 专用字段（Oracle 仍用 `database` 承载 service/SID）
- 将 test_connection 失败改为 HTTP 4xx（破坏 r34+ 契约）

## 7. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| 五方言错误码、limit、schema 边界 | `docs/services/datasources.md` §r37 |
| 验收勾选与代码锚点 | `prd/F04-CONN.md` CONN-003~008（**P5**） |
| hub 8 维重评 | `prd.md` frontmatter（**P5**） |

## 8. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 companion 质量推分，不触及 `fe/` 与壳层 IA；无 UI 设计交付要求。

## 9. Self-review 清单

- [x] 覆盖 round-target 五子项全部验收标准
- [x] 文件列表 16 ≤ 20，未超出 `datasources/` 模块框定
- [x] 无 TBD/TODO 占位
- [x] `ui_design_skill: none` 已记录
- [x] 错误体与项目 envelope 一致：`{code, message, detail}` / test `ok+code+traceId`
- [x] 未要求编写生产代码（本文档仅设计）
