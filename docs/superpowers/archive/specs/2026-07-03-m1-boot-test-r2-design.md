# M1 BOOT 测试与安全补强设计（r2）— BOOT-005 / BOOT-002 / BOOT-003 / BOOT-001 / BOOT-006

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target-r2.md
prd_ids: [BOOT-005, BOOT-002, BOOT-003, BOOT-001, BOOT-006]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | Settings 校验与 env 绑定边缘测试 | BOOT-005 | 1 | 测试覆盖 55%；可靠性 | 元库连接串缺失或错配在 CI 即失败，而非部署才发现 |
| 2 | AdminLayout 与 design 门禁深化 smoke | BOOT-002 | 2 | 测试覆盖 45%；安全性 58% | Admin 壳层与设计 Token 违规在 PR 合并前自动拦截 |
| 3 | 鉴权负例与公开路径矩阵 | BOOT-003 | 3 | 测试覆盖 55%；安全性 78%→ | 未授权 401、公开路径免 Token、`Bearer dev` 可回归 |
| 4 | 错误路径与 OpenAPI 契约 | BOOT-001 | 4 | 测试覆盖 55%；可靠性 | API 壳层契约在 CI 可重复验证 |
| 5 | 套件整合与 fixture 复用 | BOOT-006 | 5 | 测试覆盖 70%；安全性 66% | 本地与 CI 命令等价，新增用例稳定拾取 |

**依赖链**：子项 1–4 各自扩展测试；子项 5 收尾（`conftest` fixture 供 3–4 复用；CI 拾取全部新用例）。

**上轮已交付（本轮不重复基础用例）**：`test_migrations.py` T-MIG-01/02、`test_trace.py`、`test_health.py` T-HLT-01~04、`conftest` `auth_headers`、`fe` vitest T-FE-01/02、CI `pnpm test`。本轮仅**扩展边缘场景**，不重写上述基础断言。

**STUCK 标注**：BOOT-002/001/006 连续 3 轮未过 90；BOOT-005/003 连续 2 轮。本轮主攻测试覆盖与安全负例，不修改 PRD 验收条款结构。

## 2. 现状与约束

| 项 | 现状 |
|----|------|
| `tests/test_migrations.py` | T-MIG-01/02 已绿；缺 Settings 缺省/负例、`alembic.ini` 一致性 |
| `tests/test_me.py` | 无 Token → 401、`Bearer dev` → 200；缺畸形 Token、公开路径与受保护路径对照 |
| `tests/test_health.py` | health/CORS/openapi/docs 公开；缺 404、OpenAPI `paths` 契约断言 |
| `tests/conftest.py` | 已有 `client`、`auth_headers`；预设 env 三元组 |
| `backend/app/auth/middleware.py` | `PUBLIC_PATHS` 含 `/health`、`/docs`、`/redoc`、`/openapi.json`；`Bearer dev` 仅 `vitalspan_env=development` |
| `backend/app/core/config.py` | `database_url: str` 必填；无 URL 格式校验器 |
| `fe/src/routes.smoke.test.tsx` | T-FE-01/02 仅断言「VitalSpan」文本 |
| `fe/scripts/check-design.mjs` | 扫描 hex/rgb；`@design-token-ok` 行豁免 |
| `.github/workflows/ci.yml` | backend `pytest`（无 `-v`）；frontend `pnpm test` + build + check:design |
| P5 评分 | BOOT-001~006 加权 73.9–82.2；主薄弱维仍为测试覆盖与安全负例 |

**范围框定模块**（3）：`tests/`、`backend/app/auth/`（只读参照）、`fe/src/`（最小 smoke + design 门禁测试）。

**真理源优先级**：`round-target-r2` > `plan.md` §M1 > `prd/F01-BOOT.md` > `backend-fastapi.mdc` / `fe-ui.mdc`。

