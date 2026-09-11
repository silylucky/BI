# M1 BOOT 质量推分 r9 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_migrations.py`、`tests/test_health.py`、`tests/test_config.py`、`tests/test_trace.py`、`tests/conftest.py`、`tests/test_conftest_contract.py`、`tests/test_ci_env_contract.py`（新建）、`fe/src/layouts/AdminLayout.smoke.test.tsx`、`fe/src/routes.smoke.test.tsx`（新建 1 + 修改 8 = **9 文件**；只读参照 12，合计框定 21；实施不修改生产代码）
> **子项：** BOOT-005、BOOT-006、BOOT-001、BOOT-004、BOOT-002
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `tests/**/*.py`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 扩展 pytest/vitest 迁移降级路径、CI env 契约、健康检查耗时与公开/受保护边界、Settings 枚举与 traceId 全链路、Admin 壳层 mobile/desktop viewport smoke，推动 BOOT-005/006/001/004/002 加权总分由 85.9–87.7 向 ≥90 迈进。

**Architecture:** 子项 1（BOOT-005）扩展 `test_migrations.py`；子项 3（BOOT-001）扩展 `test_health.py`；子项 4（BOOT-004）扩展 `test_config.py` + `test_trace.py`；子项 5（BOOT-002）扩展 fe vitest；子项 2（BOOT-006）收尾扩展 `conftest`、契约测试与新建 CI env 契约文件。全程**不修改** `backend/app/**` 与 `fe/src/**` 生产逻辑；后端 `TestClient` + subprocess `alembic * --sql`，不启 docker postgres、不执行 `alembic upgrade`。

**Tech Stack:** Python 3.11、pytest 8、pydantic v2 ValidationError、FastAPI TestClient、alembic CLI `--sql`、vitest 3、@testing-library/react、jsdom、pnpm 9、GitHub Actions

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- **不修改** `backend/app/core/config.py`、`logging.py`、`migrations/env.py`、`main.py`、`fe/src/layouts/AdminLayout.tsx` 等生产逻辑
- CI **不启动** docker postgres；**不执行** `alembic upgrade`（非 `--sql`）
- 前端根目录 **`fe/`**；测试仅 smoke render，不改壳层视觉、不新增 `data-testid`
- 保留上轮 T-MIG-01~20、T-HLT-01~15、T-CFG-01~03、T-TRC-01~10、T-CFT-01~05、T-FE-01~19、T-FE-DG-01~03 断言，仅扩展边缘场景
- T-CFG-06：`config.py` 当前无 `query_default_limit` ge 约束 → 采用 `documents_current_behavior` 断言 `query_default_limit == 0`（与 T-MIG-06 一致，不修改 config.py）
- T-TRC-11：`TraceIdMiddleware` 在 `request_finished` 前 `trace_id_var.reset()`（`middleware.py` L25–29）→ `finished` 行可能无 `traceId`；断言 `started.traceId == trace_id`；若 `finished.get("traceId")` 非 None 则须等于 `trace_id`
- 纯测试补强，通常无需 PRD/API/services 文档回写（`prd-sync.mdc` 豁免）
- 本地等价：`cd backend && ruff check . && pytest -v`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | 子项 | 动作 | 职责 |
|------|:----:|------|------|
| `tests/test_migrations.py` | BOOT-005 | 扩展 | T-MIG-21~24 downgrade `--sql`、stdout 无密钥、绑定端到端、导入性能 |
| `tests/test_health.py` | BOOT-001 | 扩展 | T-HLT-16~18 启动耗时、OpenAPI vs /me 401、GET 非法 Origin |
| `tests/test_config.py` | BOOT-004 | 扩展 | T-CFG-04~07 枚举/Fernet/数值边界/LOG_LEVEL WARNING |
| `tests/test_trace.py` | BOOT-004 | 扩展 | T-TRC-11~12；补强 T-TRC-04 finished traceId |
| `tests/conftest.py` | BOOT-006 | 扩展 | `combined_auth_trace_headers` fixture + 契约注释 |
| `tests/test_conftest_contract.py` | BOOT-006 | 扩展 | T-CFT-06~08 组合 fixture、连续隔离、development token |
| `tests/test_ci_env_contract.py` | BOOT-006 | **新建** | T-CI-01~03 CI env 与 frontend job 三步 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | BOOT-002 | 扩展 | T-FE-20~22 mobile Backdrop、desktop 折叠 margin、Token 契约 |
| `fe/src/routes.smoke.test.tsx` | BOOT-002 | 扩展 | T-FE-23 mobile `/admin` 壳层 smoke |

---

