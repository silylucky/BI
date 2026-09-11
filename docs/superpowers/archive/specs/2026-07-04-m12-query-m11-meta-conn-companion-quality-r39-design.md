# M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 companion 质量推分 r39 设计

```yaml
date: 2026-07-04
milestone: M11 + M12 + META
round_target: docs/superpowers/evolution/2026-07-04-round-target-r39.md
prd_ids: [QUERY-008, CONN-022, META-003, CONN-017, CONN-010]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` / 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|---------------|:--------:|------------|----------|
| 1 | Trino catalog/schema/types 边界闭合 | CONN-010 | `trino` | 1（簇最低分 **87.1**） | 完整度 **76%→≥88%**；可靠性 **92%→≥94%** | 错误 catalog/schema、凭证失败、端点不可达返回 `TRINO_*`；catalog/schema/table 三级自省稳定 |
| 2 | 维度 values 注册/校验与分页边界 | META-003 | `dimensions/` | 2 | 完整度 **80%→≥90%**；测试覆盖 **96%→≥98%** | 重复/非法 value code、空 label、分页 limit 边界返回 `META_DIM_*`；与 glossary 分页契约一致 |
| 3 | GaussDB 凭证/库错误与 schema/types 边界 | CONN-022 | `gaussdb` | 3 | 完整度 **78%→≥88%**；可靠性 **93%→≥94%** | 错误库名、凭证失败、超时返回 `GAUSSDB_*`；PG 兼容层 schema/列自省边界清晰 |
| 4 | 达梦 DM 连接/schema owner 层级与脱敏 | CONN-017 | `dm` | 4 | 完整度 **78%→≥88%**；安全性 **88%→≥90%** | 实例/库/凭证错误可定位 `DM_*`；owner/table 层级自省；HTTP 响应不泄露密码 |
| 5 | 翻译器多方言参数化与算子/字段守卫 | QUERY-008 | `translator/` | 5（距 90 最近 **89.6**） | 完整度 **88%→≥92%**；用户价值 **82%→≥86%** | 三方言 `in`/`OR`/limit 参数化闭环；非法算子/字段/标识符返回 `QUERY_TRANSLATE_*` |

**依赖链**：`errors.py` 三连接器错误域补全 → 三 connector 边界（limit/空 catalog/owner 层级）→ `dimensions` values 校验链 → `translator` 算子白名单与注入守卫 → `test_query_meta_conn_r39.py` 全绿 → r38 36/36 + r37 40/40 回归 → P5 目标加权总分 **≥90**（五 ID STUCK 清零）。

**上轮已交付（本轮不重复 L1 骨架）**：r38 五 ID L1 kickoff（translate API 三方言、GaussDB/DM/Trino dialects + types catalog、dimensions CRUD/values 8 路由、`test_query_meta_conn_r38.py` 36 条）；r37 关系型/OLAP 五方言 companion 模式（HTTP metadata 400/502 链、`_*_MAX_COLUMNS=500`）。

**STUCK 说明**：五 ID 各连续 1 轮未破 90（87.1–89.6）；本轮 companion 质量推分闭合 r38 遗留的 test_connection/schema/types 边界、dimensions values 校验完整度、translator 非法算子/字段/注入守卫缺口。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11/M12；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `dialects/trino.py` | L1 完整；**无** `TRINO_AUTH_FAILED`/`TRINO_TIMEOUT` 单测、`list_columns` 类型枚举 smoke、`TRINO_MAX_COLUMNS` 断言、HTTP test/metadata 链 |
| `dialects/gaussdb.py` | 委托 `PostgresConnector`；**无** `GAUSSDB_TIMEOUT` 测、`GAUSSDB_MAX_COLUMNS`、`list_columns` 类型 smoke、HTTP metadata 链 |
| `dialects/dm.py` | `DM_MAX_COLUMNS=500` 已有；**无** `DM_TIMEOUT` 测、多 owner `list_schemas` smoke、`list_columns` 类型枚举、HTTP metadata 链、凭证脱敏断言 |
| `dialects/errors.py` | `GAUSSDB_*`/`DM_*`/`TRINO_*` 基础映射已有；**无** `TRINO_UNKNOWN_SCHEMA` 常量（可选，schema 空返回 `[]` 已覆盖） |
| `translator/service.py` | 三方言 SELECT/WHERE/LIMIT；**无** `QUERY_TRANSLATE_INVALID_OPERATOR` pytest、`in` 多方言数组参数化、`OR` 逻辑、标识符注入守卫测、limit 超限 HTTP 链 |
| `translator/schemas.py` | `L1_OPERATORS` 白名单；`columns` 拒 `*`；**无** `value_type` 枚举校验（L1 可保持宽松，靠参数化守卫） |
| `dimensions/service.py` | CRUD + `register_values`；**无** value code 正则/空白校验、批内重复预检、`list_values` 分页边界 pytest |
| `dimensions/schemas.py` | `DIM_CODE_RE` 仅维度 code；`DimensionValueItem` **无** code/label 校验器 |
| `test_query_meta_conn_r38.py` | 36 条 L1；**无** companion 质量推分边界（HTTP metadata、translator 算子、values 非法枚举） |