## 3. 范围框定文件清单（≤20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `tests/test_migrations.py` | 1 | 扩展：Settings 负例、env 覆盖、`alembic.ini` script_location |
| `tests/test_auth.py` | 3 | 新建：鉴权负例 + 公开/受保护路径矩阵（或扩 `test_me.py`，二选一） |
| `tests/test_health.py` | 1,4 | 扩展：404、OpenAPI `paths` 契约（公开路径断言可保留在 health 或迁至 auth） |
| `tests/conftest.py` | 5 | 微调：文档化 fixture 契约；可选 `unauthorized_headers` helper |
| `fe/src/routes.smoke.test.tsx` | 2 | 扩展：`/admin` 嵌套路由、主内容区挂载 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | 2 | 新建：侧栏 + `<main>` 结构 smoke |
| `fe/scripts/check-design.fixture.test.mjs` | 2 | 新建：违规样例负向 + `@design-token-ok` 豁免边界 |
| `fe/package.json` | 2,5 | 修改：`test` script 拾取新用例（若需单独 script 则增 `test:design-gate`） |
| `.github/workflows/ci.yml` | 5 | 修改：`pytest -v`；确认 frontend 拾取扩展 vitest |

**只读参照（不修改生产代码）**：

| 路径 | 用途 |
|------|------|
| `backend/app/auth/middleware.py` | `PUBLIC_PATHS`、401 响应体、dev token 条件 |
| `backend/app/core/config.py` | Settings 必填字段 |
| `backend/migrations/env.py` | URL 绑定（T-MIG-02 已有） |
| `backend/alembic.ini` | `script_location` 断言 |
| `backend/app/main.py` | 路由注册、中间件顺序 |
| `backend/app/api/v1/me.py` | OpenAPI path `/api/v1/me` |
| `fe/src/layouts/AdminLayout.tsx` | 侧栏/main DOM 结构 |
| `fe/src/routes.tsx` | `/admin` 嵌套 Route |
| `fe/scripts/check-design.mjs` | 门禁逻辑 |

**文件计数**：新建 3 + 修改 5 = **8 文件**（≤20）。

## 4. 非目标（明确不做）

- 修改 `backend/app/auth/`、`backend/app/core/config.py`、`backend/migrations/env.py` 生产逻辑（本轮仅增测试）
- 重复上轮 T-MIG-01/02、T-HLT-01~04、T-FE-01/02、T-TRC-* 基础用例逻辑
- CI 内启动 docker postgres 或执行 `alembic upgrade`
- Playwright / E2E / 视觉回归截图自动化（P4 人工 QA 清单预留）
- M1B（DATA-*）、META-001、DESIGN-001、CONN-021、BOOT-004 深化
- `plan.md` §文档回写 4 行勾选（留 P5/plan-fix）
- `docs/automate/goal.md` 修订
- 为测试便利新增 `data-testid` 或改动 AdminLayout 视觉

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对策 |
|--------|------------------|--------------|
| BOOT-005 | 测试覆盖 **55%**；可靠性 70% | 扩展负例：缺 `DATABASE_URL`、`alembic.ini` 与 `migrations/` 一致性；env 覆盖回归 |
| BOOT-002 | 测试覆盖 **45%**；安全性 **58%** | AdminLayout 结构 smoke；`check:design` 违规负向 + 豁免边界；`/admin` 路由表断言 |
| BOOT-003 | 测试覆盖 **55%**；安全性 78% | 畸形 Token 401；公开路径矩阵；`Bearer dev` 与无 Token 对照 |
| BOOT-001 | 测试覆盖 **55%**；可靠性 76% | 404 未知路由；OpenAPI `paths` 含 `/health`、`/api/v1/me`；CORS 预检仍绿 |
| BOOT-006 | 测试覆盖 **70%**；安全性 **66%** | `auth_headers`/`client` 被子项 3–4 复用；CI `pytest -v` 与本地等价 |

**P5 重评预期**：五项测试覆盖维由 45–80% 向 ≥90 靠拢；加权总分向 90 迈进（具体分值由 P5 评分器计算，设计不预设数值）。

## 6. 方案比选（摘要）

### 6.1 BOOT-005：Settings 负例策略

