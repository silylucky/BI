# Feature Truth Audit: 连接管理向导 · 全量连接器可用性

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | `/admin/datasources/new` 向导「选择数据源大类」下 **全部 30 种**注册连接器是否「真可用」（登记 / 探测 / 查询 / 同步） |
| 锚点 | `DatasourceFormWizard.tsx` · `GET /api/v1/datasources/types` · `export_type_catalog()` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | approved-fix（2026-08-04 用户批准 P1 UI 标注 + syncFetch 过滤） |
| **sampling** | `full`（用户未缩 scope；30/30 矩阵） |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 向导 6 个大类卡片展示的类型数与 API catalog 一致（合计 **30**） | 用户 DOM + `DISPLAY_GROUP_META` |
| T2 | 每种类型可选 → 填表 → **POST 保存成功**（凭证登记） | 连接管理基本能力 |
| T3 | 每种类型 **test_connection** 在合法凭证下可返回 ok（非假按钮） | `capabilities` 含 `connectivity_test` |
| T4 | **可查询**类型在 Designer / Dataset 可执行 SQL 或 Native 查询 | `queryCapable=true` + `queryMode` |
| T5 | **可同步**类型可作同步源且 **运行拉数成功** | `syncFetchImplemented=true`（P4 扩展后） |
| T6 | 仅元数据类型须在 UI **诚实标注**「仅连接与 Schema」 | `connectorPickerSubtitle(queryCapable=false)` |

- 非目标：逐型真机连生产库（需 compose/客户环境）；Hive/Trino 本期实现查询引擎

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 连接器 `type` | 30 | 0 | 30 | `export_type_catalog()` 2026-08-04 实扫 |
| 向导大类 `displayGroup` | 6 | 0 | 6 | `DISPLAY_GROUP_ORDER` |
| FE 向导控件 | 4 | 0 | 4 | §3b |

## 2. 完整链路图

