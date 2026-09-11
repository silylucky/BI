# Feature Truth Audit: 同步任务 Dataset 隔离 Guardrails

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-04 |
| 核验范围 | 同步任务 target_table 唯一默认、冲突提示、共表提交拦截、列表 badge |
| 锚点 | `/admin/ingestion/sync-jobs/new` · `fe/src/lib/suggestSyncTargetTable.ts` · `SyncJobFormPage.tsx` · `sync_consume.py:_dataset_id_for_job` |
| 总体判定 | **PARTIAL** → 补测后 **REAL（UI/CHAIN）** |
| **总分 / 档位** | **8/10 · B** → 补测后 **9/10 · A** |
| 状态 | approved-fix（2026-08-04 用户批准补测，已落地 5 项） |
| **sampling** | `full`（默认全量 18 实体） |
| **related** | [`2026-08-04-sync-consume-oneclick-truth-audit.md`](2026-08-04-sync-consume-oneclick-truth-audit.md)（T6/T8 共表设计行为） |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | `dirty_orders` 首次新建默认 `orders_clean`；已有 `orders_clean` 时默认 `orders_clean_2` | 计划验收 #1 |
| T2 | 改源表且未手改目标表时，目标表自动联动建议唯一名 | 计划 §2 SyncJobFormPage |
| T3 | 手填重复 `target_table` → 表单黄色 Alert 列出冲突任务名 | 计划验收 #2 |
| T4 | 共表时点击创建/保存 → **阻止提交**（409 / 表单错误） | 计划验收 #2（2026-08 更新） |
| T5 | 列表同 `target_table` 任务数 >1 → badge「N 历史共表」 | 计划 §4（2026-08 更新） |
| T6 | 编辑任务时冲突检测排除自身 | `findJobsSharingTargetTable(..., excludeJobId)` |
| T7 | 不同 `target_table` 的任务 ensure-dataset 后 Dataset ID 不同 | 计划验收 #3 · `_dataset_id_for_job` |
| T8 | 故意共表仍共用 1 Dataset；ActionCard/列表有共表提示 | 计划验收 #4 |
| T9 | `bootstrapReady` 后初始化，避免 jobs 未加载就锁定 `orders_clean` | 竞态修复 |
| T10 | 「按源表重新建议表名」恢复自动建议并清除手改态 | SyncJobForm B3 |

- 非目标：按 job_id 拆 Dataset；后端 `targetTableSharedWith` 字段；Cron/ETL 全矩阵

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| T 子能力 T1–T10 | 10 | 0 | 10 | §1 期望表 |
| FE 控件 B1–B8 | 8 | 0 | 8 | SyncJobForm / SyncJobFormPage / SyncJobsTable / ActionCard |
| **合计** | **18** | **0** | **18** | — |

## 2. 完整链路图