| 方案 | 说明 | 结论 |
|------|------|------|
| A `monkeypatch.delenv` + `pytest.raises(ValidationError)` 调 `Settings()` | 无 docker；对齐 pydantic 必填契约 | **采用** |
| B 在 `config.py` 增 `HttpUrl` 校验器 | 需改生产代码 | 否决 |
| C CI 启动 postgres 验证连接 | 超范围 | 否决 |

「非法 URL」在本轮定义为：**空字符串** `database_url=""` 仍可实例化 Settings（当前无格式校验），用例断言 `get_settings().database_url == ""` 以文档化现状；**缺字段**为主负例。若 env 被设为空白，T-MIG-04 记录行为供后续二期加校验器参考。

### 6.2 BOOT-003：测试文件组织

| 方案 | 说明 | 结论 |
|------|------|------|
| A 新建 `tests/test_auth.py` 专责中间件矩阵 | 与 `test_me.py` 职责分离，易扩展 | **采用** |
| B 全部并入 `test_me.py` | 文件膨胀、命名误导 | 否决 |

### 6.3 BOOT-002：`check:design` 负向

| 方案 | 说明 | 结论 |
|------|------|------|
| A vitest/`node:test` 子进程跑 `check-design.mjs` 对临时 fixture 目录 | 不拆脚本逻辑；验证真实门禁 | **采用** |
| B 复制 hex 正则进 vitest 单测 | 与脚本漂移 | 否决 |
| C 改 `check-design.mjs` 接受 `--path` 参数 | 轻微生产脚本变更，可选 | 备选（若 A 需传参则增 `--root` flag，仍属测试支撑） |

### 6.4 BOOT-001：OpenAPI 契约

| 方案 | 说明 | 结论 |
|------|------|------|
| A `GET /openapi.json` 解析 `paths` 键集合 | 直接验证路由注册遗漏 | **采用** |
| B 硬编码比对完整 schema | 脆弱 | 否决 |

## 7. 子项详细设计

### 7.1 BOOT-005 — 扩展 `tests/test_migrations.py`

**目标**：在无 postgres 条件下验证 Settings 配置链边缘与 Alembic 目录一致性。

**用例清单**（保留 T-MIG-01/02）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-MIG-03` | 缺 `DATABASE_URL` 时 Settings 实例化失败 | `monkeypatch.delenv("DATABASE_URL", raising=False)` + `cache_clear`；`pytest.raises(ValidationError)` on `Settings()` |
| `T-MIG-04` | env 覆盖 `DATABASE_URL` 生效 | monkeypatch 为 `postgresql+psycopg://alt:alt@localhost:5432/alt`；`get_settings().database_url == alt` |
| `T-MIG-05` | `alembic.ini` `script_location` 与仓库一致 | 解析 `backend/alembic.ini`；`script_location == migrations`；`Path("backend/migrations").is_dir()` |
| `T-MIG-06` |（可选）空白 `DATABASE_URL` 行为记录 | monkeypatch `DATABASE_URL=""`；`get_settings().database_url == ""`（文档化现状，不 FAIL 除非产品后续加校验） |

**实现要点**：

- 每个修改 env 的用例前后 `get_settings.cache_clear()`
- T-MIG-05 使用 `configparser` 或简单行解析，路径相对 `backend/` 工作目录
- **不** import 并执行 `run_migrations_online/offline`
- T-MIG-02 mock 策略保持不变，不重复实现

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_migrations.py -v` 全绿
- [ ] 用例不依赖网络或 docker

### 7.2 BOOT-002 — 前端壳层与设计门禁深化

**目标**：AdminLayout 结构 smoke、`/admin` 嵌套路由可达、`check:design` 负向可回归。

#### 7.2.1 扩展 `fe/src/routes.smoke.test.tsx`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-FE-03` | `/admin` 嵌套 index 渲染主内容 | `MemoryRouter initialEntries={["/admin"]}`；`screen.getByRole("main")` 存在 |
| `T-FE-04` | 路由表含 `/admin` path | 从 `routes.tsx` 导出结构或渲染后 URL 稳定；断言 `AdminHomePage` 占位文案「欢迎使用 VitalSpan」存在 |
| `T-FE-05` | 未知路径重定向至 admin 壳层 | `initialEntries={["/unknown"]}` 后仍可见「VitalSpan」 |

