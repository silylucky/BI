# M1B DATA/ETL companion 质量推分 r13 设计 — DATA-004 / DATA-003 / DATA-002 / ETL-001 / DATA-001

```yaml
date: 2026-07-03
milestone: M1B
round_target: docs/superpowers/evolution/2026-07-03-round-target-r13.md
prd_ids: [DATA-004, DATA-003, DATA-002, ETL-001, DATA-001]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | 托管分析库与配置项 | DATA-004 | 1 | 用户价值 **76%**；性能 **82%** | 托管库 URL / 连接超时 / compose 健康检查在 CI 可早期发现 |
| 2 | Admin 配置台页面 | DATA-003 | 2 | 安全性 **84%**；可靠性 **89%** | 删除/手动运行二次确认；非法输入与权限边界可验证 |
| 3 | 同步执行器（定时/手动） | DATA-002 | 3 | 用户价值 **80%**；性能 **86%** | cron 边界、并发 run 幂等、大批量 P95 可预期 |
| 4 | 清洗规则引擎（轻量） | ETL-001 | 4 | 用户价值 **76%**；完整度 **94%** | 规则冲突/越界 JSON 有结构化反馈；脏数据 transform 可感知 |
| 5 | 同步任务模型与 API | DATA-001 | 5 | 用户价值 **78%**；测试覆盖 **98%** | API 脱敏/幂等/OpenAPI 契约在 CI 防回归 |

**依赖链**：DATA-004 配置与连接基线 → DATA-003 高危操作 UX → DATA-002 调度/执行边界 → ETL-001 规则链与流水线 → DATA-001 API 巩固 → 全量验证。

**上轮已交付（本轮不重复基础用例）**：

- r11/r12：`test_ingestion_config` T-D04-11~16；`test_ingestion_api` T-D01-19~22；`test_sync_executor` T-D02-13~21、T-ETL-15；`test_scheduler` T-D02-22；`test_etl_rules` T-ETL-16~19；`ingestion.smoke.test.tsx` T-ING-06~27（27 项）；`test_ingestion_l1_smoke` T-L1-07~08
- DATA-005 r12 已破 90（本轮 intentionally 跳过）

**STUCK 标注**：DATA-004(5)、DATA-002(7)、DATA-003(7)、ETL-001(6) 连续未过 90。本轮主攻 **破 90 线**；若 P5 仍 <90，建议人工 `create-evolution-plan` 复核 M1B 验收阈值（尤其 DATA-002 执行器）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `backend/app/ingestion/scheduler.py` | `refresh_all_jobs` 对非法 cron 用 `except Exception: pass` 静默跳过；5 项 scheduler 单测已绿 |
| `backend/app/ingestion/sync_executor.py` | `pool_pre_ping=True`；1 次重试；`INGESTION_MAX_ROWS` LIMIT；21 项 executor 单测 |
| `backend/app/ingestion/etl_rules.py` | 4 类规则 + 未知 type 忽略；22 项单测含 8 规则深链 perf |
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | 删除有 `AlertDialog` 二次确认；**手动运行无确认弹层**，仅 `runningId` 防重 |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | **27 项** vitest；覆盖 delete 确认、run 防双 POST、50 行 history perf |
| `tests/test_ingestion_api.py` | 24 项；含 OpenAPI snapshot、P95 run、422 边界；**缺** PUT 空密码保留、list/detail 脱敏全分支 |
| `tests/test_ingestion_config.py` | 14 项；含连接拒绝、坏 host；**缺** compose healthcheck 契约、连接超时 smoke |
| `docker-compose.yml` | `analytics-postgres`/`sample-mysql` 均有 `healthcheck`；`integration_env` 端口探测 skip |
| `tests/test_ingestion_e2e.py` | `@pytest.mark.integration` compose 全链路；CI 保持 skip |

**范围框定模块**（3）：`backend/app/ingestion/`、`fe/src/pages/admin/ingestion/`、`tests/`（含 `fe/` vitest）。

**真理源优先级**：`round-target` > `prd/F16-DATA.md` > r10 `m1b-data-quality-r10-design.md`。

**本轮性质**：质量推分（测试为主 + DATA-003 最小 UX 高危确认），非新功能立项。允许框定内 **≤25 行/页** 的 run 确认弹层，禁止扩大 M1B 能力边界。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `tests/test_ingestion_config.py` | DATA-004 | 扩展 T-D04-17~19 |
| `tests/test_ingestion_api.py` | DATA-001 | 扩展 T-D01-23~25 |
| `tests/test_sync_executor.py` | DATA-002 | 扩展 T-D02-23~25 |
| `tests/test_scheduler.py` | DATA-002 | 扩展 T-D02-26 |
| `tests/test_ingestion_l1_smoke.py` | DATA-002 | 扩展 T-L1-09 |
| `tests/test_etl_rules.py` | ETL-001 | 扩展 T-ETL-20~22 |
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | DATA-003 | 最小：手动运行 `AlertDialog` 二次确认 |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | 扩展 T-ING-28~31 |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/ingestion/sync_executor.py` | 重试、LIMIT、apply_rules 管线 |
| `backend/app/ingestion/scheduler.py` | cron 注册与异常吞没 |
| `backend/app/ingestion/etl_rules.py` | 规则类型与 cast/filter 边界 |
| `backend/app/ingestion/models.py` | Fernet 加解密、元表模型 |
| `backend/app/api/v1/ingestion/sync.py` | CRUD、409 run 守卫、`preserve_password` |
| `backend/app/core/config.py` | `analytics_database_url` 校验器 |
| `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx` | 表单校验、防重 |
| `fe/src/pages/admin/ingestion/SyncJobHistoryPage.tsx` | history 表格、limit=20 |
| `fe/src/pages/admin/ingestion/EtlRulesPage.tsx` | 规则保存防重 |
| `docker-compose.yml` | healthcheck 契约锚点 |
| `tests/conftest.py` | `integration_env`、`analytics_sqlite` |
| `tests/test_ingestion_e2e.py` | integration marker（保持 skip） |
| `docs/ui/layout.md` | Admin 内容区 IA |

