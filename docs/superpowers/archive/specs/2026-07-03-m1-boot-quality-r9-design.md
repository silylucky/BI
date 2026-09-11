# M1 BOOT 质量推分 r9 设计 — BOOT-005 / BOOT-006 / BOOT-001 / BOOT-004 / BOOT-002

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target-r9.md
prd_ids: [BOOT-005, BOOT-006, BOOT-001, BOOT-004, BOOT-002]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | Alembic 降级路径与迁移配置安全负例 | BOOT-005 | 1 | 用户价值 **76%**；性能 **78%** | 元库升级/降级 SQL 可预期；密钥不出现在迁移 stdout |
| 2 | conftest/CI 环境契约与 fixture 稳定性 | BOOT-006 | 2 | 性能 **78%**；安全性 **80%** | PR 合并前 backend+frontend 门禁完整；fixture 无状态泄漏 |
| 3 | 健康检查启动耗时与公开/受保护路径边界 | BOOT-001 | 3 | 用户价值 **78%**；安全性 **82%** | 冷启动可感知；OpenAPI 公开而业务 API 受保护 |
| 4 | Settings 枚举/边界 + 日志 traceId 全链路 | BOOT-004 | 4 | 性能 **82%**；安全性 **84%** | 配置错配合并前失败；request_finished 日志可追踪 |
| 5 | Admin 壳层响应式折叠与 design 门禁回归 | BOOT-002 | 5 | 安全性 **80%**；性能 **82%** | 多 viewport 布局稳定；Token 门禁持续有效 |

**依赖链**：子项 1、3、4 各自扩展 `tests/`；子项 5 扩展 `fe/` vitest；子项 2 收尾（`conftest` 供 3–4 复用；CI 核对拾取）。

**上轮已交付（本轮不重复基础用例）**：

- `tests/test_migrations.py` T-MIG-01~20（Settings 绑定、revision 链、offline/online、`--sql` upgrade）
- `tests/test_health.py` T-HLT-01~15（CORS 预检/非法 Origin、`/redoc`、OpenAPI paths、ingestion 路由登记）
- `tests/test_config.py` T-CFG-01~03；`tests/test_trace.py` T-TRC-01~10（traceId 生成/透传、日志脱敏、`LOG_LEVEL` 边界）
- `tests/conftest.py` + `tests/test_conftest_contract.py` T-CFT-01~05
- `fe/` vitest T-FE-01~19、T-FE-DG-01~03；CI `pytest -v` + `pnpm test` + build + check:design

**STUCK 标注**：BOOT-005/006 连续 10 轮、BOOT-002 连续 10 轮、BOOT-001/004 连续 9 轮未过 90。本轮**仅增测试与 fixture**，不改生产逻辑。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `tests/test_migrations.py` | 20 项已绿；缺 `downgrade --sql` 用户价值路径、stdout 密钥泄漏负例、模块导入性能预算 |
| `tests/test_health.py` | 15 项；缺启动耗时 smoke、公开 OpenAPI vs 受保护 `/api/v1/me` 成对边界 |
| `tests/test_config.py` | 3 项；缺 `vitalspan_env` 枚举、`credential_fernet_key` 非法值、`query_*` 数值边界 |
| `tests/test_trace.py` | T-TRC-04 **未断言** `request_finished.traceId`（仅 `status_code`）；缺非 hex 入站 trace 行为记录 |
| `tests/conftest.py` | 四类 fixture 已有；缺组合 fixture、development 环境鉴权契约断言 |
| `tests/test_conftest_contract.py` | 5 项；缺 CI env 与 conftest 默认值对齐、连续请求隔离 |
| `.github/workflows/ci.yml` | backend env 三键已设；frontend 三步骤已绿；无显式「新测文件」文档化 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | T-FE-06~16；**无** mobile 375 菜单/Backdrop、**无** desktop 侧栏折叠 margin 契约 |
| `fe/src/routes.smoke.test.tsx` | desktop 1400 为主；缺 mobile `/admin` 壳层 smoke |
| `backend/app/core/config.py` | `vitalspan_env` Literal 三值；`credential_fernet_key` Fernet 校验；`database_url` 无格式校验 |
| `fe/src/context/sidebar-context.tsx` | XL=1280；mobile 强制 `isExpanded=false`；`toggleSidebar` 折叠桌面侧栏 |