> `AdminHomePage` 稳定锚点：`欢迎使用 VitalSpan`（h1）。

#### 7.2.2 新建 `fe/src/layouts/AdminLayout.smoke.test.tsx`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-FE-06` | AdminLayout 侧栏与主内容区挂载 | 独立 `render(<AdminLayout><div>child</div></AdminLayout>)` 或 `Outlet` mock；`getByRole("navigation")` 或侧栏 nav 链接存在；`getByRole("main")` 含子内容 |
| `T-FE-07` | 顶栏 actions 区挂载 | `ThemeToggleButton` 可访问（`button` 或 `aria-label`） |

#### 7.2.3 新建 `fe/scripts/check-design.fixture.test.mjs`

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-FE-DG-01` | 含硬编码 hex 的 fixture 文件触发失败 | 临时目录写入 `bad.tsx` 含 `#ff0000`；`node scripts/check-design.mjs`（或子进程 `--root`）exit code 1 |
| `T-FE-DG-02` | `@design-token-ok` 行豁免 | 同行 hex + 注释 `// @design-token-ok`；扫描通过 exit 0 |

**实现要点**：

- fixture 文件放在 `fe/scripts/__fixtures__/check-design/`（git 跟踪），避免污染 `src/`
- 若 `check-design.mjs` 无 `--root`，实施阶段可增可选参数 **仅用于测试**（不改变默认扫描 `src/` 行为）
- **不**修改 `AdminLayout` 视觉或 Token
- `pnpm build` + `pnpm run check:design` 必须仍通过

**验收标准（可测试）**：

- [ ] `cd fe && pnpm test` 全绿（含新 smoke + design gate 测试）
- [ ] `cd fe && pnpm build && pnpm run check:design` 全绿
- [ ] CI frontend job 执行 `pnpm test`

### 7.3 BOOT-003 — 新建 `tests/test_auth.py`

**目标**：鉴权中间件负例与公开路径矩阵。

**用例清单**：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-AUTH-01` | `GET /api/v1/me` 无 Token → 401 | 与 `test_me.py` 等价（可保留一处，另一处 skip 或删重复 — 实施时 DRY，行为不变） |
| `T-AUTH-02` | `Authorization: Bearer invalid` → 401 | status 401；body `code == "UNAUTHORIZED"` |
| `T-AUTH-03` | `Authorization: Bearer`（空 token）→ 401 | 畸形 header |
| `T-AUTH-04` | `Bearer dev` → 200 | 复用 `auth_headers` fixture |
| `T-AUTH-05` | `GET /health` 无 Token → 200 | 公开路径 |
| `T-AUTH-06` | `GET /openapi.json` 无 Token → 200 | 公开路径 |
| `T-AUTH-07` | `GET /docs` 无 Token → 200 | 公开路径（可与 `test_health` 去重，auth 文件保留矩阵一行即可） |
| `T-AUTH-08` | `OPTIONS /api/v1/me` 预检无 Token 不被 401 拦截 | status ≠ 401（中间件放行 OPTIONS） |

**实现要点**：

- 复用 `conftest.client`、`auth_headers`
- 断言响应体与 `middleware._unauthorized_response` 契约一致
- **不**测生产环境 `vitalspan_env != development` 下 `Bearer dev` 拒绝（需 monkeypatch Settings，可选 T-AUTH-09 辅用例）

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_auth.py -v` 全绿
- [ ] `cd backend && pytest` 全绿（含 `test_me.py` 无冲突）

### 7.4 BOOT-001 — 扩展 `tests/test_health.py`

**目标**：错误路径与 OpenAPI 契约；CORS 预检回归。

