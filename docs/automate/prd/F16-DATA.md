# F16-DATA 数据接入与清洗

> 模块：M1B · SRS FR-DATA / FR-ETL · 8 维评分见 [`../prd.md`](../prd.md)

### [DATA-004] 托管分析库与配置项

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03
- **描述**：平台托管分析库（与元库分离）及 `ANALYTICS_DATABASE_URL` 配置。
- **验收标准**：
  - [x] docker-compose 可启动托管 PostgreSQL（或独立 schema 方案已文档化）
  - [x] `Settings` 可加载 `ANALYTICS_DATABASE_URL`
- **代码锚点**：`docker-compose.yml` · `backend/app/core/config.py`
- **演化建议**：`tests/test_ingestion_config.py` T-D04-17~19（连接超时 failed、compose healthcheck 契约、缺失 analytics 503）；CI compose 集成 job 跑 L1 e2e（当前 integration marker skip）

### [DATA-001] 同步任务模型与 API

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03
- **描述**：同步任务 CRUD；支持内联 `SourceConnection` 或引用已登记 MySQL 数据源（快照连接）；源表、目标表、全量/增量模式与调度。

**创建请求（`SyncJobCreate`）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| name | string | ✓ | 任务名称 |
| target_table | string | ✓ | 托管分析库目标表 |
| source_mode | `inline` \| `datasource` | — | 默认 `inline` |
| source | SourceConnection | inline 时 ✓ | 内联连接 |
| source_data_source_id | uuid | datasource 时 ✓ | 引用 `datasources` 中 MySQL |
| source_table | string | datasource 时 ✓ | 源表（可与 inline 的 `source.table` 二选一） |
| sync_mode | `full` \| `incremental` | — | 默认 `full` |
| primary_key | string | 增量时 ✓ | 单列主键 |
| incremental_column | string | 增量时 ✓ | 整型或时间戳水位列 |
| schedule_cron | string | — | 可选 Cron |
| enabled | bool | — | 默认 true |

**SourceConnection 字段（`source_mode=inline` 时 `source` 对象）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| type | `mysql` \| `postgres` | ✓ | M1B executor 仅 mysql |
| host | string | ✓ | 源库主机 |
| port | int 1–65535 | ✓ | 源库端口 |
| database | string | ✓ | 库名 |
| username | string | ✓ | 用户名 |
| password | string | ✓ | 请求明文；响应 `***` |
| table | string | ✓ | 源表名 |

- **验收标准**：
  - [x] `GET/POST /api/v1/ingestion/sync-jobs` 可用
  - [x] OpenAPI 可访问
  - [x] 可选 `source_data_source_id` 引用 MySQL 数据源并快照连接（B-4）
  - [x] 增量模式创建时校验 `primary_key` / `incremental_column`
- **代码锚点**：`backend/app/ingestion/` · `backend/app/api/v1/ingestion/` · `source_resolver.py`
- **演化建议**：`tests/test_ingestion_api.py` T-D01-23~25（PUT 空密码保留密文、create P95 <0.8s、OpenAPI SyncRunItem 快照）；补 postgres 源类型 executor 覆盖；OpenAPI 示例与 api/README 持续对齐

### [DATA-002] 同步执行器

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03
- **描述**：全量 TRUNCATE+INSERT 与增量 upsert（单列 PK + 水位）同步执行，及定时调度。
- **验收标准**：
  - [x] 手动 `POST .../run` 可将源表写入托管库
  - [x] 运行历史含状态与 `traceId` 日志
  - [x] 全量任务覆盖目标表（T-D02-19）；增量任务 upsert 不 TRUNCATE（T-INC-01~03）
  - [x] 增量成功后写回 `last_watermark`
- **代码锚点**：`backend/app/ingestion/sync_executor.py` · `sync_fetch.py` · `sync_write.py` · `scheduler.py`
- **演化建议**：`tests/test_sync_executor.py` T-INC-* 增量契约；复合主键、增量删除、Postgres 源 executor；大批量分批写入 perf 基准

### [ETL-001] 清洗规则引擎（轻量）

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03
- **描述**：JSON 规则：列重命名、类型转换、空值填充、简单过滤（pandas DataFrame 实现）。同步写托管库前执行；**所有** Dataset execute 出数后复用同一引擎（见 QUERY-009 `pandas_transform.py`）。
- **验收标准**：
  - [x] 规则在写托管库前生效
  - [x] 脏数据样例经规则后字段符合配置
- **代码锚点**：`backend/app/ingestion/etl_rules.py` · `backend/app/query/dataset/pandas_transform.py`（外部源 Dataset 查询清洗）
- **演化建议**：`tests/test_etl_rules.py` T-ETL-23~24（type 数字不崩、cast_type 缺 column KeyError）；`test_sync_executor` T-ETL-25 apply_rules 异常 failed 不写库；补 executor+rules 组合失败降级场景

### [DATA-003] Admin 配置台页面

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03
- **描述**：`/admin/ingestion/*` 同步任务与清洗规则配置 UI。
- **验收标准**：
  - [x] 浏览器可创建任务并手动运行
  - [x] 可查看运行历史
  - [x] 表单支持引用数据源 / 内联连接双模式与全量/增量配置
  - [x] UI 展示同步成功 **动作卡**（`SyncConsumeActionCard`：自动 prepare 分析库 → 一键 ensure-dataset → 创建看板；无看板 SQL）
  - [x] `GET consume-hints` / `POST prepare-consume` / `POST ensure-dataset` API（`sync_consume.py`）
  - [x] 列表最近成功任务展示消费状态标签（可出图 / 待建 Dataset / 待准备）
- **代码锚点**：`fe/src/pages/admin/ingestion/`
- **演化建议**：`ingestion.smoke.test.tsx` 35 项（T-ING-32~35 failed error_message、skeleton loading、401 无 success、run dialog pending 禁用）；二期 Playwright 真浏览器 L1

### [DATA-005] 端到端验收与文档回写

- **状态**：已实现
- **goal_ref**：goal.md §5（DATA-SMOKE）
- **期次**：M1B
- **里程碑对齐**：M1B · 已完成 · 2026-07-03；M-FE-2 L2 · 已完成 · 2026-07-06
- **描述**：DATA-SMOKE **L1**：内联 SourceConnection → 同步+清洗 → 托管库目标表；运行历史含 traceId/行数/errorMessage。**L2**（dataSourceId + SQL 出数）M-FE-2 已实现。
- **验收标准**：
  - [x] DATA-SMOKE L1 用例通过（`tests/test_ingestion_e2e.py`）
  - [x] SRS §3.6、api/README §9、services/ingestion 状态已回写
  - [x] DATA-SMOKE L2：dataSourceId + SQL 出数（`tests/test_data_p1_smoke_l2.py`）
  - [x] 同步消费一键链：`scripts/truth_verify_sync_consume.py` 覆盖 prepare-consume → ensure-dataset → execute
- **代码锚点**：`tests/test_ingestion_e2e.py` · `tests/test_ingestion_l1_smoke.py` · `tests/test_doc_anchors_data.py` · `tests/test_data_p1_smoke_l2.py` · `docs/automate/plan.md` M1B
- **演化建议**：`tests/test_ingestion_l1_smoke.py` T-L1-07~08 L1 编排 + <2.5s；Playwright E2E P1-SMOKE 真实 DB 浏览器验收