**范围框定模块**（3）：`tests/`、`backend/app/`（core · auth · migrations，只读参照）、`fe/`（BOOT-002 smoke）。

**真理源优先级**：`round-target` > `plan.md` §M1 > `prd/F01-BOOT.md` > `backend-fastapi.mdc` / `fe-ui.mdc`。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `tests/test_migrations.py` | BOOT-005 | 扩展 T-MIG-21~24 |
| `tests/test_health.py` | BOOT-001 | 扩展 T-HLT-16~18 |
| `tests/test_config.py` | BOOT-004 | 扩展 T-CFG-04~07 |
| `tests/test_trace.py` | BOOT-004 | 扩展 T-TRC-11~12；补强 T-TRC-04 断言 |
| `tests/conftest.py` | BOOT-006 | 扩展 `combined_auth_trace_headers` fixture；更新契约注释 |
| `tests/test_conftest_contract.py` | BOOT-006 | 扩展 T-CFT-06~08 |
| `tests/test_ci_env_contract.py` | BOOT-006 | **新建**：CI env 键与 conftest 默认值对齐 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | BOOT-002 | 扩展 T-FE-20~22（viewport + 折叠 + Backdrop） |
| `fe/src/routes.smoke.test.tsx` | BOOT-002 | 扩展 T-FE-23 mobile `/admin` smoke |

**只读参照（不修改生产代码）**：

| 路径 | 用途 |
|------|------|
| `backend/migrations/env.py` | URL 绑定链 |
| `backend/app/core/config.py` | Settings 字段与校验器 |
| `backend/app/core/middleware.py` | TraceIdMiddleware 入站 header 逻辑 |
| `backend/app/core/logging.py` | JsonFormatter traceId 注入 |
| `backend/app/main.py` | CORS、lifespan、OpenAPI |
| `backend/app/auth/middleware.py` | PUBLIC_PATHS |
| `fe/src/components/layout/backdrop.tsx` | mobile 遮罩 `bg-gray-900/50` |
| `fe/src/components/layout/app-header.tsx` | `aria-label="打开菜单"` 折叠触发 |
| `fe/src/context/sidebar-context.tsx` | XL_BREAKPOINT=1280 |
| `fe/scripts/check-design.mjs` | HEX/RGB 扫描（T-FE-DG 保持绿） |
| `.github/workflows/ci.yml` | env 与 job 命令等价性 |
| `docs/ui/layout.md` | 壳层 290px/90px、内容区 max-w 契约 |

**文件计数**：新建 1 + 修改 8 = **9 文件**（只读 12，合计框定 21；实施时**不新建**第 10 个生产文件，CI 仅核对不改结构 → 有效修改 **9 ≤ 20**）。

## 4. 非目标（明确不做）

- 修改 `backend/app/core/config.py`、`logging.py`、`migrations/env.py`、`main.py`、`AdminLayout.tsx` 等生产逻辑
- 重复 T-MIG-01~20、T-HLT-01~15、T-CFG-01~03、T-TRC-01~10、T-CFT-01~05、T-FE-01~19、T-FE-DG-01~03 已有断言
- CI 内 docker postgres 或 `alembic upgrade`（非 `--sql`）
- Playwright / 浏览器截图自动化（P4 人工 QA 清单承担）
- BOOT-003 鉴权矩阵扩展、DATA-* / ETL-001 / 远期 META/DESIGN/CONN
- `docs/automate/goal.md` 修订；`plan.md` 结构修改
- 为测试便利新增 `data-testid` 或改动壳层视觉
- `analytics_database_url` 校验扩展（属 DATA-004，r8 已交付）

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 |
|--------|------------------|--------------|
| BOOT-005 | 用户价值 **76%**；性能 **78%** | `downgrade --sql` 可预期路径；stdout 无 `SECRET_KEY`；env.py 绑定链端到端；导入耗时预算 |
| BOOT-006 | 性能 **78%**；安全性 **80%** | CI env 契约测试；组合 fixture；连续请求无状态泄漏；development 鉴权 token 契约 |
| BOOT-001 | 用户价值 **78%**；安全性 **82%** | 首请求耗时 smoke；OpenAPI 公开 + `/api/v1/me` 401 成对；GET 非法 Origin 无 ACAO 回归 |
| BOOT-004 | 性能 **82%**；安全性 **84%** | Settings 枚举/ Fernet/数值边界；`request_finished.traceId` 补齐；非 hex 入站 trace 文档化 |
| BOOT-002 | 安全性 **80%**；性能 **82%** | mobile 375 菜单+Backdrop；desktop 折叠 margin；vitest 渲染预算 smoke |

