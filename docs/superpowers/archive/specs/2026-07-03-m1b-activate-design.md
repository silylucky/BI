# M1B 数据接入首期设计 — DATA-004 / DATA-001 / DATA-002 / ETL-001 / DATA-003

```yaml
date: 2026-07-03
milestone: M1B
round_target: docs/superpowers/evolution/2026-07-03-round-target-m1b-activate.md
base_branch: dev-auto
prd_ids: [DATA-004, DATA-001, DATA-002, ETL-001, DATA-003]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 用户感知 |
|---|------|--------|:--------:|----------|
| 1 | 托管分析库与配置项 | DATA-004 | 1 | `docker compose up` 可启托管库 + 样例源库；凭证可 Fernet 加密 |
| 2 | 同步任务模型与 API | DATA-001 | 2 | OpenAPI 可见同步任务 CRUD；内联 `SourceConnection` 创建任务 |
| 3 | 同步执行器（定时/手动） | DATA-002 | 3 | 手动/定时同步后托管库目标表有数据；失败可查历史并重跑 |
| 4 | 清洗规则引擎（轻量） | ETL-001 | 4 | 脏值源表经 JSON 规则后目标字段符合配置 |
| 5 | Admin 配置台页面 | DATA-003 | 5 | `/admin/ingestion/*` 完成创建任务 → 手动运行 → 查看历史 |

**依赖链**：004 基础设施 → 001 模型/API → 002 执行器（消费 001）→ ETL-001 挂载于 002 写库前 → 003 UI 消费 001/002/ETL API。

## 2. 现状与约束

| 项 | 现状 |
|----|------|
| `backend/app/ingestion/` | **不存在**；本轮从零建域 |
| `docker-compose.yml` | 仅元库 `postgres:5432` |
| `config.py` | 已有 `analytics_database_url: str \| None = None`；`credential_fernet_key` 必填但未用于业务 |
| `backend/migrations/` | 仅空 revision `0001`；`target_metadata = None` |
| `backend/pyproject.toml` | 无 `apscheduler` / `pymysql` / `cryptography` |
| `fe/src/pages/admin/` | 仅 `AdminHomePage.tsx`；无 ingestion 路由 |
| `docs/api/README.md` §9 | 三条路由状态为「规划」 |
| `docs/services/ingestion.md` | 状态「未实现」；依赖描述仍写 M3 `dataSourceId`（本轮按 plan 内联源连接） |

**真理源优先级**：`round-target` > `plan.md` §M1B > `arch.md` > `prd/F16-DATA.md` > `services/ingestion.md`（边界描述本轮不终稿，留 DATA-005）。

**M1B 源连接策略（plan 锁定）**：任务内联 **`SourceConnection`**（`mysql` / `postgres`、主机、库、表、凭证）；`sourceDataSourceId` 字段预留可空；**不依赖** M3 `ConnectorRegistry`。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `docker-compose.yml` | 004 | 增 `analytics-postgres`、`sample-mysql`、可选 `sample-postgres`；init SQL 种子脏数据 |
| `backend/app/core/config.py` | 004 | 校验/文档化 `analytics_database_url`；启动时校验 Fernet key 格式（可选 warn） |
| `backend/.env.example` | 004 | 展开 `ANALYTICS_DATABASE_URL`、样例源注释；标注 M1B 启用凭证加密 |
| `backend/migrations/versions/0002_ingestion_tables.py` | 004,001 | 元库 `ingestion_*` 表 |
| `backend/pyproject.toml` | 004,002 | 增 `apscheduler`、`pymysql`、`cryptography` |
| `backend/app/ingestion/models.py` | 001 | ORM 模型、元库 Session 工厂、凭证加解密 helper |
| `backend/app/ingestion/sync_executor.py` | 002 | 全量同步、重试、写运行历史 |
| `backend/app/ingestion/scheduler.py` | 002 | APScheduler cron 注册/刷新 |
| `backend/app/ingestion/etl_rules.py` | ETL-001 | 规则引擎与 JSON schema |
| `backend/app/api/v1/ingestion/sync.py` | 001,002,ETL | 薄 entry：CRUD + run + runs 列表 + etl-rules |
| `docs/api/README.md` | 001 | §9 状态规划→已实现；补 `GET .../runs` 若登记 |
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | 003 | 任务列表 + 手动运行入口 |
| `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx` | 003 | 新建/编辑（含内联源连接表单） |
| `fe/src/pages/admin/ingestion/SyncJobHistoryPage.tsx` | 003 | 运行历史 |
| `fe/src/pages/admin/ingestion/EtlRulesPage.tsx` | 003 | 清洗规则 JSON 表单 |
| `fe/src/routes.tsx` | 003 | 登记 `/admin/ingestion/*` 嵌套路由 |

**紧邻依赖（不扩 module 边界，P2 须单列任务）**：

| 路径 | 原因 |
|------|------|
| `backend/app/api/v1/router.py` | `include_router(ingestion_router)` 一行聚合 |
| `backend/app/api/v1/ingestion/__init__.py` | 导出 `router` |
| `backend/app/ingestion/__init__.py` | 包标记 |
| `backend/app/main.py` | 应用 lifespan 启停 scheduler（`scheduler.start()` / `shutdown()`） |
| `fe/src/lib/api.ts` | 最小 envelope fetch 客户端（M1B 首期联调） |
| `fe/src/components/ui/*`（按需） | Table/Dialog/Badge/Select/Textarea 等 skill 模板，同 PR 更新 README |
| `tests/test_ingestion_*.py` | API / etl_rules 单测（P3 范围，设计预留） |

## 4. 非目标（明确不做）

- **DATA-005**：L1/L2 端到端验收、`services/ingestion.md` 终稿、SRS §3.6 回写（下轮）
- M3+ `dataSourceId` / `ConnectorRegistry` 读源（仅预留字段）
- 增量同步、OGG 实时复制、可视化 ETL 设计器
- 托管库第二套 Alembic（业务表由执行器 `CREATE TABLE IF NOT EXISTS` + 全量刷新）
- `fe/src/config/admin-nav.tsx` 侧栏入口（本轮验收以直接 URL `/admin/ingestion/sync-jobs` 为准；nav 增补可随 DATA-005 或人工）
- TanStack Query 全量数据层、`mapApiError` 体系（M1B 用最小 fetch + 页面内错误映射）
- CI 内启动 analytics/sample 容器集成测试（P4 以本地 compose 手验 + 单测 mock 为主）

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（≤40%） | 本轮设计对策 |
|--------|----------------|--------------|
| DATA-004 | 完整度 5%、可靠性 0%、测试 0% | compose 健康检查 + Alembic revision 可重复 upgrade；单测覆盖 Settings 加载 `ANALYTICS_DATABASE_URL` |
| DATA-001 | 完整度 5%、架构 11%、测试 0% | 域/entry 分层；OpenAPI schema 完整；CRUD + run API 单测（TestClient + sqlite 或 mock session） |
| DATA-002 | 可靠性 0%、测试 0% | 1 次自动重试；`failed` + `errorMessage` + `traceId` 落库；executor 纯函数单测 |
| ETL-001 | 完整度 5%、可靠性 0% | 四类规则 + 脏数据样例表验收；`etl_rules.apply_rules` 单测矩阵 |
| DATA-003 | 完整度 5%、交互体验待评 | UI 设计交付节；`crud-flow` 模式；loading/empty/error；P4 desktop+mobile 截图 QA |

## 6. 方案比选（摘要）

### 6.1 托管分析库（DATA-004）

| 方案 | 说明 | 结论 |
|------|------|------|
| A 独立 `analytics-postgres` 容器 | 与元库端口/数据隔离；对齐 plan | **采用**（`:5433`） |
| B 元库内独立 schema | 运维简单但边界模糊 | 否决 |
| C 外部云 RDS | M1B 本地验收不便 | 否决 |

### 6.2 源连接（DATA-001）

| 方案 | 说明 | 结论 |
|------|------|------|
| A 任务内联 `SourceConnection` + Fernet 存密码 | plan M1B；无 M3 依赖 | **采用** |
| B 引用 `datasources` 域 `dataSourceId` | 需 M3 ConnectorRegistry | M3+（字段预留） |
| C 明文存密码 | 违反 ADR-06 | 否决 |

### 6.3 调度（DATA-002）

| 方案 | 说明 | 结论 |
|------|------|------|
| A 进程内 APScheduler `BackgroundScheduler` | plan 指定；M1B 任务量小 | **采用** |
| B Celery + Redis | 过重 | 否决 |
| C 仅手动 run | 不满足 cron 验收 | 否决 |

### 6.4 全量同步写托管库（DATA-002）

| 方案 | 说明 | 结论 |
|------|------|------|
| A 读源 → Python 内存 → ETL → `pandas`/行迭代 INSERT | 样例表规模小；可控 | **采用**（无 pandas 依赖，用 SQLAlchemy `execute` 批量） |
| B `INSERT INTO analytics... SELECT * FROM dblink(...)` | 跨库扩展复杂 | 否决 |
| C 增量 CDC | 超 M1B | 否决 |

### 6.5 ETL 规则（ETL-001）

| 方案 | 说明 | 结论 |
|------|------|------|
| A JSON 规则列表，Python 行级变换 | plan「轻量」 | **采用** |
| B SQL 表达式引擎 | 安全风险与复杂度高 | 否决 |

## 7. 总体架构

```mermaid
flowchart TB
    subgraph fe [Admin UI DATA-003]
        List[SyncJobsPage]
        Form[SyncJobFormPage]
        Hist[SyncJobHistoryPage]
        Etl[EtlRulesPage]
    end
    subgraph api [api/v1/ingestion/sync.py]
        CRUD[CRUD sync-jobs]
        Run[POST .../run]
        Runs[GET .../runs]
        Rules[GET/PUT etl-rules]
    end
    subgraph domain [backend/app/ingestion]
        Models[models.py]
        Exec[sync_executor.py]
        EtlEng[etl_rules.py]
        Sched[scheduler.py]
    end
    subgraph dbs [Docker]
        Meta[(postgres:5432 元库)]
        Analytics[(analytics-postgres:5433)]
        MySQL[(sample-mysql:3307)]
    end
    List --> CRUD
    Form --> CRUD
    Hist --> Runs
    Etl --> Rules
    Run --> Exec
    Sched --> Exec
    CRUD --> Models
    Exec --> Models
    Exec --> EtlEng
    Models --> Meta
    Exec --> MySQL
    Exec --> Analytics
```

**请求链路（手动 run）**：

1. `POST /api/v1/ingestion/sync-jobs/{id}/run` → 创建 `ingestion_sync_runs` 行 `status=running`
2. `sync_executor.run_job(job_id, trace_id)`：解密源凭证 → 连源库 `SELECT *` → `etl_rules.apply` → 连托管库建表/清空/插入
3. 成功 → `succeeded` + `rows_synced`；失败 → 重试 1 次 → 仍失败 `failed` + `error_message` + `trace_id`

## 8. 分项设计

### 8.1 DATA-004 — 托管分析库与配置项

#### 8.1.1 `docker-compose.yml` 服务

| 服务名 | 镜像 | 端口 | 用途 |
|--------|------|------|------|
| `postgres` | `postgres:16-alpine` | 5432 | 元库（已有） |
| `analytics-postgres` | `postgres:16-alpine` | **5433:5432** | 托管分析库 `analytics` |
| `sample-mysql` | `mysql:8` | **3307:3306** | 样例源；init 脚本建 `sample_db.dirty_orders` |
| `sample-postgres`（可选） | `postgres:16-alpine` | **5434:5432** | 第二样例源 `sample_src.orders` |

**样例脏数据表**（MySQL init `docker/sample-mysql/init.sql`）：

- 列：`id`, `product_name`, `amount`（字符串混数字）, `status`, `note`（含 NULL）
- 插入 ≥5 行含 NULL、类型脏值、需过滤的 `status='deleted'`

> init 脚本路径为 compose `volumes` 挂载，**不计入** round-target 16 文件预算（基础设施种子）。

#### 8.1.2 配置

`backend/.env.example` 增补：

```env
ANALYTICS_DATABASE_URL=postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics
# 样例源（文档注释，非 Settings 字段）
# SAMPLE_MYSQL_URL=mysql+pymysql://sample:sample@localhost:3307/sample_db
```

`config.py`：`analytics_database_url` 保持 `str | None`；`sync_executor` 在 run 时若未配置则返回 503 业务错误（`ANALYTICS_DB_NOT_CONFIGURED`），避免破坏现有无 M1B 配置的测试。

`CREDENTIAL_FERNET_KEY`：M1B 在 `models.encrypt_password` / `decrypt_password` 使用 `cryptography.fernet.Fernet`；API 响应中密码字段恒为 `"***"` 或省略。

#### 8.1.3 Alembic `0002_ingestion_tables.py`

元库表（`upgrade()` 纯 SQL 或 `op.create_table`）：

**`ingestion_sync_jobs`**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | VARCHAR(120) NOT NULL | 任务名 |
| `source_type` | VARCHAR(16) NOT NULL | `mysql` \| `postgres` |
| `source_host` | VARCHAR(255) NOT NULL | |
| `source_port` | INTEGER NOT NULL | |
| `source_database` | VARCHAR(128) NOT NULL | |
| `source_username` | VARCHAR(128) NOT NULL | |
| `source_password_encrypted` | TEXT NOT NULL | Fernet 密文 |
| `source_table` | VARCHAR(128) NOT NULL | 源表名 |
| `target_table` | VARCHAR(128) NOT NULL | 托管库目标表 |
| `schedule_cron` | VARCHAR(64) NULL | 空=仅手动 |
| `enabled` | BOOLEAN DEFAULT true | |
| `source_data_source_id` | UUID NULL | M3 预留 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`ingestion_sync_runs`**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | UUID PK | |
| `job_id` | UUID FK → jobs | ON DELETE CASCADE |
| `status` | VARCHAR(16) | `pending`/`running`/`succeeded`/`failed` |
| `started_at` / `finished_at` | TIMESTAMPTZ | |
| `rows_synced` | INTEGER NULL | |
| `error_message` | TEXT NULL | 用户可读摘要，无堆栈 |
| `trace_id` | VARCHAR(64) NOT NULL | 来自 `TraceIdMiddleware` |
| `retry_count` | INTEGER DEFAULT 0 | |

**`ingestion_etl_rules`**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | UUID PK | |
| `job_id` | UUID FK UNIQUE | 每任务一套规则 |
| `rules` | JSONB NOT NULL DEFAULT `[]` | 规则数组 |
| `updated_at` | TIMESTAMPTZ | |

索引：`ingestion_sync_runs(job_id, started_at DESC)`。

#### 8.1.4 `pyproject.toml` 依赖

```toml
"apscheduler>=3.10.0",
"pymysql>=1.1.0",
"cryptography>=43.0.0",
```

#### 8.1.5 验收命令（可测试）

```bash
docker compose up -d
cd backend && alembic upgrade head   # 含 0002
psql $ANALYTICS_DATABASE_URL -c '\conninfo'
mysql -h 127.0.0.1 -P 3307 -u sample -psample -e 'SELECT COUNT(*) FROM sample_db.dirty_orders'
```

---

### 8.2 DATA-001 — 同步任务模型与 API

#### 8.2.1 `models.py` 职责

- SQLAlchemy 2.0 declarative 模型映射上表
- `get_meta_session()`：基于 `settings.database_url` 的 `sessionmaker`（本轮置于 `models.py` 避免扩 `core/` 范围）
- `SourceConnection` Pydantic 内联 DTO（API 入参）：`type`, `host`, `port`, `database`, `username`, `password`, `table`
- 密码入库前 `encrypt_password`；出库 API 脱敏

#### 8.2.2 API 契约（`sync.py`）

前缀：`/ingestion`（挂于 `api_v1_router`）

| 方法 | 路径 | 说明 | 请求体要点 | 响应 |
|------|------|------|------------|------|
| GET | `/sync-jobs` | 列表 | — | `{ items: SyncJobSummary[] }` |
| POST | `/sync-jobs` | 创建 | `name`, `source`（内联连接）, `target_table`, `schedule_cron?` | `SyncJobDetail` 201 |
| GET | `/sync-jobs/{id}` | 详情 | — | `SyncJobDetail`（无密码明文） |
| PUT | `/sync-jobs/{id}` | 全量更新 | 同 POST | `SyncJobDetail` |
| DELETE | `/sync-jobs/{id}` | 删除 | — | 204 |
| POST | `/sync-jobs/{id}/run` | 手动触发 | — | `{ run_id, status }` 202 |
| GET | `/sync-jobs/{id}/runs` | 运行历史 | `?limit=20` | `{ items: SyncRun[] }` |
| GET | `/sync-jobs/{id}/etl-rules` | 读规则 | — | `{ rules: EtlRule[] }` |
| PUT | `/sync-jobs/{id}/etl-rules` | 写规则 | `{ rules: EtlRule[] }` | 同 GET |

**错误体**：`{ "code", "message", "detail" }`（与现有 auth 一致）。

**鉴权**：全部路由需 `Bearer dev`（development）。

创建任务**不得**调用 M3 数据源 API；`source_data_source_id` 请求中忽略或恒 null。

#### 8.2.3 `docs/api/README.md`

§9 三行状态改为「已实现」；若历史列表未登记，增补：

`| GET | /api/v1/ingestion/sync-jobs/{id}/runs | 运行历史 | ... |`

---

### 8.3 DATA-002 — 同步执行器

#### 8.3.1 `sync_executor.py`

```python
# 伪代码结构（实现参考，非复制粘贴）
def run_job(job_id: UUID, trace_id: str, *, attempt: int = 0) -> SyncRunResult:
    # 1. load job + rules
    # 2. fetch_source_rows(job.source_*)  # pymysql or psycopg
    # 3. rows = apply_rules(rows, rules)
    # 4. write_analytics_table(settings.analytics_database_url, job.target_table, rows)
    # 5. update run record
```

**全量策略（M1B）**：

- 托管库：`CREATE TABLE IF NOT EXISTS`（列类型 TEXT/NUMERIC 简化推断或全 TEXT）
- 每 run：`TRUNCATE` 目标表后批量 `INSERT`
- 行数上限：默认 100_000 行（常量 `INGESTION_MAX_ROWS`，防 OOM）

**重试**：捕获连接/SQL 异常 → 若 `attempt < 1` 则 `retry_count+=1` 递归重试；否则 `failed`。

**异步**：`POST .../run` 使用 `BackgroundTasks` 或线程池触发 executor，HTTP 立即 202（避免阻塞）。

#### 8.3.2 `scheduler.py`

- `BackgroundScheduler(timezone="Asia/Shanghai")`
- `register_job(scheduler, job)`：`CronTrigger.from_crontab(job.schedule_cron)` → `run_job`
- `refresh_all_jobs()`：启动时与 CRUD 后调用，移除旧 job id 再注册
- `main.py` lifespan：`scheduler.start()` / `scheduler.shutdown(wait=False)`

**cron 为空**：不注册定时，仅手动 run。

#### 8.3.3 验收

1. 创建指向 `sample-mysql` 的任务，`target_table=orders_clean`
2. `POST .../run` 后 `analytics-postgres`：`SELECT COUNT(*) FROM orders_clean > 0`
3. 故意错误密码 → 历史 `failed`，`error_message` 中文可读，`trace_id` 非空
4. 修正后重跑 → `succeeded`

---

### 8.4 ETL-001 — 清洗规则引擎

#### 8.4.1 规则 JSON Schema（`etl_rules.py`）

`EtlRule` discriminated union（`type` 字段）：

| type | 字段 | 行为 |
|------|------|------|
| `rename_column` | `from`, `to` | 列重命名 |
| `cast_type` | `column`, `to` | `to` ∈ `integer`/`float`/`string`/`boolean`；失败置 NULL |
| `fill_null` | `column`, `value` | 空值填充 |
| `filter_rows` | `column`, `op`, `value` | `op` ∈ `eq`/`ne`/`is_null`/`is_not_null`；不满足则丢弃行 |

规则按数组顺序应用。

#### 8.4.2 挂载点

`sync_executor` 在 **步骤 3**（读源后、写托管库前）调用 `apply_rules(rows: list[dict], rules: list[EtlRule]) -> list[dict]`。

#### 8.4.3 样例验收配置

对 `dirty_orders` 推荐规则链：

1. `rename_column`: `product_name` → `product`
2. `cast_type`: `amount` → `float`
3. `fill_null`: `note` → `"无备注"`
4. `filter_rows`: `status` `ne` `deleted`

期望 `orders_clean` 无 `deleted` 行，`amount` 可聚合，`note` 无 NULL。

---

### 8.5 DATA-003 — Admin 配置台页面

遵循 `layout.md` 单应用 `/admin/*` 壳层；路由 IA：

```
/admin/ingestion/sync-jobs              # 列表
/admin/ingestion/sync-jobs/new            # 创建
/admin/ingestion/sync-jobs/:id/edit       # 编辑
/admin/ingestion/sync-jobs/:id/history    # 运行历史
/admin/ingestion/sync-jobs/:id/etl-rules  # 清洗规则
```

#### 8.5.1 数据层（M1B 最小）

- 新建 `fe/src/lib/api.ts`：`apiFetch(path, options)` → 解析 envelope；`Authorization: Bearer dev`
- 页面内 `useState` + `useEffect` 拉取；提交后手动 refetch（不引入 TanStack Query）

#### 8.5.2 页面职责

| 页面 | 主操作 | 次操作 |
|------|--------|--------|
| SyncJobsPage | 「新建任务」 | 行内「运行」「历史」「规则」「编辑」 |
| SyncJobFormPage | 「保存」 | 「取消」回列表 |
| SyncJobHistoryPage | — | 「返回」；失败行展示 `error_message` + 复制 `trace_id`（管理员） |
| EtlRulesPage | 「保存规则」 | JSON 预览；规则类型用 Select 增行 |

---

## 9. UI 设计交付

### 9.1 ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读）；布局模式参考 `references/layout-patterns/crud-flow.md`。

### 9.2 页面信息架构

- **导航层级**：Admin 壳层 → 数据接入（本期无侧栏项，面包屑「管理 / 数据接入 / 同步任务」）
- **主内容区**：`max-w-(--breakpoint-2xl)` 内；列表页全宽表格；表单页 `max-w-2xl` 卡片
- **密度**：`space-y-6` 区块；表格 `text-theme-sm`；表单 `gap-4`

**状态**：

| 态 | 表现 |
|----|------|
| 加载 | 表格区 `Skeleton` 5 行；表单按钮 `disabled` |
| 空 | 居中「暂无同步任务」+ primary「新建任务」 |
| 错误 | `Alert` destructive +「重试」 |
| 权限 | M1B 无 RBAC 细分；401 重定向提示「请使用开发令牌」 |

### 9.3 视觉层级

- **主操作**：`Button variant="primary"` — 新建、保存、运行
- **次操作**：`outline` — 取消、返回、编辑
- **危险**：删除任务 `AlertDialog` + destructive
- **承载**：列表用 `rounded-xl border bg-white dark:bg-gray-900 shadow-theme-sm` 卡片包表格；表单同源卡片；历史用带状态 `Badge` 的表格

### 9.4 组件映射

| 需求 | 复用 | 需补封装 |
|------|------|----------|
| 按钮/输入/标签 | `@/components/ui/button|input|label` | — |
| 表格 | — | `SyncJobsTable` 页内组件或 `components/admin/DataTable.tsx`（≥2 页则上浮） |
| 状态徽章 | — | skill `badge.tsx` 模板 → `ui/badge.tsx` |
| 对话框 | — | skill `alert-dialog.tsx` |
| 下拉 | — | skill `select.tsx`（源类型、cron 预设） |
| 加载 | `ui/skeleton`（若缺则补） | — |
| 壳层 | `AdminLayout` | — |

**禁止**：页面内自定义 primary 色按钮、手写 `<table>` 无 token 样式。

### 9.5 Token 与密度

- 语义色：`text-gray-900 dark:text-white` 标题；`text-gray-500` 辅助
- 边框：`border-gray-200 dark:border-gray-800`
- 成功/失败运行：`success-500` / `error-500` Badge
- 间距：卡片 `p-6`；表单元 `space-y-4`
- 图标：`lucide-react` `size-5`（Play 运行、History、Settings 规则）

### 9.6 响应式与可访问性

- **桌面**：表格全列；工具栏横排
- **窄屏**：表格横向滚动 `overflow-x-auto`；工具栏纵排；侧栏已有 mobile backdrop
- **焦点**：表单控件 `focus-visible:ring-brand-500`；Dialog 焦点陷阱
- **aria**：运行按钮 `aria-label="手动运行同步"`；状态 Badge 含文字不单靠颜色
- **长文本**：`error_message` `max-w-md truncate` + `title` 全文

### 9.7 视觉 QA 清单（P4）

- [ ] Desktop 1280px：列表、表单、历史、规则四页截图
- [ ] Mobile 390px：列表横向滚动无重叠；主按钮可点
- [ ] Light/Dark：卡片背景与边框对比足够
- [ ] 状态：空列表、加载 skeleton、API 错误 Alert、运行中 disabled
- [ ] `pnpm build` + `pnpm check:design` exit 0

---

## 10. 测试策略（P3/P4 指引）

| 层级 | 范围 | 方式 |
|------|------|------|
| 单测 | `etl_rules.apply_rules` | 四类规则 + 脏数据 fixture |
| 单测 | `encrypt_password` 往返 | Fernet |
| API | CRUD + 401 | TestClient + mock executor |
| 集成 | compose 全链路 | P4 手验脚本（非 CI 阻断） |

不在本轮要求新增 docker 服务进 GitHub Actions。

---

## 11. 文档同步（P5 预览，本轮不执行）

| 变更 | 文档 |
|------|------|
| §9 API 已实现 | `docs/api/README.md` |
| ingestion 域落地 | `prd/F16-DATA.md` 勾选（DATA-004~003） |
| plan M1B 勾选 | `plan.md` 五行 `[x]`（P5 only） |
| 域附录 | `services/ingestion.md` **留 DATA-005** |

---

## 12. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 文件清单未超 20（含 4 个 fe 页面 + routes；docker init 为基础设施）
- [x] 无 TBD/TODO 占位
- [x] UI 设计交付节完整
- [x] 非目标明确 DATA-005 / M3 / nav
- [x] 8 维薄弱项逐 PRD 对策
- [x] 未写生产代码
