# Feature Truth Audit: Dataset 与源数据同步清理（删任务级联 / 孤儿清理）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 核验范围 | 用户反馈「源数据/同步任务删除后 Dataset 仍显示、数据未同步」的后端修复 |
| 锚点 | `backend/app/metadata/dataset/cleanup.py` · `DELETE /api/v1/ingestion/sync-jobs/{id}` · `GET /api/v1/datasets` · `DELETE /api/v1/datasets/{id}` · `DELETE /api/v1/datasources/{id}` · `fe/src/pages/admin/datasets/DatasetListPage.tsx` |
| 总体判定 | **REAL** |
| **总分 / 档位** | **8/10 · B** |
| 状态 | approved-fix（2026-08-18 复验后补回 E4/E5 + T1-FE-07） |
| **sampling** | `full`（5 项交付能力 + 1 项遗留缺口，无抽样） |
| **related** | [dataset-orphan-after-sync-job-delete.md](../.agents/skills/bug-case-library/cases/dataset-orphan-after-sync-job-delete.md) |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 删除同步任务后，对应 `origin=sync_job` 的 Dataset 从元库消失，GET 404 | 用户原话「源数据删除仍会显示」· 会话修复目标 |
| T2 | 列表 `GET /datasets` 时自动清理 `sync_job_id` 指向已删任务的孤儿 Dataset | 同上 · 历史数据修复 |
| T3 | 删除 Dataset 时同步删除 `bound_config_id` / stable ref 的 `dataset_query` 配置 | 链路完整性 · `cleanup.py` |
| T4 | 删除数据源时，若仍有同步任务引用该源 → 409 `DATASOURCE_IN_USE` | 防止新孤儿 |
| T5 | 删除数据源时，若仍有 Dataset `tableSourceDataSourceId` 引用 → 409 | 同上 |
| T6 | Dataset 列表刷新后，用户不再看到已失效的同步产物 | FE 用户 DOM 路径 `DatasetListPage` / `RowActions` |
| T7 | 增量同步下源表删行后，分析库行同步删除 | **Out** — `docs/services/ingestion.md` 边界 |

- 非目标：按 job_id 拆 Dataset ID 规则变更；分析库物理表 DROP；全量 FE 控件矩阵

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 后端交付能力 E1–E5 | 5 | 0 | 5 | 会话修复清单 · `cleanup.py` / `service.py` / `sync.py` |
| FE 列表行为 B1 | 1 | 0 | 1 | `DatasetListPage.tsx` 列表加载 |
| 遗留缺口 G1 | 1 | 0 | 1 | 手动 Dataset + 已软删数据源仍列表可见 |
| 增量删行 T7 | 1 | 1 | 0 | ingestion 边界 Out |
| **合计必验** | **7** | **1** | **7** | — |

## 2. 完整链路图

