# M1/M1B 质量推分实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_migrations.py` · `tests/test_me.py` · `tests/conftest.py` · `tests/test_conftest_contract.py` · `.github/workflows/ci.yml` · `fe/src/layouts/AdminLayout.smoke.test.tsx` · `fe/src/routes.smoke.test.tsx` · `fe/src/vite.config.smoke.test.ts` · `fe/src/config/admin-nav.tsx` · `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`（只读 fixture：`backend/migrations/**` · `backend/app/auth/middleware.py` · `backend/app/core/config.py` · `fe/vite.config.ts`）
> **子项：** BOOT-005 · BOOT-006 · BOOT-002 · BOOT-003 · DATA-003
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `backend/**/*.py`/`tests/**` → `backend-fastapi.mdc`；触及 `fe/**` → `fe-ui.mdc`）

**Goal:** 在不动生产业务逻辑前提下，补齐 M1 BOOT 五项与 M1B DATA-003 的测试/CI/导航 IA，推动 PRD 8 维加权总分向 ≥90 迈进。

**Architecture:** backend 先行（迁移测 → `/me` companion → conftest/CI），frontend vitest 扩展壳层与 ingestion 页 smoke；`admin-nav` 增「数据接入」为本轮唯一 UI 结构变更。全部新增测由现有 `pytest -v` / `pnpm test` 拾取，不引入 postgres service 或 Playwright。

**Tech Stack:** Python 3.11 · pytest · FastAPI TestClient · ruff · React 19 · Vitest · Testing Library · Vite 6 · pnpm 9

## Global Constraints

- 禁止修改 `docs/automate/plan.md` 结构或勾选
- 禁止 CI 内 `docker compose` / `alembic upgrade` / Playwright E2E
- 禁止新增 Alembic revision、ingestion 业务逻辑、正式 JWT
- 禁止修改 `backend/migrations/versions/*` 与 `backend/app/auth/middleware.py` 行为
- 前端禁止 `@axe-core/react`；主题/a11y 用 Testing Library role/label
- 验证门禁：`cd backend && ruff check . && pytest -v` · `cd fe && pnpm test && pnpm build && pnpm run check:design`
- 预估改动文件 ≤ 11（round-target 上限 20）

---

### Task 1: BOOT-005 迁移框架测试补强

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: 现有 `KNOWN_URL` fixture、`get_settings.cache_clear()`、`sys.modules.pop("migrations.env", None)` 清理模式
- Produces: `test_revision_directory_single_head_chain` (T-MIG-15) · `test_migrations_online_path_connects_and_runs` (T-MIG-16) · `test_migrations_offline_import_under_budget` (T-MIG-17) · `test_migrations_env_rebinds_on_settings_change` (T-MIG-18)

- [ ] **Step 1: 在 `tests/test_migrations.py` 顶部补充 `import time`**

- [ ] **Step 2: 追加 T-MIG-15 revision 目录遍历测**

```python
def test_revision_directory_single_head_chain():
    """T-MIG-15: versions/*.py revision 唯一、单链、head 为 0002。"""
    versions_dir = (
        Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    )
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        module = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[module.revision] = module.down_revision

    assert set(revisions.keys()) == {"0001", "0002"}
    assert len(revisions) == len(set(revisions.keys()))
    assert revisions["0001"] is None
    assert revisions["0002"] == "0001"

    referred_down = {d for d in revisions.values() if d}
    heads = [rev for rev in revisions if rev not in referred_down]
    assert heads == ["0002"]
```

- [ ] **Step 3: 追加 T-MIG-16 online 分支 mock 测**

```python
def test_migrations_online_path_connects_and_runs(monkeypatch):
    """T-MIG-16: is_offline_mode=False 时 connect() 与 run_migrations() 被调用。"""
    fake_settings = Settings(
        database_url=KNOWN_URL,
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_connection = MagicMock()
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_connection)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)

    with patch("alembic.context", mock_context):
        with patch("migrations.env.engine_from_config", return_value=mock_engine):
            importlib.import_module("migrations.env")

    mock_engine.connect.assert_called_once()
    mock_context.run_migrations.assert_called_once()
    sys.modules.pop("migrations.env", None)
```

- [ ] **Step 4: 追加 T-MIG-17 offline 导入性能预算测**

```python
def test_migrations_offline_import_under_budget(monkeypatch):
    """T-MIG-17: offline 导入 migrations.env 全流程 < 2s。"""
    fake_settings = Settings(
        database_url=KNOWN_URL,
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_main_option.return_value = KNOWN_URL

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)

    start = time.perf_counter()
    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")
    elapsed = time.perf_counter() - start

    assert elapsed < 2.0
    sys.modules.pop("migrations.env", None)
```

