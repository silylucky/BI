# M1 BOOT 质量推分 r15 设计 — BOOT-004 / BOOT-005 / BOOT-006 / BOOT-002 / BOOT-003

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target-r15.md
prd_ids: [BOOT-004, BOOT-005, BOOT-006, BOOT-002, BOOT-003]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | Settings 边界 + 日志/trace 契约（**STUCK 主攻**） | BOOT-004 | 1 | 用户价值 **80%**；性能 **86%** | 配置错配启动/CI 即失败；`GET /health` 日志含一致 `traceId` |
| 2 | Alembic 链 + 连接超时边界巩固 | BOOT-005 | 2 | 用户价值 **82%**；性能 **86%** | 迁移链 head 一致；非法/超时连接可早期捕获 |
| 3 | CI 收集率 + ruff/vitest 超时守卫 | BOOT-006 | 3 | 安全性 **86%**；性能 **86%** | PR CI 失败可定位；门禁稳定不 flaky |
| 4 | Admin 壳层路由守卫 + 主题/a11y 巩固 | BOOT-002 | 4 | 安全性 **84%**；性能 **86%** | 非法路由不泄露壳层外状态；主题异常可降级 |
| 5 | PUBLIC_PATHS + Bearer 多 scheme + `/me` 全分支 | BOOT-003 | 5 | 用户价值 **82%**；测试覆盖 **94%** | 未授权 `/api/v1/me` 一致 401；公开路径豁免可回归 |

**依赖链**：BOOT-004（core 配置/日志契约）→ BOOT-005（`DATABASE_URL` 与 Settings 共享）→ BOOT-003（鉴权与 trace 可组合 fixture）→ BOOT-002（FE smoke 独立）→ BOOT-006 收尾（收集率拾取本轮新增测例）。

**上轮已交付（本轮不重复基础用例）**：

- r14：`test_migrations.py` T-MIG-25~28；`test_me.py` T-ME-09~14；`test_conftest_contract.py` T-CFT-09~10；`test_ci_env_contract.py` T-CI-04~06；`fe/` T-FE-24~27；backend **227 passed / 2 skipped**；fe vitest **60/60**
- r9~r12：`test_config.py` T-CFG-04~07；`test_trace.py` T-TRC-01~10、T-TRC-12；`test_ci_env_contract.py` T-CI-01~03；`fe/` T-FE-20~23；`check-design.fixture.test.mjs` T-FE-DG-01~03

**STUCK 标注**：**BOOT-004 连续 10 轮未过 90**（89.5）。本轮主攻破线；若 P5 仍 <90，建议人工 `create-evolution-plan` 复核 BOOT-004 验收阈值（配置/日志/trace）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `backend/app/core/middleware.py` | `TraceIdMiddleware` 在 `finally` 内 `trace_id_var.reset()` **早于** `request_finished` 日志（L24–34）→ `finished` 行常无 `traceId`（T-TRC-04 仅条件断言） |
| `backend/app/core/config.py` | `database_url`/`credential_fernet_key` 有校验；`secret_key` 无最小长度；`query_timeout_seconds` 无 `ge` 约束 |
| `tests/test_trace.py` | 12 项；**缺** T-TRC-11；缺超长/重复 `X-Trace-Id`；缺 `LOG_LEVEL=ERROR` 抑制 INFO 的 L1 断言 |
| `tests/test_config.py` | 7 项；缺必填 `SECRET_KEY` 缺失 env、越界 `query_timeout_seconds` |
| `tests/test_migrations.py` | 28 项；缺 `upgrade head --sql` 子进程 smoke；缺连接超时/不可达 host 结构化传播 |
| `tests/test_ci_env_contract.py` | 6 项；收集下限 225；**无** ruff 违规样例契约；**无** frontend job 耗时预算 |
| `backend/app/auth/middleware.py` | `PUBLIC_PATHS` 精确匹配 + `/docs` 前缀；`/healthz` **不在** 豁免集 |
| `tests/test_me.py` | 14 项；缺 `/healthz` 负例、Basic 混用 scheme、`get_current_user` 无 user 分支 |
| `fe/src/routes.tsx` | `*` → `/admin` 重定向；无 `/admin/*` 未定义子路径专用守卫测试 |
| `fe/src/context/theme-context.tsx` | `localStorage.theme` 未校验枚举；非法值可能传入 `resolveActiveTheme` |
| `.github/workflows/ci.yml` | backend ruff+pytest；frontend pnpm test/build/check:design；无显式 timeout-minutes |
| pytest 基线 | r14：**227** collected（2 skipped integration） |

