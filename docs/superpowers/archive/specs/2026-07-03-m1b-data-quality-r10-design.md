# M1B DATA/ETL companion 质量推分 r10 设计 — DATA-003 / DATA-002 / ETL-001 / DATA-004 / DATA-001

```yaml
date: 2026-07-03
milestone: M1B
round_target: docs/superpowers/evolution/2026-07-03-round-target-r10.md
prd_ids: [DATA-003, DATA-002, ETL-001, DATA-004, DATA-001]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | 托管分析库与配置项 | DATA-004 | 1 | 用户价值 **74%**；性能 **80%** | 托管库 URL / Fernet / 连接池路径在 CI 可捕获 |
| 2 | 同步任务模型与 API | DATA-001 | 2 | 用户价值 **76%**；性能 **82%** | 非法输入、并发 run、OpenAPI 契约与触发耗时可度量 |
| 3 | 同步执行器（定时/手动） | DATA-002 | 3 | 用户价值 **78%**；性能 **78%** | 大表分批、调度触发、失败重试与 traceId 行为可预期 |
| 4 | 清洗规则引擎（轻量） | ETL-001 | 4 | 用户价值 **74%**；性能 **78%**；安全性 **86%** | 脏数据 / 恶意规则在 CI 有明确反馈 |
| 5 | Admin 配置台页面 | DATA-003 | 5 | 性能 **76%**；交互体验 **86%** | 运行历史与清洗规则表单更流畅；错误指引更明确 |

**依赖链**：DATA-004 配置与凭证基线 → DATA-001 API 边界与性能 smoke → DATA-002 executor/scheduler 补强 → ETL-001 规则边界与 executor 管线 → DATA-003 FE vitest 收尾 → 全量验证。

**上轮已交付（本轮不重复基础用例）**：

- r8：`SyncJobsPage` 删除 `AlertDialog` + run 防重；`Settings.analytics_database_url` 校验；`POST .../run` 409 并发守卫；vitest T-ING-06~15（14 项）；`test_ingestion_api` T-D01-09~13；`test_sync_executor` T-D02-01~11；`test_scheduler` T-D02-08/12；`test_etl_rules` T-ETL-01~08；`test_ingestion_config` T-D04-01~10
- r9：BOOT rotation 纯测试推分（本轮 intentionally 跳过 BOOT-*）

**STUCK 标注**：DATA-003 连续 4 轮、DATA-002 连续 4 轮、ETL-001/DATA-004/DATA-001 连续 3 轮未过 90。本轮以**测试补强 + DATA-003 最小 UX 防重**为主，若 P5 仍 <90 建议人工 `create-evolution-plan` 复核 M1B Admin UI 验收阈值。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `fe/src/pages/admin/ingestion/` | 4 页 + `ingestion.smoke.test.tsx` **14 项**（T-ING-06~15，**缺 T-ING-14**）；`routes.smoke` 已含 history/etl-rules/edit 嵌套路由 |
| `SyncJobHistoryPage` | `limit=20` 硬编码；有 error/empty/loading；**无** history error 态 vitest；**无** limit 查询断言 |
| `SyncJobFormPage` / `EtlRulesPage` | `submitting`/`saving` 仅驱动 Button `loading`；**无** handler 入口防重；**无**双次提交 vitest |
| `backend/app/ingestion/sync_executor.py` | 1 次重试、`INGESTION_MAX_ROWS` LIMIT、`pool_pre_ping=True`；11 项单测已绿 |
| `backend/app/ingestion/scheduler.py` | enabled+cron 注册；disabled 跳过；2 项单测 |
| `backend/app/ingestion/etl_rules.py` | 4 类规则 + 未知 type 忽略；13 项单测含恶意嵌套 JSON |
| `tests/test_ingestion_api.py` | 13 项；**缺** GET/DELETE 404、runs `limit` 参数、OpenAPI schema 细项、run 耗时 smoke |
| `tests/test_ingestion_config.py` | 8 项；**缺** `create_engine` `pool_pre_ping` 路径断言 |
| `tests/test_ingestion_l1_smoke.py` | 3 项 mock L1；**缺**响应耗时预算 |
| `tests/conftest.py` | 已有 `analytics_sqlite`、`integration_env`（compose skip） |

**范围框定模块**（3）：`backend/app/ingestion/`、`fe/src/pages/admin/ingestion/`、`tests/`（含 `fe/` vitest）。

**真理源优先级**：`round-target` > `prd/F16-DATA.md` > r8 `m1b-quality-r8-design.md`。

**本轮性质**：质量推分（测试为主 + DATA-003 最小 UX 防重），非新功能立项。允许框定内 **≤6 行/页** 的防重 guard，禁止扩大 M1B 能力边界。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `tests/test_ingestion_config.py` | DATA-004 | 扩展 T-D04-11~12 |
| `tests/test_ingestion_models_crypto.py` | DATA-004 | 扩展 T-D04-13 |
| `tests/test_ingestion_api.py` | DATA-001 | 扩展 T-D01-14~18 |
| `tests/test_sync_executor.py` | DATA-002 | 扩展 T-D02-13~14 |
| `tests/test_scheduler.py` | DATA-002 | 扩展 T-D02-15 |
| `tests/test_ingestion_l1_smoke.py` | DATA-002 | 扩展 T-L1-04（耗时预算） |
| `tests/test_etl_rules.py` | ETL-001 | 扩展 T-ETL-09~12 |
| `fe/src/pages/admin/ingestion/SyncJobFormPage.tsx` | DATA-003 | 最小：`handleSubmit` 入口 `if (submitting) return` |
| `fe/src/pages/admin/ingestion/EtlRulesPage.tsx` | DATA-003 | 最小：`handleSave` 入口 `if (saving) return` |
| `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx` | DATA-003 | 扩展 T-ING-14、T-ING-16~19 |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/ingestion/sync_executor.py` | 重试、LIMIT、pool_pre_ping、apply_rules 管线 |
| `backend/app/ingestion/scheduler.py` | cron 注册与 disabled 跳过 |
| `backend/app/ingestion/etl_rules.py` | 规则类型与 cast/filter 边界 |
| `backend/app/ingestion/models.py` | Fernet 加解密、元表模型 |
| `backend/app/api/v1/ingestion/sync.py` | CRUD、409 run 守卫、runs limit |
| `backend/app/core/config.py` | `analytics_database_url` 校验器 |
| `fe/src/pages/admin/ingestion/SyncJobsPage.tsx` | run 防重、删除确认（r8 已交付） |
| `fe/src/pages/admin/ingestion/SyncJobHistoryPage.tsx` | history 表格、error 态、limit=20 |
| `fe/src/routes.smoke.test.tsx` | 嵌套路由 smoke（不重复扩展） |
| `tests/conftest.py` | `analytics_sqlite`、`auth_headers` |
| `tests/test_ingestion_e2e.py` | integration marker（保持 skip，不强制 compose） |
| `docs/ui/layout.md` | Admin 内容区 `max-w-2xl` / 表格 overflow |