- [ ] **Step 5: 追加 T-MIG-18 Settings 变更后重导入绑定测**

```python
def test_migrations_env_rebinds_on_settings_change(monkeypatch):
    """T-MIG-18: DATABASE_URL 变更后重导入 migrations.env 绑定新 URL。"""
    url_a = "postgresql+psycopg://a:a@localhost:5432/a"
    url_b = "postgresql+psycopg://b:b@localhost:5432/b"

    def import_env_and_capture_url() -> str:
        sys.modules.pop("migrations.env", None)
        mock_config = MagicMock()
        mock_config.config_file_name = None
        mock_context = MagicMock()
        mock_context.config = mock_config
        mock_context.is_offline_mode.return_value = True
        with patch("alembic.context", mock_context):
            importlib.import_module("migrations.env")
        call_args = mock_config.set_main_option.call_args
        assert call_args is not None
        return call_args[0][1]

    monkeypatch.setenv("DATABASE_URL", url_a)
    get_settings.cache_clear()
    assert import_env_and_capture_url() == url_a

    monkeypatch.setenv("DATABASE_URL", url_b)
    get_settings.cache_clear()
    assert import_env_and_capture_url() == url_b
    sys.modules.pop("migrations.env", None)
```

- [ ] **Step 6: 运行验证**

Run: `cd backend && pytest tests/test_migrations.py -v --tb=short`
Expected: PASS，用例数 ≥ 18（14 既有 + 4 新增）

- [ ] **Step 7: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): extend migration framework offline/online/chain coverage"
```

---

### Task 2: BOOT-003 鉴权 `/me` companion 测试

**Files:**
- Modify: `tests/test_me.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `client` · `auth_headers` · `unauthorized_headers` fixtures；`get_settings` from `app.core.config`
- Produces: T-ME-03~08 六个 companion 用例；`UNAUTHORIZED_BODY` 常量复用 `test_auth.py` 结构

- [ ] **Step 1: 在 `tests/test_me.py` 顶部补充 imports 与常量**

```python
import pytest

from app.core.config import get_settings

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token",
    "detail": None,
}
```

- [ ] **Step 2: 追加 T-ME-03 非法 Bearer**

```python
def test_me_invalid_bearer_returns_401(client, unauthorized_headers):
    """T-ME-03: Authorization: Bearer invalid → 401 + 标准 error body。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
```

- [ ] **Step 3: 追加 T-ME-04 无 Authorization header**

```python
def test_me_missing_authorization_header_returns_401(client):
    """T-ME-04: 无 Authorization header → 401。"""
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
```

- [ ] **Step 4: 追加 T-ME-05~07 公开路径矩阵**

```python
@pytest.mark.parametrize("path", ["/health", "/openapi.json", "/docs"])
def test_public_paths_accessible_without_token(client, path):
    """T-ME-05~07: 公开路径无 Token → 200。"""
    response = client.get(path)
    assert response.status_code == 200
```

- [ ] **Step 5: 追加 T-ME-08 production 拒绝 dev token**

```python
def test_me_bearer_dev_rejected_in_production(client, auth_headers, monkeypatch):
    """T-ME-08: production 环境拒绝 Bearer dev。"""
    monkeypatch.setenv("VITALSPAN_ENV", "production")
    get_settings.cache_clear()
    response = client.get("/api/v1/me", headers=auth_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
    get_settings.cache_clear()
```

- [ ] **Step 6: 运行验证**

Run: `cd backend && pytest tests/test_me.py tests/test_auth.py -v --tb=short`
Expected: PASS，`test_me.py` 用例数 ≥ 8；`test_auth.py` 仍全绿

- [ ] **Step 7: Commit**

```bash
git add tests/test_me.py
git commit -m "test(BOOT-003): companion /me and public path contract in test_me.py"
```

---

### Task 3: BOOT-006 CI 与 conftest 契约整合