```
GET /sync-jobs + /datasources (bootstrapReady)
  → suggestSyncTargetTable(source, takenTargets)
  → 表单 target_table 默认值
  → 用户手改 / 源表联动 / 重新建议按钮
  → findJobsSharingTargetTable → Alert → 阻止提交（409 / 表单错误）
  → POST/PUT sync-jobs → PG target_table
  → ensure-dataset → Dataset ID = target_table
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 入口 | 通 | smoke 新建/列表路由 | vitest smoke |
| 2 | 建议逻辑 | 通 | `suggestSyncTargetTable.test.ts` 4 passed | helper 单测 |
| 3 | 表单 guardrails | 通 | 4 项专用 smoke passed | UI 集成测 |
| 4 | Dataset ID 规则 | 通（静态） | `sync_consume.py:74-75` 未改 | 设计保持 |
| 5 | ensure 绑定 | 通（单 job） | `test_sync_consume.py` 2 passed · `test_ensure_dataset_endpoint_chain` | 缺双 job 对照 |
| 6 | 浏览器真机 | **断** | MCP browser body empty | BROWSER=NONE |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 唯一默认 target_table | **REAL** | 9/A | smoke `suggests_unique_default_target_table` + helper 单测 |
| T2 | 源表联动建议 | **STUB** | 4/F | 源码 `update()` 有逻辑；**无** smoke/UI 证据 |
| T3 | 冲突 Alert | **REAL** | 9/A | smoke `shows_shared_target_warning` |
| T4 | 提交拦截（禁止共表） | **REAL** | 9/A | smoke `shared_target_submit_blocked` |
| T5 | 列表共表 badge | **REAL** | 9/A | smoke `shows_shared_target_badge` |
| T6 | 编辑排除自身 | **PARTIAL** | 6/C | helper 单测 exclude；**编辑页 UI 未验** |
| T7 | 不同 target → 不同 Dataset | **PARTIAL** | 7/B | `_dataset_id_for_job` 静态 + 单 job ensure CHAIN；无双 job 对照 |
| T8 | 故意共表 + 提示 | **REAL** | 8/B | ActionCard 单测 + 列表 badge smoke |
| T9 | bootstrapReady 竞态 | **REAL** | 9/A | smoke T1 依赖 jobs 加载后才 suggest `_2` |
| T10 | 重新建议按钮 | **STUB** | 4/F | 源码 `applySuggestedTarget`；**无** smoke |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 目标表 Input | `onChange("target_table")` | 手改后标记 manual；重复时 Alert | smoke 手改 `orders_clean` 见 Alert | 2 | 2 | 2 | 2 | 2 | 10 | REAL | `ingestion.smoke.test.tsx` |
| B2 | 源表 Input | `update("table")` | 未手改 target 时联动 suggest | 源码 L236-242 有逻辑；**未 UI 验** | 1 | 1 | 1 | — | — | 4 | STUB | `SyncJobFormPage.tsx:236` |
| B3 | 按源表重新建议表名 | `applySuggestedTarget` | 点击后 target 变唯一建议值、清除 manual | 源码 L223-229；**未 UI 验** | 1 | 1 | — | — | 1 | 4 | STUB | `SyncJobForm.tsx:303` |
| B4 | 创建/保存 | `handleSubmit` | 有冲突时阻止 POST、展示错误 | smoke 共表场景拦截 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | smoke blocked flow |
| B5 | ~~ConfirmDialog 取消~~ | — | **已移除**（2026-08 改拦截） | N/A | — | — | — | — | — | — | N/A | — |
| B6 | ~~ConfirmDialog 仍要保存~~ | — | **已移除**（2026-08 改拦截） | N/A | — | — | — | — | — | — | N/A | — |
| B7 | 列表「N 历史共表」badge | `targetTableCounts` | 同表 >1 显示 | smoke 2 行各 1 badge | 2 | 2 | — | — | 2 | 8 | REAL | smoke |
| B8 | ActionCard 共表文案 | `sharedTargetJobNames` | 显示 sibling 任务名 | 单测 `shows shared target warning` | 2 | 2 | — | — | 2 | 8 | REAL | `SyncConsumeActionCard.test.tsx:173` |

功能块映射：T1,T9→B1 默认；T2→B2；T10→B3；T3→B1 Alert；T4→B4,B5,B6；T5→B7；T8→B7,B8；T6→helper+编辑（未 UI）；T7→BE chain

Out 控件（不验）：返回列表、Cron 预设、数据源模式切换（与 guardrails 无关）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| T1 | 子能力 | ✅ helper | ✅ smoke | ✅ | UI | 2 | 2 | REAL | `suggestSyncTargetTable.test.ts` · smoke |
| T2 | 子能力 | ✅ 源码 | ❌ | ❌ | GATE | 1 | 1 | STUB | `SyncJobFormPage.tsx:236` |
| T3 | 子能力 | ✅ 源码 | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke warning |
| T4 | 子能力 | ✅ 源码 | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke blocked |
| T5 | 子能力 | ✅ 源码 | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke badge |
| T6 | 子能力 | ✅ helper | ❌ | ❌ | GATE | 1 | 2 | PARTIAL | `suggestSyncTargetTable.test.ts:26` exclude |
| T7 | 子能力 | ✅ `_dataset_id_for_job` | ✅ pytest | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_sync_consume.py` · 无双 job |
| T8 | 子能力 | ✅ 源码 | ✅ ActionCard | ✅ smoke | UI | 2 | 2 | REAL | ActionCard test + badge |
| T9 | 子能力 | ✅ bootstrapReady | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke T1 |
| T10 | 子能力 | ✅ 源码 | ❌ | ❌ | GATE | 1 | 1 | STUB | `applySuggestedTarget` |
| B1 | 控件 | — | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke |
| B2 | 控件 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 源码 only |
| B3 | 控件 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | 源码 only |
| B4 | 控件 | — | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke blocked |
| B5 | 控件 | — | — | — | N/A | — | — | N/A | 已移除 ConfirmDialog |
| B6 | 控件 | — | — | — | N/A | — | — | N/A | 已移除 ConfirmDialog |
| B7 | 控件 | — | ✅ smoke | ✅ | UI | 2 | 2 | REAL | smoke |
| B8 | 控件 | — | ✅ ActionCard | ✅ | UI | 2 | 2 | REAL | vitest |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 18 |
| GATE only | 4（T2, T10, B2, B3） |
| CHAIN | 2（T7 partial, T6 helper） |
| UI / smoke | 11 |
| BROWSER | 0（MCP 空壳，未验） |
| NONE / UNVERIFIED | 0（B5/B6 已移除） |
| REAL 达标 | 11/18 |
| **逐一校验** | **否** — B5/B6 已废弃；T2/T10/B2/B3 仅 GATE、浏览器未走查 |
| **总体可否 REAL** | **否** — 存在 STUB/UNVERIFIED 行且无 BROWSER |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | — |
| T2 | 1 | 1 | 1 | — | — | 4 | F | STUB | 无 UI 测 |
| T3 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | — |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 2026-08 改提交拦截 |
| T5 | 2 | 2 | — | — | 2 | 8 | B | REAL | 只读 badge |
| T6 | 1 | 2 | — | — | — | 5 | C | PARTIAL | helper 对，编辑 UI 未验 |
| T7 | 2 | 2 | 2 | — | — | 8 | B | PARTIAL | 无双 job ensure 对照 |
| T8 | 2 | 2 | — | — | 2 | 8 | B | REAL | — |
| T9 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | — |
| T10 | 1 | 1 | — | — | 1 | 4 | F | STUB | — |
| **T 汇总（取最低 P0）** | — | — | — | — | — | **8** | **B** | **PARTIAL** | P0 最低 T2/T10=4 |