**用例清单**（保留 T-HLT-01~04）：

| 用例 ID | 描述 | 断言 |
|---------|------|------|
| `T-HLT-05` | `GET /nonexistent-route-xyz` → 404 | `response.status_code == 404` |
| `T-HLT-06` | OpenAPI `paths` 含 `/health` | `"/health" in body["paths"]` |
| `T-HLT-07` | OpenAPI `paths` 含 `/api/v1/me` | `"/api/v1/me" in body["paths"]` |
| `T-HLT-08` | CORS 预检仍绿（回归） | 复跑 T-HLT-02 逻辑或显式 regression 标记；确保中间件链未破坏 |

**实现要点**：

- T-HLT-06/07 复用单次 `GET /openapi.json` 响应解析，避免重复请求
- 404 用例使用不可能碰撞的 path 字符串
- 公开路径 200 断言留在 `test_auth.py` 矩阵时，`test_health.py` 不重复 T-HLT-03/04 以外的公开路径测试

**验收标准（可测试）**：

- [ ] `cd backend && pytest tests/test_health.py -v` 全绿

### 7.5 BOOT-006 — conftest 与 CI 整合

**`tests/conftest.py` 契约**（已有 fixture，本轮固化复用）：

| Fixture | 返回值 | 消费者 |
|---------|--------|--------|
| `client` | `TestClient(app)` | 全部 backend 测试 |
| `auth_headers` | `{"Authorization": "Bearer dev"}` | `test_me.py`、`test_auth.py` T-AUTH-04 |

**可选扩展**：

```python
@pytest.fixture
def unauthorized_headers() -> dict[str, str]:
    return {"Authorization": "Bearer invalid"}
```

**`.github/workflows/ci.yml` 变更**：

| Job | 修改 |
|-----|------|
| backend | `pytest` → `pytest -v`（与 round-target 验收一致） |
| frontend | 保持 `pnpm test`（自动拾取新 vitest 文件） |

**本地等价命令**（与 CI 一致）：

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

**验收标准（可测试）**：

- [ ] `cd backend && ruff check . && pytest -v` 全绿
- [ ] `cd fe && pnpm test && pnpm build && pnpm run check:design` 全绿
- [ ] `.github/workflows/ci.yml` 与本地命令等价

## 8. 测试架构示意

```mermaid
flowchart TB
  subgraph backend_pytest [backend pytest]
    CF[conftest.py\nclient + auth_headers]
    TM[test_migrations.py\nT-MIG-03~06]
    TA[test_auth.py\nT-AUTH-01~08]
    TH[test_health.py\nT-HLT-05~08]
    TME[test_me.py\n保留或 DRY]
    CF --> TM & TA & TH & TME
  end

  subgraph fe_vitest [fe vitest + node]
    RT[routes.smoke.test.tsx\nT-FE-03~05]
    AL[AdminLayout.smoke.test.tsx\nT-FE-06~07]
    DG[check-design.fixture.test.mjs\nT-FE-DG-01~02]
  end

  subgraph ci [ci.yml]
    BJ[backend\nruff + pytest -v]
    FJ[frontend\npnpm test + build + check:design]
  end

  backend_pytest --> BJ
  fe_vitest --> FJ
```

## 9. UI 设计交付（BOOT-002 测试触及 fe/）

> 本轮**不修改** UI 组件或页面视觉；仅增 vitest smoke 与 design 门禁负向测试。以下描述现有壳层契约，供测试选取稳定 DOM 锚点。

### 9.1 ui_design_skill

