# Feature Truth Audit: 连接管理 30 型全量能力（查询 + 同步）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | 连接管理目录 **30** 种连接器：登记 / 查询 / 同步拉数 / UI 标注 |
| 锚点 | `export_type_catalog()` · `/admin/datasources/new` · `/admin/ingestion/sync-jobs/new` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | approved-fix（用户要求最终形态；代码已落地，运行时全量未逐型真机） |
| **sampling** | `full`（30/30 矩阵） |
| **related** | [`2026-08-04-datasource-wizard-connectors-truth-audit.md`](2026-08-04-datasource-wizard-connectors-truth-audit.md) |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | Catalog **30/30** `queryCapable=true` 且 `syncFetchImplemented=true` | 用户「不要分期、最终形态」 |
| T2 | 每种类型可登记连接（POST datasources） | 连接管理基本能力 |
| T3 | 每种类型可 **SQL/Native 查询** 出数（Designer/execute API） | query 域 |
| T4 | 每种类型可作同步源且 **run 拉数成功** 写入托管分析库 | ingestion 域 |
| T5 | UI 无「待支持/仅元数据」误导；同步表单可选全部可查询连接 | P1 标注修复 |
| T6 | 自动化测试与 catalog 一致（无 stale 断言） | 复验本轮 |

- 非目标：30 型逐型生产环境真机（需客户侧实例）；ClickHouse 查询引擎 cursor 适配专项

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 连接器 `type` | 30 | 0 | 30 | `export_type_catalog()` 2026-08-04 18:04 |
| FE 向导/列表/同步表单 | 3 块 | 0 | 3 | §3b |

## 2. 链路图

