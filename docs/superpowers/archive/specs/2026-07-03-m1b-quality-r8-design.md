# M1B DATA 质量推分 r8 设计

```yaml
date: 2026-07-03
milestone: M1B
round_target: docs/superpowers/evolution/2026-07-03-round-target-r8.md
prd_ids: [DATA-003, DATA-002, DATA-004, DATA-001, DATA-005]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | PRD ID | 角色 | 主攻薄弱维 | 用户感知 |
|---|--------|------|------------|----------|
| 1 | **DATA-003** | 主项（最低分 81.5） | 交互体验 80%、安全性 72%、测试 80% | 删除/重跑有确认或防重；空错态与表单校验在 CI 可回归 |
| 2 | DATA-002 | companion | 性能 74%、完整度 84% | 大数据量边界与调度触发在单测可验证；失败重试含 traceId |
| 3 | DATA-004 | companion | 性能 76%、测试 88% | 托管库 URL 非法配置在启动/运行前结构化失败；元表迁移可 smoke |
| 4 | DATA-001 | companion | 性能 78%、测试 86% | API CRUD 全分支、非法 SourceConnection、幂等提交、手动 run 可测 |
| 5 | DATA-005 | companion | 用户价值 74%、性能 76% | L1 闭环自动化回归；PRD/域/API 文档锚点 idempotent 对账 |

**执行顺序（P2 建议）**：DATA-004 配置校验基线 → DATA-001 API 边界测试 → DATA-002 executor/scheduler 性能与重试补强 → DATA-005 L1 smoke + 文档对账 → DATA-003 FE 高危操作 + vitest 扩展 → 全量验证。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `fe/src/pages/admin/ingestion/` | 4 页 + `ingestion.smoke.test.tsx` **10 项**（空/错/运行/历史/表单/ETL/骨架） |
| `SyncJobsPage` | 有 `runningId` 防重跑；**无**删除入口；**无** `AlertDialog` 确认 |
| `backend/app/ingestion/` | executor 1 次重试、`INGESTION_MAX_ROWS=100_000`、scheduler 仅注册 enabled+cron |
| `tests/test_sync_executor.py` | 8 用例（成功/失败/重试/空行/postgres 拒绝/ETL 管线） |
| `tests/test_ingestion_api.py` | CRUD + 422 + 503 + 404 + runs 空 + etl-rules；**无** PUT 更新、**无** openapi 全路由断言 |
| `tests/test_ingestion_config.py` | analytics URL 绑定；T-D04-03 **记录**空白/非法 URL 为当前宽松行为 |
| `tests/test_ingestion_l1_smoke.py` | mock L1 成功/失败；**未**断言托管库落表 |
| `tests/test_doc_anchors_data.py` | 2 用例；**未**覆盖 `api/README.md` §9 |
| `tests/test_migrations.py` | 已有 0002 ingestion 表 revision smoke（T-MIG-19/20） |

**真理源优先级**：`round-target` > `prd/F16-DATA.md` > 上轮 `m1b-close-design.md`。

**本轮性质**：**质量推分**（测试 + 最小 UX/配置补强），非新功能立项。允许在框定模块内做**最小生产修复**（高危操作确认、配置校验、并发 run 防重），禁止扩大 M1B 能力边界。

## 3. 范围框定文件清单（16 项，≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | DATA-003 | 增删除操作 + `AlertDialog`；强化 run 防重（`disabled` 与 loading 一致） |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | 扩展：删除确认、run 防双 POST、路由子页、表单 `aria-invalid` |
| `fe/src/routes.smoke.test.tsx` | DATA-003 | 扩展：`/admin/ingestion/sync-jobs/:id/{history,etl-rules,edit}` 嵌套路由 smoke |
| `backend/app/ingestion/sync_executor.py` | DATA-002 | 可选：批量写入路径微优化（仅当性能测试暴露瓶颈时，≤15 行） |
| `backend/app/ingestion/scheduler.py` | DATA-002 | 无逻辑变更；单测触发 `run_job` 回调 |
| `tests/test_sync_executor.py` | DATA-002 | 扩展：大行数 LIMIT、traceId 终态失败、写库批处理断言 |
| `tests/test_scheduler.py` | DATA-002 | 扩展：cron `add_job` 回调 mock 触发 `run_job` |
| `tests/test_ingestion_config.py` | DATA-004 | 扩展：非法 URL → `ValidationError`；Fernet 边界；0002 revision 锚点 |
| `tests/test_ingestion_models_crypto.py` | DATA-004 | 扩展：错误长度 `CREDENTIAL_FERNET_KEY` 路径 |
| `tests/test_ingestion_api.py` | DATA-001 | 扩展：PUT 全分支、非法 `source.type`、重复 run 防重、OpenAPI 路由表 |
| `tests/test_ingestion_l1_smoke.py` | DATA-005 | 扩展：`analytics_sqlite` 落表行数断言 + 历史字段 |
| `tests/test_ingestion_e2e.py` | DATA-005 | 保持 integration marker；补充 teardown 性能计时日志（可选） |
| `tests/test_doc_anchors_data.py` | DATA-005 | 扩展：`api/README.md` §9、`F16-DATA` 演化建议锚点 |
| `docs/automate/prd/F16-DATA.md` | DATA-005 | idempotent 对账：演化建议/代码锚点（无行为变更则仅措辞） |
| `docs/services/ingestion.md` | DATA-005 | idempotent 对账：符号表与边界 |
| `docs/api/README.md` | DATA-001, DATA-005 | idempotent 对账：§9 路由与 SourceConnection 示例 |

**紧邻依赖（P2 单列，计入 ≤20 预算）**：

| 路径 | 子项 | 原因 |
|------|:----:|------|
| `backend/app/core/config.py` | DATA-004 | `analytics_database_url` 结构化校验（空白→`None`，非法 scheme→`ValidationError`） |
| `backend/app/api/v1/ingestion/sync.py` | DATA-001 | 同一 job 存在 `status=running` 的 run 时 `POST .../run` 返回 **409** `RUN_ALREADY_IN_PROGRESS`（幂等/并发安全） |
| `tests/conftest.py` | DATA-005 | 复用 `analytics_sqlite` / `integration_env`；不新增并行 fixture 文件 |

**明确不含**：`goal.md` / `plan.md` 结构修改；BOOT-* / ETL-001 新立项；postgres 源 executor；Playwright；CI 强制 compose；TanStack Query 迁移；侧栏 IA 变更。

## 4. 非目标（明确不做）

- L2 `dataSourceId` + SQL 出数（M3/M4）
- PostgreSQL **源库**同步执行（API 可接受 `postgres` 类型，executor 仍拒绝并记录 failed）
- 增量同步、可视化 ETL 设计器、OGG
- hub 8 维重评与 `plan.md` 勾选（**P5**）
- 全量 `mapApiError` / TanStack Query 数据层重构
- 修改 `docs/automate/goal.md`

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维 | 本轮对策 | 可测验收信号 |
|--------|--------|----------|--------------|
| DATA-003 | 交互 80%、安全 72%、测试 80% | 删除 `AlertDialog`；run 防重 + vitest；`routes.smoke` 全子路由 | vitest ≥14 项；`check:design` 绿；P4 截图 QA |
| DATA-002 | 性能 74%、完整度 84% | 大行数 LIMIT 单测；scheduler 回调；traceId 失败终态 | pytest 新增 ≥3 用例；`INGESTION_MAX_ROWS` 被 SQL LIMIT 使用 |
| DATA-004 | 性能 76%、测试 88% | Settings URL 校验；Fernet 边界；0002 revision 锚点 | 非法 URL 启动失败；T-D04 用例更新为断言 `ValidationError` |
| DATA-001 | 性能 78%、测试 86% | PUT/409/OpenAPI 全路由；非法 SourceConnection 分支 | API 测试 ≥12 用例覆盖 run 并发与更新 |
| DATA-005 | 用户价值 74%、性能 76% | L1 mock smoke 落表断言；文档锚点自动化 | `test_doc_anchors_data` ≥4 用例；L1 smoke 含行数 |

## 6. 方案比选（摘要）

### 6.1 高危操作确认（DATA-003）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `AlertDialog` 删除 + run 仅 loading 防重 | 符合 `fe-ui.mdc`；删除需确认，run 已有 `runningId` | **采用** |
| B run 也弹 `AlertDialog` | 操作频率高，增加摩擦 | 否决 |
| C `window.confirm` | 违反设计系统 | 否决 |

### 6.2 托管库 URL 校验（DATA-004）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `Settings` 字段 `field_validator`：空白→`None`；须 `postgresql`/`postgresql+psycopg` 前缀 | 启动即失败，早暴露配置错误 | **采用** |
| B 仅 `POST .../run` 时校验 | 晚发现、重复逻辑 | 否决 |
| C 保持宽松仅文档记录 | 无法推安全性/性能维 | 否决 |

### 6.3 重复 run 幂等（DATA-001）

| 方案 | 说明 | 结论 |
|------|------|------|
| A API：存在 `running` run → **409** | 后端并发安全；FE 防重为双保险 | **采用**（`sync.py` 紧邻依赖） |
| B 仅 FE `runningId` | 无法防多客户端/多标签页 | 不足，作补充 |
| C 幂等键 `Idempotency-Key` | M1B 过重 | 否决 |

### 6.4 L1 smoke 载体（DATA-005）

| 方案 | 说明 | 结论 |
|------|------|------|
| A 扩展 `test_ingestion_l1_smoke.py` + `analytics_sqlite` 实查表 | 无 compose 依赖；CI 默认绿 | **采用（主）** |
| B `test_ingestion_e2e.py` integration | compose 可达时跑；保持 skip | **保留（辅）** |
| C shell `scripts/l1-smoke.sh` | 半自动，不利于 P4 无人值守 | 否决 |

## 7. 分项设计

### 7.1 DATA-003 — Admin 配置台（交互 + 安全 + 测试）

#### 7.1.1 生产变更（最小）

**`SyncJobsPage.tsx`**：

1. 表格操作列增 **删除** `IconButton`（`aria-label="删除任务"`）+ `Trash2` icon。
2. 点击删除 → 打开 `@/components/ui/alert-dialog`：
   - 标题：「确认删除任务？」
   - 描述：含任务 `name`；「删除后无法恢复，运行历史将一并清除。」
   - 主操作 `variant="destructive"`「删除」；次操作「取消」
3. 确认后 `DELETE /api/v1/ingestion/sync-jobs/{id}` → 成功后 `loadJobs()`；失败走现有 `ErrorBanner`。
4. **run 防重**：`handleRun` 期间 `runningId === job.id` 时 `IconButton` `disabled` + `loading`（与现 loading 合并，禁止连续 POST）。

**不改**：表单页、历史页、ETL 页布局结构；不引入 TanStack Query。

#### 7.1.2 Vitest 扩展（`ingestion.smoke.test.tsx`）

| 用例 ID | 场景 | 断言 |
|---------|------|------|
| T-ING-11 | 删除流程 | 点删除 → Dialog 可见 → 确认 → `apiFetch` DELETE 被调用 |
| T-ING-12 | 删除取消 | Dialog 取消 → DELETE 未调用 |
| T-ING-13 | run 防双 POST | 快速双击 run → `apiFetch` POST run **仅 1 次** |
| T-ING-14 | 表单必填 HTML5 | 空 name submit → `apiFetch` 未调用；`name` input `required` |
| T-ING-15 | EtlRulesPage 错误态 | mock reject → 可见错误文案 + 重试/刷新 |

#### 7.1.3 路由 smoke（`routes.smoke.test.tsx`）

对 `AppRoutes` + `AdminLayout` 断言以下 `initialEntries` 在 main 区渲染对应 `h1`：

- `/admin/ingestion/sync-jobs/job-1/history` →「运行历史」
- `/admin/ingestion/sync-jobs/job-1/etl-rules` → 含「清洗规则」或保存按钮
- `/admin/ingestion/sync-jobs/job-1/edit` →「编辑同步任务」

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test ingestion.smoke routes.smoke` exit 0
- [ ] `pnpm run build && pnpm run check:design` exit 0
- [ ] 删除使用 `AlertDialog`，无 `window.confirm`
- [ ] desktop(1400) + mobile(375) viewport 各至少 1 用例