### Task 1: BOOT-005 — Alembic 降级路径与迁移配置安全负例

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `KNOWN_URL`、`clear_settings_cache` autouse fixture、`conftest` 预设 env、`backend_dir = Path(__file__).resolve().parents[1] / "backend"`
- Produces: `test_alembic_downgrade_base_sql_contains_ingestion_drop`、`test_alembic_upgrade_sql_stdout_excludes_secrets`、`test_settings_env_py_binding_end_to_end`、`test_migrations_env_reimport_under_budget`

- [ ] **Step 1: 在 `tests/test_migrations.py` 文件末尾追加 T-MIG-21~24**

```python
def test_alembic_downgrade_base_sql_contains_ingestion_drop():
    """T-MIG-21: alembic downgrade base --sql 子进程可预期降级链。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    env = os.environ.copy()
    env.setdefault("DATABASE_URL", KNOWN_URL)
    env.setdefault("SECRET_KEY", "ci-test-secret-key-min-32-chars-long!!")
    env.setdefault(
        "CREDENTIAL_FERNET_KEY",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "base", "--sql"],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    stdout_upper = result.stdout.upper()
    assert "DROP" in stdout_upper or "ingestion_sync_jobs" in result.stdout


def test_alembic_upgrade_sql_stdout_excludes_secrets():
    """T-MIG-22: upgrade head --sql stdout 不含 SECRET_KEY 明文。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    secret = os.environ["SECRET_KEY"]
    env = os.environ.copy()
    env.setdefault("DATABASE_URL", KNOWN_URL)
    env.setdefault("SECRET_KEY", secret)
    env.setdefault(
        "CREDENTIAL_FERNET_KEY",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert secret not in result.stdout
    assert "ci-test-secret" not in result.stdout


def test_settings_env_py_binding_end_to_end(monkeypatch):
    """T-MIG-23: 同一 DATABASE_URL 下 Settings 与 env.py set_main_option 一致。"""
    bound_url = "postgresql+psycopg://e2e:e2e@localhost:5432/e2e"
    monkeypatch.setenv("DATABASE_URL", bound_url)
    get_settings.cache_clear()
    assert get_settings().database_url == bound_url

    fake_settings = Settings(
        database_url=bound_url,
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", bound_url)
    sys.modules.pop("migrations.env", None)


def test_migrations_env_reimport_under_budget(monkeypatch):
    """T-MIG-24: DATABASE_URL 变更后重导入 migrations.env < 2s（rebind 路径）。"""
    url_a = "postgresql+psycopg://perf:a@localhost:5432/a"
    url_b = "postgresql+psycopg://perf:b@localhost:5432/b"

    def import_env_timed() -> float:
        sys.modules.pop("migrations.env", None)
        mock_config = MagicMock()
        mock_config.config_file_name = None
        mock_context = MagicMock()
        mock_context.config = mock_config
        mock_context.is_offline_mode.return_value = True
        mock_context.begin_transaction.return_value.__enter__ = MagicMock()
        mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)
        start = time.perf_counter()
        with patch("alembic.context", mock_context):
            importlib.import_module("migrations.env")
        return time.perf_counter() - start

    monkeypatch.setenv("DATABASE_URL", url_a)
    get_settings.cache_clear()
    assert import_env_timed() < 2.0

    monkeypatch.setenv("DATABASE_URL", url_b)
    get_settings.cache_clear()
    assert import_env_timed() < 2.0
    sys.modules.pop("migrations.env", None)
```

- [ ] **Step 2: 运行迁移测试验证通过**

Run:

```bash
cd backend && pytest ../tests/test_migrations.py -v
```

Expected: PASS（≥24 项，含 T-MIG-21~24）

- [ ] **Step 3: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): add downgrade --sql, stdout secret guard, binding e2e, reimport budget"
```

---

### Task 2: BOOT-001 — 健康检查启动耗时与公开/受保护路径边界

**Files:**
- Modify: `tests/test_health.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `client` fixture from `conftest.py`
- Produces: `test_health_first_request_startup_smoke`、`test_openapi_public_me_protected_boundary`、`test_health_get_illegal_origin_no_acao`

- [ ] **Step 1: 在 `tests/test_health.py` 顶部追加 `import time`，文件末尾追加 T-HLT-16~18**