```
连接管理登记 → test_connection
  → 查询：ExecuteRequest sql/native → datasources registry
  → 同步：SyncJob datasource → fetch_source_rows → ANALYTICS_DATABASE_URL
  → 出图：Dataset 绑定 analytics / 或直连 dataSourceId
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | Catalog 30/30 标志 | **通** | `export_catalog.py` TOTAL=30，无 query=False |
| 2 | 能力代码 | **通** | dialect 10 型 + aliases；sync_fetch registry 路径 |
| 3 | 后端自动化 | **通** | pytest **115 passed**（见 §4） |
| 4 | 前端 smoke | **通** | vitest **84 passed**（见 §4） |
| 5 | 30 型逐型 compose/真机 | **未验** | 仅 mysql/pg/sqlite 等有 compose 用例 |
| 6 | 30 型逐型 sync run 真库 | **未验** | executor 多为 mock fetch |

## 3. 子能力判定

| ID | 子能力 | 判定 | 总分 | 证据 |
|----|--------|------|------|------|
| T1 | Catalog 全绿 | **REAL** | 9/A | 30/30 query+syncFetch |
| T2 | 30/30 登记 | **PARTIAL** | 7/B | 26 smoke 未参数化 30 型 POST |
| T3 | 30/30 查询 | **PARTIAL** | 6/C | 10 dialect + native；多数无 execute 集成 |
| T4 | 30/30 同步 run | **PARTIAL** | 6/C | 代码路径齐；仅 mysql/pg/hive API 201 + mock executor |
| T5 | UI 最终形态 | **REAL** | 8/B | 无「待支持」badge；ingestion smoke 53 |
| T6 | 测试与实现一致 | **REAL** | 9/A | 修复 `test_phase2_dm_still_unsupported` stale |

## 3d. 覆盖矩阵（30 连接器）

**深度**：GATE=catalog；CHAIN=单测/mock；COMPOSE=docker；UI=smoke

| type | GATE | CHAIN | COMPOSE | UI | 深度 | 判定 | 证据 |
|------|------|-------|---------|-----|------|------|------|
| mysql | ✅ | ✅ | ✅ | ✅ | COMPOSE | REAL | r207 compose + sync mock |
| mariadb | ✅ | ✅ | ✅ | ❌ | COMPOSE | PARTIAL | mysql alias |
| postgresql | ✅ | ✅ | ✅ | ❌ | COMPOSE | REAL | r207 compose |
| tidb | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r34 mock |
| kingbase | ✅ | ✅ | ❌ | ✅ | UI | PARTIAL | smoke 信创 |
| gaussdb | ✅ | ✅ | ❌ | ✅ | UI | PARTIAL | smoke 信创 |
| gbase | ✅ | ✅ | ❌ | ✅ | UI | PARTIAL | smoke 信创 |
| oceanbase | ✅ | ✅ | ❌ | ✅ | UI | PARTIAL | smoke 信创 |
| dm | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | oracle alias |
| db2 | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r249 probe |
| oracle | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r36 mock |
| sqlserver | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r36 mock |
| sqlite | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | phase2 integration |
| clickhouse | ✅ | ✅ | ✅ | ❌ | COMPOSE | PARTIAL | compose 测连；execute cursor 风险 |
| doris | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | mysql alias |
| starrocks | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r35 mock |
| redshift | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | pg alias |
| hive | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | ingestion API 201 |
| impala | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | hive alias |
| trino | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r235 mock 测连 |
| presto | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | trino alias |
| csv | ✅ | ✅ | ❌ | ✅ | UI | REAL | CONN-024 smoke |
| excel | ✅ | ✅ | ❌ | ✅ | UI | REAL | CONN-024 smoke |
| rest_api | ✅ | ✅ | ❌ | ✅ | UI | REAL | CONN-023 smoke |
| mongodb | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r40 mock |
| elasticsearch | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | r35 mock |
| opensearch | ✅ | ✅ | ❌ | ❌ | GATE | STUB | registry only |
| influxdb | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | native execute 新增 |
| tdengine | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | dialect + r40 mock |
| timescaledb | ✅ | ✅ | ❌ | ❌ | CHAIN | PARTIAL | pg alias |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 30 |
| REAL 达标 | **4**（mysql, postgresql, csv, excel, rest_api → 5） |
| PARTIAL | **24** |
| STUB | **1**（opensearch） |
| GATE-only | 0 |
| NONE | 0 |
| **逐一校验** | **否** — catalog 30/30 GATE；运行时逐型真通 **5/30** |
| **总体可否 REAL** | **否** |

## 3c. 五维（总体 T）

| L | C | D | E | F | 总分 | 档位 | 真假 |
|---|---|---|---|---|------|------|------|
| 2 | 2 | 1 | 2 | 2 | **7** | B | **PARTIAL** |

**结论**：**代码与 catalog 层面已完成最终形态**（无分期门控）；**运行时 30 型全部可用尚未逐型验证**，不能宣称生产全绿。

## 4. 动态验证记录

| 步骤 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|--------|------|
| catalog | 30/30 query+sync | 30/30 | ✅ | export_catalog stdout |
| pytest 包 | 全绿 | **115 passed** | ✅ | 2026-08-04 18:06 |
| vitest 包 | 全绿 | **84 passed** | ✅ | 2026-08-04 18:06 |
| hive sync create | 201 | 201 | ✅ | `test_create_job_hive_datasource_201` |
| dm dialect | oracle alias | pass | ✅ | `test_phase2_dm_uses_oracle_dialect_alias` |
| 30 型 sync run 真库 | 全成功 | 未执行 | ❌ | — |

**pytest 命令**：`pytest tests/test_sync_source_capabilities.py tests/test_sync_sql_builder.py tests/test_r15_connector_query_align.py tests/test_r15_phase1_native_wire.py tests/test_r15_phase2_sql_dialects.py tests/test_sync_executor.py tests/test_ingestion_api.py`

## 5. 剩余差距（非阻塞代码，阻塞「全 REAL」）

| 优先级 | 项 | 说明 |
|--------|-----|------|
| P1 | ClickHouse QueryExecutor | `Client.query` vs `cursor()` 统一 |
| P2 | 30 型参数化 smoke | POST datasources mock 201 × 30 |
| P2 | 湖仓 compose | hive/trino sync fetch 端到端 |
| P3 | opensearch | 补 CHAIN 单测对齐 es |

## 6. 复验相对前次审计

| 指标 | 2026-08-04 17:36（分期） | 2026-08-04 18:06（最终形态） |
|------|--------------------------|------------------------------|
| queryCapable | 22/30 | **30/30** |
| syncFetchImplemented | 18/30 | **30/30** |
| REAL 逐型 | 18 | **5** |
| 总体判定 | PARTIAL 6/C | PARTIAL **7/B** |

## 7. 交接

- **对用户**：功能**在产品和代码上已不分期**；要说「全部完成并可用」，还需按上表 P1–P2 做**逐型真机/compose**验收。
- 用户批准继续：**否**（本轮仅 truth-verify）