---

### 7.2 DATA-002 — 同步执行器（性能 + 完整度）

#### 7.2.1 `tests/test_sync_executor.py` 扩展

| 用例 ID | 场景 | 断言 |
|---------|------|------|
| T-D02-09 | 大行数边界 | mock `_fetch_mysql_rows` 返回 `INGESTION_MAX_ROWS` 行；`rows_synced == INGESTION_MAX_ROWS`；fetch 被调用时 SQL 含 LIMIT |
| T-D02-10 | traceId 失败终态 | 源始终失败 → 最终 `status=failed` 且 `trace_id` 保持入参值 |
| T-D02-11 | 批写行数一致 | mock write 收到 `len(rows)` 与 `rows_synced` 一致 |

实现：`patch` `_fetch_mysql_rows` 检查 `LIMIT` 参数或 mock `pymysql` cursor `execute` 的 args。

#### 7.2.2 `tests/test_scheduler.py` 扩展

| 用例 ID | 场景 | 断言 |
|---------|------|------|
| T-D02-12 | cron 回调触发 | `add_job` 的 `func` 为 scheduler 包装函数；手动 invoke kwargs 含 `job_id`；`patch run_job` 被调用 1 次 |

**验收标准**：

- [ ] 上述 4 用例通过；`cd backend && pytest tests/test_sync_executor.py tests/test_scheduler.py` 全绿
- [ ] 不新增外部 DB 依赖

