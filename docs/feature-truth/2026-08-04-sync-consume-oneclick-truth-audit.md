# Feature Truth Audit: 同步消费一键串联

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | 同步任务 → 自动 prepare 分析库 → 一键 ensure-dataset → 看板出图 |
| 锚点 | `/admin/ingestion/sync-jobs` · `backend/app/ingestion/sync_consume.py` · `fe/src/pages/admin/ingestion/components/SyncConsumeActionCard.tsx` |
| 总体判定 | **PARTIAL**（主链 CHAIN REAL；FE 一键按钮态与 4 项控件未 UI 闭环） |
| **总分 / 档位** | **8/10 · B** |
| 状态 | approved-fix（2026-08-04 用户批准 P1/P2） |
| **sampling** | `full` |
| **supersedes** | [`2026-08-03-sync-consume-dataset-truth-audit.md`](2026-08-03-sync-consume-dataset-truth-audit.md)（旧文档仍写 `SyncJobConsumeGuide` 三步手动路径，已过时） |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 手动同步成功后，分析库 `public.{target_table}` 有数据，行数与 `rows_synced` 一致 | 对话 / PRD DATA-002 |
| T2 | 同步成功后会 best-effort 登记托管分析库（`prepare`），无需手填 5433 | 一键串联 plan |
| T3 | `GET consume-hints` 返回 `nextAction`/`consumeLabel` 与真实 Dataset 绑定状态一致 | API 契约 |
| T4 | 点击「一键创建数据集并绑定」后：Dataset ID = 目标表名、`boundConfigId` 非空 | ActionCard |
| T5 | `POST /query/dataset/execute` 行数 = PG 直查行数；字段来自分析库非 MySQL 源表 | 正确性 |
| T6 | 多任务同 `target_table` → 共用同一 Dataset；后跑全量覆盖数据（设计行为，非 bug） | 用户追问 |
| T7 | 列表「可出图/待建 Dataset/待准备」与 `consume_status` 一致；仅最近 **成功** 任务展示 | 列表 badge |
| T8 | ETL 保存并重跑后，看板数据反映清洗结果（如 deleted 过滤、脏 amount→null） | 对话历史 |
| T9 | 失败态诚实：分析库不可达时 ActionCard 显示错误，非假成功 | 异常态 E 维 |

- 非目标：全量 ingestion ETL 编辑器逐条、Cron 全组合、Dataset 多表 join 远期能力

## 2. 完整链路图