**P5 重评预期**：五项加权总分由 85.9–87.7 向 **≥90** 迈进（具体分值由 P5 评分器计算，设计不预设数值）。

## 6. 方案比选（摘要）

### 6.1 BOOT-005：降级路径验证

| 方案 | 说明 | 结论 |
|------|------|------|
| A `alembic downgrade base --sql` 子进程，断言 returncode=0 且含 `DROP`/`ingestion` | 用户可感知降级链；无 DB | **采用**（T-MIG-21） |
| B docker 实测 downgrade | 超范围、慢 | 否决 |
| C 仅测 Python `downgrade()` noop | 与 T-MIG-12 重复 | 否决 |

### 6.2 BOOT-005：stdout 安全

| 方案 | 说明 | 结论 |
|------|------|------|
| A 断言 `upgrade head --sql` stdout 不含 `SECRET_KEY` env 值与 `ci-test-secret` 子串 | 零生产改动 | **采用**（T-MIG-22） |
| B 改 env.py 脱敏 URL | 生产变更 | 否决 |

### 6.3 BOOT-001：启动耗时

| 方案 | 说明 | 结论 |
|------|------|------|
| A 单测内 `time.perf_counter()` 包裹首次 `client.get("/health")`，断言 < 2.0s | 轻量 smoke；CI 友好 | **采用**（T-HLT-16） |
| B 子进程冷启动 uvicorn | flaky、慢 | 否决 |
| C 硬编码 P95 统计 | 需多样本，超 smoke | 否决 |

### 6.4 BOOT-004：finished 日志 traceId

| 方案 | 说明 | 结论 |
|------|------|------|
| A 补强 T-TRC-04：`finished` 行 `traceId == response.headers["X-Trace-Id"]` | 对齐 JsonFormatter + trace_id_var | **采用**（T-TRC-11 别名或内联补强） |
| B 改 middleware 双写 traceId 到 extra | 生产变更 | 否决 |

### 6.5 BOOT-002：响应式 smoke

| 方案 | 说明 | 结论 |
|------|------|------|
| A `innerWidth` 375 + `fireEvent.click(打开菜单)` + 断言 `bg-gray-900/50` Backdrop | 对齐 layout.md mobile 抽屉 | **采用**（T-FE-20） |
| B Playwright 真机截图 | 超范围 | 否决 |
| C 仅测 className 字符串不含交互 | 覆盖不足 | 否决 |

### 6.6 BOOT-006：CI 契约

| 方案 | 说明 | 结论 |
|------|------|------|
| A 新建 `test_ci_env_contract.py` 解析 `ci.yml` 与 conftest 默认 env | 可测试、无 workflow 结构变更 | **采用** |
| B 改 ci.yml 增显式 pytest 文件列表 | 易漂移 | 否决 |

## 7. 子项详细设计

### 7.1 BOOT-005 — 扩展 `tests/test_migrations.py`