**文件计数**：修改 10 = **10 ≤ 20**（无新建测试文件；逻辑拆入既有模块）。

## 4. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- BOOT-* rotation（r9 刚推分；本轮 pivot DATA）
- DATA-005（88.4，r8 已触及）
- PostgreSQL **源库** executor 实现；L2 `dataSourceId` + SQL（M3/M4）
- Playwright / 真浏览器截图自动化（P4 人工 QA 清单承担）
- CI 强制 docker compose 跑 `test_ingestion_e2e`（保持 integration skip）
- TanStack Query 迁移、`mapApiError` 全量数据层重构
- 运行历史 UI 分页控件（仅测 API `limit` 与 error 态，不加「加载更多」）
- 重复 T-ING-06~13、T-D01-09~13、T-D02-01~11、T-ETL-01~08、T-D04-01~10 已有断言

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 | 可测验收信号 |
|--------|------------------|--------------|--------------|
| DATA-004 | 用户价值 **74%**；性能 **80%** | mock `create_engine` 断言 `pool_pre_ping`；`analytics_sqlite` fixture 绑定 smoke；Fernet 启用路径 roundtrip | T-D04-11~13 全绿 |
| DATA-001 | 用户价值 **76%**；性能 **82%** | 404 全分支；runs `limit`；OpenAPI operation 存在性；mock `run_job` 触发耗时 <1.0s | T-D01-14~18 全绿 |
| DATA-002 | 用户价值 **78%**；性能 **78%** | 大批量 `apply_rules` 耗时预算；scheduler `remove_job` 陈旧任务；L1 mock 端到端耗时 | T-D02-13~15、T-L1-04 全绿 |
| ETL-001 | 用户价值 **74%**；性能 **78%**；安全性 **86%** | 未知 filter op、非法 cast `to`、空规则链、全行过滤后写空集 executor 路径 | T-ETL-09~12 全绿 |
| DATA-003 | 性能 **76%**；交互体验 **86%** | 表单/规则保存防重 guard + vitest；history error/limit；可选首屏渲染预算 | vitest ≥18 项；`check:design` 绿 |