**文件计数**：修改 **8** = **8 ≤ 20**（无新建测试文件；compose 契约断言写入 `test_ingestion_config.py`）。

## 4. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- BOOT-* rotation（STUCK 7–11 轮，本轮 intentionally 跳过）
- DATA-005（r12 已破 90，让位仍 <90 四项）
- PostgreSQL **源库** executor；L2 `dataSourceId` + SQL（M3/M4）
- Playwright / 真浏览器截图自动化（P4 人工 QA 清单承担）
- CI 强制 docker compose 跑 `test_ingestion_e2e`（`integration_env` 可用时 T-L1-09 可选执行，不可用 skip）
- TanStack Query 迁移、`mapApiError` 全量数据层重构
- 运行历史 UI 分页控件（仅测 API `limit` 与渲染 perf）
- 重复 T-D04-11~16、T-D01-19~22、T-D02-13~22、T-ETL-15~19、T-ING-06~27 已有断言
- 为非法 cron 增加 API 422 校验（scheduler 静默跳过为既有行为，本轮只测不崩）

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 | 可测验收信号 |
|--------|------------------|--------------|--------------|
| DATA-004 | 用户价值 **76%**；性能 **82%** | compose healthcheck 契约 smoke；连接超时 OperationalError 传播；缺失 URL 503 回归 | T-D04-17~19 全绿 |
| DATA-003 | 安全性 **84%**；可靠性 **89%** | run `AlertDialog` 二次确认；401/404 错误态 vitest；history 100 行 perf smoke | vitest ≥31 项；`check:design` 绿 |
| DATA-002 | 用户价值 **80%**；性能 **86%** | 非法 cron 不崩；并发 POST 409 幂等；10000 行 apply_rules P95；可选 compose L1 | T-D02-23~26、T-L1-09 全绿 |
| ETL-001 | 用户价值 **76%**；完整度 **94%** | 冲突 rename 链确定性；越界 JSON 422/安全忽略；脏数据全过滤后 0 行可观测 | T-ETL-20~22 全绿 |
| DATA-001 | 用户价值 **78%**；测试覆盖 **98%** | PUT 空密码保留脱敏；并发 CRUD P95；OpenAPI SyncRunItem 字段快照扩展 | T-D01-23~25 全绿 |