**范围框定模块**（4）：`backend/app/core/`、`backend/app/auth/`、`fe/src/`（壳层与 layout）、`tests/`（含 `fe/` vitest/node:test）。

**真理源优先级**：`round-target` > `plan.md` §M1 > `prd/F01-BOOT.md` > `backend-fastapi.mdc` / `fe-ui.mdc`。

**本轮性质**：质量推分（测试为主）。BOOT-004 允许 **≤8 行** `middleware.py` 调整使 `request_finished` 日志与 PRD 契约一致（见 §7.1）；其余子项默认零生产逻辑变更。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/core/middleware.py` | BOOT-004 | **最小修复**：`request_finished` 日志在 `trace_id_var.reset` 之前写入 |
| `tests/test_config.py` | BOOT-004 | 扩展 T-CFG-08~10 |
| `tests/test_trace.py` | BOOT-004 | 新增 T-TRC-11；扩展 T-TRC-13~16 |
| `tests/test_migrations.py` | BOOT-005 | 扩展 T-MIG-29~31 |
| `tests/test_ci_env_contract.py` | BOOT-006 | 扩展 T-CI-07~09 |
| `tests/test_ruff_contract.py` | BOOT-006 | **新建**：ruff 违规样例子进程契约 |
| `tests/test_me.py` | BOOT-003 | 扩展 T-ME-15~18 |
| `tests/test_auth.py` | BOOT-003 | 扩展 T-AUTH-09~11 |
| `tests/conftest.py` | BOOT-003/006 | 扩展 `basic_auth_headers` fixture；更新契约注释 |
| `fe/src/routes.smoke.test.tsx` | BOOT-002 | 扩展 T-FE-28~29 |
| `fe/src/theme-context.smoke.test.tsx` | BOOT-002 | **新建**：主题 Token 缺失/非法降级 |
| `fe/scripts/check-design.fixture.test.mjs` | BOOT-002 | 扩展 T-FE-DG-04 |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/core/logging.py` | `JsonFormatter` `traceId` 注入 |
| `backend/app/core/config.py` | Settings 字段与校验器 |
| `backend/app/auth/deps.py` | `get_current_user` 401 分支 |
| `backend/app/auth/middleware.py` | `PUBLIC_PATHS`、Bearer 解析 |
| `backend/app/api/v1/me.py` | `/me` handler 与 DI |
| `backend/app/main.py` | 中间件注册顺序 |
| `backend/migrations/env.py` | online/offline 与 NullPool |
| `backend/migrations/versions/` | revision 链 |
| `fe/src/layouts/AdminLayout.tsx` | 壳层结构 |
| `fe/src/routes.tsx` | 重定向与嵌套路由 |
| `fe/scripts/check-design.mjs` | HEX/RGB 扫描规则 |
| `.github/workflows/ci.yml` | job 步骤与 env |
| `docs/ui/layout.md` | 壳层 IA 与宽度契约 |

**文件计数**：新建 2 + 修改 10 + 生产最小 1 = **13 ≤ 20**。

