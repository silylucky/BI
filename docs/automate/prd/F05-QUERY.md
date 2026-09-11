# F05-QUERY 查询引擎

> 模块：M3 · 8 维评分见 [`../prd.md`](../prd.md)

### [QUERY-001] M3-LITE SQL 只读执行

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：M3-LITE SQL 只读执行（SRS 追溯项）。
- **验收标准**：
  - [x] POST `/api/v1/query/execute` 返回结果集
  - [x] 强制 LIMIT
- **代码锚点**：`backend/app/query/executor.py` · `backend/app/api/v1/query.py`
- **演化建议**：r27 加固只读守卫（注释剥离、多语句/内联写拒绝、64KB 上限）与 P95 smoke；后续可补查询超时细粒度与生产 P95 基准
- **里程碑对齐**：
### [QUERY-002] 物理表 mode=table 查询

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：物理表 mode=table 查询（SRS 追溯项）。
- **验收标准**：
  - [x] 指定 tableName 可查询
  - [x] 标识符转义正确
- **代码锚点**：`backend/app/query/table.py` · `backend/app/query/executor.py`
- **演化建议**：r27 补空结果集、分页上限、非法标识符与超时结构化响应；后续可补跨 schema 浏览联动
- **里程碑对齐**：
### [QUERY-003] Native 查询双路径

- **状态**：已实现（M11 r236 集成验收）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：Native 查询双路径（SRS 追溯项）。
- **验收标准**：
  - [x] 时序/文档/搜索走 native（r49 L1：`GET /api/v1/query/routing/modes` opensearch→native）
  - [x] 不做 SQL 伪装（r49 L1：`POST /api/v1/query/native/validate` + `QUERY_NATIVE_SQL_DISGUISE` 守卫）
  - [x] 注入与 readonly-guard companion（r52：`QUERY_NATIVE_INJECTION_SUSPECT`/`QUERY_PARAM_INJECTION_SUSPECT` + POST `query/readonly-guard` + probe <50ms）
  - [x] native execute 链 Mongo/ES/OpenSearch（r236：`NativeQueryExecutor` + `POST /api/v1/query/execute` mode=native + ACL/`QUERY_NATIVE_WRONG_MODE`/空 body 422 + routing probe <50ms）
- **代码锚点**：`backend/app/query/native/` · `backend/app/query/native/executor.py` · `backend/app/query/readonly.py` · `backend/app/api/v1/query.py` · `tests/test_design_conn_gov_query_r49.py` · `tests/test_design_conn_gov_query_r52.py` T-QUERY-R52-003-01~10 · `tests/test_m11_batch2_r236.py` T-QUERY-R236-003-01~09
- **演化建议**：M11 r236 已闭合 Mongo/ES/OpenSearch native execute 与 M4 合并验收；后续补 compose 集成 E2E 与 ES offset 限制文档化
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [QUERY-004] SQL 方言适配器

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：SQL 方言适配器（SRS 追溯项）。
- **验收标准**：
  - [x] MySQL/PostgreSQL/ClickHouse 方言适配
  - [x] LIMIT/标识符转义
- **代码锚点**：`backend/app/query/dialects/` · `backend/app/query/dialects/clickhouse.py`
- **演化建议**：r27 交付 ClickHouse L1（标识符、LIMIT/OFFSET、table select）与执行错误映射；后续可补更多 OLAP 类型映射
- **里程碑对齐**：
### [QUERY-005] 图表直连绑定 FR-2.0b（**deprecated · 2026-08**）

- **状态**：已废弃（出图/出报表统一 Dataset execute；bindings API 保留兼容）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期（历史）
- **描述**：原图表直连绑定；新功能不得使用。
- **替代**：QUERY-009 `POST /query/dataset/execute` + `ChartViewConfig(mode=dataset)`
### [QUERY-006] RLS 注入执行链

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：RLS 注入执行链（SRS 追溯项）。
- **验收标准**：
  - [x] 执行前合并 AUTH-007 谓词
  - [x] 越权返回空集或 403
- **代码锚点**：`backend/app/query/rls/guard.py` · `backend/app/query/service.py`
- **演化建议**：r27 补 admin bypass、多维谓词合并与 ClickHouse 执行链集成 smoke；生产环境禁止 `rls.enabled=false`
- **里程碑对齐**：
### [QUERY-007] 配置元模型存储

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：配置元模型存储（SRS 追溯项）。
- **验收标准**：
  - [x] 可视化配置可入库（r32 L1：`QueryConfigRecord` JSON upsert + `POST/GET /api/v1/query-configs`）
  - [x] 配置版本可追溯（`revision` 递增 + `updated_at`；同 ref 幂等 upsert）
  - [x] `dataset_query` 类型可持久化 + owner/admin ACL（r243 `PUT/GET /api/v1/query-configs` + `config_store/access.py`；`test_mfinal_fd_r243` T-QUERY-R243-007-01~05）