**P5 重评预期**：五项加权总分由 85.4–88.1 向 **≥90** 迈进（具体分值由 P5 评分器计算，设计不预设数值）。

## 6. 方案比选（摘要）

### 6.1 DATA-003：表单防重复提交

| 方案 | 说明 | 结论 |
|------|------|------|
| A handler 入口 `if (submitting/saving) return` + Button `loading` | 双保险；≤3 行/页 | **采用** |
| B 仅 vitest mock 断言单次 POST | 无生产 guard，双击仍可能双发 | 否决（作测试补充） |
| C `Idempotency-Key` header | M1B 过重 | 否决 |

### 6.2 DATA-003：运行历史「分页」

| 方案 | 说明 | 结论 |
|------|------|------|
| A vitest 断言 `apiFetch` URL 含 `limit=20`；补 history error 态 + 重试 | 对齐现有 API；零 UI 分页控件 | **采用**（T-ING-14/16） |
| B 新增「加载更多」按钮与 offset 参数 | 超 M1B 范围 | 否决 |
| C 前端虚拟滚动 | 过度工程 | 否决 |

### 6.3 DATA-002：性能 smoke 载体

| 方案 | 说明 | 结论 |
|------|------|------|
| A `time.perf_counter()` 包裹 5000 行 `apply_rules` / mock L1 全流程，断言 <2.0s | CI 友好、可重复 | **采用**（T-D02-13、T-L1-04） |
| B docker compose 实测大表同步 | flaky、超范围 | 否决 |
| C 仅计数不断言耗时 | 无法推性能维 | 否决 |

### 6.4 DATA-004：连接池路径

| 方案 | 说明 | 结论 |
|------|------|------|
| A `@patch("sqlalchemy.create_engine")` 断言 `pool_pre_ping=True` | 零 DB 依赖 | **采用**（T-D04-11） |
| B 实测连接超时 | 需 compose、flaky | 否决 |
| C 改 executor 增连接池参数 | 生产变更非必要 | 否决 |

### 6.5 DATA-001：run 触发性能

| 方案 | 说明 | 结论 |
|------|------|------|
| A mock `run_job` + `BackgroundTasks` 同步执行路径，`perf_counter` <1.0s | 测 API 层开销 | **采用**（T-D01-18） |
| B 含真实 executor 全链路 | 混入 DATA-002 域 | 否决 |
| C 无耗时断言 | 无法推性能维 | 否决 |

### 6.6 ETL-001：安全性边界

| 方案 | 说明 | 结论 |
|------|------|------|
| A 单测：未知 `op`、非法 `to`、非 list rules（API 422 或 ignore）+ executor 全过滤空写 | 覆盖 plan §ETL-001 脏数据边界 | **采用**（T-ETL-09~12） |
| B 引入 JSON Schema 校验器库 | 新依赖 | 否决 |
| C 仅文档记录 | 无法推分 | 否决 |

## 7. 子项详细设计

### 7.1 DATA-004 — 扩展 `tests/test_ingestion_config.py` 与 `tests/test_ingestion_models_crypto.py`