**P5 重评预期**：四项 <90 加权总分由 89.3–89.8 向 **≥90** 迈进；DATA-001 巩固 ≥90.4（具体分值由 P5 评分器计算，设计不预设数值）。

## 6. 方案比选（摘要）

### 6.1 DATA-003：手动运行二次确认

| 方案 | 说明 | 结论 |
|------|------|------|
| A 复用 `AlertDialog`（与删除同模式） | `runTarget` state + 确认后 `handleRun`；≤25 行 | **采用** |
| B 仅 vitest 断言 `runningId` 防双 POST | 无确认弹层，不满足 round-target「二次确认」 | 否决（r12 已有 T-ING-13） |
| C `window.confirm` | 违反 fe-ui 规范 | 否决 |

### 6.2 DATA-004：compose 健康检查 smoke

| 方案 | 说明 | 结论 |
|------|------|------|
| A 静态解析 `docker-compose.yml` 断言 `analytics-postgres`/`sample-mysql` healthcheck 字段 | 零 compose 依赖、CI 稳定 | **采用**（T-D04-18） |
| B CI job 跑 `docker compose up --wait` | flaky、超 P3 范围 | 否决 |
| C 仅文档记录 healthcheck | 无法推用户价值维 | 否决 |

### 6.3 DATA-002：非法 cron 边界

| 方案 | 说明 | 结论 |
|------|------|------|
| A 单测 seed `schedule_cron="not valid"` → `refresh_all_jobs()` 不抛、scheduler 无该 job | 对齐既有 `except: pass` 行为 | **采用**（T-D02-26） |
| B API 创建时 422 拒绝非法 cron | 生产行为变更、超 companion 范围 | 否决 |
| C 忽略不测 | 无法推用户价值 | 否决 |

### 6.4 DATA-002：并发 run 幂等

| 方案 | 说明 | 结论 |
|------|------|------|
| A API 层：seed `running` run → 连续 3 次 POST → 仅首次 202、其余 409 | 复用既有 409 守卫 | **采用**（T-D02-23） |
| B 线程池真并发 POST | flaky | 否决 |
| C 仅 executor 单测 | 无法测 API 用户感知 | 否决 |

### 6.5 ETL-001：规则版本冲突

| 方案 | 说明 | 结论 |
|------|------|------|
| A 同列双 `rename_column`：后者覆盖前者（顺序应用） | 文档化确定性 + 单测断言最终列名 | **采用**（T-ETL-20） |
| B 引入规则 version 字段 | 新功能 | 否决 |
| C 冲突时报错 | 行为变更 | 否决 |

### 6.6 DATA-001：凭证脱敏巩固

| 方案 | 说明 | 结论 |
|------|------|------|
| A PUT 空 `password` + GET detail/list 均 `***`；密文库内不变 | 测 `preserve_password=True` 路径 | **采用**（T-D01-23） |
| B 仅测 create 响应 | r12 已有 | 否决（作基线保留） |
| C 响应返回密文前缀 | 安全倒退 | 否决 |

## 7. 子项详细设计

### 7.1 DATA-004 — 扩展 `tests/test_ingestion_config.py`

**保留** T-D04-01~16。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D04-17 | `create_engine.begin()` 连接超时 OperationalError 传播 | mock `OperationalError` 含 `timeout`；`run_job` → `failed` + `error_message` 含 timeout（不区分大小写） |
| T-D04-18 | `docker-compose.yml` healthcheck 契约 | 解析 YAML；`analytics-postgres` 含 `pg_isready`；`sample-mysql` 含 `mysqladmin ping`；均有 `interval`/`timeout`/`retries` |
| T-D04-19 | 缺失 `ANALYTICS_DATABASE_URL` 时 API run → 503 回归 | 复用 `test_trigger_run_without_analytics_503` 路径；Settings `analytics_database_url=None`；`ANALYTICS_DB_NOT_CONFIGURED` |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_ingestion_config.py -v` 全绿（≥17 项）

### 7.2 DATA-003 — `SyncJobsPage` run 确认 + vitest 扩展

**生产变更（≤25 行）**：

| 文件 | 变更 |
|------|------|
| `SyncJobsPage.tsx` | 新增 `runTarget` state；点击「手动运行同步」打开 `AlertDialog`（文案「确认手动运行同步？」）；确认后调用既有 `handleRun`；取消清空 `runTarget`；`runningId` 防重保留 |

**`ingestion.smoke.test.tsx` 扩展**（保留 T-ING-06~27）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-ING-28 | `SyncJobsPage_run_confirms_and_calls_post` | 点击 run → 出现确认文案 → 点「运行」→ POST `/run` 一次 |
| T-ING-29 | `SyncJobsPage_run_cancel_skips_api` | 打开确认 → 点「取消」→ 无 POST `/run` |
| T-ING-30 | `SyncJobsPage_load_401_shows_error` | mock reject `Error('未登录或会话已过期')`；展示错误条 + 重试 |
| T-ING-31 | `SyncJobHistoryPage_renders_100_rows_under_900ms` | mock 100 条 runs；`findByText` 首行；elapsed < 900ms |

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test` 全绿（ingestion smoke ≥31 项）
- [ ] `cd fe && pnpm build && pnpm run check:design` 全绿