---

### 7.3 DATA-004 — 托管分析库与配置项

#### 7.3.1 `backend/app/core/config.py`（紧邻依赖）

```python
# 行为契约（P3 实现）
# analytics_database_url:
#   - 缺省 / 纯空白 → None
#   - 非 postgresql* scheme → ValidationError（message 含「托管分析库 URL」）
#   - 合法 postgresql+psycopg://... → 原样保留
```

更新 `tests/test_ingestion_config.py`：

- T-D04-03 由「记录宽松行为」改为断言 `ValidationError`
- 新增 T-D04-08：合法 URL 通过
- 新增 T-D04-09：`migrations/versions/0002_ingestion_tables.py` revision id 与三表名存在（与 T-MIG-20 互补，专注 ingestion 域）

`tests/test_ingestion_models_crypto.py`：

- T-D04-10：43 字符非法 Fernet key → `encrypt_password` 或 Settings 加载失败路径

**验收标准**：

- [ ] 空白 analytics URL 视为未配置（`None`），`POST .../run` 仍 503
- [ ] `not-a-valid-url` 在 `Settings()` 时 `ValidationError`
- [ ] pytest `test_ingestion_config.py` + `test_ingestion_models_crypto.py` 全绿

---

### 7.4 DATA-001 — 同步任务模型与 API