```
POST sync-jobs/run → sync_executor → analytics PG 5433
  → best_effort_prepare_after_sync → ensure_analytics_datasource
GET consume-hints → resolve_consume_status
SyncConsumeActionCard → POST ensure-dataset → datasets + query_config
看板 Dataset 模式 → POST query/dataset/execute → PG
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 入口 | 通 | 浏览器 `/admin/ingestion/sync-jobs` 200 | 列表 6 任务可见 |
| 2 | 触发 | 通 | 浏览器确认框 + Play 禁用 busy | B2/B10 |
| 3 | 协议 | 通 | `truth_verify_sync_consume.py` prepare/hints/ensure 均 200 | CHAIN |
| 4 | 域逻辑 | 通 | `sync_consume.py` · `sync_executor` auto prepare | 无 stub |
| 5 | 数据 | 通 | PG count=5 = execute rowCount=5 | C1 |
| 6 | 渲染/反馈 | **部分** | 历史页 ActionCard「创建看板」；列表 badge「可出图」 | 列表页 post-run ActionCard 未观测（运行卡住） |
| 7 | 异常态 | **部分** | pytest 503；ActionCard `setError` 源码 | 浏览器未复现 503 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 同步写入 PG | **REAL** | 9/A | PG probe count=5；历史页 rows_synced=5 |
| T2 | 自动 prepare | **REAL** | 9/A | `prepare-consume` 200 · `analyticsReady=true` |
| T3 | consume-hints 契约 | **REAL** | 9/A | truth_verify + pytest |
| T4 | ensure-dataset 一键 | **PARTIAL** | 8/B | API CHAIN 通过；**浏览器未点击**「一键创建」按钮（已 bound 态） |
| T5 | execute 正确性 | **REAL** | 10/A | rowCount=expectedCount=5 |
| T6 | 多任务共 Dataset | **REAL** | 8/B | `_dataset_id_for_job` = target_table；6 任务均写 orders_clean |
| T7 | 列表 consume 标签 | **REAL** | 9/A | 浏览器多行「可出图」 |
| T8 | ETL 重跑反映 | **UNVERIFIED** | — | 本轮未配置 ETL 后重跑 |
| T9 | 分析库不可达诚实 | **PARTIAL** | 7/B | pytest 503；FE error 分支有源码，未浏览器 L1 |

## 3b. 前端控件下钻表（21 实体中的 FE 15 项）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 新建任务 | Link `/sync-jobs/new` | 可达 | 可见 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 + smoke |
| B2 | 手动运行+确认框 | `onRun` AlertDialog | 文案含覆盖警告 | 与期望一致 | 2 | 2 | — | 2 | 2 | 8 | REAL | 浏览器 snapshot |
| B3 | 删除/批量删 | toolbar + dialog | 确认后删除 | smoke 有测 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | vitest smoke |
| B4 | 运行后 ActionCard | `recentRunSuccess` | 成功后顶部卡片 | **列表页未出现**（维度1 运行 35s+ 仍 running） | 1 | 1 | — | 1 | 1 | 5 | PARTIAL | 历史页 B13 同组件已验 |
| B5 | 一键创建 Dataset | `handleEnsureDataset` | toast + 标签变可出图 | **未点击**（hints 已 open_dashboard） | 2 | 2 | 2 | — | — | 8 | PARTIAL | API ensure 200；UI 待建态未走查 |
| B6 | 创建看板 | Link `/admin/dashboards` | 跳转看板列表 | 历史页可见可点 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 history |
| B7 | ActionCard 关闭 | `onDismiss` | 关闭后不再显示 | 未验 | 1 | 1 | — | — | 1 | 4 | STUB | 源码 `SyncConsumeActionCard.tsx:116` |
| B8 | 列表「一键出图」 | Link history | 进历史页 | 6 行均有链接 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 |
| B9 | consume 标签 | `consumeLabelText` | 与 API 一致 | 「可出图」与 hints ready 一致 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 + API |
| B10 | 运行中 Play 禁用 | `runningId` | disabled+busy | 维度1 运行中按钮 disabled | 2 | 2 | — | 2 | 2 | 8 | REAL | 浏览器 |
| B11 | 401/503 banner | PageErrorBanner | 诚实错误 | pytest 503；浏览器未验 | 2 | 2 | — | 2 | — | 8 | PARTIAL | `test_trigger_run_without_analytics_503` |
| B12 | 历史「重新同步」 | history resync | 触发 run | 按钮可见 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 |
| B13 | 历史 ActionCard | 同 B5/B6 | 成功 run 后展示 | 「同步2」卡片 + 创建看板 | 2 | 2 | — | — | 2 | 8 | REAL | 浏览器 screenshot |
| B14 | Trace 复制 | copy button | 复制 traceId | 按钮可见，**未点击验剪贴板** | 2 | 1 | — | — | 1 | 6 | PARTIAL | 浏览器 |
| B15 | 失败 error_message | LastRunCell | 展示本地化错误 | **本轮无失败行走查** | 1 | 1 | — | 1 | 1 | 5 | PARTIAL | 源码有分支 |

功能块映射：T4 → B5,B13；T7 → B8,B9；T9 → B11

## 3d. 覆盖矩阵（必验 21 实体）

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| API-consume-hints | API | ✅ | ✅ | — | — | CHAIN | 2 | 2 | REAL | truth_verify 200 |
| API-prepare-consume | API | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | truth_verify 200 |
| API-ensure-dataset | API | ✅ mock | ✅ live | — | — | CHAIN | 2 | 2 | REAL | truth_verify 200；pytest mock |
| B1-new-job | FE | — | — | ✅ | ✅ | UI | 2 | 2 | REAL | 浏览器 |
| B2-run-confirm | FE | — | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | REAL | 浏览器 |
| B3-delete-batch | FE | — | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | vitest |
| B4-post-run-card | FE | — | — | ✅ | ❌ | UI | 1 | 1 | PARTIAL | 运行卡住 |
| B5-ensure-btn | FE | — | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | API 已 bound |
| B6-open-dashboard | FE | — | — | ✅ | ✅ | BROWSER | 2 | 2 | REAL | history |
| B7-dismiss | FE | — | — | ❌ | ❌ | GATE | 1 | 1 | STUB | 未验 |
| B8-oneclick-link | FE | — | — | ✅ | ✅ | BROWSER | 2 | 2 | REAL | 浏览器 |
| B9-consume-badge | FE | — | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | REAL | 浏览器 |
| B10-run-disabled | FE | — | — | ✅ | ✅ | BROWSER | 2 | 2 | REAL | 浏览器 |
| B11-error-banner | FE | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | pytest only |
| B12-resync | FE | — | — | ✅ | ✅ | BROWSER | 2 | 2 | REAL | history |
| B13-history-card | FE | — | ✅ | ✅ | ✅ | BROWSER | 2 | 2 | REAL | history |
| B14-trace-copy | FE | — | — | ✅ | ❌ | UI | 2 | 1 | PARTIAL | 可见未点 |
| B15-fail-message | FE | — | — | ❌ | ❌ | GATE | 1 | 1 | PARTIAL | 无失败样本 |
| C1-pg-vs-execute | 正确性 | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | 5=5 |
| C2-shared-dataset | 正确性 | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | datasetId=orders_clean |
| C3-etl-clean | 正确性 | — | ❌ | — | — | NONE | 0 | 0 | UNVERIFIED | 未配置 ETL 重跑 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 21 |
| GATE only | 2（B7、B15 部分） |
| CHAIN | 10 |
| UI / BROWSER | 12 |
| NONE（未验） | 1（C3） |
| REAL 达标 | 14/21 |
| **逐一校验** | **否** — 已验 20/21；C3 未验；B4/B5/B7/B14/B15 深度不足 |
| 总体可否 REAL | **否** — FE 一键 ensure 按钮态与列表 post-run ActionCard 缺 UI 闭环 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1–T3,T5–T7 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | CHAIN+浏览器 |
| T4 | 2 | 2 | 2 | 1 | 1 | 8 | B | PARTIAL | ensure UI 待建态未点 |
| T8 | 0 | 0 | — | — | — | 0 | F | UNVERIFIED | 可选探针 |
| T9 | 2 | 2 | — | 1 | 1 | 6 | C | PARTIAL | 503 仅 pytest |
| **模块** | 2 | 2 | 2 | 1 | 2 | **8** | **B** | **PARTIAL** | 主链真通；FE 细项与 ETL 未闭环 |

**打通但不对**：0（无 L≥2 且 C=0 项）  
**假功能 / STUB**：B7 dismiss（GATE-only）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | 环境 3307/5433/8000 | 可达 | 全部 True + health 200 | ✅ | Test-NetConnection |
| 2 | `pytest test_ingestion_api + test_sync_executor` | 71 passed | **71 passed** 13.11s | ✅ | 2026-08-04 终端 |
| 3 | `vitest ingestion.smoke` | 41 passed | **41 passed** | ✅ | 2026-08-04 终端 |
| 4 | `truth_verify_sync_consume.py` | PG+consume+execute | pg_count=5, rowCount=5, hints ready | ✅ | 脚本 SUMMARY |
| 5 | 浏览器列表 | 成功任务「可出图」 | 多行绿色「可出图」+「一键出图」 | ✅ | MCP browser |
| 6 | 浏览器运行「维度1」 | 成功 → ActionCard | **35s+ 仍 running**，无 ActionCard | ❌ | 环境/backend 卡顿 |
| 7 | 浏览器历史「同步2」 | ActionCard open_dashboard | 卡片 + 「创建看板」「查看数据集」 | ✅ | history URL |
| 8 | PG vs execute | N 行 | 5 = 5 | ✅ | truth_verify |
| 9 | consume-hints after ensure | open_dashboard, bound | nextAction=open_dashboard, datasetBound=true | ✅ | truth_verify JSON |
| 10 | 两任务同 target | 同一 datasetId | 均为 orders_clean | ✅ | 列表 + `_dataset_id_for_job` |

### 正确性对比表

| 输入 | 应见 | 实见 | 证据 |
|------|------|------|------|
| PG `SELECT COUNT(*) FROM orders_clean` | N | execute 返回 **5** 行 | truth_verify |
| consume-hints after ensure | `nextAction=open_dashboard`, `datasetBound=true` | **一致** | truth_verify |
| 两任务 target 相同 | 同一 `datasetId` | **orders_clean** | GET hints + 6 任务列表 |

## 5. 静态审计摘要（Step 2）

| 风险点 | 结论 | 证据 |
|--------|------|------|
| Dataset ID 硬绑 `target_table` | ✅ 符合 T6 设计 | `sync_consume.py:74-75` |
| 已选表不记数据源 | ⚠️ 产品缺口仍在 | `DatasetTablePicker.tsx` 仅 `tables[].name`，无 dataSourceId |
| ensure-dataset 只绑 PG analytics | ✅ dataSourceId 来自 `prep.analytics_datasource_id` | `_bind_dataset_query` L157 |
| consume_status 仅 last_run=succeeded | ✅ | `sync.py:414-415` |
| FE 无 ActionCard 专用 vitest | ⚠️ 仍成立 | smoke 仅验「不 stale 显示 guide」 |
| `test_ensure_dataset_endpoint` mock | ⚠️ GATE-only | `test_ingestion_api.py:121-128` patch 域函数 |

## 6. 修复文档（P0/P1，不改代码除非用户批准）

### P1 — B5 ensure-dataset UI 待建态未浏览器闭环

**判定**：PARTIAL 8/10  
**期望 vs 实际**：新环境首次同步后应出现「一键创建数据集并绑定」并可点击；本轮环境已 bound，仅见「创建看板」。  
**根因**：审计环境 Dataset 已存在；缺「删 Dataset 后重跑」走查脚本。  
**修复方向**：补 vitest/integration：mock hints `ensure_dataset` → 断言按钮文案与 `ensureSyncDataset` 调用；或 E2E 用独立 target_table。  
**修后验收**：B5 BROWSER depth，C≥2，总分≥8。

### P1 — B4 列表页 post-run ActionCard

**判定**：PARTIAL 5/10（列表路径）  
**期望 vs 实际**：SyncJobsPage 运行成功后应出现 ActionCard；「维度1」运行 35s+ stuck running。  
**根因**：环境/backend 并发或 uvicorn 热重载已知问题（非 sync_consume 逻辑本身）；历史页同组件已验。  
**修复方向**：运维：避免 dev 热重载卡死；产品：运行超时 UI 提示。  
**修后验收**：列表页 BROWSER 见 ActionCard。

### P1 — 测试缺口 ActionCard / ensure-dataset

**判定**：GATE-only pytest mock  
**根因**：`test_ensure_dataset_endpoint` patch `ensure_dataset_for_sync_job`；无 `SyncConsumeActionCard` 单测。  
**修复方向**：新增 vitest：渲染 card + mock API ensure + toast；pytest 集成测（不 patch 域层）或扩 truth_verify 用临时表名。

### P2 — DatasetTablePicker 混源表名

**判定**：产品缺口（非本功能 STUB）  
**说明**：手动建 Dataset 可选不同数据源同名表；一键串联路径始终绑 analytics PG，不受影响。  
**修复方向**：选表时绑定 dataSourceId 或同表名冲突校验。

### P2 — 多任务同 target 无 UI 警告

**判定**：F 维 1 分  
**修复方向**：列表或 ActionCard 提示「与任务 X 共用 Dataset orders_clean」。

### P2 — C3 ETL 清洗正确性

**判定**：UNVERIFIED  
**修复方向**：配置 deleted 过滤规则 → 重跑 → 对比 PG count 与看板行数。

## 7. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | B5 | 补 ensure-dataset 待建态 UI/E2E 证据 |
| P1 | B4 | 列表 post-run ActionCard 浏览器闭环（含运行卡住排查） |
| P1 | 测试 | ActionCard vitest + ensure 非 mock 集成 |
| P2 | DatasetTablePicker | 混源选表产品缺口 |
| P2 | T6 | 同 target 多任务 UI 警告 |
| P2 | C3 | ETL 重跑正确性探针 |

## 8. 交接

- **supersedes**：`2026-08-03-sync-consume-dataset-truth-audit.md`
- 建议：`root-first-solve` 优先 P1 测试与 B5 UI 走查；环境运行卡住单独排查 backend
- 用户批准修复：**是**（2026-08-04）

## 9. 修复落地记录（2026-08-04）

| ID | 改动 | 证据 |
|----|------|------|
| P1 B5 | 新增 `SyncConsumeActionCard.test.tsx`（ensure/open_dashboard/dismiss/prepare/共享表警告） | vitest 6 passed |
| P1 B4 | `SyncJobsPage` 轮询立即首检 + 60s 超时 warning toast；smoke `SyncJobsPage_shows_action_card_after_run_success` | vitest 48 passed |
| P1 测试 | `tests/test_sync_consume.py` 域集成 + `test_ensure_dataset_endpoint_chain`（endpoint 不 mock 域函数） | pytest 74 passed |
| P2 T6 | ActionCard `sharedTargetJobNames` 警告；列表/历史页传入 sibling 任务名 | 组件测试 + 源码 |
| P2 DatasetTablePicker | 已选表锁定数据源，切换前须清空 | `DatasetTablePicker.tsx` |