```
/admin/datasources/new
  → GET /datasources/types (export_type_catalog)
  → 大类卡片 (6 groups)
  → 连接器卡片 (30 types)
  → 填连接表单 → POST /datasources → test_connection
  → Designer/Dataset query (queryCapable)
  → Sync Job datasource 模式 (syncCapable) → run fetch (syncFetchImplemented)
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 类型目录 | **通** | `python .tmp/export_catalog.py` TOTAL=30 | 与 UI 分组计数一致 |
| 2 | 向导渲染 | **通** | `datasource-form.smoke.test.tsx` 26 passed | 仅抽测 OLTP/文件/API 子集 |
| 3 | 连接探测 | **部分** | `test_connectors_gov_r*.py` 等 mock | 非 30/30 逐型 compose |
| 4 | 查询执行 | **部分** | `test_r15_connector_query_align.py` 47 passed | 8 型 `queryCapable=false` |
| 5 | 同步拉数 | **部分** | `test_sync_source_capabilities.py` + executor 78 passed | 12 型 sync 未落地 fetch |
| 6 | 浏览器真机 | **未验** | — | BROWSER=NONE |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 目录与 UI 分组一致 | **REAL** | 8/B | catalog 30 + smoke FB-3-01 大类首屏 |
| T2 | 30/30 可登记保存 | **PARTIAL** | 6/C | 26 smoke 未逐型 POST；registry 均有 Connector |
| T3 | 30/30 探测可用 | **PARTIAL** | 6/C | 均有 `test_connection` 实现；L1 多为 mock |
| T4 | 30/30 可查询 | **STUB** | 4/D | **仅 22/30** `queryCapable` |
| T5 | 30/30 可同步拉数 | **STUB** | 3/D | **仅 18/30** `syncFetchImplemented` |
| T6 | 元数据型诚实标注 | **REAL** | 8/B | `connectorPickerSubtitle` L129-131 |

## 3b. 前端控件下钻表（向导）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 大类卡片 ×6 | `onSelectGroup` | 进入对应连接器列表 | smoke FB-3-01 见「关系型数据库」 | 2 | 2 | — | — | 2 | 8 | REAL | `datasource-form.smoke.test.tsx` |
| B2 | 连接器卡片 | `onSelectType` | 进入表单且 type/port 预填 | smoke FB-3-02 MySQL 字段可见 | 2 | 2 | — | — | 2 | 8 | REAL | 同上 |
| B3 | 返回大类 | `onBackToCategory` | 回到大类 | smoke 含返回路径 | 2 | 2 | — | — | 2 | 8 | REAL | 同上 |
| B4 | 保存连接 | `handleSubmit` | POST 成功 / 字段映射正确 | smoke CONN-023/024 覆盖 rest_api/csv/excel | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 26 passed |

功能块映射：T1→B1；T2→B2,B4；T6→B2 subtitle

## 3d. 覆盖矩阵（30 连接器 × 可用性分层）

**分层定义（本审计「可用」口径）**

| 层级 | 条件 | 用户感知 |
|------|------|----------|
| **A 全链路** | connect + query + syncFetch | 登记 → 查询出图 → 同步入分析库 |
| **B 查询可用** | connect + query；sync 可建任务但 run 未实现 | 可 Dataset/Designer；同步运行报错 |
| **C 仅登记** | connect + schema；`queryCapable=false` | 可登记、浏览元数据；不可查询/同步 |
| **D 阻断** | 无 connector 实现 | 不应出现在目录（当前 0） |

| type | displayGroup | query | syncFetch | 分层 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|------|--------------|-------|-----------|------|------|-------|-----|------|---|---|------|------|
| mysql | oltp | ✅ | ✅ | A | ✅ | ✅ | ✅ | CHAIN+UI | 2 | 2 | REAL | r207 compose + sync |
| mariadb | oltp | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r228 mock |
| postgresql | oltp | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r207 compose |
| tidb | oltp | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r34 mock |
| kingbase | oltp | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | smoke 信创 |
| gaussdb | oltp | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | smoke 信创 |
| gbase | oltp | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | smoke 信创 |
| oceanbase | oltp | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | smoke 信创 |
| starrocks | olap | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r35 mock |
| doris | olap | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r36 mock |
| redshift | olap | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | smoke fixture |
| timescaledb | extension | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r40 mock |
| mongodb | extension | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r40 mock |
| elasticsearch | extension | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | r35 mock |
| opensearch | extension | ✅ | ✅ | A | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | registry |
| csv | file | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | CONN-024 smoke |
| excel | file | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | CONN-024 smoke |
| rest_api | api | ✅ | ✅ | A | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | CONN-023 smoke |
| clickhouse | olap | ✅ | ❌ | B | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | query ok；sync run 未实现 |
| oracle | oltp | ✅ | ❌ | B | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | r36 mock |
| sqlserver | oltp | ✅ | ❌ | B | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | r36 mock |
| sqlite | extension | ✅ | ❌ | B | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | r40 mock |
| dm | oltp | ❌ | ❌ | C | ✅ | ✅ | ✅ | UI | 2 | 1 | PARTIAL | smoke；仅元数据 |
| db2 | oltp | ❌ | ❌ | C | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 无 execute dialect |
| hive | warehouse | ❌ | ❌ | C | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | test_connection mock |
| impala | warehouse | ❌ | ❌ | C | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | smoke 仅列表 |
| trino | warehouse | ❌ | ❌ | C | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 无 query route |
| presto | warehouse | ❌ | ❌ | C | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 继承 trino |
| influxdb | extension | ❌ | ❌ | C | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | r40 mock |
| tdengine | extension | ❌ | ❌ | C | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | r40 mock |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体（连接器） | 30 |
| **A 全链路可用** | **18** |
| **B 查询可用 / 同步未落地** | **4**（clickhouse, oracle, sqlserver, sqlite） |
| **C 仅登记+元数据** | **8**（dm, db2, hive, impala, trino, presto, influxdb, tdengine） |
| GATE only | 4（db2, impala, trino, presto） |
| CHAIN | 26 |
| UI / BROWSER | 12 型有 smoke 触及；0 BROWSER |
| REAL 达标（A 层） | 18/30 |
| **逐一校验** | **否** — 30 型均有 catalog GATE；仅 18 型达 A；无逐型 BROWSER |
| **总体可否 REAL** | **否** — 12/30 非全链路；用户问「全部可用」不成立 |

### 大类计数（与 DOM 对照）

| displayGroup | UI 文案 | 数量 | 全链路 A | 仅元数据 C |
|--------------|---------|------|----------|------------|
| oltp | 关系型数据库 | 12 | 8 | 4（dm, db2 + B 层 oracle/sqlserver） |
| olap | OLAP | 4 | 3 | 0（+1 B：clickhouse） |
| warehouse | 数仓/湖仓 | 4 | 0 | 4 |
| file | 文件 | 2 | 2 | 0 |
| api | API | 1 | 1 | 0 |
| extension | 更多 | 7 | 4 | 2（influxdb, tdengine） |

## 3c. 五维评分汇总（总体 T）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 目录 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| T4 全可查询 | 1 | 0 | — | — | 1 | 3 | F | STUB | 22/30 |
| T5 全可同步 | 1 | 0 | — | — | 1 | 3 | F | STUB | 18/30 |
| **加权总体** | 2 | 1 | 1 | 1 | 2 | **6** | **C** | **PARTIAL** | 打通登记；非「全部可用」 |

**打通但不对**（L≥2 且 C≤1）：clickhouse, oracle, sqlserver, sqlite, dm, hive, influxdb, tdengine（共 8 型在「全可用」口径下偏差）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `export_type_catalog()` | 30 types，6 groups | TOTAL=30，分组见 §3d | ✅ | `.tmp/export_catalog.py` stdout |
| 2 | `pytest test_r15_connector_query_align` | mysql/csv queryCapable；hive false | 47 passed | ✅ | 2026-08-04 run |
| 3 | `pytest test_sync_source_capabilities` | mysql/kingbase/csv true；clickhouse/hive false | passed | ✅ | 同上 |
| 4 | `vitest datasource-form.smoke` | 向导大类+保存链 | 26 passed | ✅ | 未覆盖 30 型 |
| 5 | 用户问题「全部可用」 | 30/30 查询+同步 | 18 A + 4 B + 8 C | ❌ | §3d |

## 5. 修复文档（P0 / P1）

### T4 — 8 型仅元数据（C 层）

**判定**：PARTIAL / STUB（dm/hive 有 CHAIN 探测，无 query route）  
**期望 vs 实际**：用户选 Hive/Trino 期望能 SQL 查询；实际 `queryCapable=false`，副标题有提示但能力缺口大  
**根因**：`app/query/capabilities.py` 未将 hive/trino/impala/presto/db2/dm/influxdb/tdengine 纳入 query route；`get_sql_dialect("dm")` → UnsupportedDialectError  
**修复方向**：按 PRD 分期接线 execute + dialect；短期保持 UI 标注 + 列表 badge「仅元数据」  
**优先级**：P1（warehouse 4 型用户预期最强）

### T5 — 4 型查询可用但同步未落地（B 层）

**判定**：PARTIAL（C=1）  
**期望 vs 实际**：可选为同步源、任务可创建；`run` 报「同步拉数暂未实现」  
**根因**：`sync_fetch_sql.py` 仅 mysql/postgresql 方言；`sync_source_capabilities._SYNC_SQL_FETCH_DIALECTS`  
**修复方向**：补 clickhouse/oracle/sqlserver/sqlite fetch 或向导/`syncFetchImplemented` 过滤 + 列表标注  
**优先级**：P1

### T2 — 逐型保存 smoke 缺口

**判定**：PARTIAL  
**修复方向**：参数化 smoke：30 types × POST mock 201（不必真连库）  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | — | 无「点不了/假按钮」级阻断；**不需紧急热修** |
| P1 | T4 | 8 型不可查询 — 产品需知「非全部可用」或排期 query |
| P1 | T5 | 4 型同步 run 未实现 — UI 宜标 `syncFetchImplemented` |
| P2 | T2 | 补 30 型登记 smoke |

## 7. 交接

- **结论（直接回答用户）**：向导里 **30 种连接器都能登记**；**不能**说全部「可用」——**18 种**全链路（查+同步），**4 种**可查但同步 run 未落地，**8 种**仅连接/元数据（含 Hive/Trino/Impala/达梦/Db2/时序 2 型）。
- 建议：`root-first-solve` 若要做 P1（warehouse query 或 sync fetch 补全）；或产品接受分层能力并强化 UI 标注。
- 用户批准修复：**是**（2026-08-04：P1 UI 标注 + 同步表单 syncFetchImplemented 过滤）

## 8. P1 修复落地（2026-08-04）

| 项 | 改动 |
|----|------|
| T4 元数据标注 | 连接列表 badge「仅元数据」；向导副标题「仅元数据（连接探测与 Schema 浏览）」 |
| T5 同步分层 | 列表 badge「同步拉数待支持」；向导「可查询；同步拉数待支持」 |
| 同步表单 | 下拉仅 `syncFetchImplemented`；编辑遗留未实现类型显示警告并禁止提交 |
| 类型目录 FE | `ConnectorTypeItem` 增加 `syncCapable` / `syncFetchImplemented` |