#### 7.4.1 `backend/app/api/v1/ingestion/sync.py`（紧邻依赖）

`trigger_run` 在创建新 run 前查询：

```text
SELECT 1 FROM ingestion_sync_runs
WHERE job_id = :id AND status = 'running' LIMIT 1
```

若存在 → `HTTPException(409, detail={code: "RUN_ALREADY_IN_PROGRESS", message: "该任务正在运行中"})`

#### 7.4.2 `tests/test_ingestion_api.py` 扩展

| 用例 ID | 场景 | 期望 |
|---------|------|------|
| T-D01-09 | PUT 更新 roundtrip | 改 `name`/`target_table` → 200；GET 一致 |
| T-D01-10 | 非法 `source.type` | `type: "oracle"` → 422 |
| T-D01-11 | 并发 run | 种子 `running` run → POST run → 409 |
| T-D01-12 | OpenAPI 全路由 | `/openapi.json` paths 含 sync-jobs CRUD、run、runs、etl-rules |
| T-D01-13 | 手动 run 202 | mock `BackgroundTasks` 或轮询 runs → `running`/`succeeded` |

**验收标准**：

- [ ] CRUD + run + runs + etl-rules + 异常码分支均有单测
- [ ] OpenAPI 可见 ingestion 路由（与 `test_health.py` T-HLT-15 互补，断言更全）