## 4. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- BOOT-001（r14 已 90.4，让位本轮五 ID）
- DATA/ETL/M1B 簇、远期 META/DESIGN/CONN、M2+ AUTH-001 新功能
- CI 内 docker postgres 或 `alembic upgrade`（非 `--sql`）
- Playwright / 真浏览器截图自动化（P4 人工 QA 清单承担）
- JWT 正式鉴权、RBAC、Settings 热加载
- 重复 T-CFG-04~07、T-TRC-01~10、T-TRC-12、T-MIG-25~28、T-ME-09~14、T-CI-01~06、T-FE-20~27、T-FE-DG-01~03 已有断言
- 为测试便利新增 `data-testid` 或改动壳层视觉（BOOT-002 主题校验除外：允许 `theme-context` ≤6 行枚举守卫）
- `analytics_database_url` 扩展（属 DATA-004）

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 | 可测验收信号 |
|--------|------------------|--------------|--------------|
| BOOT-004 | 用户价值 **80%**；性能 **86%** | Settings 缺失/越界 env；`request_finished.traceId` 强制契约；trace 头超长/空值；`LOG_LEVEL` 动态 ERROR 抑制 INFO | T-CFG-08~10、T-TRC-11/13~16 全绿；middleware 修复后 T-TRC-11 无 skip |
| BOOT-005 | 用户价值 **82%**；性能 **86%** | `upgrade head --sql` 子进程；revision 链无断点；不可达 host `OperationalError` 传播 | T-MIG-29~31 全绿 |
| BOOT-006 | 安全性 **86%**；性能 **86%** | 收集率地板上调；ruff 违规样例必失败；vitest 子集耗时预算 | T-CI-07~09 + T-RUF-01~02 全绿 |
| BOOT-002 | 安全性 **84%**；性能 **86%** | 非法 `/admin/*` 重定向；主题 localStorage 非法降级；check:design 违规样例；Tab 焦点 smoke 保持 | T-FE-28~29、T-FE-DG-04 全绿 |
| BOOT-003 | 用户价值 **82%**；测试覆盖 **94%** | `/health` vs `/healthz`；Basic/Bearer 混用；过期占位 token；`get_current_user` 无 user | T-ME-15~18、T-AUTH-09~11 全绿 |

**P5 重评预期**：BOOT-004 由 89.5 → **≥90**；BOOT-005/006 地板 **≥90.5**；BOOT-002/003 安全性/用户价值维 **+2~4%**（具体分值由 P5 评分器计算，设计不预设数值）。

## 6. 方案比选（摘要）

### 6.1 BOOT-004：`request_finished` traceId

| 方案 | 说明 | 结论 |
|------|------|------|
| A 将 `request_finished` 日志移入 `try` 块、`reset` 留在 `finally`（仅 relocate，≤8 行） | 对齐 PRD「结构化日志含 traceId」；T-TRC-11 可硬断言 | **采用** |
| B 仅测试 `request_started` 含 traceId | 不解决 STUCK 根因 | 否决 |
| C 改 JsonFormatter 读 response header | 侵入大、非 L1 | 否决 |

### 6.2 BOOT-004：超长 X-Trace-Id

| 方案 | 说明 | 结论 |
|------|------|------|
| A 断言 middleware **原样透传**（当前 L16 `incoming or uuid`） | 零改动；文档化边界 | **采用**（T-TRC-14） |
| B 截断至 32 hex | 生产变更、非 round-target | 否决 |

### 6.3 BOOT-005：连接超时

| 方案 | 说明 | 结论 |
|------|------|------|
| A mock `engine.connect()` 抛 `OperationalError`，断言 `import migrations.env` 传播 | 与 T-MIG-28 互补，用不可达 host URL 文案 | **采用**（T-MIG-31） |
| B 真 TCP 连接 `localhost:1` | flaky、慢 | 否决 |

### 6.4 BOOT-006：ruff 契约

| 方案 | 说明 | 结论 |
|------|------|------|
| A `tests/fixtures/ruff_bad.py` + 子进程 `ruff check` 断言 returncode≠0 | 可测试、无 CI 结构变更 | **采用**（T-RUF-01） |
| B 改 `pyproject.toml` 降规则 | 削弱门禁 | 否决 |

### 6.5 BOOT-002：主题 Token 缺失

| 方案 | 说明 | 结论 |
|------|------|------|
| A `theme-context` 校验 `savedTheme ∈ {light,dark,auto}` 否则 `"light"`（≤6 行）+ vitest | 用户价值：非法主题不污染 `dark` class | **采用**（T-FE-29 + 最小生产守卫） |
| B 仅测当前非法值行为 | 不改善安全性维 | 否决 |

### 6.6 BOOT-003：`get_current_user` 无 user

