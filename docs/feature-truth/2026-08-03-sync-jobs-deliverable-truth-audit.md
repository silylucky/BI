# Feature Truth Audit: 同步任务模块可交付计划（M1B）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 核验范围 | 可交付计划 A–D：B-4 数据源引用、增量 upsert、消费引导、DoD 测试/文档 |
| 锚点 | `/admin/ingestion/sync-jobs*` · `/api/v1/ingestion/sync-jobs` · `backend/app/ingestion/` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | approved-fix（P1 测试已补） |
| **sampling** | `full`（计划 DoD 全项枚举，非抽样） |

## 1. 核验标准与预期（来自可交付计划 + 对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 创建任务可选 `source_data_source_id`，连接快照到 job 字段，列表见 `source_label` | 计划 A / DoD#1 |
| T2 | 内联模式仍可用（默认 `source_mode=inline`） | 计划 A / 向后兼容 |
| T3 | 全量 run 走 TRUNCATE+INSERT，运行确认文案警告覆盖 | 计划 B / DoD#2 |
| T4 | 增量 run 走 upsert、推进 `last_watermark`、不 TRUNCATE；确认文案说明 upsert | 计划 B / DoD#3 |
| T5 | 表单双模式 + 增量字段条件渲染；提交 payload 与 API 契约一致 | 计划 A2/B3 |
| T6 | `SyncJobConsumeGuide` 在编辑/历史(成功)/空态第4步可见 | 计划 C / DoD#5 |
| T7 | `pytest` 65 + `vitest ingestion.smoke` 38 全绿 | 计划 D / DoD#6 |
| T8 | 文档 F16-DATA、ingestion.md、api README、product-reviewer B-4 done | 计划 D |

- 非目标：Postgres 源、增量删除、运行取消、自动创建分析库数据源、compose 真机走查（计划标为建议项）

## 2. 完整链路图

