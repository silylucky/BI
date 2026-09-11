# query — 查询执行

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/query/` |
| PRD | [F05-QUERY](../automate/prd/F05-QUERY.md) · QUERY-001 ~ QUERY-009 |
| 里程碑 | M4（L1 kickoff r26） |
| 状态 | **L1 已实现（r26）**；r32 追加 `config_store/`（QUERY-007） |

## 职责

- 接收 `ExecuteRequest`（sql/table 模式或 bindingId），解析绑定与参数
- 经 `datasources` 获取连接，生成方言 SQL 并执行
- 行级权限（RLS）注入（委托 `auth` 策略）
- 结果集整形、分页、超时与资源限额（NFR）
- 图表直连绑定（`chart_query_bindings`）CRUD 与执行复用

## 边界

| In | Out |
|----|-----|
| 查询编排、执行、结果返回 | 连接器与池（→ `datasources`） |
| M3-LITE 直连 SQL + mode=table | Dataset 语义解析全量（多表 join 可视化等远期） |
| L1 chart_query_bindings CRUD + bindingId 执行 | Native 查询执行器（仅路由守卫 L1） |
| L1 配置元模型存储（`query_conditions`/`compute_rules`/… JSON） | 设计器画布 UI |
| 已存 `dataset_query` 翻译与执行（`execute_config.py` → 真实 SQL） | Dataset CRUD（→ `metadata`） |
| `query/dataset/guard` 第三路径 routing + ACL/readonly | |
| `query/native/guard` 路由模式探测 + native spec 校验 | SQL 模式执行（仍走 sql 路径） |
| 执行前 RLS WHERE 注入 | 图表/Dashboard 持久化（→ `dashboard` / `designer`） |
| | M5 VIZ 渲染 |
| | 完整 Admin 查询设计器 UI |

## 依赖

- `core`、`datasources`
- `auth`：RLS、查询审计、数据源 ACL
- `metadata`（四期）：Dataset 解析

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `QueryExecutor` | 统一执行入口（sql/table） | QUERY-001/002 | 已实现 |
| `ExecuteRequest` / `ExecuteResponse` | Pydantic 契约 | QUERY-001 | 已实现 |
| `ChartQueryBinding` / `binding_service` | 图表直连绑定 CRUD | QUERY-005 | 已实现 |
| `query/config_store` | 配置元模型 JSON 存储（revision upsert） | QUERY-007 | L1 已实现 |
| `query/native/guard` | `resolve_query_mode` + `validate_native_spec` | QUERY-003 | L1 已实现 |
| `query/native/executor` | `NativeQueryExecutor`（MongoDB/ES/OpenSearch native 出数） | QUERY-003 | L1 已实现（r236） |
| `query/dataset/guard` | 第三路径 dataset + 内置 ACL registry | QUERY-009 | L1 已实现（r53） |
| `query/dataset/executor` | execute-plan 四步链 companion（契约/探针） | QUERY-009 | companion 已实现（r57） |
| `query/dataset/execute_config.py` | `POST /query/dataset/execute` 真实 SQL 出数（M-DEPTH F-A） | QUERY-009 | **已实现**（2026-07-10） |
| `query/dialects` | MySQL/PostgreSQL/ClickHouse 方言适配 | QUERY-004 | 已实现 |
| `rls/guard` | 行级过滤注入 | QUERY-006 | 已实现 |

## 关联 API

见 [api/README.md](../api/README.md) §查询。

## 实现笔记

- r26：方言适配器 + 只读守卫 + QueryExecutor + RLS 执行链 + chart_query_bindings 迁移 0011
- r27：ClickHouse dialect L1、只读守卫加固、chartId 唯一绑定（0012）、admin RLS bypass
- r32：migration 0015 `query_config_records`；`config_store` upsert API（QUERY-007）
- r33：`MAX_CONFIG_PAYLOAD_BYTES=262144`；PUT 可选 `expectedRevision` 乐观锁；超大 payload → 413 `CONFIG_PAYLOAD_TOO_LARGE`；revision 冲突 → 409 `CONFIG_VERSION_CONFLICT`
- r49：`query/native/guard` 只读 `export_type_catalog()` 按 `category` 路由；`NATIVE_CATEGORIES={search,document,timeseries}`；`QUERY_NATIVE_*` 错误码；不含 native 执行器

### r53 L1 kickoff（QUERY-009）

- **三路径**：`sql`（dataSourceId+sql/table）· `native`（connectorType+body）· `dataset`（datasetId+parameters）
- **内置 datasets**：`demo-orders`（analyst）、`restricted-ledger`（finance）；admin bypass
- **错误码**：`QUERY_DATASET_*`、`QUERY_PATH_AMBIGUOUS`
- API：`GET /query/dataset/routing`、`POST /query/dataset/validate`

### r57 companion 质量推分（QUERY-009）

- **`query/dataset/executor.py`**：`build_dataset_execute_plan` 四步链（path_resolve → acl_check → readonly_guard → plan_ready）；stub 计划，**非真实 SQL execute**
- **错误码**：`QUERY_DATASET_PLAN_INVALID_PARAMS`（禁止 `_sql`/`__proto__` 参数键）
- API：`POST /query/dataset/execute-plan`（`planVersion=dataset-plan-v1`）
- **性能**：`probe_execute_plan_budget_ms` ≤30ms smoke

### r243 F-D kickoff（QUERY-007~009）

- **QUERY-007**：`dataset_query` 配置类型 + `DatasetQueryConfigPayload` 校验 + `config_store/access.py` owner 守卫
- **QUERY-008**：`translator/from_config.py` → `POST /query/configs/{id}/translate`
- **QUERY-009**：`dataset/execute_config.py` → `POST /query/dataset/execute`（真实 `QueryExecutor` 出数；**生产主路径**；与 r53 内置 `demo-orders` 正交）
- **集成测**：`tests/test_mfinal_fd_r243.py` ≥18 断言

### M-DEPTH F-A（QUERY-009 · 2026-07-10）

- **`execute_dataset_from_config`**：`config_store` 读取 `dataset_query` → `translate_from_config_record` → `QueryExecutor.execute` → 真实 rows
- **pandas 查询清洗（2026-08）**：`origin=manual` 的外部源 Dataset 在 `dataset/execute` 出数后经 `query/dataset/pandas_transform.py`（复用 `ingestion/etl_rules` + `datasets.transform_rules`）。`origin=sync_job` 同步产物已在写库前清洗，**跳过** query pandas。Admin「查询清洗」Tab 仅 manual 型可编辑。失败 → `QUERY_DATASET_TRANSFORM_FAILED`
- **LIMIT 取最新**：翻译 SQL 时若选出时间列（如 `sale_date` / `updated_at`），先 `ORDER BY 时间 DESC LIMIT N`，再按时间升序返回给图表；无时间列则仍为无序前 N 行。组件「结果展示」预设 10/20/50/100/500/1000（默认 **20**），历史 `all`/`10000` 视为 1000（平台上限）。
- **图表 encoding 出数（对标 DataEase）**：`POST /query/dataset/execute` 请求体可选 `encoding`（`chartType`、维/指、`filters`、`timeRange`）。有 encoding 时走 `query/dataset/chart_sql.py`：**WHERE（汇总前过滤）→ GROUP BY/聚合 → LIMIT（截汇总后行数）**；明细表（`table-info`/`table`/`table-normal`）仍为 WHERE + 最新 N 条明细，无 GROUP BY。无 encoding 时保持旧 `translate_from_config_record` 路径（管理探针/旧客户端兼容）。
- **出图路径**：`useChartExecute` **仅** `mode=dataset` → `/dataset/execute`；sql/table/native 直连已废弃
- **FE**：`DatasetBindPanel` 创建并绑定 config；`ChartEditRail` `DatasetPickerPanel`；`useChartExecute` dataset 路径

### r52 companion 质量推分（QUERY-003）

- **QUERY-003**：`readonly.assert_safe_sql_parameters`；`guard_native_injection`（`QUERY_NATIVE_INJECTION_SUSPECT` / `QUERY_PARAM_INJECTION_SUSPECT`）；`POST /query/readonly-guard`（sql 模式只读 + native 模式拒绝 sql 字段）；`probe_list_routing_modes`（<50ms smoke）；binding 创建 sql 模式委托 `assert_readonly_sql`
- **r236 execute**：`POST /query/execute` `mode=native` + `nativeBody`/`index`；`NativeQueryExecutor` 复用 `validate_native_spec` + `pool_manager`；ES/OS **不支持 offset**（`QUERY_NATIVE_OFFSET_UNSUPPORTED`）；**不注入 SQL RLS**
- **Out**：Influx/TDengine native execute（`QUERY_NATIVE_EXECUTE_UNSUPPORTED`）；ES filter DSL 自动拼接；SQL RLS on native
- 执行链：`assert_visible` → `readonly` → `dialect.wrap_limit` → `apply_rls_to_sql` → `pool_manager`

### 方言适配器

- **MySQL**（`mysql`）：反引号标识符、子查询包裹 LIMIT/OFFSET
- **PostgreSQL**（`postgresql`）：双引号标识符、子查询包裹 LIMIT/OFFSET
- **ClickHouse**（`clickhouse`）：L1 已注册 — 反引号标识符、后缀 `LIMIT/OFFSET`；执行错误映射 `QUERY_SYNTAX_ERROR` / `QUERY_TABLE_NOT_FOUND`；无 CONN-007 连接器（mock/单元测试验收）。

### chart_query_bindings（deprecated）

- 历史图表直连绑定；**新图表/报表不得使用**。保留 API 仅供存量迁移与集成兼容。

### RLS

- `admin` 角色跳过行级谓词注入（数据源 ACL 仍生效）；viewer 无 org 仍降级 `1=0`