**保留** T-D04-01~10。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D04-11 | `_write_analytics` 使用 `pool_pre_ping` | `@patch("sqlalchemy.create_engine")`；调用 kwargs 含 `pool_pre_ping=True` |
| T-D04-12 | `analytics_sqlite` fixture URL 可被 Settings 加载 | conftest fixture 返回 `sqlite+pysqlite://...`；`Settings` 实例化不抛错（或按 config 校验策略 skip sqlite 若不允许） |
| T-D04-13 | Fernet key 启用时 encrypt 密文可 decrypt | 使用 `CREDENTIAL_FERNET_KEY` env；`encrypt_password` ≠ 明文；`decrypt_password` roundtrip |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_ingestion_config.py tests/test_ingestion_models_crypto.py -v` 全绿

### 7.2 DATA-001 — 扩展 `tests/test_ingestion_api.py`

**保留** T-D01-01~13（含 409、OpenAPI paths）。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D01-14 | GET/DELETE 不存在 job → 404 `NOT_FOUND` | 随机 `uuid`；`detail.code == NOT_FOUND` |
| T-D01-15 | `GET .../runs?limit=5` 尊重 limit | seed 6 条 run；响应 `len(items) <= 5` |
| T-D01-16 | 已有 running run 时第二次 POST run → 409 | 复用 T-D01-11 种子；连续两次 POST 第二次 409 |
| T-D01-17 | OpenAPI `ingestion` tag 与 POST run operation | `openapi.json` paths 含 `post`；`tags` 含 `ingestion` |
| T-D01-18 | 手动 run 接受响应耗时 smoke | mock `run_job`；`perf_counter` 包裹 POST；elapsed < 1.0s |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_ingestion_api.py -v` 全绿（≥18 项）

### 7.3 DATA-002 — 扩展 executor / scheduler / L1 smoke

**`tests/test_sync_executor.py` 扩展**（保留 T-D02-01~11）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D02-13 | 5000 行经 `apply_rules`（空规则）耗时预算 | `perf_counter` < 2.0s；输出行数 == 5000 |
| T-D02-14 | 过滤规则移除全部行后 `_write_analytics` 收到 `[]` | mock fetch 2 行 + filter 全剔除；`rows_synced == 0`；write 参数 `[]` |

**`tests/test_scheduler.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-D02-15 | `refresh_all_jobs` 移除已注销 job | `get_jobs` 返回陈旧 id → `remove_job` 被调用 |

**`tests/test_ingestion_l1_smoke.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-L1-04 | mock L1 全流程耗时预算 | 复用 success 路径；create+rules+run+history `perf_counter` < 3.0s |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_sync_executor.py tests/test_scheduler.py tests/test_ingestion_l1_smoke.py -v` 全绿

### 7.4 ETL-001 — 扩展 `tests/test_etl_rules.py` + executor 管线

**保留** T-ETL-01~08。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-ETL-09 | `filter_rows` 未知 `op` 默认保留行 | `op: "regex"` → 行不被过滤掉 |
| T-ETL-10 | `cast_type` 未知 `to` 回退为 `str()` | `to: "decimal"` → `str(value)` |
| T-ETL-11 | 空 `rules: []` 不改变行集 | 输入 2 行 → 输出 2 行同内容 |
| T-ETL-12 | executor 脏数据链：cast 失败变 None + fill_null 补救 | mock fetch 含 `"amount": "bad"`；write 收到 `amount is None` 或 fill 后值 |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_etl_rules.py -v` 全绿（≥16 项）
- [ ] T-ETL-08（executor apply_rules 管线）保持绿

### 7.5 DATA-003 — 最小 UX + vitest 扩展

**生产变更（各 ≤3 行）**：

| 文件 | 变更 |
|------|------|
| `SyncJobFormPage.tsx` | `handleSubmit` 首行：`if (submitting) return;` |
| `EtlRulesPage.tsx` | `handleSave` 首行：`if (saving) return;` |