**保留** T-MIG-01~20。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-MIG-21 | `alembic downgrade base --sql` 子进程 | `returncode == 0`；stdout 含 `ingestion_sync_jobs` 相关 DROP 或 downgrade 标记 |
| T-MIG-22 | upgrade `--sql` stdout 不含密钥 | stdout 不含 `os.environ["SECRET_KEY"]` 全文及 `ci-test-secret-key` 子串 |
| T-MIG-23 | Settings → env.py 绑定端到端 | 同一 `DATABASE_URL` monkeypatch 下 `get_settings().database_url` 等于 env.py `set_main_option` 第二参数 |
| T-MIG-24 | 模块导入性能预算 | `importlib.import_module("migrations.env")`（mock offline）全流程 < 2.0s（与 T-MIG-17 互补，测 rebind 路径） |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_migrations.py -v` 全绿（≥24 项）
- [ ] 不执行 `alembic upgrade`（非 `--sql`）

### 7.2 BOOT-006 — conftest、契约测试与 CI 核对

**`tests/conftest.py` 扩展**：

| Fixture | 返回值 | 用途 |
|---------|--------|------|
| `combined_auth_trace_headers` | `auth_headers` ∪ `trace_id_headers` | T-CFT-06；减少复制粘贴 |

契约注释块追加 `combined_auth_trace_headers` 一行。

**`tests/test_conftest_contract.py` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CFT-06 | `combined_auth_trace_headers` 同时满足 me 200 + trace 回显 | `GET /api/v1/me` 200；`GET /health` trace 回显 |
| T-CFT-07 | 连续 client 请求隔离 | 两次 `GET /health` 的 `X-Trace-Id` 均可生成（或第二次可透传不同 id） |
| T-CFT-08 | development 环境允许 dev token | `get_settings().vitalspan_env == "development"`；`auth_headers` 含 `Bearer dev` |

**`tests/test_ci_env_contract.py`（新建）**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CI-01 | `ci.yml` backend job env 含三必填键 | 解析 YAML/文本：`DATABASE_URL`、`SECRET_KEY`、`CREDENTIAL_FERNET_KEY` |
| T-CI-02 | ci env 默认值与 conftest `setdefault` 一致 | 三键字符串相等 |
| T-CI-03 | frontend job 含 test/build/check:design 三步 | 文本包含 `pnpm test`、`pnpm build`、`check:design` |

**`.github/workflows/ci.yml`**：结构不变；P3 实施时若新测已自动拾取则记「已核对」。

**验收标准（可测试）**：

- [ ] `cd backend && ruff check . && pytest -v` 全绿
- [ ] `cd fe && pnpm test && pnpm build && pnpm run check:design` 全绿

### 7.3 BOOT-001 — 扩展 `tests/test_health.py`

**保留** T-HLT-01~15。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-HLT-16 | 首请求启动耗时 smoke | `perf_counter` 包裹首次 `GET /health`；elapsed < 2.0s |
| T-HLT-17 | 公开 OpenAPI vs 受保护 API | `GET /openapi.json` 无 Token → 200；`GET /api/v1/me` 无 Token → 401 |
| T-HLT-18 | GET 非法 Origin 无 ACAO | `GET /health` + `Origin: http://evil.example`；body ok；`access-control-allow-origin` ≠ evil |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_health.py -v` 全绿（≥18 项）

### 7.4 BOOT-004 — 扩展 `tests/test_config.py` 与 `tests/test_trace.py`

**`tests/test_config.py` 扩展**（保留 T-CFG-01~03）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CFG-04 | `vitalspan_env` 非法枚举 | `Settings(..., vitalspan_env="invalid")` → `ValidationError` |
| T-CFG-05 | 非法 `credential_fernet_key` | 非 Fernet base64 → `ValidationError` 含中文提示 |
| T-CFG-06 | `query_default_limit` 非正整数 | `query_default_limit=0` → `ValidationError` |
| T-CFG-07 | `LOG_LEVEL=WARNING` 可加载 | `monkeypatch` + `configure_logging` 不抛异常 |

**`tests/test_trace.py` 扩展**（保留 T-TRC-01~10）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-TRC-11 | `request_finished` 含 traceId | 捕获 JSON；`message=="request_finished"` 行 `traceId == response X-Trace-Id` |
| T-TRC-12 | 非 hex 入站 trace 保留 | `X-Trace-Id: not-hex-but-present`；响应头原样回显（文档化 middleware L16 行为） |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_config.py tests/test_trace.py -v` 全绿

### 7.5 BOOT-002 — 扩展 `fe/` vitest smoke

**`fe/src/layouts/AdminLayout.smoke.test.tsx` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-FE-20 | mobile 375 打开菜单显示 Backdrop | `innerWidth=375`；click `打开菜单`；`document.querySelector('[class*="bg-gray-900/50"]')` 存在 |
| T-FE-21 | desktop 1400 折叠侧栏 margin | `innerWidth=1400`；两次 toggle `打开菜单`；内容区 wrapper 在 `xl:ml-[290px]` 与 `xl:ml-[90px]` 间切换 |
| T-FE-22 | 主题 Token 类名契约 | `main` 含 `max-w-(--breakpoint-2xl)`；`navigation` aria-label `管理端导航` |

**`fe/src/routes.smoke.test.tsx` 扩展**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-FE-23 | mobile `/admin` 壳层可达 | `innerWidth=375`；`VitalSpan` + `main` + `打开菜单` 按钮均存在 |

**共享 helper**：复制 `routes.smoke.test.tsx` 的 `setDesktopViewport`，新增 `setMobileViewport(width=375)` 到各文件或抽取同目录 `test-viewport.ts`（若抽取则计入 1 文件预算；**优先**各文件内联 ≤10 行避免超文件数）。

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test` 全绿
- [ ] `cd fe && pnpm build && pnpm run check:design` 全绿
- [ ] T-FE-DG-01~03 保持绿