`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读取）

### 9.2 页面信息架构

| 路由 | 层级 | 主内容区 | 测试锚点 |
|------|------|----------|----------|
| `/` | 重定向 → `/admin` | — | 壳层 logo「VitalSpan」 |
| `/admin` | `AdminLayout` + index | `main.mx-auto.max-w-(--breakpoint-2xl)` | `role="main"`；`AdminHomePage` 标题 |
| `/admin/*`（未来） | 嵌套 `Outlet` | 同上 | 本轮仅 index |
| `*` | 重定向 → `/admin` | — | T-FE-05 |

**状态覆盖（测试范围）**：默认加载态壳层；不测 empty/error/权限 API（M1 静态壳层）。

### 9.3 视觉层级

- 侧栏：`AppSidebar` 290px/90px（`xl:ml-[290px]` / `xl:ml-[90px]`）
- 顶栏：`AppHeader` sticky + `ThemeToggleButton`
- 主内容：`<main>` 包裹 `Outlet`
- smoke 优先 `getByRole("main")`、`getByRole("navigation")`，避免断言具体 px 宽度

### 9.4 组件映射

| 区域 | 复用组件 | 本轮动作 |
|------|----------|----------|
| 路由 | `fe/src/routes.tsx` | 扩展 smoke，不修改 |
| 壳层 | `fe/src/layouts/AdminLayout.tsx` | 新建 smoke 文件，不修改组件 |
| 侧栏/顶栏 | `components/layout/*` | 间接挂载 |
| 门禁 | `fe/scripts/check-design.mjs` | 负向 fixture 测试 |

**禁止**：为测试新增 data-testid 或局部重画按钮/表格/输入框。

### 9.5 Token 与密度

- 沿用 `fe/src/index.css` 语义 Token；`check:design` 拦截硬编码 hex/rgb
- T-FE-DG-02 验证 `@design-token-ok` 豁免机制
- 测试不断言具体色值

### 9.6 响应式与可访问性

- AdminLayout 含 mobile sidebar（`Backdrop`、`isMobileOpen`）；smoke 在 jsdom 默认视口，不覆盖窄屏截图
- 顶栏 toggle 须可键盘聚焦（`ThemeToggleButton` 为 `button`）
- 侧栏图标 `aria-hidden`；导航链接须可 `getByRole("link")`

### 9.7 视觉 QA 清单（P4 执行）

| 检查项 | desktop | mobile |
|--------|:-------:|:------:|
| `/admin` 侧栏 + 顶栏对齐 | ✓ | ✓ |
| `main` 内容区与侧栏不重叠 | ✓ | ✓ |
| 移动侧栏打开态 Backdrop | — | ✓ |
| logo / 「管理员」无文本溢出 | ✓ | ✓ |
| 暗色切换可点击 | ✓ | ✓ |
| `check:design` CI 与本地一致 | ✓ | ✓ |

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `test_me.py` 与 `test_auth.py` 重复 401 用例 | 实施时保留单一定义，另一文件 import 或 pytest 标记 `skip` |
| `check-design` 子进程测试路径解析 | fixture 放 `scripts/__fixtures__`；必要时为 mjs 增 `--root` |
| Settings 缓存污染 | 沿用 `clear_settings_cache` autouse fixture |
| OpenAPI path 键与注册路由漂移 | 仅断言键存在，不断言 schema 细节 |
| vitest 对 `.mjs` 测试混跑 | `package.json` `test` 包含 `scripts/**/*.test.mjs` 或 vitest `include` 扩展 |
| STUCK 项仍不过 90 | 本轮已最大化负例与矩阵；若仍不过，round-target 已标注人工 `create-evolution-goal` 复核 |

## 11. 文档同步评估（P3 实施后）

| 变更 | 是否同步 | 说明 |
|------|:--------:|------|
| 仅增测试与 CI `-v` | 通常否 | `prd-sync.mdc` 纯测试豁免 |
| `prd/F01-BOOT.md` 演化建议 | P5 | 8 维重评后更新 |
| `docs/services/auth.md` | 否 | 域边界未变 |

## 12. 完成自检（P1）

- [x] 覆盖 round-target-r2 全部 5 子项（BOOT-005/002/003/001/006）
- [x] 未超出范围框定（8 文件；不修改 auth/core 生产代码）
- [x] 无 TBD/TODO 占位
- [x] 触及 fe/：已读 UI skill；含完整「UI 设计交付」节
- [x] 禁止写生产代码（本文档仅设计）