**`ingestion.smoke.test.tsx` 扩展**（保留 T-ING-06~15）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-ING-14 | `SyncJobHistoryPage_error_state` | mock reject；展示错误文案 + `重试` 按钮；click 重试再次 `apiFetch` |
| T-ING-16 | history 请求带 `limit=20` | mock resolve；断言 URL 匹配 `/runs?limit=20` |
| T-ING-17 | `EtlRulesPage_prevents_double_save` | 保存 pending 时双 click `保存规则`；PUT 仅 1 次 |
| T-ING-18 | `SyncJobFormPage_prevents_double_submit` | 创建 pending 时双 click `创建`；POST 仅 1 次 |
| T-ING-19 | 列表首屏渲染预算（可选） | `perf_counter` 包裹 `findByText`；mock 10 条 job；elapsed < 500ms |

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test` 全绿（ingestion smoke ≥19 项）
- [ ] `cd fe && pnpm build && pnpm run check:design` 全绿

## 8. UI 设计交付（DATA-003）

### ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读取；评审引用 `references/ui-elements-empty-error-loading-review-checklist.md`、`references/async-state-review-checklist.md`、`references/form-validation-logic-review-checklist.md`）

### 页面信息架构

- **导航层级**：`/admin` → `AdminLayout` → `/admin/ingestion/sync-jobs` → 子页 `.../new`、`.../:id/edit`、`.../:id/history`、`.../:id/etl-rules`（`layout.md` §Admin 数据接入）
- **主内容区**：表单/规则页 `mx-auto max-w-2xl`；列表/历史 `rounded-xl border` 卡片 + 表格式 `overflow-x-auto`（`min-w-[720px]`）
- **空/加载/错误/权限态**：
  - 列表：`暂无同步任务` / Skeleton 5 行 / ErrorBanner + `重试`
  - 历史：`暂无运行记录` / Skeleton / error 条 + `重试`（T-ING-14 补齐）
  - 规则：默认空规则行 / Skeleton / error 条 / `规则已保存` success 条
  - 权限：本轮不测（M7 扩展）

### 视觉层级

- **主操作**：`创建`/`保存`/`保存规则` — `Button variant="primary"` + `loading`
- **次操作**：`取消`（outline Link）、`刷新`（history）、`添加规则`（outline）、行内 `手动运行同步`/`删除任务`（ghost/icon）
- **承载关系**：面包屑 `text-theme-sm text-gray-500`；数据表在 `bg-white shadow-theme-sm` 卡片内；错误用 `border-error-500 bg-error-50` Alert 风格条

### 组件映射

| 区域 | 复用组件 | 禁止 |
|------|----------|------|
| 列表 | `Button`、`IconButton`、`Badge`、`AlertDialog`、`Skeleton` | 页面内手写 `<table>` 样式漂移 |
| 表单 | `Input`、`Label`、`Select`、`Button` | 原生 `<button>`/`<input>` |
| 规则 | `Select`、`Input`、`IconButton`（删除规则） | 局部重画 Select 浮层 |
| 历史 | `Badge`、`IconButton`（复制 trace）、`Skeleton` | 自定义状态色 hex |

### Token 与密度

- 语义色：`brand-500` 链接 hover；`error-*`/`success-*` 反馈条；`gray-200/800` 边框
- 密度：`space-y-6` 页间距；表头 `px-6 py-4`；表单 `p-6`
- 圆角：`rounded-xl` 卡片、`rounded-lg` 规则子卡
- 字号：`text-theme-xl` 标题、`text-theme-sm` 正文、`font-mono text-xs` traceId
- 图标：`lucide-react` `size-3.5`/`size-4`；与 Skill `size-4` 基准一致
- **门禁**：`pnpm run check:design` 禁止裸 hex

### 响应式与可访问性

- **desktop（1400）**：表格横向滚动；主操作右对齐或 `flex gap-3`
- **mobile（375）**：smoke 覆盖 error 态；表单 `sm:grid-cols-2` 折叠为单列
- **键盘焦点**：Button/Input 使用 shadcn 默认 `focus-visible`；复制 trace `aria-label="复制 Trace ID"`
- **长文本**：`error_message` `max-w-xs truncate` + `title`；traceId `max-w-[120px] truncate`

### 视觉 QA 清单（P3/P4）

- [ ] **desktop 1400**：sync-jobs 列表（有数据）+ history 失败行各 1 张；检查表格对齐、Badge 色、trace 截断
- [ ] **mobile 375**：history error 态 + 表单创建各 1 张；检查 error 条不挤压主按钮
- [ ] **状态**：loading Skeleton、empty 文案、error 重试、saved success 绿条
- [ ] **防重**：保存/创建 loading 中按钮 disabled（T-ING-17/18）
- [ ] **色彩漂移**：`check:design` 全绿
- [ ] **文本溢出**：长 `error_message` 省略号 + hover title

## 9. 验证命令（P4 等价）

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

## 10. Spec self-review

- [x] 覆盖 round-target 五项，无 TBD/TODO
- [x] 未超出范围框定（10 修改文件，无新建生产模块）
- [x] UI 设计交付完整；`ui_design_skill` 已登记
- [x] 与 PRD 8 维薄弱项逐条对齐
- [x] 禁止写生产代码（设计阶段仅 spec；P3 允许 DATA-003 ≤6 行防重）