### 7.3 DATA-002 — executor / scheduler / L1 smoke

**`tests/test_sync_executor.py` 扩展**（保留 T-D02-01~21、T-ETL-15）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D02-23 | 并发 POST run 幂等（API 层） | 见 `test_ingestion_api.py` 同 ID 或 executor 互补：seed running → 409 |
| T-D02-24 | 10000 行空规则 `apply_rules` P95 | `perf_counter`；`len(result)==10000`；elapsed < 3.0s |
| T-D02-25 | 重试后 `failed` + `traceId` + `error_message` 回归加固 | 与 T-D02-17 互补：断言 `retry_count==1` 且 history 可查 |

**`tests/test_scheduler.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D02-26 | 非法 `schedule_cron="not-a-cron"` refresh 不崩 | seed enabled job；`refresh_all_jobs()` 无异常；`scheduler.get_jobs()` 不含该 id |

**`tests/test_ingestion_api.py` 扩展**（DATA-002 并发项）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D02-23 | 三连 POST run：running 存在时全 409 | seed `status=running` run；3× POST → 均 409 `RUN_ALREADY_ACTIVE`（或等价 code） |

**`tests/test_ingestion_l1_smoke.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-L1-09 | compose 可用时样例 mysql→analytics 写穿（integration） | `@pytest.mark.integration`；`integration_env`；真实 `_fetch_mysql_rows` + `_write_analytics`；目标表有行；compose 不可用 skip |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_sync_executor.py tests/test_scheduler.py tests/test_ingestion_api.py tests/test_ingestion_l1_smoke.py -v` 全绿

### 7.4 ETL-001 — 扩展 `tests/test_etl_rules.py` + executor 管线

**保留** T-ETL-01~19。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-ETL-20 | 同列双 `rename_column` 顺序应用 | `from: product_name` → `product`，再 `from: product` → `sku`；最终列 `sku`，无 `product_name` |
| T-ETL-21 | 越界 JSON：rules 项含超长 column 名（256+ 字符） | API PUT → 422 或 apply 不崩且行数不变（与现有 validator 对齐，设计取 API 422 优先） |
| T-ETL-22 | 脏数据经规则后目标字段符合配置（executor mock 写穿） | fetch 含 `amount: "bad"` + fill_null；write 行 `amount is None` 且 `note` 已填充；`rows_synced` 匹配 |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_etl_rules.py -v` 全绿（≥25 项）
- [ ] T-ETL-15 executor L1 链保持绿

### 7.5 DATA-001 — 扩展 `tests/test_ingestion_api.py`