| 方案 | 说明 | 结论 |
|------|------|------|
| A `pytest` 直接 `async` 调用 `get_current_user(Request(scope={...}))` 无 `state.user` | 不增路由；覆盖 DI 异常路径 | **采用**（T-ME-18） |
| B 新增测试专用路由 | 超范围 entry | 否决 |

## 7. 子项详细设计

### 7.1 BOOT-004 — 配置边界 + 日志/trace 契约

#### 7.1.1 生产最小修复（`backend/app/core/middleware.py`）

将 `request_finished` 的 `logger.info` 移入 `try` 块内、在 `call_next` 之后、`finally` 的 `trace_id_var.reset` **之前**执行；`response.headers["X-Trace-Id"]` 赋值保持在 `try` 内 `call_next` 之后。预期 diff ≤8 行，行为不变更 trace 生成逻辑。

#### 7.1.2 扩展 `tests/test_config.py`（保留 T-CFG-01~07）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CFG-08 | 缺 `SECRET_KEY` env | `monkeypatch.delenv("SECRET_KEY", raising=False)` + `get_settings.cache_clear()` → `pytest.raises(ValidationError)` |
| T-CFG-09 | 空白 `SECRET_KEY` | `Settings(..., secret_key="   ")` → `ValidationError` 或接受非空 strip（**以当前 pydantic 行为为准**，断言实例化失败或 `secret_key` 非空） |
| T-CFG-10 | `query_timeout_seconds=0` 记录现状 | 实例化成功且值为 `0`（文档化：二期可加 `ge=1`） |