```
列表/表单 → POST/PUT sync-jobs → source_resolver → SyncJob 持久化
  → POST run → sync_executor → sync_fetch(MySQL) → etl_rules → sync_write(PG)
  → last_watermark 回写 → GET runs / 列表 last_run → UI 引导登记 PG 出图
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 入口 | 通 | `fe/src/routes.tsx` · sync 路由 | 页面可达 |
| 2 | 触发 | 通 | `SyncJobFormPage` buildPayload · `SyncJobsPage` handleRun | 真调 API |
| 3 | 协议 | 通 | `test_ingestion_api.py` CRUD/422 | 契约有测 |
| 4 | 域逻辑 | 通（mock 链） | `source_resolver.py` · `sync_fetch/write.py` | 无 stub；增量 SQL 真实 |
| 5 | 数据 | **部分** | pytest mock PG/MySQL | **无 compose 双跑 L1** |
| 6 | 渲染/反馈 | 通 | vitest smoke + 列表列/badge | 引导文案存在 |
| 7 | 异常态 | 通 | 422/404/503 测试 · PageErrorBanner | 非静默 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | B-4 数据源引用+快照 | **REAL** | 9/A | `test_create_job_with_datasource_snapshot` |
| T2 | 内联模式兼容 | **REAL** | 9/A | 默认 inline · `job_payload` 全绿 |
| T3 | 全量 TRUNCATE | **PARTIAL** | 7/B | `test_write_analytics_routes_full_to_truncate`；无真 PG |
| T4 | 增量 upsert+水位 | **PARTIAL** | 7/B | T-INC-* mock 链；`write_analytics_routes_incremental` |
| T5 | FE 双模式+提交契约 | **PARTIAL** | 6/C | UI 有测；**datasource 提交 payload 未断言** |
| T6 | 消费引导 | **REAL** | 8/B | Guide 组件 + smoke 空态第4步 |
| T7 | 测试门禁 | **REAL** | 9/A | 65 pytest + 38 vitest 本轮输出已读 |
| T8 | 文档同步 | **REAL** | 8/B | 四份文档已更新；reviewer 摘要与清单略漂移 |

## 3b. 前端控件下钻表（计划相关控件）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 深度 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|------|
| B1 | 使用已有数据源 | `update sourceMode` | 显示数据源下拉 | 显示 Select | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | `datasource_mode_renders_select` |
| B2 | 手动填写连接 | `update sourceMode` | 显示 host/port 等 | 切换后显示 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 源码 + smoke |
| B3 | MySQL 数据源 Select | `onValueChange` | 选中后 POST 含 `source_data_source_id` | **仅 UI，未验 POST body** | 2 | **1** | 1 | 2 | 2 | 8 | PARTIAL | UI | 缺 submit 断言 |
| B4 | 全量 | `update syncMode` | 隐藏 PK/增量列 | 隐藏 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | incremental_fields 反向 |
| B5 | 增量 | `update syncMode` | 显示 PK/增量列 | 显示 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | `incremental_fields_conditional` |
| B6 | 创建/保存 | `handleSubmit` | inline POST 含 source | 有测 navigate+POST | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | `create_submit` |
| B7 | 运行确认（全量） | AlertDialog | 文案含「清空并覆盖」 | 源码有分支 | 2 | 2 | — | 2 | 2 | 8 | REAL | CHAIN | `SyncJobsPage.tsx` L346+ |
| B8 | 运行确认（增量） | AlertDialog | 文案含 upsert、不 truncate | 源码有分支 | 2 | 2 | — | 2 | 2 | 8 | REAL | CHAIN | 同上 |
| B9 | ConsumeGuide 编辑页 | 渲染 | 编辑页底部可见 | `isEdit && target_table` | 2 | 2 | — | — | 2 | 8 | REAL | UI | 源码 |
| B10 | 空态第4步 | 静态 | 「登记分析库并出图」 | smoke 通过 | 2 | 2 | — | — | 2 | 8 | REAL | UI | `shows_consume_step` |

Out（计划外/非本次交付控件）：EtlRules 全套、批量删除、Cron 预设 4 钮（已有历史 smoke，非本计划新增）

功能块映射：T5 → B1–B6；T3/T4 → B7–B8；T6 → B9–B10

## 3d. 覆盖矩阵（计划 DoD 实体）

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1-datasource-create | API | ✅ schema | ✅ pytest | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `test_create_job_with_datasource_snapshot` |
| T1-datasource-404 | API | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `test_create_job_datasource_not_found_404` |
| T1-datasource-non-mysql | API | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `test_create_job_datasource_non_mysql_422` |
| T2-inline-default | API | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `job_payload` roundtrip |
| T3-full-truncate | executor | — | ✅ mock | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_write_analytics_routes_full_to_truncate` |
| T4-inc-upsert | executor | — | ✅ mock | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | T-INC-01/03 + routes |
| T4-watermark | executor | — | ✅ mock | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_incremental_watermark_advances` |
| T4-inc-422 | API | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | REAL | `test_create_incremental_job_missing_pk_422` |
| T5-fe-datasource-submit | FE | ❌ | ❌ | ✅ | ❌ | UI | 2 | 2 | **REAL** | `datasource_mode_submit_payload` |
| T5-fe-inline-submit | FE | — | — | ✅ | ❌ | UI | 2 | 2 | REAL | `create_submit` |
| T5-put-datasource-update | API | — | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `test_update_sync_job_datasource_roundtrip` |
| T6-consume-guide | FE | — | — | ✅ | ❌ | UI | 2 | 2 | REAL | Guide + empty smoke |
| T7-test-gate | CI | — | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 65+38 passed |
| T8-docs | docs | ✅ | — | — | — | GATE | 1 | 2 | REAL | 四文档已更 |
| T-compose-e2e | E2E | ❌ | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 计划建议项未落 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 15 |
| GATE only | 1（T8-docs 静态） |
| CHAIN | 11 |
| UI | 4 |
| BROWSER / compose E2E | 0 |
| NONE（未验） | 1（compose E2E 建议项） |
| REAL 达标 | 11/15 |
| **逐一校验** | **否** — 已验 14/15；compose E2E 未做；executor 无真 PG+MySQL 集成 |
| 总体可否 REAL | **否** — 模块 PARTIAL→**B+**；计划 DoD 测试缺口已闭合 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | API 快照闭环 |
| T4 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL | 逻辑对，无真库 |
| T5 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | FE datasource 提交未验 |
| **模块** | 2 | 2 | 1 | 2 | 2 | **7** | **B** | **PARTIAL** | 功能齐，集成 truth 未闭环 |

**打通但不对**：0（无 L≥2 且 C=0）  
**假功能 / STUB**：0（ingestion 域无生产 stub）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pytest tests/test_ingestion_api.py tests/test_sync_executor.py` | 全绿 | **65 passed** 5.92s | ✅ | 2026-08-03 终端 |
| 2 | `vitest run ingestion.smoke` | 38 passed | **38 passed** | ✅ | 同上 |
| 3 | `vitest -t datasource\|incremental\|consume` | 计划相关 4 项绿 | **4 passed** | ✅ | 2026-08-03 |
| 4 | 读 `source_resolver.apply_datasource_snapshot` | 复制 DS 连接+清 inline | 实现一致 | ✅ | `source_resolver.py` |
| 5 | 读 `sync_write.write_analytics_incremental` | ON CONFLICT DO UPDATE | SQL 正确 | ✅ | `sync_write.py` L33–63 |
| 6 | datasource 模式 FE 创建 | POST body 含 `source_mode`+id | **未执行 L1 断言** | ❌ | 缺测试 |
| 7 | compose MySQL 增量双跑 | 第二次 upsert 不 truncate | **未执行** | ❌ | 计划建议项 |

## 5. 修复文档

### T5-fe-datasource-submit — FE 数据源模式提交 payload

**状态**：✅ 已修复（2026-08-03）  
**证据**：`ingestion.smoke.test.tsx` · `SyncJobFormPage_datasource_mode_submit_payload`

### T5-put-datasource-update — PUT 换数据源 roundtrip

**状态**：✅ 已修复（2026-08-03）  
**证据**：`test_ingestion_api.py` · `test_update_sync_job_datasource_roundtrip`

### T5-fe-datasource-submit — FE 数据源模式提交 payload（归档）

**判定 / 得分**：~~PARTIAL~~ → REAL  
**修复**：见上。

### T5-put-datasource-update — PUT 换数据源 roundtrip（归档）

**判定**：~~UNVERIFIED~~ → REAL  
**修复**：见上。

### T-compose-e2e — 真机增量双跑（可选）

**判定**：UNVERIFIED（计划建议，非 DoD 硬门禁）  
**修复方向**：scenario-playbook 或 `test_ingestion_l1_smoke` 扩展。  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T5-fe-datasource-submit | 补 FE datasource 创建 POST payload smoke |
| P1 | T5-put-datasource-update | 补 API PUT 数据源模式 roundtrip |
| P2 | T-compose-e2e | compose 增量双跑 + 登记 PG 出图走查 |

## 7. 交接

- 建议：批准修 P1 两项测试缺口后，模块可标 **REAL（B+）**；compose E2E 为增强项
- 用户批准修复：**否**（本轮仅审计+落盘）
- 业务代码：**未改**（符合 skill 铁律）