**Files:**
- Modify: `tests/test_conftest_contract.py`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/conftest.py`（仅确认契约注释完整，无行为变更）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**Interfaces:**
- Consumes: `client` · `unauthorized_headers` · `trace_id_headers` fixtures
- Produces: `test_unauthorized_headers_fixture_returns_401` (T-CFT-04) · `test_trace_id_headers_fixture_echoes_trace` (T-CFT-05)

- [ ] **Step 1: 扩展 `tests/test_conftest_contract.py`**

```python
def test_unauthorized_headers_fixture_returns_401(client, unauthorized_headers):
    """T-CFT-04: unauthorized_headers + client → GET /api/v1/me 401 UNAUTHORIZED。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_trace_id_headers_fixture_echoes_trace(client, trace_id_headers):
    """T-CFT-05: trace_id_headers + client → 响应头 X-Trace-Id 回显。"""
    incoming = trace_id_headers["X-Trace-Id"]
    response = client.get("/health", headers=trace_id_headers)
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == incoming
```

- [ ] **Step 2: 确认 `tests/conftest.py` 头部契约注释含四个 fixture（已存在则跳过改动）**

契约表须包含：`client` · `auth_headers` · `unauthorized_headers` · `trace_id_headers`

- [ ] **Step 3: 修改 `.github/workflows/ci.yml` backend job 注入显式 env**

在 `jobs.backend` 下、`steps` 之前插入：

```yaml
    env:
      DATABASE_URL: postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan
      SECRET_KEY: ci-test-secret-key-min-32-chars-long!!
      CREDENTIAL_FERNET_KEY: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
```

`Pytest` step 保持 `run: pytest -v`（自动拾取 `tests/` 全部模块）。

- [ ] **Step 4: 运行 backend 全量验证**

Run: `cd backend && ruff check . && pytest -v --tb=short`
Expected: PASS，ruff 0 error；pytest 全绿

- [ ] **Step 5: Commit**

```bash
git add tests/test_conftest_contract.py tests/conftest.py .github/workflows/ci.yml
git commit -m "ci(BOOT-006): explicit env vars and conftest fixture contract tests"
```

---

### Task 4: BOOT-002 React 管理端壳层 vitest 扩展

**Files:**
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`
- Modify: `fe/src/routes.smoke.test.tsx`
- Create: `fe/src/vite.config.smoke.test.ts`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin 壳层组件（`AdminLayout` · `ThemeToggleButton` · `main` `max-w-(--breakpoint-2xl)`）
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡（vitest 用 role/class 代理断言）
- hover/focus：主题按钮 `aria-label="切换深浅色主题"` 可点击；`main` landmark 存在
- `check:design` 静态门禁保持 0 退出

- [ ] **Step 1: 扩展 `AdminLayout.smoke.test.tsx` — T-FE-15 主题切换**

在文件顶部补充 `fireEvent, waitFor` import，追加：

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

  it("toggles dark class on theme button click (T-FE-15)", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    const toggle = screen.getAllByRole("button", { name: "切换深浅色主题" })[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
```

- [ ] **Step 2: 扩展 `AdminLayout.smoke.test.tsx` — T-FE-16 壳层宽度契约**

```typescript
  it("main content area uses max-w breakpoint contract (T-FE-16)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getByRole("main");
    expect(main.className).toContain("max-w-(--breakpoint-2xl)");
  });
```

- [ ] **Step 3: 在 `routes.smoke.test.tsx` 为 T-FE-11 补 doc 别名 T-FE-17**

将现有 `renders nested sync-jobs route through AdminLayout (T-FE-11)` 测试 doc 更新为同时标注 T-FE-17，并追加 `main` 内 h1 断言：

```typescript
    const main = screen.getAllByRole("main")[0];
    expect(
      within(main).getByRole("heading", { level: 1, name: "同步任务" }),
    ).toBeInTheDocument();
```

- [ ] **Step 4: 创建 `fe/src/vite.config.smoke.test.ts` — T-FE-18**

```typescript
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("vite.config smoke", () => {
  it("proxies /api to backend dev server (T-FE-18)", () => {
    const proxy = viteConfig.server?.proxy;
    expect(proxy).toBeDefined();
    const apiProxy = proxy?.["/api"];
    expect(apiProxy).toBeDefined();
    if (apiProxy && typeof apiProxy === "object" && "target" in apiProxy) {
      expect(apiProxy.target).toBe("http://localhost:8000");
    } else {
      throw new Error("expected /api proxy object with target");
    }
  });

  it("includes vitest jsdom environment (T-FE-18b)", () => {
    expect(viteConfig.test?.environment).toBe("jsdom");
  });
});
```

- [ ] **Step 5: 运行 frontend 验证**

Run: `cd fe && pnpm test && pnpm build && pnpm run check:design`
Expected: vitest 用例数 ≥ 22；build 与 check:design 全绿

- [ ] **Step 6: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx fe/src/routes.smoke.test.tsx fe/src/vite.config.smoke.test.ts
git commit -m "test(BOOT-002): extend AdminLayout theme/a11y and vite proxy smoke"
```

---

### Task 5: DATA-003 admin-nav 数据接入口（IA 修正）

**Files:**
- Modify: `fe/src/config/admin-nav.tsx`
- Modify: `fe/src/routes.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 侧栏「数据」分组新增「数据接入」链接，icon lucide `size-6` + `aria-hidden`
- desktop 侧栏 link `name="数据接入"` `href="/admin/ingestion/sync-jobs"` 可达
- 不引入新组件文件；遵守语义 token 与现有 `NavSection` 结构

- [ ] **Step 1: 修改 `fe/src/config/admin-nav.tsx`**

```typescript
import { ArrowLeftRight, Database, Settings } from "lucide-react";
import type { NavSection } from "@/components/layout/app-sidebar";

export const ADMIN_NAV_GROUPS: NavSection[] = [
  {
    title: "数据",
    items: [
      {
        name: "数据源",
        icon: <Database className="size-6" aria-hidden />,
        path: "/admin",
      },
      {
        name: "数据接入",
        icon: <ArrowLeftRight className="size-6" aria-hidden />,
        path: "/admin/ingestion/sync-jobs",
      },
    ],
  },
  // ... 系统分组不变
];
```

- [ ] **Step 2: 在 `routes.smoke.test.tsx` 追加 T-FE-19**

```typescript
  it("shows 数据接入 nav link at /admin (T-FE-19)", () => {
    setDesktopViewport();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "数据接入" });
    expect(link).toHaveAttribute("href", "/admin/ingestion/sync-jobs");
  });
```

- [ ] **Step 3: 运行验证**

Run: `cd fe && pnpm test -- src/routes.smoke.test.tsx src/config/admin-nav.tsx`
Expected: PASS，T-FE-19 绿

- [ ] **Step 4: Commit**

```bash
git add fe/src/config/admin-nav.tsx fe/src/routes.smoke.test.tsx
git commit -m "feat(DATA-003): add 数据接入 nav entry for ingestion sync-jobs"
```

---

### Task 6: DATA-003 ingestion 页面 vitest smoke 扩展

**Files:**
- Modify: `fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 表单 HTML5 `required` 拦截空提交；password 字段 `type="password"`
- EtlRules 空 rules 默认一行编辑 UI + 「保存」按钮
- 历史页空态「暂无运行记录」；edit 模式 loading `Skeleton`
- mobile 375px viewport 已有用例保持绿

- [ ] **Step 1: 补充 `EtlRulesPage` import**

```typescript
import { EtlRulesPage } from "./EtlRulesPage";
```

- [ ] **Step 2: 追加 T-ING-06 表单 required 拦截**

```typescript
  it("SyncJobFormPage_blocks_submit_when_name_empty (T-ING-06)", async () => {
    setViewport(375);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const nameInput = await screen.findByLabelText("任务名称");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: 追加 T-ING-07 password type 断言**

```typescript
  it("SyncJobFormPage_password_field_is_masked (T-ING-07)", async () => {
    setViewport(1400);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const passwordInput = await screen.findByLabelText(/^密码/);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
```

- [ ] **Step 4: 追加 T-ING-08 EtlRules 空 rules UI**

```typescript
  it("EtlRulesPage_renders_default_rule_row_when_empty (T-ING-08)", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({ rules: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByLabelText(/规则类型/)).toBeInTheDocument();
  });
```

- [ ] **Step 5: 追加 T-ING-09 历史空态**

```typescript
  it("SyncJobHistoryPage_empty_state (T-ING-09)", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("暂无运行记录")).toBeInTheDocument();
  });
```

- [ ] **Step 6: 追加 T-ING-10 edit 模式 loading Skeleton**

```typescript
  it("SyncJobFormPage_edit_mode_shows_skeleton_while_loading (T-ING-10)", async () => {
    setViewport(1400);
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/edit"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [data-slot="skeleton"], [class*="animate-pulse"]',
      );
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });
```

- [ ] **Step 7: 运行全量 frontend 验证**

Run: `cd fe && pnpm test && pnpm build && pnpm run check:design`
Expected: `ingestion.smoke.test.tsx` 用例数 ≥ 10；全链路绿

- [ ] **Step 8: 运行全仓库门禁（P3 收口）**

Run: `cd backend && ruff check . && pytest -v`
Run: `cd fe && pnpm test && pnpm build && pnpm run check:design`
Expected: 全部 PASS；backend pytest 较现状 +10 项；frontend vitest 较现状 +8 项

- [ ] **Step 9: Commit**

```bash
git add fe/src/pages/admin/ingestion/ingestion.smoke.test.tsx
git commit -m "test(DATA-003): extend ingestion form/etl/history smoke coverage"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| BOOT-005 T-MIG-15~18 | Task 1 | ✓ |
| BOOT-003 T-ME-03~08 | Task 2 | ✓ |
| BOOT-006 T-CFT-04~05 + CI env | Task 3 | ✓ |
| BOOT-002 T-FE-15~18 | Task 4 | ✓ |
| DATA-003 admin-nav + T-FE-19 | Task 5 | ✓ |
| DATA-003 T-ING-06~10 | Task 6 | ✓ |

**预估文件数：** 11（9 modify + 1 create + 1 CI workflow）
**预估任务数：** 6