#### 7.1.3 扩展 `tests/test_trace.py`（保留 T-TRC-01~10、T-TRC-12）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-TRC-11 | `request_finished` **必须**含 `traceId` | 捕获 JSON；`message=="request_finished"` 行 `traceId == response.headers["X-Trace-Id"]`（**硬断言**，依赖 §7.1.1 修复） |
| T-TRC-13 | 无 `X-Trace-Id` 请求头 | 与 T-TRC-01 互补：显式不传 header；响应头为 32 位 hex；`started`/`finished` 日志 traceId 一致 |
| T-TRC-14 | 超长入站 trace（256 字符） | `X-Trace-Id: "a"*256`；响应头原样回显；日志 `traceId` 与头一致 |
| T-TRC-15 | 重复/多值 trace 头 | 使用 Starlette 支持的 header 列表或单次长值；记录**实际**合并行为（不断言 500） |
| T-TRC-16 | `LOG_LEVEL=ERROR` 抑制 INFO 请求日志 | `monkeypatch` + `configure_logging`；`caplog` 或 StringIO handler；`GET /health` 后 `vitalspan.http` **无** INFO 级 `request_started` 行 |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_config.py tests/test_trace.py -v` 全绿（config ≥10 项、trace ≥16 项）
- [ ] `GET /health` 后 JSON 日志 `request_started` 与 `request_finished` 均含相同 `traceId`

### 7.2 BOOT-005 — 迁移链 + 连接边界

**保留** T-MIG-01~28。

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-MIG-29 | `alembic upgrade head --sql` 子进程 | `returncode == 0`；stdout 含 `ingestion_sync_jobs` 或 `CREATE TABLE` |
| T-MIG-30 | revision 链完整性扫描 | 遍历 `versions/*.py`：`down_revision` 形成单链无 orphan；`head` 唯一为 `0002` |
| T-MIG-31 | 不可达 host `DATABASE_URL` online 导入 | `database_url` 含 `@127.0.0.1:1/`；mock 或真实 `connect` 抛 `OperationalError` 向上传播（与 T-MIG-28 不同：断言错误消息含 `connection` 或 `refused` 子串） |

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_migrations.py -v` 全绿（≥31 项）
- [ ] 不执行 `alembic upgrade`（非 `--sql`）

### 7.3 BOOT-006 — CI 守卫巩固

#### 7.3.1 扩展 `tests/test_ci_env_contract.py`（保留 T-CI-01~06）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-CI-07 | pytest 收集下限 | `--collect-only -q` 末行计数 **≥232**（227 基线 + 本轮 ~5+） |
| T-CI-08 | frontend job 步骤顺序契约 | `ci.yml` 中 `pnpm test` 在 `pnpm build` 之前；`check:design` 在 build 之后 |
| T-CI-09 | vitest 子集耗时预算 | 子进程 `cd fe && pnpm test -- src/routes.smoke.test.tsx`（或等效单文件）elapsed **< 45s** |

#### 7.3.2 新建 `tests/test_ruff_contract.py`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-RUF-01 | 违规样例必被 ruff 拒绝 | `tests/fixtures/ruff_bad_sample.py` 含未使用 import；`ruff check` 该文件 `returncode != 0` |
| T-RUF-02 | 干净样例通过 | `tests/conftest.py` 或 `tests/test_health.py` `returncode == 0` |

**`tests/fixtures/ruff_bad_sample.py`**：仅用于 T-RUF-01，文件头注释标明「故意违规，勿修复」。

**`.github/workflows/ci.yml`**：结构不变；P3 核对新测已被 pytest 自动拾取。

**验收标准（可测试）**：

- [ ] `cd backend && ruff check . && pytest -v` 全绿
- [ ] `cd fe && pnpm test && pnpm build && pnpm run check:design` 全绿

### 7.4 BOOT-002 — FE 壳层安全 smoke

#### 7.4.1 扩展 `fe/src/routes.smoke.test.tsx`（保留 T-FE-01~27）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-FE-28 | 非法 `/admin/nonexistent-secret` 仍落 Admin 壳层 | `MemoryRouter` initialEntries=`["/admin/nonexistent-secret"]`；**无**独立 404 页；`VitalSpan` + `main` 存在；**不**渲染敏感占位 API 数据（无 `mockApiFetch` 调用或 calls==0） |
| T-FE-29 | 未匹配子路由不暴露壳层外布局 | `initialEntries=["/admin/ingestion/unknown"]`；仍 `AdminLayout`；`main` 可达（index 或空 outlet 行为以 routes 为准） |

#### 7.4.2 新建 `fe/src/theme-context.smoke.test.tsx`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-FE-30 | `localStorage.theme` 非法值降级 | `localStorage.setItem("theme","garbage")`；渲染 `ThemeProvider`+子组件；`document.documentElement.classList.contains("dark") === false` |
| T-FE-31 | `localStorage` 缺失默认 light | 清除 `theme` key；初始化后无 `dark` class |

**生产最小调整（`fe/src/context/theme-context.tsx`）**：读取 `savedTheme` 后，若不在 `["light","dark","auto"]` 则置 `"light"`（≤6 行）。

#### 7.4.3 扩展 `fe/scripts/check-design.fixture.test.mjs`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-FE-DG-04 | 多文件混合：一坏一好 | fixture 目录含 bad+ok；`check:design --root` exit 1 |

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test` 全绿（vitest ≥62 项 + node:test ≥4 项）
- [ ] `pnpm build && pnpm run check:design` 全绿

### 7.5 BOOT-003 — 鉴权边界 + 公开路径契约

#### 7.5.1 扩展 `tests/test_me.py`（保留 T-ME-03~14）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-ME-15 | `/health` 公开 vs `/healthz` 受保护 | `GET /health` → 200；`GET /healthz` → 401 + `UNAUTHORIZED` body |
| T-ME-16 | `Authorization: Basic dev` → 401 | 非 Bearer scheme 拒绝 |
| T-ME-17 | 过期占位 token | `Authorization: Bearer expired-placeholder` → 401（M1 无 JWT 解析，一律 401） |
| T-ME-18 | `get_current_user` 无 `state.user` | `async` 直接调用；`Request` scope 空 state → `HTTPException` 401，`detail.code == "UNAUTHORIZED"` |

#### 7.5.2 扩展 `tests/test_auth.py`（保留 T-AUTH-02~08）

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| T-AUTH-09 | `/healthz` 401 | 与 T-ME-15 互补，保持 auth 模块覆盖 |
| T-AUTH-10 | `/api/v1/me` 全分支矩阵快照 | 参数化：无头/空 Bearer/invalid/dev(200)/Basic → 状态码集合 `{401,200}` 符合预期 |
| T-AUTH-11 | 公开路径 `/redoc` 仍 200 | 回归 T-ME-13 子集 |

#### 7.5.3 扩展 `tests/conftest.py`

| Fixture | 返回值 | 用途 |
|---------|--------|------|
| `basic_auth_headers` | `{"Authorization": "Basic dev"}` | T-ME-16 / T-AUTH-10 |

契约注释块追加一行。

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_me.py tests/test_auth.py -v` 全绿
- [ ] `GET /api/v1/me` 无 Token → 401 与 `UNAUTHORIZED_BODY` 一致

## 8. UI 设计交付（BOOT-002）

### ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读取；本轮引用 `references/accessibility-review-checklist.md`、`references/ui-drift-review-checklist.md`、`references/scenario-domain-focus-keyboard-viewport-light-dark-screenshot-review-checklist.md` 中键盘/焦点条目）

### 页面信息架构

- **导航层级**：`/` → redirect `/admin`；`/admin/*` 嵌套 `AdminLayout`（侧栏 + 顶栏 + `main` Outlet）；未知路径 `*` → `/admin`（本轮测非法子路径不穿透壳层）
- **主内容区**：`max-w-(--breakpoint-2xl)` 居中，`p-4 md:p-6`（`layout.md` §2）
- **空/加载/错误/权限态**：本轮不新增业务态；T-FE-12 skeleton 不重复；非法路由仅验证壳层包裹

### 视觉层级

- **主操作**：顶栏 `ThemeToggleButton`（`切换深浅色主题`）
- **次操作**：`打开菜单`（Header，`size-10`/`lg:size-11`）
- **承载关系**：`AppSidebar` 固定左侧；mobile `Backdrop` `bg-gray-900/50`；内容区 `xl:ml-[290px|90px]`

### 组件映射

| 区域 | 复用组件 | 禁止 |
|------|----------|------|
| 壳层 | `AdminLayout`、`AppSidebar`、`AppHeader`、`Backdrop`、`ThemeToggleButton` | 页面内重写侧栏/顶栏 |
| 主题 | `ThemeProvider`（`theme-context.tsx`） | 页面内独立 `dark` class 切换 |
| 测试 | `@testing-library/react` + `MemoryRouter` | 手写非语义 DOM 查询 |

### Token 与密度

- 语义色：Backdrop `bg-gray-900/50`；Header `border-gray-200` / `dark:border-gray-800`
- 侧栏：展开 290px / 折叠 90px
- 断点：XL=1280；mobile smoke 375px
- **门禁**：`pnpm run check:design` 禁止裸 hex/rgb（T-FE-DG-01~04）

### 响应式与可访问性

- **desktop（1400）**：T-FE-24 Tab 顺序 menu → theme（保持绿）
- **mobile（375）**：T-FE-25/26 菜单可达、不 trap focus（保持绿）
- **键盘焦点**：T-FE-27/28 不削弱；非法路由不新增焦点陷阱
- **主题降级**：非法 `localStorage.theme` 回退 light，避免错误 `dark` 对比度

### 视觉 QA 清单（P3/P4）

- [ ] **desktop 1400**：AdminLayout 展开态；侧栏与 main 无重叠
- [ ] **mobile 375**：菜单打开 + Backdrop；按钮不重叠
- [ ] **非法路由**：`/admin/foo` 仍在壳层内，无白屏/裸文本外泄
- [ ] **主题**：light 默认；toggle dark（T-FE-15）；非法 theme 回 light（T-FE-30）
- [ ] **色彩漂移**：check:design 全绿
- [ ] **文本溢出**：nav 链接与欢迎标题无异常 ellipsis

## 9. 验证命令（P4 等价）

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

**预期计数**：backend pytest **≥232 passed**（2 skipped 保持）；fe vitest **≥62**；node:test **≥4**。

## 10. Spec self-review

- [x] 覆盖 round-target 五项，无 TBD/TODO
- [x] 未超出范围框定（13 文件，含 2 个最小生产调整）
- [x] UI 设计交付完整；`ui_design_skill` 已登记
- [x] 与 PRD 8 维薄弱项逐条对齐
- [x] 点名 BOOT-004 STUCK 根因（`request_finished` traceId）并给出可测修复路径
- [x] 不重复 r14/r9 已交付用例编号