## 8. UI 设计交付（BOOT-002）

### ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读取；评审清单引用 `references/responsive-review-checklist.md`、`references/ui-drift-review-checklist.md`）

### 页面信息架构

- **导航层级**：`/admin` → `AdminLayout`（侧栏 `ADMIN_NAV_GROUPS` + 顶栏 `AppHeader` + `main` Outlet）；本轮仅 smoke 根路径与 mobile 菜单，不改 IA
- **主内容区**：`max-w-(--breakpoint-2xl)` 居中，`p-4 md:p-6`（`layout.md` §2）
- **空/加载/错误/权限态**：本轮不新增业务态；routes smoke 已有 sync-jobs skeleton（T-FE-12），不重复

### 视觉层级

- **主操作**：顶栏 `ThemeToggleButton`（次要在壳层 smoke 已覆盖 T-FE-15）
- **次操作**：`打开菜单`（Header 左侧 border 按钮，`size-10`/`lg:size-11`）
- **承载关系**：`AppSidebar` 固定左侧；`Backdrop` z-40 仅 mobile 打开时；内容区 `xl:ml-[290px|90px]` 随折叠态切换

### 组件映射

| 区域 | 复用组件 | 禁止 |
|------|----------|------|
| 壳层 | `AdminLayout`、`AppSidebar`、`AppHeader`、`Backdrop`、`ThemeToggleButton` | 页面内重写侧栏/顶栏 |
| 测试 | `@testing-library/react` + `MemoryRouter` | 手写 DOM 查询替代 role/label |

### Token 与密度

- 语义色：`bg-gray-900/50` Backdrop、`border-gray-200` Header（Tailwind 语义类，非 hex）
- 侧栏宽度：展开 290px / 折叠 90px（`xl:ml-[290px]` / `xl:ml-[90px]`）
- 断点：XL=1280（`sidebar-context`）；mobile smoke 用 375（Skill token-index `2xsm`）
- 圆角/间距：Header 按钮 `rounded-lg`；内容 `p-4 md:p-6`
- **门禁**：`pnpm run check:design` 扫描 `fe/src` 禁止裸 hex/rgb（T-FE-DG 保持）

### 响应式与可访问性

- **desktop（1400）**：侧栏折叠切换 margin；导航 `aria-label="管理端导航"`
- **mobile（375）**：`打开菜单` → `isMobileOpen` → Backdrop 可见；`aria-label` 已存在于 `app-header.tsx`
- **键盘焦点**：smoke 仅 click；完整 Tab 遍历留二期
- **长文本**：壳层 Logo `VitalSpan` 无截断需求

### 视觉 QA 清单（P3/P4）

- [ ] **desktop 1400**：AdminLayout 展开/折叠各 1 张（或 vitest 断言 margin class）；检查侧栏与 main 无重叠
- [ ] **mobile 375**：菜单打开态 1 张；检查 Backdrop 覆盖、按钮不重叠、main 可读
- [ ] **对齐/留白**：main 左右 padding 一致；顶栏 sticky 不遮挡 h1
- [ ] **状态**：light 默认 + dark toggle（T-FE-15 已覆盖）
- [ ] **色彩漂移**：无硬编码 hex；check:design 全绿
- [ ] **文本溢出**：欢迎标题与 nav 链接无 ellipsis 异常

## 9. 验证命令（P4 等价）

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

## 10. Spec self-review

- [x] 覆盖 round-target 五项，无 TBD/TODO
- [x] 未超出范围框定（9 修改/新建，无生产代码）
- [x] UI 设计交付完整；`ui_design_skill` 已登记
- [x] 与 PRD 8 维薄弱项逐条对齐
- [x] 不重复上轮 T-MIG/T-HLT/T-FE 已交付用例