- **代码锚点**：`backend/app/query/config_store/` · `backend/app/query/config_store/access.py` · `backend/app/api/v1/query_configs.py` · `tests/test_mfinal_fd_r243.py` T-QUERY-R243-007-01~05
- **演化建议**：Admin 可视化 Dataset 配置器 UI 留 F-D companion（META-004 联动）
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07
### [QUERY-008] 配置→SQL/API 翻译器

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：配置→SQL/API 翻译器（SRS 追溯项）。
- **验收标准**：
  - [x] DSL/JSON 生成可执行 SQL（`POST /api/v1/query/translate`；mysql/postgresql/clickhouse 三方言 SELECT/WHERE/LIMIT，r38 L1）
  - [x] 参数化防注入（`%(p0)s` 占位符 + `parameters` 字典；`in` 三参数化修复，r38+r39）
  - [x] 结构化错误域（`QUERY_TRANSLATE_UNSUPPORTED_DIALECT`/`QUERY_TRANSLATE_UNKNOWN_FIELD`/`QUERY_TRANSLATE_INVALID_CONFIG`/`QUERY_TRANSLATE_INVALID_OPERATOR`，r38+r39）
  - [x] 算子白名单与标识符注入守卫（r39）
  - [x] 已存 `dataset_query` 配置可翻译（r243 `POST /api/v1/query/translate-from-config` + `translator/from_config.py`；`test_mfinal_fd_r243` T-QUERY-R243-008-01~04）
- **代码锚点**：`backend/app/query/translator/` · `backend/app/query/translator/from_config.py` · `backend/app/api/v1/query_translate.py` · `tests/test_query_meta_conn_r38.py` T-QUERY-R38-008-01~09 · `tests/test_query_meta_conn_r39.py` T-QUERY-R39-008-01~08 · `tests/test_mfinal_fd_r243.py` T-QUERY-R243-008-01~04
- **演化建议**：扩展 hive/trino/gaussdb 等方言 translate-from-config；Admin 可视化配置器对接留 F-D companion
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07
### [QUERY-009] Dataset 查询路径

- **状态**：已实现（M-DEPTH F-A 真实 execute · 2026-07-10）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：Dataset 查询路径（SRS 追溯项）。L1 含 validate/routing/execute-plan（非真实 SQL）与 execute 链；M-DEPTH 要求真实 rows 出数。
- **验收标准**：
  - [x] datasetId 查询可走通（r53 L1：`POST /api/v1/query/dataset/validate` + `GET /api/v1/query/dataset/routing` 三路径 sql/native/dataset 边界说明）
  - [x] 仅授权 Dataset（analyst role ACL + `QUERY_DATASET_FORBIDDEN`/`QUERY_DATASET_NOT_READONLY`/`QUERY_PATH_AMBIGUOUS` 守卫）
  - [x] Dataset execute-plan 四步链贯通（r57 companion：`POST /api/v1/query/dataset/execute-plan` planVersion=dataset-plan-v1；非真实 SQL 执行）
  - [x] `dataSourceId` + `configId` 存储→翻译→执行端到端（r243 `POST /api/v1/query/dataset/execute` + `execute_config.py`；`test_mfinal_fd_r243` T-QUERY-R243-009-01~05）
  - [x] Dashboard `WidgetInspector` dataset 模式 + `useChartExecute` → `POST /api/v1/query/dataset/execute`（M-PRODUCT F-A；`chartViewConfig.ts` mode=dataset）
  - [x] **M-DASH-UX F-A**：编辑态 Dataset 执行路径失败/空态可读、不阻断画布（`ChartRenderer` + `ChartPanel` 覆盖层；Wave1 2026-07-09）
  - [x] **M-DEPTH F-A**：Dataset 真实 execute（`execute_config.py` → `QueryExecutor` → 外部源 query pandas；出真实 rows；重启后 bound Dataset 仍可出图）（完成于 2026-07-10；pandas 查询清洗 2026-08）
  - [x] **图表 encoding 出数**：`DatasetExecuteRequest.encoding` + `chart_sql.py` 汇总前 SQL 过滤（WHERE）→ 库内 GROUP BY/聚合 → LIMIT 截汇总后行数；明细表例外（`tests/test_dataset_chart_sql.py`）
- **代码锚点**：`backend/app/query/dataset/guard.py` · `backend/app/query/dataset/executor.py` · `backend/app/query/dataset/execute_config.py` · `backend/app/query/dataset/chart_sql.py` · `backend/app/query/dataset/pandas_transform.py` · `backend/app/query/dataset/schemas.py` · `backend/app/api/v1/query.py` · `fe/src/components/dashboard/WidgetInspector.tsx` · `fe/src/components/charts/useChartExecute.ts` · `fe/src/lib/chartExecuteProbe.ts` · `fe/src/lib/chartViewConfig.ts` · `tests/test_dash_rpt_query_nfr_r53.py` T-QUERY-R53-009-01~07 · `tests/test_dash_rpt_query_nfr_r57.py` T-QUERY-R57-009-01~07 · `tests/test_mfinal_fd_r243.py` T-QUERY-R243-009-01~05 · `tests/test_dataset_pandas_transform.py` · `tests/test_dataset_chart_sql.py`
- **演化建议**：M-DEPTH F-A 闭合真实 SQL execute；execute-plan 保留为文档/探针，不再作为出图主路径
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07；M-PRODUCT F-A · Dashboard FE · 2026-07-08；**M-DEPTH F-A · 已闭合 · 2026-07-29**