```python
import time


def test_health_first_request_startup_smoke(client):
    """T-HLT-16: 首请求 GET /health 耗时 smoke < 2.0s。"""
    start = time.perf_counter()
    response = client.get("/health")
    elapsed = time.perf_counter() - start
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert elapsed < 2.0


def test_openapi_public_me_protected_boundary(client):
    """T-HLT-17: /openapi.json 公开；/api/v1/me 无 Token → 401。"""
    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "openapi" in openapi.json()

    me = client.get("/api/v1/me")
    assert me.status_code == 401
    assert me.json()["code"] == "UNAUTHORIZED"


def test_health_get_illegal_origin_no_acao(client):
    """T-HLT-18: GET /health 非法 Origin 无 access-control-allow-origin。"""
    response = client.get(
        "/health",
        headers={"Origin": "http://evil.example"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin is None or allow_origin != "http://evil.example"
```

- [ ] **Step 2: 运行健康检查测试**

Run:

```bash
cd backend && pytest ../tests/test_health.py -v
```

Expected: PASS（≥18 项，含 T-HLT-16~18）

- [ ] **Step 3: Commit**

```bash
git add tests/test_health.py
git commit -m "test(BOOT-001): add startup timing smoke, openapi/me boundary, GET illegal origin"
```

---

### Task 3: BOOT-004 — Settings 枚举/边界与 traceId 全链路

**Files:**
- Modify: `tests/test_config.py`
- Modify: `tests/test_trace.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `clear_settings_cache`（`test_config.py`）、`client` fixture、`JsonFormatter`、`configure_logging`
- Produces: T-CFG-04~07、T-TRC-11（内联补强 T-TRC-04）、T-TRC-12

- [ ] **Step 1: 在 `tests/test_config.py` 追加 import 与 T-CFG-04~07**

在文件顶部 `import pytest` 后追加 `import logging`；在 `from app.core.config import Settings, get_settings` 后追加 `from app.core.logging import configure_logging`；在 `from pydantic import ValidationError`（若无则新增 `from pydantic import ValidationError`）。

```python
from pydantic import ValidationError


_BASE_KWARGS = {
    "database_url": "postgresql+psycopg://ci:ci@localhost:5432/ci",
    "secret_key": "ci-test-secret-key-min-32-chars-long!!",
    "credential_fernet_key": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
}


def test_vitalspan_env_invalid_enum_raises():
    """T-CFG-04: vitalspan_env 非法枚举 → ValidationError。"""
    with pytest.raises(ValidationError):
        Settings(**_BASE_KWARGS, vitalspan_env="invalid")