---

### 7.5 DATA-005 — 端到端验收与文档回写

#### 7.5.1 L1 自动化

**主路径** — 扩展 `tests/test_ingestion_l1_smoke.py`：

1. 在 `test_l1_mock_smoke_success` 末尾，用 `analytics_sqlite` engine 查询目标表 `COUNT(*)==2`（与 mock 行数一致）。
2. 新增 `test_l1_mock_smoke_history_list_order`：runs 按 `started_at` 降序。

**辅路径** — `tests/test_ingestion_e2e.py`：保持 `@pytest.mark.integration` + compose skip，不强制 CI。

#### 7.5.2 文档 idempotent 对账

`tests/test_doc_anchors_data.py` 扩展：

| 用例 ID | 断言 |
|---------|------|
| T-D05-05 | `api/README.md` 含 `/api/v1/ingestion/sync-jobs` 与 `source` 字段说明 |
| T-D05-06 | `F16-DATA.md` DATA-005 验收项含 `test_ingestion` 锚点 |
| T-D05-07 | `services/ingestion.md` 状态为「已实现」 |

**人工对账**（测试绿后同 PR，无行为变更则仅核对）：

- `prd/F16-DATA.md` 演化建议更新为 r8 后状态
- `docs/api/README.md` §9 与 OpenAPI 一致
- `docs/services/ingestion.md` 符号表

**验收标准**：

- [ ] `pytest tests/test_ingestion_l1_smoke.py tests/test_doc_anchors_data.py` 全绿
- [ ] 文档对账测试失败时 P3 同步修文档，而非削弱断言

---

## 8. UI 设计交付（DATA-003 门控）

**ui_design_skill**: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 8.1 页面信息架构

| 路由 | 页面 | 主内容区 | 本轮变更 |
|------|------|----------|----------|
| `/admin/ingestion/sync-jobs` | SyncJobsPage | 表格卡片 +「新建任务」 | 增删除列 + Dialog |
| `/admin/ingestion/sync-jobs/new` | SyncJobFormPage | `max-w-2xl` 表单卡片 | 无布局变更 |
| `/admin/ingestion/sync-jobs/:id/edit` | SyncJobFormPage | 同上 + 骨架加载 | 无布局变更 |
| `/admin/ingestion/sync-jobs/:id/history` | SyncJobHistoryPage | 历史表格 + 刷新 | 无布局变更 |
| `/admin/ingestion/sync-jobs/:id/etl-rules` | EtlRulesPage | 规则链表单 | 无布局变更 |

导航：`管理 / 数据接入 / {子页}` breadcrumb（保持）。壳层 `AdminLayout` + `max-w-(--breakpoint-2xl)` 不变。

### 8.2 视觉层级与状态

