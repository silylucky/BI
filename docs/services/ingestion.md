# ingestion — 数据同步与清洗

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/ingestion/` |
| PRD | [F16-DATA](../automate/prd/F16-DATA.md) · DATA-* / ETL-001 |
| SRS | FR-DATA · FR-ETL §3.6 |
| 里程碑 | **M1B** |
| 状态 | **已实现** |

## 职责

- 同步任务定义与调度（内联或引用 MySQL 数据源 → 托管分析库表）
- 全量覆盖与增量 upsert（单列 PK + 水位）
- 轻量 ETL 规则（写库前 pandas 清洗；创建同步任务时按源表列元数据自动生成默认规则）
- 同步产物 Dataset 读托管分析库时不再重复 query pandas（清洗已在写库前完成）
- 同步运行历史与失败重试

## 边界

| In | Out |
|----|-----|
| 库表级同步、规则表级清洗 | 完整可视化 ETL 设计器（远期） |
| 内联 SourceConnection 或引用 `dataSourceId`（MySQL 快照） | 自动创建/同步托管库数据源记录（默认手动登记 PG；开发环境 `ENSURE_ANALYTICS_DATASOURCE=1` 可自动登记） |
| 全量 TRUNCATE + 增量 upsert | 增量删除、复合主键 |
| 托管分析库写入 | BI 查询执行（→ `query`） |
| M1B 手动/定时同步 | 连接器插件注册（→ `datasources`，M3+） |

## 依赖

- `core`（配置、日志、调度）
- 托管分析库（`ANALYTICS_DATABASE_URL`，与元库分离）
- 下游：M3/M4 `datasources`（L2 托管库登记为 `dataSourceId`）

## 主要类型 / 入口

| 符号 | 说明 | 状态 |
|------|------|------|
| `ingestion.models` | `SyncJob`、`SyncRun`、`EtlRuleSet`、`SourceConnection` | 已实现 |
| `ingestion.source_resolver` | 内联 vs 数据源引用解析与快照 | 已实现 |
| `ingestion.sync_fetch` / `sync_write` | MySQL 拉取 + PG 全量/增量写入 | 已实现 |
| `ingestion.sync_executor` | 同步编排（mysql 源，1 次重试） | 已实现 |
| `ingestion.sync_consume` | 同步成功后消费链：prepare 分析库、ensure-dataset、状态解析 | 已实现 |
| `ingestion.etl_rules` | 清洗规则引擎（pandas DataFrame；写托管库前执行） | 已实现 |
| `ingestion.scheduler` | APScheduler 定时触发 | 已实现 |
| `GET/POST /api/v1/ingestion/sync-jobs` | 任务 API | 已实现 |

## 关联 API

见 [api/README.md](../api/README.md) §9 数据接入。

## 验收与 L1 smoke（DATA-005）

- L1 端到端：`tests/test_ingestion_l1_smoke.py`（`T-L1-07` L1 编排 smoke、`T-L1-08` 编排 <2.5s、`T-L1-05` analytics_sqlite 写穿、`T-L1-06` 运行历史排序）
- 文档锚点：`tests/test_doc_anchors_data.py` T-D05-08~12