**保留** T-D01-01~22。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D01-23 | PUT 更新时 `password: ""` 保留原密文；GET 仍 `***` | create → GET `***` → PUT 改 name 且 `password: ""` → GET detail `password=="***"`；DB 密文不变 |
| T-D01-24 | 并发 5 次 create 不同 name P95 < 0.8s | 5× POST create；`perf_counter` P95 < 0.8s；各 201 |
| T-D01-25 | OpenAPI 快照含 `SyncRunItem` 必填字段 | `components.schemas.SyncRunItem.required` 含 `id,status,started_at,trace_id`；paths 含 `runs` GET |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_ingestion_api.py -v` 全绿（≥27 项）

## 8. UI 设计交付（DATA-003）

### ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读取；评审引用 `references/ui-elements-empty-error-loading-review-checklist.md`、`references/async-state-review-checklist.md`、`references/form-validation-logic-review-checklist.md`）

### 页面信息架构

- **导航层级**：`/admin` → `AdminLayout` → `/admin/ingestion/sync-jobs` → 子页 `.../new`、`.../:id/edit`、`.../:id/history`、`.../:id/etl-rules`（`layout.md` §Admin 数据接入）
- **主内容区**：列表/历史 `rounded-xl border` 卡片 + `min-w-[720px]` 表格；表单页 `max-w-2xl`
- **空/加载/错误/权限态**：
  - 列表：`暂无同步任务` / Skeleton / ErrorBanner + `重试`（含 401 文案 T-ING-30）
  - 运行确认：`AlertDialog`「确认手动运行同步？」+ 描述任务名
  - 删除确认：既有「确认删除任务？」（T-ING-11）
  - 历史：100 行渲染 perf（T-ING-31）；error `role=alert`（T-ING-26）
  - 权限：M7 前仅测 API 错误展示，不做 RBAC UI

### 视觉层级

- **主操作**：`运行`（AlertDialog Action，`variant` 与删除区分：run 用 primary、删除用 destructive）/`删除`/`创建`
- **次操作**：`取消`（AlertDialogCancel outline）、行内 `IconButton`（历史/规则/编辑）
- **承载关系**：确认弹层用 shadcn `AlertDialog`；列表表格在 `shadow-theme-sm` 卡片内

### 组件映射

| 区域 | 复用组件 | 禁止 |
|------|----------|------|
| run 确认 | `AlertDialog`、`AlertDialogAction`、`AlertDialogCancel`（与删除共用模式） | `window.confirm` |
| 列表 | `Button`、`IconButton`、`Badge`、`Skeleton` | 原生 `<button>` |
| 错误 | `ErrorBanner` 模式（`border-error-500 bg-error-50`） | 裸 hex 错误色 |

### Token 与密度

- 语义色：run 确认 destructive 仅用于删除；run 用 `brand-500` primary Action
- 密度：`space-y-6` 页间距；表头 `px-6 py-4`
- 圆角：`rounded-xl` 卡片
- 字号：`text-theme-xl` 标题、`text-theme-sm` 正文
- 图标：`lucide-react` `Play`/`Trash2` `size-4`
- **门禁**：`pnpm run check:design` 禁止裸 hex

### 响应式与可访问性

- **desktop（1400）**：run 确认弹层居中；表格横向滚动
- **mobile（375）**：T-ING-29 cancel 路径；error 条不挤压主按钮
- **键盘焦点**：AlertDialog 默认焦点陷阱；Action/Cancel 可 Tab
- **aria**：确认标题可读；error `role=alert`（T-ING-26 延续）

### 视觉 QA 清单（P3/P4）

- [ ] **desktop 1400**：sync-jobs run 确认弹层打开态 1 张；检查 Action 色、任务名展示
- [ ] **mobile 375**：run 取消路径 + 401 error 态各 1 张
- [ ] **状态**：run loading（`runningId`）、delete/run 确认、error 重试
- [ ] **防重**：确认前不 POST；确认后单次 POST（T-ING-28/29）
- [ ] **色彩漂移**：`check:design` 全绿
- [ ] **perf**：100 行 history < 900ms（T-ING-31）

## 9. 验证命令（P4 等价）

```bash
cd backend && ruff check . && pytest -v
cd backend && pytest -v ../tests/test_ingestion_config.py ../tests/test_sync_executor.py ../tests/test_scheduler.py ../tests/test_etl_rules.py ../tests/test_ingestion_api.py ../tests/test_ingestion_l1_smoke.py
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

## 10. Spec self-review

- [x] 覆盖 round-target 五项，无 TBD/TODO
- [x] 未超出范围框定（8 修改文件，无新建生产模块）
- [x] UI 设计交付完整；`ui_design_skill` 已登记
- [x] 与 PRD 8 维薄弱项逐条对齐
- [x] 禁止写生产代码（设计阶段仅 spec；P3 允许 DATA-003 run 确认 ≤25 行）