def test_credential_fernet_key_invalid_raises():
    """T-CFG-05: 非法 credential_fernet_key → ValidationError 含中文提示。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(**_BASE_KWARGS, credential_fernet_key="not-a-valid-fernet-key")
    message = str(exc_info.value)
    assert "Fernet" in message or "CREDENTIAL_FERNET_KEY" in message


def test_query_default_limit_zero_documents_current_behavior():
    """T-CFG-06: query_default_limit=0 记录现状（当前无 ge 约束）。"""
    settings = Settings(**_BASE_KWARGS, query_default_limit=0)
    assert settings.query_default_limit == 0


def test_configure_logging_accepts_warning_level(monkeypatch):
    """T-CFG-07: LOG_LEVEL=WARNING 可加载。"""
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    get_settings.cache_clear()
    configure_logging(get_settings())
    assert logging.getLogger().level == logging.WARNING
```

- [ ] **Step 2: 补强 `tests/test_trace.py` 中 T-TRC-04 并追加 T-TRC-12**

在 `test_request_finished_log_contains_trace_id` 的 `assert finished.get("status_code") == 200` 之后追加：

```python
        finished_trace = finished.get("traceId")
        if finished_trace is not None:
            assert finished_trace == trace_id
```

在文件末尾追加：

```python
def test_non_hex_incoming_trace_id_preserved(client):
    """T-TRC-12: 非 hex 入站 X-Trace-Id 原样回显（middleware L16 行为）。"""
    custom = "not-hex-but-present"
    response = client.get("/health", headers={"X-Trace-Id": custom})
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == custom
```

- [ ] **Step 3: 运行配置与 trace 测试**

Run:

```bash
cd backend && pytest ../tests/test_config.py ../tests/test_trace.py -v
```

Expected: PASS（T-CFG-04~07、T-TRC-12；T-TRC-04 补强通过）

- [ ] **Step 4: Commit**

```bash
git add tests/test_config.py tests/test_trace.py
git commit -m "test(BOOT-004): add Settings enum/boundary tests and traceId finished/non-hex cases"
```

---

### Task 4: BOOT-002 — Admin 壳层响应式折叠与 design 门禁回归

**Files:**
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`
- Modify: `fe/src/routes.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `AdminLayout`、`AppHeader`、`Backdrop`、`AppSidebar` 壳层组件；断言 Tailwind 语义类 `bg-gray-900/50`、`xl:ml-[290px]`/`xl:ml-[90px]`、`max-w-(--breakpoint-2xl)`，无硬编码 hex
- desktop 1400 与 mobile 375 viewport 下侧栏/顶栏/main 无重叠（vitest class 断言）；`打开菜单` 按钮 `aria-label` 可达
- mobile：click `打开菜单` → Backdrop 可见；desktop：两次 toggle 切换 margin class
- `pnpm run check:design` 保持全绿（T-FE-DG-01~03 不回归）

**触及域：** `fe/**`（`fe-ui.mdc`）

**Interfaces:**
- Consumes: `setDesktopViewport()`（`routes.smoke.test.tsx` 已有）、`AdminLayout`、`AppRoutes`、`MemoryRouter`
- Produces: `setMobileViewport()`（各文件内联 ≤10 行）、T-FE-20~23

- [ ] **Step 1: 在 `fe/src/layouts/AdminLayout.smoke.test.tsx` 追加 viewport helper 与 T-FE-20~22**

在 `describe` 块内、`it("mounts sidebar...` 之前追加 helper：

```typescript
function setMobileViewport(width = 375) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function setDesktopViewport(width = 1400) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}
```

在 `describe` 末尾追加三个 `it`：

```typescript
  it("shows mobile backdrop when menu opens at 375px (T-FE-20)", () => {
    setMobileViewport(375);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    fireEvent.click(menuBtn);
    const backdrop = document.querySelector('[class*="bg-gray-900/50"]');
    expect(backdrop).not.toBeNull();
  });

  it("toggles desktop sidebar margin between 290px and 90px (T-FE-21)", () => {
    setDesktopViewport(1400);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    const main = screen.getAllByRole("main")[0];
    const contentWrapper = main.parentElement;
    expect(contentWrapper?.className).toContain("xl:ml-[290px]");

    fireEvent.click(menuBtn);
    expect(contentWrapper?.className).toContain("xl:ml-[90px]");

    fireEvent.click(menuBtn);
    expect(contentWrapper?.className).toContain("xl:ml-[290px]");
  });

  it("main and navigation token contract (T-FE-22)", () => {
    setDesktopViewport(1400);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-(--breakpoint-2xl)");
    expect(
      screen.getByRole("navigation", { name: "管理端导航" }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: 在 `fe/src/routes.smoke.test.tsx` 追加 `setMobileViewport` 与 T-FE-23**

在 `setDesktopViewport` 函数之后追加：

```typescript
function setMobileViewport(width = 375) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}
```

在 `describe` 末尾追加：

```typescript
  it("renders admin shell at mobile 375px (T-FE-23)", () => {
    setMobileViewport(375);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole("button", { name: "打开菜单" }).length,
    ).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 3: 运行前端测试与 design 门禁**

Run:

```bash
cd fe && pnpm test
cd fe && pnpm build && pnpm run check:design
```

Expected: PASS（含 T-FE-20~23；T-FE-DG-01~03 保持绿）

- [ ] **Step 4: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx fe/src/routes.smoke.test.tsx
git commit -m "test(BOOT-002): add mobile/desktop viewport AdminLayout smoke tests"
```

---

### Task 5: BOOT-006 — conftest 组合 fixture、契约测试与 CI env 对齐

**Files:**
- Modify: `tests/conftest.py`
- Modify: `tests/test_conftest_contract.py`
- Create: `tests/test_ci_env_contract.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: 既有 `auth_headers`、`trace_id_headers` fixtures；`.github/workflows/ci.yml` 文本
- Produces: `combined_auth_trace_headers` fixture；T-CFT-06~08；T-CI-01~03

- [ ] **Step 1: 扩展 `tests/conftest.py`**

在 `trace_id_headers` fixture 之后追加：

```python
@pytest.fixture
def combined_auth_trace_headers(
    auth_headers: dict[str, str],
    trace_id_headers: dict[str, str],
) -> dict[str, str]:
    return {**auth_headers, **trace_id_headers}
```

在契约注释块（L20–24）追加一行：

```python
# - combined_auth_trace_headers: auth_headers ∪ trace_id_headers for me+trace combo tests
```

- [ ] **Step 2: 扩展 `tests/test_conftest_contract.py` 追加 T-CFT-06~08**

```python
from app.core.config import get_settings


def test_combined_auth_trace_headers_fixture(client, combined_auth_trace_headers):
    """T-CFT-06: combined_auth_trace_headers 同时满足 me 200 + trace 回显。"""
    me = client.get("/api/v1/me", headers=combined_auth_trace_headers)
    assert me.status_code == 200
    assert me.json()["username"] == "dev"

    incoming = combined_auth_trace_headers["X-Trace-Id"]
    health = client.get("/health", headers=combined_auth_trace_headers)
    assert health.status_code == 200
    assert health.headers.get("X-Trace-Id") == incoming


def test_consecutive_client_requests_trace_isolation(client):
    """T-CFT-07: 连续 GET /health 各自生成或可透传 X-Trace-Id。"""
    first = client.get("/health")
    second = client.get("/health")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.headers.get("X-Trace-Id")
    assert second.headers.get("X-Trace-Id")


def test_development_env_allows_dev_token(client, auth_headers):
    """T-CFT-08: development 环境 auth_headers Bearer dev 可达 /api/v1/me。"""
    assert get_settings().vitalspan_env == "development"
    assert auth_headers == {"Authorization": "Bearer dev"}
    response = client.get("/api/v1/me", headers=auth_headers)
    assert response.status_code == 200
```

- [ ] **Step 3: 新建 `tests/test_ci_env_contract.py`**

```python
"""T-CI-01~03: CI workflow env 与 conftest 默认值对齐（BOOT-006）。"""

import re
from pathlib import Path

import pytest

CONFTEST_DEFAULTS = {
    "DATABASE_URL": "postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan",
    "SECRET_KEY": "ci-test-secret-key-min-32-chars-long!!",
    "CREDENTIAL_FERNET_KEY": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
}

CI_YML = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"


@pytest.fixture(scope="module")
def ci_yml_text() -> str:
    return CI_YML.read_text(encoding="utf-8")


def _extract_backend_env_value(text: str, key: str) -> str:
    """从 backend job env 块提取 KEY: value。"""
    pattern = rf"^\s+{re.escape(key)}:\s+(.+)$"
    match = re.search(pattern, text, re.MULTILINE)
    assert match is not None, f"missing {key} in ci.yml backend env"
    return match.group(1).strip()


def test_ci_yml_backend_env_has_required_keys(ci_yml_text):
    """T-CI-01: ci.yml backend job env 含三必填键。"""
    for key in CONFTEST_DEFAULTS:
        assert f"{key}:" in ci_yml_text


def test_ci_env_values_match_conftest_defaults(ci_yml_text):
    """T-CI-02: ci env 默认值与 conftest setdefault 一致。"""
    for key, expected in CONFTEST_DEFAULTS.items():
        actual = _extract_backend_env_value(ci_yml_text, key)
        assert actual == expected, f"{key}: ci={actual!r} conftest={expected!r}"


def test_ci_frontend_job_has_test_build_check_design(ci_yml_text):
    """T-CI-03: frontend job 含 pnpm test、build、check:design。"""
    assert "pnpm test" in ci_yml_text
    assert "pnpm build" in ci_yml_text
    assert "check:design" in ci_yml_text
```

- [ ] **Step 4: 运行 backend 全量门禁**

Run:

```bash
cd backend && ruff check . && pytest -v
```

Expected: PASS（含 T-CFT-06~08、T-CI-01~03；既有用例无回归）

- [ ] **Step 5: 核对 `.github/workflows/ci.yml` 结构不变**

Run:

```bash
git diff .github/workflows/ci.yml
```

Expected: 无 diff（新测由 `pytest -v` 自动拾取，workflow 结构不变）

- [ ] **Step 6: Commit**

```bash
git add tests/conftest.py tests/test_conftest_contract.py tests/test_ci_env_contract.py
git commit -m "test(BOOT-006): add combined fixture, conftest contracts, and CI env alignment tests"
```

---

### Task 6: 全量验证（P4 等价）

**Files:**（只读验证，无修改）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: Backend 全量**

Run:

```bash
cd backend && ruff check . && pytest -v
```

Expected: exit_code = 0

- [ ] **Step 2: Frontend 全量**

Run:

```bash
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

Expected: exit_code = 0

- [ ] **Step 3: 最终 commit（若有遗漏 staged 文件）**

```bash
git status
```

Expected: working tree clean

---

## Spec Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 五项均有对应 Task | ✓ Task 1~5 映射 BOOT-005/001/004/002/006 |
| 无 TBD/TODO/「适当处理」占位符 | ✓ |
| 每 Task 含验证命令与期望输出 | ✓ |
| 前端 Task 4 含 Skills + UI Acceptance | ✓ |
| 预估修改文件 9 ≤ 20 | ✓ |
| 不修改生产代码 | ✓ Global Constraints 明确 |
| T-CFG-06 / T-TRC-11 与现状对齐说明 | ✓ Global Constraints |