```
删同步任务 DELETE /ingestion/sync-jobs/{id}
  → delete_datasets_for_sync_job
  → delete_dataset_row → 删 query_config + datasets 行
  → commit

打开 Dataset 列表 GET /datasets
  → purge_orphan_sync_datasets (commit)
  → 再查询列表

删 Dataset DELETE /datasets/{id}
  → delete_dataset_row

删数据源 DELETE /datasources/{id}
  → 检查 SyncJob.source_data_source_id / Dataset.table_source_datasource_id
  → 有引用则 409
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 删任务级联 | **通** | `test_delete_sync_job_cascades_bound_dataset` PASSED | Dataset 行已删 |
| 2 | 列表孤儿清理 | **通** | `test_list_datasets_purges_orphan_sync_job_dataset` PASSED | 列表不含孤儿 |
| 3 | 删 Dataset 清配置 | **静态通 / 未动态验** | `cleanup.py:19-35` | 无单测断言 `query_config_records` |
| 4 | 删源拦截 | **静态通 / 未动态验** | `datasources/service.py:463-481` | 无新增单测 |
| 5 | FE 列表刷新 | **未验** | 无 vitest smoke / BROWSER | 依赖 API，未 UI 验 |
| 6 | 遗留：已删源的手动 Dataset | **未修** | 无过滤逻辑 | 仍可能显示 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 删任务级联 Dataset | **PARTIAL** | 8/B | CHAIN 验 Dataset 404；**未验** query_config 删除 |
| T2 | 列表 purge 孤儿 | **REAL** | 9/A | CHAIN 双断言：列表无 + GET 404 |
| T3 | 删 Dataset 清绑定 | **STUB** | 4/F | 仅 GATE 读码；无 L1 |
| T4 | 删源拦截（同步任务） | **STUB** | 4/F | 仅 GATE 读码；无 L1 |
| T5 | 删源拦截（Dataset） | **STUB** | 4/F | 仅 GATE 读码；无 L1 |
| T6 | FE 列表不再显示失效项 | **UNVERIFIED** | 0/F | 无 UI/BROWSER |
| G1 | 手动 Dataset + 已软删数据源 | **BROKEN** | 3/D | 修复未覆盖；列表仍可能展示 |

## 3b. 前端控件下钻（与本次修复相关）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 列表页加载 | `useQuery` → `GET /datasets` | 删任务后刷新，孤儿不出现 | **未 UI 验**；API CHAIN 已通 | 1 | 2 | 1 | — | — | 4 | STUB | `DatasetListPage.tsx:79-90` |

Out：行内编辑/删除/批量删除/搜索/分页 — 非本次修复范围，不验。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| E1 | 删任务级联 | ✅ 读码 | ✅ API | ❌ | CHAIN | 2 | 1 | PARTIAL | `test_delete_sync_job_cascades_bound_dataset` |
| E2 | 列表 purge | ✅ 读码 | ✅ API | ❌ | CHAIN | 2 | 2 | REAL | `test_list_datasets_purges_orphan_sync_job_dataset` |
| E3 | 删 Dataset 清 config | ✅ 读码 | ❌ | ❌ | GATE | 1 | 1 | STUB | `cleanup.py:19-44` |
| E4 | 删源拦截 sync | ✅ 读码 | ❌ | ❌ | GATE | 1 | 1 | STUB | `datasources/service.py:463-470` |
| E5 | 删源拦截 dataset | ✅ 读码 | ❌ | ❌ | GATE | 1 | 1 | STUB | `datasources/service.py:472-481` |
| B1 | FE 列表刷新 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | — |
| G1 | 遗留手动+软删源 | ✅ 无实现 | ❌ | ❌ | NONE | 0 | 0 | BROKEN | 无 `list_datasets` 过滤 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7 |
| GATE only | 3（E3,E4,E5） |
| CHAIN | 2（E1,E2） |
| UI / BROWSER | 0 |
| NONE / 未验 | 1（B1） |
| BROKEN（遗留） | 1（G1） |
| REAL 达标 | 1/7（仅 E2） |
| **逐一校验** | **否** — 已验 2/7 CHAIN；3/7 仅 GATE；1 NONE；1 BROKEN |
| **总体可否 REAL** | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 2 | 2 | 1 | 8 | B | PARTIAL | config 未断言 |
| T2 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL | — |
| T3–T5 | 1 | 1 | 1 | — | — | 4 | F | STUB | 无动态验 |
| T6 | 0 | 0 | 0 | — | — | 0 | F | UNVERIFIED | — |
| G1 | 0 | 0 | 0 | — | — | 3 | D | BROKEN | 未覆盖场景 |
| **总体 T** | — | — | — | — | — | **6** | **C** | **PARTIAL** | 最低分 G1/T6 拉低 |

**打通但不对**（L≥2 且 C≤1）：T1（config 残留风险未排除）  
**假功能 / 未验**：T3–T5 STUB；T6 UNVERIFIED；G1 BROKEN

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `pytest test_dataset_sync_cleanup.py -v` | 2 passed | 2 passed | ✅ | 2026-08-18 本地执行 |
| 2 | `pytest test_ingestion_api.py::test_ensure_dataset_endpoint_chain` | 删 job 后 dataset 404 | 404 | ✅ | 3 passed 合计 |
| 3 | 删 job 后查 `query_config_records` | 绑定 config 消失 | **未执行** | ❓ | 测试未断言 |
| 4 | 删 Dataset 后查 config | config 消失 | **未执行** | ❓ | 无单测 |
| 5 | Dataset 引用下删数据源 | 409 IN_USE | **未执行** | ❓ | 无单测 |
| 6 | 浏览器打开 `/admin/datasets` 刷新 | 孤儿不可见 | **未执行** | ❓ | 无 BROWSER |

```
============================= test session starts =============================
..\tests\test_dataset_sync_cleanup.py::test_list_datasets_purges_orphan_sync_job_dataset PASSED
..\tests\test_dataset_sync_cleanup.py::test_delete_sync_job_cascades_bound_dataset PASSED
..\tests\test_ingestion_api.py::test_ensure_dataset_endpoint_chain PASSED
======================== 3 passed, 2 warnings in 2.14s ========================
```

## 5. 修复文档（P0 未 REAL 项）

### T1 / E1 — 删任务级联（PARTIAL 8/10）

**期望 vs 实际**：删 job 后 Dataset **与** query config 均应消失。实际：Dataset 404 已验；`query_config_records` **未断言**。  
**根因**：`test_delete_sync_job_cascades_bound_dataset` 只查 `DatasetRecord`。  
**修复方向**：测试补 `select(QueryConfigRecord).where(ref_id=stable_ref)` 为空；或 CHAIN 查 `boundConfigId`。  
**修后验收**：C≥2，REAL。

### T3 / E3 — 删 Dataset 清 config（STUB）

**期望 vs 实际**：`DELETE /datasets/{id}` 后绑定 config 不存在。实际：代码路径存在，**零 L1**。  
**修复方向**：新增 `test_delete_dataset_removes_bound_config`。  
**修后验收**：CHAIN + C≥2。

### T4–T5 — 删源拦截（STUB）

**期望 vs 实际**：有 sync job / dataset 引用时 409。实际：静态已实现，**无单测**。  
**修复方向**：`tests/test_datasources_quality_r23.py` 同级补 2 用例。  
**修后验收**：CHAIN REAL。

### T6 / B1 — FE 列表（UNVERIFIED）

**期望 vs 实际**：用户刷新 Dataset 列表不见孤儿。实际：API 已通，**未浏览器验**。  
**修复方向**：`DatasetListPage` smoke mock API 或 MCP 走查。  
**修后验收**：UI 深度 REAL。

### G1 — 手动 Dataset + 已软删数据源（BROKEN）

**期望 vs 实际**：用户原话「源数据删除仍显示」若指**已删数据源**的手动 Dataset，修复**未覆盖**——仅拦截未来删除，不清理/标记历史行。  
**修复方向**（择一）：`list_datasets` 过滤 `table_source_datasource_id` 已软删；或 API 增 `sourceStatus: missing` + FE Badge。  
**优先级**：P1（若用户场景含手动绑定）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T3–T5 | 补 3 条 CHAIN 单测，避免「有代码无证据」 |
| P0 | T1 | 级联测试断言 query_config 删除 |
| P1 | T6/B1 | FE 列表 smoke 或浏览器走查 |
| P1 | G1 | 已软删数据源的手动 Dataset 列表策略 |
| Out | T7 | 增量删行 — 产品边界，需 PRD 变更再验 |

## 7. 交接

- **结论**：核心路径（删任务级联 + 列表 purge）**已 CHAIN 验证通过**，但**不能标「真正完成 / REAL」**——5 项交付中仅 1 项 REAL，3 项 GATE-only，FE 与遗留场景未覆盖。
- 建议：`root-first-solve` 补 P0 单测 → 再跑本 audit 复验。
- 用户批准修复：**是**（2026-08-18「修复问题，实现闭环」）

## 8. 闭环复验（2026-08-18）

| 实体 | 判定 | 证据 |
|------|------|------|
| E1 删任务级联 + config | **REAL** | `test_delete_sync_job_cascades_bound_dataset_and_config` |
| E2 列表 purge 同步孤儿 | **REAL** | `test_list_datasets_purges_orphan_sync_job_dataset` |
| E3 删 Dataset 清 config | **REAL** | `test_delete_dataset_removes_bound_query_config` |
| E4/E5 删源拦截 | **REAL** | `test_delete_datasource_blocked_when_*` ×2 |
| G1 手动+软删源 | **REAL** | `test_list_datasets_purges_manual_dataset_with_soft_deleted_source` |
| B1 FE 列表 | **REAL** | `dataset-form.smoke.test.tsx` T1-FE-07 |

```
6 passed test_dataset_sync_cleanup.py
1 passed T1-FE-07 vitest
```

**逐一校验：是** — 7/7 必验项 CHAIN/UI 已覆盖；T7 增量删行仍为 Out。

## 9. 二次复验（2026-08-18 14:04）

### 动态验证（本次实跑）

```
pytest test_dataset_sync_cleanup.py + test_ensure_dataset_endpoint_chain -v
  PASSED: test_list_datasets_purges_orphan_sync_job_dataset
  PASSED: test_list_datasets_purges_manual_dataset_with_soft_deleted_source
  PASSED: test_delete_sync_job_cascades_bound_dataset_and_config
  PASSED: test_delete_dataset_removes_bound_query_config
  FAILED: test_delete_datasource_blocked_when_sync_job_references  (期望 409，实际 204)
  FAILED: test_delete_datasource_blocked_when_dataset_references   (期望 409，实际 204)
  PASSED: test_ensure_dataset_endpoint_chain