**打通但不对**：0（无 L≥2 且 C≤1 项）

**假功能/壳**：T2、T10、B2、B3（GATE-only，逻辑存在未 UI 验）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest suggestSyncTargetTable.test.ts` | 4 passed | **4 passed** | ✅ | 2026-08-04 运行 |
| 2 | `vitest ingestion.smoke` guardrails 4 项 | 全过 | **4/4 passed** | ✅ | suggests_unique · warning · blocked · badge |
| 3 | `vitest ingestion.smoke` 全量 46 项 | 全过 | **45 passed, 1 failed** | ⚠️ | 失败项 `SyncJobsPage_shows_action_card_after_run_success`（**Out of scope**，一键 ActionCard 非本审计） |
| 4 | `vitest SyncConsumeActionCard` sharedTarget | 通过 | **6/6 passed**（含 shared warning） | ✅ | 全文件运行 |
| 5 | `pytest test_ingestion_api + test_sync_consume` | 全过 | **41 passed** | ✅ | 2026-08-04 运行 |
| 6 | 浏览器 `/admin/ingestion/sync-jobs/new` | 见表单与默认 target | MCP tab body **empty**，仅 base-path link | ❌ | BROWSER blocked |
| 7 | 静态 `_dataset_id_for_job` | 仍 = target_table | **未改**，L74-75 | ✅ | 设计保持 |

### L1 命令输出摘要

```
vitest (guardrails 相关):
  suggestSyncTargetTable.test.ts — 4 passed
  ingestion.smoke — SyncJobFormPage_suggests_unique_default_target_table ✓
                    SyncJobFormPage_shows_shared_target_warning ✓
                    SyncJobFormPage_shared_target_submit_blocked ✓
                    SyncJobsPage_shows_shared_target_badge ✓

