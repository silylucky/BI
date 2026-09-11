# M1B 收尾设计 — DATA-005 L1 端到端验收 + Companion 测试/文档补强

```yaml
date: 2026-07-03
milestone: M1B
round_target: docs/superpowers/evolution/2026-07-03-round-target-m1b-close.md
base_branch: dev-auto
prd_ids: [DATA-005, DATA-002, DATA-003, ETL-001, DATA-001]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 角色 | 用户感知 |
|---|------|--------|------|----------|
| 1 | 端到端验收与文档回写（L1） | DATA-005 | **主项** | compose 样例源 → 配置同步+清洗 → 托管库目标表数据正确 → 运行历史含 traceId/行数/errorMessage；PRD/域文档/plan.archive/SRS 与实现一致 |
| 2 | 同步执行器可靠性测试补强 | DATA-002 | companion | 同步失败自动重试 ≥1 次；仍失败时历史可查 errorMessage 并可手动重跑 |
| 3 | Admin 配置台 e2e smoke | DATA-003 | companion | `/admin/ingestion/*` 创建→运行→查历史 smoke 可重复；空/错态有明确文案 |
| 4 | 清洗规则 L1 脏数据场景 | ETL-001 | companion | 四类规则 + 规则链在 L1 样例表上可验证；写托管库前生效 |
| 5 | SourceConnection 模型与 API 文档对齐 | DATA-001 | companion | OpenAPI/PRD/API 索引对 `SourceConnection` 字段一致；CRUD + run API 契约测试覆盖 |

**执行顺序（P2 建议）**：DATA-001 文档/契约基线 → ETL-001 规则单测补强 → DATA-002 executor 单测 → DATA-005 L1 集成用例 → DATA-003 UI smoke → DATA-005 文档回写（L1 通过后）。

## 2. 现状与约束

| 项 | 现状 |
|----|------|
| `backend/app/ingestion/` | **已实现**（models、sync_executor、etl_rules、scheduler） |
| `docker-compose.yml` | 已有 `analytics-postgres:5433`、`sample-mysql:3307` + `dirty_orders` 种子 |
| `tests/test_ingestion_api.py` | 仅 auth + CRUD roundtrip；**无** run/runs/etl-rules/503 覆盖 |
| `tests/test_sync_executor.py` | **不存在** |
| `tests/test_ingestion_e2e.py` | **不存在** |
| `tests/test_etl_rules.py` | 2 用例（链式 + invalid cast）；缺四类规则独立用例 |
| `fe/src/pages/admin/ingestion/` | 4 页已实现（列表/表单/历史/规则）；**无** vitest smoke |
| `docs/services/ingestion.md` | 状态仍「未实现」；边界未写 SourceConnection |
| `docs/automate/plan.archive.md` §M1B | 6 项均为 `[ ]` |
| SRS §3.6 FR-DATA/FR-ETL | 状态仍「规划中（M1B）」 |
| `prd/F16-DATA.md` DATA-005 | 状态「未实现」；验收 `[ ]` |
| `docs/api/README.md` §9 | 路由已登记「已实现」；**缺**请求/响应示例与 SourceConnection 字段说明 |

**真理源优先级**：`round-target` > `plan.md` §M1B DATA-005 > 上轮 `m1b-activate-design.md` > `prd/F16-DATA.md`。

**L1 vs L2 边界（plan 锁定）**：

| 级别 | 范围 | 本轮 |
|------|------|:----:|
| **L1** | 内联 `SourceConnection` → 同步+清洗 → 托管库目标表正确；运行历史可查 | **必达** |
| **L2** | 托管库登记 `dataSourceId`（DS-002）→ FR-2.0b SQL 出数 | **不做**（M3/M4） |

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `tests/test_ingestion_e2e.py` | DATA-005 | **新建** L1 集成用例（compose 依赖，可 skip） |
| `tests/test_sync_executor.py` | DATA-002 | **新建** executor 成功/失败/重试单测（mock 源库与托管库） |
| `tests/test_etl_rules.py` | ETL-001 | **扩展** 四类规则各 1 场景 + 规则链 + 边界 |
| `tests/test_ingestion_api.py` | DATA-001, DATA-002 | **扩展** run/runs/etl-rules/503/404/422 契约 |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | **新建** vitest smoke（mock `apiFetch`） |
| `docs/automate/prd/F16-DATA.md` | DATA-005, DATA-001 | DATA-001 SourceConnection 字段表；DATA-005 状态/验收勾选 |
| `docs/services/ingestion.md` | DATA-005 | 状态→已实现；In/Out 含 SourceConnection；依赖更新 |
| `docs/automate/plan.archive.md` | DATA-005 | M1B 节 6 项 `[x]`；目标文案区分 L1/L2 |
| `docs/srs/全生命周期系统需求规格说明书.md` §3.6 | DATA-005 | FR-DATA/FR-ETL 状态→**已实现（L1）**；L2 留 M3/M4 注记 |
| `docs/api/README.md` | DATA-001 | §9 补 SourceConnection 字段与 POST/GET 示例 |

**紧邻依赖（不扩 module 边界，P2 单列任务）**：

| 路径 | 原因 |
|------|------|
| `backend/pyproject.toml` 或 `pytest.ini` | 注册 `integration` marker（若尚未存在） |
| `tests/conftest.py` | 可选：`integration_env` fixture 检测 compose 可达性 |

**明确不含**：生产代码功能变更（除非测试暴露必修 bug，且仅限框定模块内最小修复）、L2 dataSourceId 登记、M3 ConnectorRegistry、侧栏 nav 增补、Playwright 全浏览器 E2E、CI 内强制启动 compose。

## 4. 非目标（明确不做）

- **DATA-005 L2**：托管库 → DS-002 `dataSourceId` → FR-2.0b SQL 出数（M3/M4）
- M3+ `sourceDataSourceId` 读源、`ConnectorRegistry` 集成
- PostgreSQL 源库支持（executor 仍仅 mysql；文档注明限制即可）
- 增量同步、OGG、可视化 ETL 设计器
- `fe/src/config/admin-nav.tsx` 侧栏「数据接入」入口（仍可直接 URL 访问；nav 留人工或后续轮次）
- TanStack Query / `mapApiError` 全量数据层
- hub 8 维重评与 `plan.md` DATA-005 勾选（**P5** 职责）
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（round-target） | 本轮设计对策 |
|--------|------------------------|--------------|
| DATA-005 | 完整度 5%、测试 0%、可靠性 0% | L1 集成用例 + 4 份文档回写；验收标准可自动化断言 |
| DATA-002 | 测试覆盖 55% | `test_sync_executor.py` 覆盖成功/源失败/写库失败/重试仍 failed；运行历史字段断言 |
| DATA-003 | 测试 58%、交互 70% | vitest smoke 覆盖 CRUD→run→history 与 empty/error/loading；P4 desktop+mobile 截图 QA |
| ETL-001 | 可靠性（脏数据边界）、测试边界 | 四类规则独立用例 + 规则链；L1 集成断言 `dirty_orders` 变换结果 |
| DATA-001 | 完整度（文档一致性）、测试 78%→补边界 | SourceConnection 字段表三处对齐；API 异常码单测 |

## 6. 方案比选（摘要）

### 6.1 L1 集成测试载体（DATA-005）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `test_ingestion_e2e.py` + compose 实库 + `@pytest.mark.integration` + 不可达则 skip | 真实 DATA-SMOKE L1；CI 默认单测仍绿 | **采用** |
| B 全 mock（pymysql/SQLAlchemy patch） | 无 compose 依赖但非 L1 语义 | 仅作 executor **单测**补充，不作 L1 主验收 |
| C Playwright 浏览器 E2E | 覆盖 UI 但过重、compose+fe 双依赖 | 否决（UI 用 vitest smoke） |

### 6.2 Executor 失败/重试测试（DATA-002）

| 方案 | 说明 | 结论 |
|------|------|------|
| A `unittest.mock.patch` `_fetch_mysql_rows` / `_write_analytics` | 隔离外部 DB；可精确模拟首次失败 | **采用** |
| B 故意错误 compose 凭证 |  flaky、污染共享库 | 否决 |
| C 仅 API 层测 202 接受 | 不覆盖 retry 逻辑 | 不足，需 A 补充 |

### 6.3 Admin UI smoke（DATA-003）

| 方案 | 说明 | 结论 |
|------|------|------|
| A vitest + `@testing-library/react` + mock `apiFetch` | 与 `routes.smoke.test.tsx` 一致；无后端依赖 | **采用** |
| B MSW 拦截真实 HTTP | 更重，M1 无先例 | 否决 |
| C Playwright | 超 round-target 范围 | 否决 |

## 7. 总体架构（L1 验收链路）

```mermaid
sequenceDiagram
    participant T as test_ingestion_e2e
    participant API as sync.py
    participant EX as sync_executor
    participant ETL as etl_rules
    participant MySQL as sample-mysql:3307
    participant PG as analytics-postgres:5433
    participant Meta as 元库 ingestion_*

    T->>API: POST sync-jobs (SourceConnection)
    API->>Meta: 持久化 job + 空 etl-rules
    T->>API: PUT etl-rules (四类规则链)
    T->>API: POST .../run (X-Trace-Id)
    API->>Meta: SyncRun running
    API->>EX: background run_job
    EX->>MySQL: SELECT dirty_orders
    EX->>ETL: apply_rules
    EX->>PG: CREATE/TRUNCATE/INSERT target
    EX->>Meta: succeeded + rows_synced
    T->>API: GET .../runs
    T->>PG: 直接查询目标表断言行/字段
```

**L1 预期数据变换**（与 `docker/sample-mysql/init.sql` + 推荐规则链一致）：

| 规则 | 配置 |
|------|------|
| rename_column | `product_name` → `product` |
| cast_type | `amount` → `float`（`not-a-number` → `NULL`） |
| fill_null | `note` → `"无备注"` |
| filter_rows | `status` `ne` `"deleted"` |

**预期结果**：5 行源数据 → **4 行**目标表（`Widget C` 被过滤）；`Widget A/D` 的 `note` 填充；`Widget B.amount` 为 `NULL`。

## 8. 分项设计

### 8.1 DATA-005 — 端到端验收与文档回写（L1）

#### 8.1.1 `tests/test_ingestion_e2e.py`

**前置条件 fixture**（`@pytest.fixture(scope="module")`）：

1. 检测 `127.0.0.1:3307` 与 `127.0.0.1:5433` TCP 可达；不可达 → `pytest.skip("compose services not running")`
2. 设置环境变量：
   - `ANALYTICS_DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics`
   - `DATABASE_URL` 使用独立 sqlite 或测试 postgres（与现有 `test_ingestion_api.py` 内存 sqlite 模式一致，避免污染开发元库）
3. `Base.metadata.create_all` 创建 ingestion 元表

**用例 `test_l1_sync_etl_analytics_pipeline`**：

1. `POST /api/v1/ingestion/sync-jobs` — payload 对齐 `test_ingestion_api.job_payload`（sample-mysql `dirty_orders` → `orders_clean_l1`）
2. `PUT .../etl-rules` — 上表规则链 JSON
3. `POST .../run` — header `X-Trace-Id: e2e-trace-001`；断言 `202` + `run_id`
4. **轮询** `GET .../runs`（≤30s，间隔 0.5s）直至 `status in (succeeded, failed)`；断言 `succeeded`
5. 断言 run 项：`trace_id == "e2e-trace-001"`、`rows_synced == 4`、`error_message is None`
6. 用 SQLAlchemy 连 analytics URL 查询 `"orders_clean_l1"`：
   - `COUNT(*) == 4`
   - 存在 `product='Widget A'` 且 `note='无备注'`
   - 不存在 `product='Widget C'`（已过滤）
7. teardown：删除 job（级联 runs/rules）；`DROP TABLE IF EXISTS orders_clean_l1` on analytics

**用例 `test_l1_run_history_on_source_failure`**（可选 companion DATA-002，可合并到 executor 单测）：

- 创建 job 指向错误 host → run → 断言最终 `failed` + 非空 `error_message` + `retry_count >= 1`

#### 8.1.2 文档回写（L1 测试通过后同 PR）

| 文档 | 变更要点 |
|------|----------|
| `prd/F16-DATA.md` | DATA-005 状态→已实现；验收 `[x]` DATA-SMOKE L1；DATA-001 增 SourceConnection 字段表（type/host/port/database/username/password/table；响应用 `***` 脱敏） |
| `docs/services/ingestion.md` | 状态→**已实现**；In 增「内联 SourceConnection（M1B）」；Out 明确不含 L2 dataSourceId 登记；主要类型表更新为已实现 |
| `docs/automate/plan.archive.md` | M1B 6 项全 `[x]`；目标改为「L1 同步+清洗闭环；L2 dataSourceId+SQL 见 M3/M4」；保留 124 项总计注记 |
| `docs/srs/...md` §3.6 | FR-DATA/FR-ETL 状态→**已实现（L1）**；验收要点加注「L2 BI 出数见 M3/M4」 |
| `docs/api/README.md` | §9 增 POST body 示例（含 `source` 对象）与 run/runs 响应示例 |

**验收标准（可测试）**：

- [ ] `pytest tests/test_ingestion_e2e.py -m integration` 在 compose up 时 exit 0
- [ ] 上述 5 份文档状态/边界与代码一致，无「未实现/规划中」残留（L2 除外显式标注）
- [ ] `grep` 确认 `services/ingestion.md` 含 SourceConnection In 边界

---

### 8.2 DATA-002 — 同步执行器可靠性测试

#### 8.2.1 `tests/test_sync_executor.py`

| 用例 | mock 策略 | 断言 |
|------|-----------|------|
| `test_run_job_success_applies_rules_and_writes` | patch `_fetch_mysql_rows` 返回 2 行；patch `_write_analytics` 返回 2 | run `status=succeeded`，`rows_synced=2` |
| `test_run_job_source_failure_retries_then_failed` | patch `_fetch_mysql_rows` 始终 `raise ConnectionError(...)` | 最终 `status=failed`，`retry_count>=1`，`error_message` 含摘要 |
| `test_run_job_analytics_not_configured` | patch `get_settings` 使 `analytics_database_url=None` | `failed` + message 含 `ANALYTICS` |
| `test_run_job_write_failure` | fetch 成功；`_write_analytics` raise | 重试后 `failed` |
| `test_run_job_missing_job` | 无效 job_id | `failed` + `任务不存在` |

**实现注意**：使用 sqlite 内存元库 + 真实 `SyncJob`/`SyncRun` ORM；mock 仅隔离外部 MySQL/PG。

**验收标准**：

- [ ] 5 用例以上覆盖 plan §DATA-002 失败重试与历史字段
- [ ] 断言字段：`status`、`error_message`、`trace_id`、`rows_synced`、`retry_count`

---

### 8.3 DATA-003 — Admin 配置台 e2e smoke（UI 门控）

#### 8.3.1 `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`

**mock 策略**：`vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))`

| 用例 | 页面 | 断言 |
|------|------|------|
| `SyncJobsPage_empty_state` | 列表 | mock 空 `items` → 可见「暂无同步任务」+ 新建按钮 |
| `SyncJobsPage_error_state` | 列表 | mock reject → ErrorBanner 文案 + 「重试」 |
| `SyncJobsPage_run_flow` | 列表 | mock 1 job + run POST 成功 → Play 按钮可点且不抛错 |
| `SyncJobHistoryPage_shows_runs` | 历史 | mock runs 含 succeeded/failed → Badge 文案「成功」「失败」 |
| `SyncJobFormPage_create_submit` | 表单 | 填必填项 submit → mock POST 201 → navigate 被调用（mock `useNavigate`） |

**路由**：`MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}` + 渲染单页组件（与 `routes.smoke.test.tsx` 模式一致，不依赖完整 `AppRoutes` 除非必要）。

**验收标准**：

- [ ] `cd fe && pnpm test ingestion.smoke` exit 0
- [ ] `pnpm run build && pnpm run check:design` exit 0
- [ ] 空态/错态断言非空白（`getByText` 命中中文文案）

---

### 8.4 ETL-001 — 清洗规则 L1 脏数据场景

#### 8.4.1 扩展 `tests/test_etl_rules.py`

| 用例 | 规则类型 | 输入 | 预期 |
|------|----------|------|------|
| `test_rename_column_only` | rename | `{a:1}` | key `b` 存在、`a` 不存在 |
| `test_cast_type_integer` | cast | `"42.0"` | int 42 |
| `test_fill_null_only` | fill_null | `note: null` | 填充值 |
| `test_filter_rows_eq` | filter | 多行 | 仅匹配行保留 |
| `test_rule_chain_dirty_orders_subset` | 链式 | 对齐 init.sql 子集 | 行数与字段与 §7 一致 |
| `test_filter_rows_is_null` | filter | `is_null` op | 空串/NULL 过滤 |

**集成挂载点验证**：在 `test_sync_executor_success` 或 L1 e2e 中断言 `_fetch_mysql_rows` 原始行数 > `apply_rules` 后写入行数（当规则含 filter 时）。

**验收标准**：

- [ ] 四类规则类型各有 ≥1 独立单测
- [ ] ≥1 规则链组合用例
- [ ] L1 e2e 或 executor 单测证明规则在写库前生效

---

### 8.5 DATA-001 — SourceConnection 模型与 API 文档对齐

#### 8.5.1 扩展 `tests/test_ingestion_api.py`

| 用例 | 场景 | 期望 |
|------|------|------|
| `test_create_job_invalid_source_422` | 缺 `password` 或非法 `port` | 422 |
| `test_trigger_run_without_analytics_503` | 无 `ANALYTICS_DATABASE_URL` | 503 + `ANALYTICS_DB_NOT_CONFIGURED` |
| `test_trigger_run_not_found_404` | 随机 uuid | 404 |
| `test_list_runs_empty` | 新建 job 无 run | 200 + `items=[]` |
| `test_put_etl_rules_roundtrip` | PUT 规则后 GET | 规则一致 |

#### 8.5.2 文档字段表（三处一致）

**SourceConnection（请求 `source` / 响应 `source`）**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| type | `mysql` \| `postgres` | ✓ | M1B executor 仅 mysql |
| host | string | ✓ | 源库主机 |
| port | int 1–65535 | ✓ | 源库端口 |
| database | string | ✓ | 库名 |
| username | string | ✓ | 用户名 |
| password | string | ✓ | 请求明文；响应 `***` |
| table | string | ✓ | 源表名 |

**验收标准**：

- [ ] 上述 5 个 API 用例通过
- [ ] `prd/F16-DATA.md`、`docs/api/README.md` §9、`OpenAPI` 字段名一致（snake_case 在 JSON 为嵌套 `source` 对象）

---

## 9. UI 设计交付（DATA-003 门控）

**ui_design_skill**: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 9.1 页面信息架构

| 路由 | 页面 | 主内容区 |
|------|------|----------|
| `/admin/ingestion/sync-jobs` | SyncJobsPage | 列表卡片表格；主操作「新建任务」 |
| `/admin/ingestion/sync-jobs/new` | SyncJobFormPage | 表单卡片；内联 SourceConnection 字段组 |
| `/admin/ingestion/sync-jobs/:id/history` | SyncJobHistoryPage | 运行历史表格 |
| `/admin/ingestion/sync-jobs/:id/etl-rules` | EtlRulesPage | 规则链表单列表 |

导航层级：`管理 / 数据接入 / {子页}` breadcrumb（已实现）。主内容区遵循 Admin 壳层 `max-w-(--breakpoint-2xl)` 与 `space-y-6` 密度。

### 9.2 状态覆盖（本轮 smoke 必验）

| 状态 | 组件/文案 | 要求 |
|------|-----------|------|
| loading | `Skeleton` 占位 | 列表/表单/历史均已有 |
| empty | 「暂无同步任务」 | SyncJobsPage 已有；历史空列表需有「暂无运行记录」类文案（若缺失则补一行，不改布局） |
| error | `ErrorBanner` + 「重试」 | 已有；smoke 断言可见 |
| success | Badge「成功」/「失败」/「运行中」 | SyncJobHistoryPage 已有 |

### 9.3 组件映射

| 用途 | 组件 | 来源 |
|------|------|------|
| 主/次操作 | `Button` variant primary/outline | `@/components/ui/button` |
| 表格行内操作 | `IconButton` ghost + lucide | 已有 |
| 状态 | `Badge` success/error/warning | 已有 |
| 表单 | `Input`/`Label`/`Select` | 已有 |
| 加载 | `Skeleton` | 已有 |

**禁止**：页面内新建原生 button/input；局部重画表格/Alert 配色。

### 9.4 Token 与密度

- 语义色：`brand-*`、`gray-*`、`error-*`（ErrorBanner 已用 `border-error-500 bg-error-50`）
- 卡片：`rounded-xl border border-gray-200 shadow-theme-sm`
- 字号：`text-theme-xl` 标题、`text-theme-sm` 正文
- 图标：`size-4` 行内操作

本轮以测试与文档为主；**无结构性 UI 改版**。若 smoke 发现历史页空列表缺文案，允许最小 diff 补一句中文空态。

### 9.5 响应式与可访问性

- 表格 `overflow-x-auto` + `min-w-[720px]`（已有）
- 行内 `IconButton` 带 `aria-label`（已有）
- smoke 在 `innerWidth=1400` 与 `375` 各跑一轮（复制 `routes.smoke.test.tsx` 的 viewport helper）

### 9.6 视觉 QA 清单（P4 执行）

- [ ] desktop（≥1280px）截图：`sync-jobs` 列表、history、etl-rules
- [ ] mobile（375px）截图：同上 3 路由，检查表格横向滚动与按钮不重叠
- [ ] 空态/错态截图各 1 张
- [ ] `pnpm run check:design` 无新增 hex 硬编码

---

## 10. 测试矩阵汇总

| 层级 | 文件 | 依赖 | CI 默认 |
|------|------|------|:-------:|
| 单元 | `test_etl_rules.py` | 无 | ✓ |
| 单元 | `test_sync_executor.py` | sqlite 元库 + mock | ✓ |
| API | `test_ingestion_api.py` | TestClient + sqlite | ✓ |
| 集成 L1 | `test_ingestion_e2e.py` | compose mysql+analytics | skip 若不可达 |
| FE smoke | `ingestion.smoke.test.tsx` | vitest + mock api | ✓ |

**P4 完整验证建议命令**：

```bash
docker compose up -d sample-mysql analytics-postgres
cd backend && pytest tests/test_etl_rules.py tests/test_sync_executor.py tests/test_ingestion_api.py tests/test_ingestion_e2e.py -m integration
cd ../fe && pnpm test ingestion.smoke && pnpm run build && pnpm run check:design
```

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| compose 未启动导致 L1 skip | 文档与 P4 命令显式 `docker compose up`；integration marker 与 skip 消息含指引 |
| analytics 表污染 | e2e 使用独立 `target_table` 名 + teardown DROP |
| executor 递归重试栈深 | 单测 mock 限制 2 次调用；已有实现 attempt≤1 |
| FE mock 与真实 API 字段漂移 | smoke 使用与 OpenAPI 一致的 snake_case 响应样本 |
| SRS 状态过早标全量实现 | 仅标「已实现（L1）」并保留 L2 注记 |

---

## 12. Spec Self-Review

- [x] 无 TBD/TODO 占位
- [x] 覆盖 round-target 5 项
- [x] 文件清单 ≤20，未扩 module 边界
- [x] L1/L2 边界无矛盾
- [x] UI 门控节完整（skill 路径、IA、状态、组件、Token、响应式、QA）
- [x] 每项验收标准可测试