**范围框定模块**（3）：`backend/app/query/translator/`、`backend/app/datasources/dialects/`（gaussdb/dm/trino + errors）、`backend/app/metadata/dimensions/`。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/errors.py` | CONN-010/017/022 | 修改：补全 timeout/auth 映射路径注释与导出 |
| `backend/app/datasources/dialects/trino.py` | CONN-010 | 修改：`list_schemas` 无 catalog 守卫巩固、`list_columns` limit 注释 |
| `backend/app/datasources/dialects/gaussdb.py` | CONN-022 | 修改：`GAUSSDB_MAX_COLUMNS=500` + `list_columns` 切片 |
| `backend/app/datasources/dialects/dm.py` | CONN-017 | 修改：`list_schemas` 多 owner 过滤巩固；错误 message 不含 password |
| `backend/app/metadata/dimensions/schemas.py` | META-003 | 修改：`DimensionValueItem` code/label 校验器 |
| `backend/app/metadata/dimensions/service.py` | META-003 | 修改：`register_values` 批内重复/空白校验 |
| `backend/app/query/translator/service.py` | QUERY-008 | 修改：巩固 `_validate_conditions` 与 `in` 非数组守卫（若缺口） |
| `backend/app/query/translator/schemas.py` | QUERY-008 | 修改：文档化 `L1_OPERATORS` 与 designer 差异（`not_in` 不在 L1） |
| `tests/test_query_meta_conn_r39.py` | 全部 | 新建（≥30 条断言函数） |
| `docs/services/datasources.md` | CONN-* | 修改：r39 三方言 companion 边界登记 |
| `docs/services/metadata.md` | META-003 | 修改：values 校验码与分页契约 |
| `docs/automate/prd/F04-CONN.md` | CONN-010/017/022 | **P5 对账**（非 P3） |
| `docs/automate/prd/F05-QUERY.md` | QUERY-008 | **P5 对账**（非 P3） |
| `docs/automate/prd/F11-META.md` | META-003 | **P5 对账**（非 P3） |

**真理源优先级**：`round-target` > `prd.md` hub + 分片 > `docs/services/*` > `docs/api/README.md`（本轮无新 HTTP 路由）。

**本轮性质**：M11/M12/META **companion 质量推分**（边界闭合 + pytest + 文档），**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、QUERY-009 Dataset 路径、VIZ-003、生产级信创 HA、translator 扩展 gaussdb/dm/trino 方言（留四期后续）。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/dialects/
├── errors.py              # GAUSSDB_/DM_/TRINO_ 映射路径补全（timeout/auth）
├── trino.py               # catalog 三级自省边界 + TRINO_MAX_COLUMNS 巩固
├── gaussdb.py             # + GAUSSDB_MAX_COLUMNS=500
└── dm.py                  # owner 层级 + 错误 message 脱敏

backend/app/metadata/dimensions/
├── schemas.py             # value code/label 校验
└── service.py             # register_values 批内重复 + META_DIM_VALUE_INVALID_*

backend/app/query/translator/
├── service.py             # 算子/字段/标识符守卫巩固
└── schemas.py             # L1_OPERATORS 文档

tests/
└── test_query_meta_conn_r39.py   # T-QUERY-R39-* / T-CONN-R39-* / T-META-R39-*
```

**共享 companion 契约**（三 connector + translator + dimensions 均满足）：

| 契约项 | r38 已有 | r39 增量 |
|--------|----------|----------|
| 结构化 `code` | 基础路径 | 补全 timeout/auth 全路径单测 |
| schema 空/未知边界 | 部分 mock | 空 catalog、未知 owner/schema、零行 columns、类型枚举 smoke |
| 列元数据 limit | DM/TRINO 500 | GaussDB 对齐 **500** |
| HTTP 链 | translate 2 条 | 每 connector ≥1 失败 test + ≥1 metadata 链（400/502） |
| values 校验 | 重复 DB 约束 | 非法 code、空白 label、批内重复、分页边界 |
| translator 守卫 | unknown field | 非法算子、标识符注入、`in` 多方言、`OR` 逻辑 |
| 只读 | 是 | 不变 |
| 回归 | r38 36/36 | r38 + r37 全量回归不删旧套件 |

### 3.2 CONN-010 — Trino companion

#### 3.2.1 方案比选

| 方案 | catalog/schema | types | 结论 |
|------|----------------|-------|------|
| A 巩固 `SHOW SCHEMAS`/`SHOW TABLES`/`DESCRIBE` + mock HTTP 链 | 三级 | `TRINO_MAX_COLUMNS` | **采用** — 与 r37 Hive 对称 |
| B 新增 `information_schema` 自省 | JDBC 标准 | 更丰富类型 | 否决 — 超范围、Trino 方言差异大 |
| C Presto 别名双注册 | — | — | 否决 — PRD 仅 `type=trino` |

#### 3.2.2 实现要点

**文件**：`trino.py`、`errors.py`

- `map_trino_error`：巩固 `unauthorized`/`401` → `TRINO_AUTH_FAILED`；`timeout` → `TRINO_TIMEOUT`（已有映射，补单测）。
- `list_schemas(connection, catalog=None)`：`catalog` 空 → `[]`（已有）；mock 多 schema 行断言 `SchemaInfo.name`。
- `list_tables` / `list_columns`：未知 schema → `[]`；`list_columns` mock `VARCHAR`/`BIGINT`/`DOUBLE` 类型枚举；超 500 列切片 `TRINO_MAX_COLUMNS`。
- `export_type_catalog()`：`displayName`/`capabilities`/`category=lake` 字段完整 smoke（r38 已有，r39 巩固 HTTP 链）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R39-010-01 | mock `401 Unauthorized` → `code=TRINO_AUTH_FAILED` |
| T-CONN-R39-010-02 | mock timeout → `code=TRINO_TIMEOUT` |
| T-CONN-R39-010-03 | mock `list_columns` 600 行 → 返回 500 + 类型字段非空 |
| T-CONN-R39-010-04 | mock 多 schema `list_schemas` → `["default","sales"]` |
| T-CONN-R39-010-05 | HTTP POST test mock refused → 200 `ok=false` `TRINO_CONN_REFUSED` + `traceId` |
| T-CONN-R39-010-06 | HTTP GET metadata tables 无 schema → 400 `METADATA_INVALID_REQUEST` |

### 3.3 META-003 — 维度 values companion

#### 3.3.1 方案比选

| 方案 | value 校验 | 分页 | 结论 |
|------|-----------|------|------|
| A `DIM_CODE_RE` 复用 value code + service 批内重复预检 | 与 glossary 对称 | limit/offset 与 glossary 同契约 | **采用** |
| B 独立 `DIM_VALUE_CODE_RE` 允许数字开头 | 更松 | 同左 | 否决 — 与维度 code 风格不一致 |
| C DB 仅依赖 UniqueConstraint | 无预检 | — | 否决 — 批内重复无法一次 409 定位 |

#### 3.3.2 实现要点

**文件**：`dimensions/schemas.py`、`dimensions/service.py`

- `DimensionValueItem`：新增 `@field_validator` — `code` 匹配 `^[a-z][a-z0-9_]{1,63}$` 且非空白；`label` `strip()` 后 `min_length=1`。
- `register_values`：
  - 空 `items` 由 Pydantic `min_length=1` 拦截 → 422（HTTP 层）。
  - 批内重复 code → `META_DIM_VALUE_DUPLICATE_BATCH` 422 + `fields`。
  - 空白 code/label → `META_DIM_VALUE_INVALID_CODE` / `META_DIM_VALUE_INVALID_LABEL` 422。
  - 与 DB 冲突保持 `META_DIM_VALUE_CODE_CONFLICT` 409。
- `list_values`：分页 `capped = min(max(limit,1), 500)` 已有；补 `limit=1`/`offset=1` total 不变 smoke。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-META-R39-003-01 | POST values `code=""` → 422 `META_DIM_VALUE_INVALID_CODE` |
| T-META-R39-003-02 | POST values `code="Bad-Code"` → 422 |
| T-META-R39-003-03 | POST values 批内 `[{code:"a"},{code:"a"}]` → 422 `META_DIM_VALUE_DUPLICATE_BATCH` |
| T-META-R39-003-04 | POST values `label="   "` → 422 `META_DIM_VALUE_INVALID_LABEL` |
| T-META-R39-003-05 | GET values `limit=1&offset=0` → `len(items)==1` 且 `total>=2` |
| T-META-R39-003-06 | GET dimensions `limit=500` 上限 smoke（与 glossary 对齐） |

### 3.4 CONN-022 — GaussDB companion

#### 3.4.1 方案比选

| 方案 | schema | types | 结论 |
|------|--------|-------|------|
| A 委托 PG + `GAUSSDB_MAX_COLUMNS` + mock HTTP | `list_schemas`/`list_tables` 边界 | `list_columns` 切片 | **采用** |
| B 独立 GaussDB 驱动分支 | — | — | 否决 — r38 已选 PG 兼容委托 |
| C 真实 compose GaussDB | — | — | 否决 — 无集成环境 |

#### 3.4.2 实现要点

**文件**：`gaussdb.py`、`errors.py`

- 常量：`GAUSSDB_MAX_COLUMNS = 500`；`list_columns` 委托后切片（与 Oracle r37 模式一致）。
- `map_gaussdb_error`：`PG_TIMEOUT` → `GAUSSDB_TIMEOUT` 路径单测（已有映射，补测）。
- mock 多 schema `list_schemas`；未知 schema `list_tables` → `[]`；`list_columns` mock `varchar`/`int4`/`timestamp` 类型 smoke。
- HTTP：POST test mock `28P01` → 200 `ok=false` `GAUSSDB_AUTH_FAILED`；GET metadata schemas 502 链（复用 r37 `METADATA_CONNECTION_FAILED` 模式）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R39-022-01 | mock timeout → `GAUSSDB_TIMEOUT` |
| T-CONN-R39-022-02 | mock `list_columns` 600 行 → 500 |
| T-CONN-R39-022-03 | mock 多 schema 含 `public` 不含 `pg_catalog` 系统库过滤（委托 PG 行为） |
| T-CONN-R39-022-04 | HTTP POST test mock auth fail → `GAUSSDB_AUTH_FAILED` |
| T-CONN-R39-022-05 | HTTP GET metadata tables 缺 schema → 400 |

### 3.5 CONN-017 — 达梦 DM companion

#### 3.5.1 方案比选

| 方案 | owner 层级 | 安全 | 结论 |
|------|-----------|------|------|
| A `ALL_TABLES` owner 过滤 + message 脱敏 + HTTP 链 | `list_schemas` 多 owner | test 响应不含 `password` 明文 | **采用** |
| B `DBA_*` 视图需 DBA 权限 | 更全 | — | 否决 — 默认用户权限不足风险 |
| C 连接串日志脱敏改 core logging | — | 更广 | 否决 — 超范围；仅断言 HTTP test `message` |

#### 3.5.2 实现要点

**文件**：`dm.py`、`errors.py`

- `map_dm_error`：timeout 路径单测 → `DM_TIMEOUT`。
- `list_schemas`：mock 返回 `HR`/`APP` owner，过滤 `SYS`/`SYSDBA`；空 `ALL_TABLES` → `[]`。
- `list_tables(connection, "UNKNOWN")` → `[]`（r38 已有）；`list_columns` mock `VARCHAR`/`NUMBER`/`DATE` 类型 smoke。
- **脱敏**：`test_connection` 的 `message` 与 HTTP test 响应 JSON **不得**包含请求体 `password` 字段值（断言 `secret123` not in `resp.text`）。
- HTTP：POST test mock `-2501` → `DM_AUTH_FAILED`；GET metadata columns 未知 table → 200 空或 400/502 按 metadata service 契约。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R39-017-01 | mock timeout → `DM_TIMEOUT` |
| T-CONN-R39-017-02 | mock 多 owner schemas 含 `HR` 不含 `SYS` |
| T-CONN-R39-017-03 | mock `list_columns` 类型枚举非空 |
| T-CONN-R39-017-04 | HTTP test 失败响应不含 password 明文 |
| T-CONN-R39-017-05 | HTTP POST test mock auth → `DM_AUTH_FAILED` |
| T-CONN-R39-017-06 | HTTP GET metadata tables 无 schema → 400 |

### 3.6 QUERY-008 — 翻译器 companion

#### 3.6.1 方案比选

| 方案 | 方言 | 算子 | 结论 |
|------|------|------|------|
| A 巩固 mysql/pg/ch 三方言 + L1 算子白名单 + 参数化 | 不新增 gaussdb/dm/trino | `in`/`OR`/`like`/`is_null` | **采用** — round-target 主攻边界非扩方言 |
| B 同步注册 gaussdb→PostgresDialect | +3 方言 | 同左 | 否决 — 用户价值增量有限，超 companion 最小 diff |
| C 对齐 designer `not_in` 算子 | 扩 L1_OPERATORS | — | 否决 — designer 与 translator L1 有意分层，r38 PRD 已勾选 L1 算子集 |

#### 3.6.2 实现要点

**文件**：`translator/service.py`、`translator/schemas.py`

- **非法算子**：`operator="contains"` 或 `not_in` → `QUERY_TRANSLATE_INVALID_OPERATOR` 422（HTTP + 单测）。
- **非法字段**：已有 `QUERY_TRANSLATE_UNKNOWN_FIELD`；巩固 `fields` 数组含 `fieldId`。
- **标识符注入**：`columns=["status;DROP"]` 或 `schema` 含 `'` → `QUERY_TRANSLATE_INVALID_IDENTIFIER` 422（`validate_identifier` 链）。
- **参数化多方言**：
  - mysql `in` 数组 → 多个 `%(pN)s`，SQL 无字面量。
  - postgresql `OR` 双条件 + `eq` → `WHERE (a = %(p0)s OR b = %(p1)s)`。
  - clickhouse `like` → `{p0:String}` 占位符。
- **配置守卫**：`limit > query_default_limit` → `QUERY_TRANSLATE_INVALID_CONFIG`；`logic="XOR"` → `QUERY_TRANSLATE_INVALID_CONFIG`。
- **注入守卫 smoke**：条件 `value` 含 `' OR 1=1 --` 时 SQL 仍仅含占位符，值在 `parameters` dict。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-QUERY-R39-008-01 | `operator="not_in"` → 422 `QUERY_TRANSLATE_INVALID_OPERATOR` |
| T-QUERY-R39-008-02 | `columns=["x;drop"]` → 422 `QUERY_TRANSLATE_INVALID_IDENTIFIER` |
| T-QUERY-R39-008-03 | mysql `in` 三值 → 3 占位符 + `parameters` 3 键 |
| T-QUERY-R39-008-04 | postgresql `logic=OR` 双条件 → SQL 含 `OR` |
| T-QUERY-R39-008-05 | clickhouse `like` → `{p0:String}` |
| T-QUERY-R39-008-06 | `in` + 非 array value → 422 `QUERY_TRANSLATE_INVALID_CONFIG` |
| T-QUERY-R39-008-07 | HTTP POST 非法算子 → 422 + code |
| T-QUERY-R39-008-08 | 恶意 value 不在 SQL 字面量中 |

## 4. 与 PRD 8 维薄弱项对齐

| PRD ID | 最薄弱维 | r38 分 | r39 目标 | 设计闭合手段 |
|--------|----------|--------|----------|--------------|
| CONN-010 | 完整度 76% | 87.1 | ≥90 | catalog/schema/columns 三级边界 + HTTP 链 + timeout/auth 测 |
| META-003 | 完整度 80% | 87.4 | ≥90 | values 校验码 + 批内重复 + 分页边界 pytest |
| CONN-022 | 完整度 78% | 87.6 | ≥90 | GAUSSDB_MAX_COLUMNS + timeout + HTTP metadata 链 |
| CONN-017 | 完整度 78% / 安全 88% | 87.6 | ≥90 | owner 层级 smoke + password 脱敏断言 + HTTP 链 |
| QUERY-008 | 用户价值 82% / 完整度 88% | 89.6 | ≥90 | 三方言参数化闭环 + 非法算子/字段/注入守卫可感知错误 |

**推分逻辑**（companion 轮次惯例）：完整度 +2~4%、可靠性 +1~2%、测试覆盖 +1~2%、安全性 +1~2%（CONN-017）、用户价值 +2~4%（QUERY-008）→ 加权总分各 ≥90。

## 5. 测试策略

### 5.1 新套件

- **文件**：`tests/test_query_meta_conn_r39.py`
- **夹具**：复用 r38 `sqlite+pysqlite` module fixture 模式（`query_meta_conn_r39` 内存库名隔离）
- **规模**：≥30 条（QUERY ~8 + CONN ~17 + META ~6 + scaffold 1）
- **命名**：`T-QUERY-R39-008-*`、`T-CONN-R39-010-*`、`T-CONN-R39-017-*`、`T-CONN-R39-022-*`、`T-META-R39-003-*`

### 5.2 回归

| 套件 | 期望 |
|------|------|
| `test_query_meta_conn_r38.py` | 36/36 |
| `test_connectors_gov_r37.py` | 40/40 |
| 全量 `pytest` | 无新增 skip；ruff clean |

### 5.3 HTTP 契约（复用 r37 模式）

- 创建 `type=trino|gaussdb|dm` 数据源 → POST `/api/v1/datasources/{id}/test` mock 失败 → 200 + `ok=false` + `{PREFIX}_*` + `traceId`
- GET `/api/v1/datasources/{id}/metadata/schemas|tables|columns` 缺参或 mock 连接失败 → 400 `METADATA_INVALID_REQUEST` 或 502 `METADATA_CONNECTION_FAILED`
- POST `/api/v1/query/translate` 非法配置 → 422 + `QUERY_TRANSLATE_*`
- POST `/api/v1/metadata/dimensions/{id}/values` 非法枚举 → 422 + `META_DIM_VALUE_*`

## 6. 非目标（明确不做）

- 不修改 `goal.md`、`plan.md` 结构
- 不实现 Admin UI、VIZ-003、QUERY-009 Dataset 路径、CONN-006 SQLite
- 不扩展 translator 至 gaussdb/dm/trino/hive 方言（四期后续）
- 不引入真实 Trino/GaussDB/DM compose 集成环境
- 不实现信创 HA、生产级 OLAP 查询优化
- 不修改 r37 已破 90 的 CONN-003~008 簇实现（仅回归）
- 不新增 Alembic migration（values 校验在 service/schema 层）
- 不实现 META-003 M4/M5/M6 统一引用（远期）

## 7. UI 设计交付

`ui_design_skill: none` — 本轮纯后端 companion 质量推分，不触及 `fe/` 或页面/组件/样式目录。

## 8. P3 任务切分建议（供 planner）

| Task | 内容 | 产出文件 | 预估新测 |
|------|------|----------|----------|
| T1 | `errors.py` 三连接器错误域补全与导出 | `errors.py` | 0（被 T2–T4 覆盖） |
| T2 | Trino companion 边界 | `trino.py` | 6 |
| T3 | GaussDB companion 边界 | `gaussdb.py` | 5 |
| T4 | DM companion 边界 + 脱敏 | `dm.py` | 6 |
| T5 | dimensions values 校验链 | `schemas.py`, `service.py` | 6 |
| T6 | translator 算子/字段/注入守卫 | `service.py`, `schemas.py` | 8 |
| T7 | `test_query_meta_conn_r39.py` 集成 + r38/r37 回归 | `tests/` | 30+ |
| T8 | `docs/services/*` + PRD 分片 P5 对账注记 | `docs/` | 0 |

**执行顺序**：T1 → T2∥T3∥T4（可并行）→ T5∥T6（可并行）→ T7 → T8。

## 9. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 文件列表 18 ≤ 20，未超出三模块框定
- [x] 无 TBD/TODO 占位
- [x] `ui_design_skill: none` 已记录
- [x] 每项含可测试验收 ID
- [x] 非目标与 r38/r37 边界清晰
- [x] 禁止生产代码（本文档仅 spec）