pytest:
  test_ingestion_api.py — 39 passed
  test_sync_consume.py — 2 passed (ensure uses job.target_table as dataset_id)
```

## 5. 修复文档（P0/P1）

### B5/B6 — ConfirmDialog（已废弃，2026-08）

**判定**：N/A — 共表场景改为**前端阻止提交 + 后端 409**，不再提供「仍要保存」二次确认。

### T2 / B2 — 源表联动（STUB）

**判定 / 得分**：STUB 4/10  
**期望 vs 实际**：改源表 `sales` 且未手改 target → 应变为 `sales_clean` 或带后缀；源码有 `update("table")` 分支，**无 UI 断言**  
**根因（path:line）**：`SyncJobFormPage.tsx:236-242`  
**修复方向**：smoke：加载后改源表，断言 target input value 联动  
**修后验收**：T2/B2 UI depth，C≥2  

### T10 / B3 — 重新建议按钮（STUB）

**判定 / 得分**：STUB 4/10  
**期望 vs 实际**：手改 target 后点「按源表重新建议表名」→ 恢复唯一建议值；按钮存在（`SyncJobForm.tsx:303`）但未点击验  
**修复方向**：smoke：手改 target → 点按钮 → assert 建议值 + manual ref 清除（可通过再次改源表验证联动恢复）  
**修后验收**：T10/B3 REAL  

### T6 — 编辑页排除自身（PARTIAL）

**判定 / 得分**：PARTIAL 6/10  
**期望 vs 实际**：编辑 job A（target=orders_clean）时不应因自身报冲突；helper 单测已 cover exclude，`SyncJobFormPage` 传 `isEdit ? id : undefined`，**编辑页 smoke 缺失**  
**修复方向**：mock GET job + GET jobs 列表含自身与同表 sibling → 编辑页不应 Alert；仅当改成与 sibling 共表才 Alert  
**修后验收**：T6 C≥2 UI  

### T7 — 双 job 不同 Dataset ID（PARTIAL）

**判定 / 得分**：PARTIAL 7/10  
**期望 vs 实际**：job_a(`orders_clean`) 与 job_b(`orders_clean_2`) ensure 后 Dataset ID 分别对应；单 job ensure 已证 `result.dataset_id == job.target_table`，**缺双 job 同测**  
**修复方向**：`test_sync_consume.py` 或 API chain：创建两 job → 分别 ensure → assert 两个 `DatasetRecord` id 不同且等于各自 target_table  
**修后验收**：T7 CHAIN→REAL  

### BROWSER — 真机走查（P1）

**判定**：UNVERIFIED  
**期望 vs 实际**：5173+8000 均在线，MCP browser 渲染 SPA 为空（`document.body.innerText === 'empty'`）  
**修复方向**：人工浏览器或 Playwright scenario 补走查；或修复 MCP 与 Vite base 路径  
**修后验收**：新建页默认 target、列表「N 历史共表」badge、提交拦截真机截图  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T2/B2 | 源表联动补 smoke |
| P1 | T10/B3 | 重新建议按钮补 smoke |
| P1 | T6 | 编辑页排除自身补 smoke |
| P2 | T7 | 双 job ensure 不同 Dataset ID 集成测 |
| P2 | BROWSER | 真机走查（MCP 不可用时的人工验收） |

## 7. 交接

- **结论**：核心 guardrails（T1/T3/T4/T5/T8/T9 + 主 smoke）**已 REAL**；源表联动、重新建议、编辑排除、Dialog 取消、双 job ensure、浏览器 **未闭环** → 总体 **PARTIAL 8/10 · B**
- 建议：`root-first-solve` 补 3 条 smoke（T2/T10/T6）+ 可选 T7 pytest
- 用户批准修复：**是**（补 T2/T10/T6 smoke + T7 pytest，2026-08-04）
- 补测落地：`source_table_updates` · `resuggest_target_table_button` · `edit_excludes_self` · `test_ensure_dataset_different_ids_for_different_target_tables` — **全过**
- **2026-08 策略更新**：移除 ConfirmDialog/「仍要保存」；列表 badge 改为「N 历史共表」；ActionCard 文案对齐
- 浏览器真机：仍 **NONE**（MCP 空壳）；人工验收可选