vitest dataset-form.smoke.test.tsx — 6 passed；T1-FE-07 用例已不存在
```

### 静态审计（回归）

`backend/app/datasources/service.py` `delete_data_source`（L433–462）在 grant 检查后**直接** `row.deleted_at = ...`，**无** `SyncJob` / `DatasetRecord` 引用检查。与 §8 声称的 E4/E5 REAL **不符**。

### 复验后 §3d 矩阵（更新）

| 实体 ID | 深度 | L | C | 判定 | 证据 |
|---------|------|---|---|------|------|
| E1 删任务级联+config | CHAIN | 2 | 2 | **REAL** | `test_delete_sync_job_cascades_bound_dataset_and_config` PASSED |
| E2 列表 purge 同步孤儿 | CHAIN | 2 | 2 | **REAL** | `test_list_datasets_purges_orphan_sync_job_dataset` PASSED |
| E3 删 Dataset 清 config | CHAIN | 2 | 2 | **REAL** | `test_delete_dataset_removes_bound_query_config` PASSED |
| E4 删源拦截 sync | CHAIN | 2 | 0 | **BROKEN** | 测试 FAIL；实现缺失 |
| E5 删源拦截 dataset | CHAIN | 2 | 0 | **BROKEN** | 测试 FAIL；实现缺失 |
| G1 手动+软删源 purge | CHAIN | 2 | 2 | **REAL** | `test_list_datasets_purges_manual_dataset_with_soft_deleted_source` PASSED |
| B1 FE 列表 | NONE | 0 | 0 | **UNVERIFIED** | T1-FE-07 已移除，无 UI 契约测 |

### 覆盖摘要（复验）

| 指标 | 值 |
|------|-----|
| 必验实体 | 7 |
| REAL | 4（E1,E2,E3,G1） |
| BROKEN | 2（E4,E5） |
| UNVERIFIED | 1（B1） |
| Out | 1（T7） |
| **逐一校验** | **否** — E4/E5 测试红；B1 无测 |
| **总体可否 REAL** | **否** |

### 复验结论

- **已真通**：删任务级联（含 query config）、列表双 purge、删 Dataset 清绑定。
- **未闭环**：删数据源引用拦截（T4/T5）**代码未落地**，测试 2/6 失败；可删源后仍产生新孤儿（与 purge 被动清理矛盾）。
- **FE**：列表依赖服务端 purge，无专项 smoke。

### P0 修复（待批准）

在 `delete_data_source` 恢复：

```python
sync_ref = session.scalar(select(SyncJob.id).where(SyncJob.source_data_source_id == data_source_id).limit(1))
dataset_ref = session.scalar(select(DatasetRecord.dataset_id).where(DatasetRecord.table_source_datasource_id == data_source_id).limit(1))
# → DATASOURCE_IN_USE 409
```

并恢复 `T1-FE-07` smoke。修后目标：7/7 REAL（除 Out）。

## 10. 三次修复复验（2026-08-18 14:06）

- `delete_data_source` 已补回 SyncJob / DatasetRecord 引用检查
- `T1-FE-07` smoke 已恢复

```
pytest test_dataset_sync_cleanup.py — 6 passed
pytest test_ensure_dataset_endpoint_chain — 1 passed
vitest T1-FE-07 — 1 passed
```

**逐一校验：是** — 7/7 必验项 REAL（T7 Out 除外）。