| 层级 | 组件 | Token/变体 |
|------|------|------------|
| 主操作 | `Button variant="primary"` | 新建任务、Dialog 确认删除用 `destructive` |
| 行内操作 | `IconButton variant="ghost" size="sm"` | Play/History/Settings/Edit/**Trash2** |
| 危险确认 | `AlertDialog` + `AlertDialogAction` destructive | 删除专用 |
| 错误 | `ErrorBanner` / error 边框卡片 | `border-error-500 bg-error-50` |
| 空态 | 居中文案 + CTA | `text-gray-500 py-16` |
| 加载 | `Skeleton` / `IconButton loading` | run 防重 |

### 8.3 组件映射

| 需求 | 复用 | 禁止 |
|------|------|------|
| 删除确认 | `@/components/ui/alert-dialog` | `window.confirm`、手写 Modal |
| 表格/按钮/徽章 | 现有 `Button`/`IconButton`/`Badge` | 页面内原生 `<button>` |
| 图标 | `lucide-react` `Trash2` `size-4` | 自定义 SVG |

### 8.4 Token 与密度

- 语义色：`brand-*`（链接）、`error-*`（删除 Dialog 描述与 ErrorBanner）、`gray-*`（表格边框）
- 卡片：`rounded-xl border border-gray-200 shadow-theme-sm dark:border-gray-800`
- 间距：页面 `space-y-6`；表格 `px-6 py-4`
- 字号：`text-theme-xl` 标题、`text-theme-sm` 正文

### 8.5 响应式与可访问性

- 表格 `overflow-x-auto` + `min-w-[720px]`（保持）
- 所有 `IconButton` 保留 `aria-label`；Dialog 含 `AlertDialogTitle`/`Description`
- 删除 Dialog 焦点陷阱由 Radix 处理；Esc 关闭
- vitest：`innerWidth` 1400 与 375 各覆盖删除/run 用例

### 8.6 视觉 QA 清单（P4）

- [ ] desktop：列表（含删除 Dialog 打开态）、history、etl-rules 截图
- [ ] mobile 375px：列表操作列不重叠；Dialog 全宽可读
- [ ] 空态 / 错态 / run loading 态各 1 张
- [ ] `pnpm run check:design` 无新增 hex
- [ ] 对照 `references/ui-elements-empty-error-loading-review-checklist.md` 抽检

---

## 9. 测试矩阵汇总

| 层级 | 文件 | CI 默认 |
|------|------|:-------:|
| FE vitest | `ingestion.smoke.test.tsx`, `routes.smoke.test.tsx` | ✓ |
| API | `test_ingestion_api.py` | ✓ |
| 域单测 | `test_sync_executor.py`, `test_scheduler.py` | ✓ |
| 配置 | `test_ingestion_config.py`, `test_ingestion_models_crypto.py` | ✓ |
| L1 mock | `test_ingestion_l1_smoke.py` | ✓ |
| L1 compose | `test_ingestion_e2e.py` | skip 若不可达 |
| 文档锚点 | `test_doc_anchors_data.py` | ✓ |

**P4 建议命令**：

```bash
cd backend && pytest tests/test_ingestion_config.py tests/test_ingestion_models_crypto.py \
  tests/test_ingestion_api.py tests/test_sync_executor.py tests/test_scheduler.py \
  tests/test_ingestion_l1_smoke.py tests/test_doc_anchors_data.py
cd ../fe && pnpm test ingestion.smoke routes.smoke && pnpm run build && pnpm run check:design
# 可选：docker compose up -d && pytest tests/test_ingestion_e2e.py -m integration
```

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| DATA-004 URL 校验破坏开发 `.env` | validator 仅拒绝明显非法 scheme；文档注明合法示例 |
| T-D04-03 用例行为变更 | 同 PR 更新测试与 design 契约 |
| 409 run 冲突影响现有 FE | FE 已防重；409 时 `mapApiError` 兜底文案「该任务正在运行中」 |
| r8 仍不过 90（STUCK×3） | P5 记录分数；round-target 已建议人工复核 M1B Admin UI 阈值 |
| `sync.py` 超模块框定 | 登记为紧邻依赖，变更 ≤20 行，仅 409 守卫 |

---

## 11. Spec Self-Review

- [x] 覆盖 round-target 全部 5 子项（DATA-003/002/004/001/005）
- [x] 文件清单 16+3 紧邻 = 19 ≤ 20
- [x] 无 TBD/TODO 占位
- [x] UI 门控节完整（skill、IA、层级、组件、Token、a11y、QA）
- [x] 每项验收标准可测试
- [x] 未写生产代码（仅设计契约）
- [x] L1/L2、postgres 源、BOOT 让位等非目标明确
