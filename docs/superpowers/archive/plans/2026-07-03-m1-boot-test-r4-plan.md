# M1 BOOT 测试与安全补强（r4）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_migrations.py`、`tests/test_health.py`、`tests/test_trace.py`、`tests/conftest.py`、`fe/src/routes.smoke.test.tsx`、`fe/src/layouts/AdminLayout.smoke.test.tsx`、`fe/scripts/check-design.fixture.test.mjs`、`fe/scripts/__fixtures__/check-design/rgb-only/bad-rgb.tsx`（新建 1 + 修改 7 = 8 文件；只读参照 11，合计框定 19 ≤ 20）
> **子项：** BOOT-005、BOOT-002、BOOT-006、BOOT-001、BOOT-004
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `tests/**/*.py`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 扩展 pytest/vitest 凭证负例、CORS 非法 Origin、`/redoc` 公开路径、TraceId 全链路日志、`LOG_LEVEL` 边界、Admin 壳层 a11y smoke 与 `rgb()` design 门禁负向，推动 BOOT-005/002/006/001/004 测试覆盖维由 68–82% 向 ≥90 靠拢。

**Architecture:** 子项 1（BOOT-005）扩展 `test_migrations.py`；子项 2（BOOT-002）扩展 fe vitest + node:test design fixture；子项 3（BOOT-006）固化 `conftest` TraceId fixture；子项 4–5（BOOT-001/004）扩展 health/trace 测试。全程**不修改**生产代码；后端 `TestClient` + monkeypatch，不启 docker postgres。

**Tech Stack:** Python 3.11、pytest 8、pydantic v2 ValidationError、FastAPI TestClient、vitest 3、@testing-library/react、jsdom、node:test、pnpm 9、GitHub Actions

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- **不修改** `backend/app/core/config.py`、`logging.py`、`migrations/env.py`、`main.py`、`fe/src/layouts/AdminLayout.tsx` 等生产逻辑
- CI **不启动** docker postgres；**不执行** `alembic upgrade`
- 前端根目录 **`fe/`**；测试仅 smoke render，不改壳层视觉、不新增 `data-testid`
- 保留上轮 T-MIG-01~06、T-HLT-01~08、T-TRC-01~03、T-FE-01~07、T-FE-DG-01~02 断言，仅扩展边缘场景
- 纯测试补强，通常无需 PRD/API/services 文档回写（`prd-sync.mdc` 豁免）
- 本地等价：`cd backend && ruff check . && pytest -v`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | 子项 | 动作 | 职责 |
|------|:----:|------|------|
| `tests/test_migrations.py` | 1 | 扩展 | T-MIG-07~11 凭证负例、env 导入失败、非法 URL、offline URL 一致 |
| `fe/src/routes.smoke.test.tsx` | 2 | 扩展 | T-FE-08~09 导航链接 href、h1 层级 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | 2 | 扩展 | T-FE-10 移动菜单按钮 aria-label |
| `fe/scripts/check-design.fixture.test.mjs` | 2 | 扩展 | T-FE-DG-03 rgb 负向 |
| `fe/scripts/__fixtures__/check-design/rgb-only/bad-rgb.tsx` | 2 | 新建 | rgb 违规 fixture |
| `tests/conftest.py` | 3 | 扩展 | `trace_id_headers` fixture + 契约注释 |
| `tests/test_health.py` | 4 | 扩展 | T-HLT-09~12 CORS 非法 Origin、`/redoc`、GET ACAO、OpenAPI 版本 |
| `tests/test_trace.py` | 5 | 扩展 | T-TRC-04~08 request_finished、LOG_LEVEL、空 Trace-Id |

---

### Task 1: BOOT-005 — Settings 凭证负例与 migrations/env 失败路径

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `KNOWN_URL` 常量、`clear_settings_cache` autouse fixture、`conftest` 预设 env
- Produces: `test_settings_missing_secret_key_raises`、`test_settings_missing_credential_fernet_key_raises`、`test_migrations_env_fails_when_get_settings_raises`、`test_settings_invalid_database_url_documents_current_behavior`、`test_migrations_offline_url_matches_settings`

- [ ] **Step 1: 在 `tests/test_migrations.py` 追加 T-MIG-07~11 五个测试函数**

```python
def test_settings_missing_secret_key_raises(monkeypatch):
    """T-MIG-07: 缺 SECRET_KEY 时 Settings 实例化失败。"""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        Settings(
            database_url=KNOWN_URL,
            credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        )


def test_settings_missing_credential_fernet_key_raises(monkeypatch):
    """T-MIG-08: 缺 CREDENTIAL_FERNET_KEY 时 Settings 实例化失败。"""
    monkeypatch.delenv("CREDENTIAL_FERNET_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        Settings(
            database_url=KNOWN_URL,
            secret_key="ci-test-secret-key-min-32-chars-long!!",
        )


def test_migrations_env_fails_when_get_settings_raises(monkeypatch):
    """T-MIG-09: migrations/env.py 在 get_settings() 失败时无法完成 URL 绑定。"""
    validation_error = ValidationError.from_exception_data(
        "Settings",
        [{"type": "missing", "loc": ("database_url",), "input": {}}],
    )

    def raise_validation():
        raise validation_error

    monkeypatch.setattr("app.core.config.get_settings", raise_validation)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    with pytest.raises(ValidationError):
        importlib.import_module("migrations.env")


def test_settings_invalid_database_url_documents_current_behavior():
    """T-MIG-10: 非法格式 database_url 记录现状（当前无 URL 校验）。"""
    settings = Settings(
        database_url="not-a-url",
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    assert settings.database_url == "not-a-url"


def test_migrations_offline_url_matches_settings(monkeypatch):
    """T-MIG-11: offline 模式 context.configure 的 url 与 set_main_option 一致。"""
    fake_settings = Settings(
        database_url=KNOWN_URL,
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()

    mock_config = MagicMock()
    mock_config.config_file_name = None

    sys.modules.pop("migrations.env", None)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True
    captured_urls: list[str] = []

    def capture_configure(**kwargs):
        if "url" in kwargs:
            captured_urls.append(kwargs["url"])

    mock_context.configure = capture_configure
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock()

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", KNOWN_URL)
    assert captured_urls == [KNOWN_URL]
```

- [ ] **Step 2: 运行迁移测试验证通过**

Run:

```bash
cd backend && pytest tests/test_migrations.py -v
```

Expected: 11 passed（T-MIG-01~11 全绿）

- [ ] **Step 3: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): add credential negative cases and env import failure path"
```

---

### Task 2: BOOT-002 — 扩展路由 smoke（T-FE-08~09）

**Files:**
- Modify: `fe/src/routes.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `b-design-system-tailadmin-radix` 壳层契约：侧栏「数据源」链接、`AdminHomePage` h1 主标题
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡（本轮 jsdom smoke，P4 人工 QA 补截图）
- 默认加载态壳层可回归；不测 empty/error/权限 API 态（M1 静态壳层）
- 通过 `pnpm run check:design` 静态检查（生产 `src/` 无硬编码色）

- [ ] **Step 1: 在 `fe/src/routes.smoke.test.tsx` 追加两个用例**

```tsx
  it("renders datasource nav link pointing to /admin (T-FE-08)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link", { name: "数据源" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "/admin");
  });

  it("renders AdminHome welcome as h1 (T-FE-09)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "欢迎使用 VitalSpan" }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行 vitest 验证通过**

Run:

```bash
cd fe && pnpm exec vitest run src/routes.smoke.test.tsx
```

Expected: 6 passed（T-FE-01、03~05、08~09）

- [ ] **Step 3: Commit**

```bash
git add fe/src/routes.smoke.test.tsx
git commit -m "test(BOOT-002): add nav link href and h1 a11y smoke assertions"
```

---

### Task 3: BOOT-002 — AdminLayout a11y 与 rgb design 门禁负向

**Files:**
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`
- Modify: `fe/scripts/check-design.fixture.test.mjs`
- Create: `fe/scripts/__fixtures__/check-design/rgb-only/bad-rgb.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `b-design-system-tailadmin-radix` 顶栏移动菜单按钮 `aria-label="打开菜单"` 契约
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡（jsdom 断言按钮存在于 DOM）
- hover/focus/active/loading/empty/error 不测（M1 静态壳层，design §9.2）
- T-FE-DG-03 验证 `check:design` 对 `rgb()` 与 hex 同等门禁强度

- [ ] **Step 1: 在 `fe/src/layouts/AdminLayout.smoke.test.tsx` 追加 T-FE-10**

```tsx
  it("renders mobile menu button with accessible label (T-FE-10)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "打开菜单" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: 新建 rgb 违规 fixture**

Create `fe/scripts/__fixtures__/check-design/rgb-only/bad-rgb.tsx`:

```tsx
export const BadRgb = () => (
  <div style={{ background: "rgb(255, 0, 0)" }}>bad</div>
);
```

- [ ] **Step 3: 在 `fe/scripts/check-design.fixture.test.mjs` 追加 T-FE-DG-03**

```javascript
test("T-FE-DG-03: rgb() in fixture fails check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "rgb-only"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});
```

- [ ] **Step 4: 运行前端测试与 design 门禁**

Run:

```bash
cd fe && pnpm exec vitest run src/layouts/AdminLayout.smoke.test.tsx
cd fe && node --test scripts/check-design.fixture.test.mjs
cd fe && pnpm build && pnpm run check:design
```

Expected: vitest 3 passed（T-FE-06~07、10）；node:test 3 passed（T-FE-DG-01~03）；build 与 check:design 全绿

- [ ] **Step 5: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx fe/scripts/check-design.fixture.test.mjs fe/scripts/__fixtures__/check-design/rgb-only/bad-rgb.tsx
git commit -m "test(BOOT-002): add mobile menu a11y smoke and rgb design gate negative"
```

---

### Task 4: BOOT-006 — 固化 conftest TraceId fixture 契约

**Files:**
- Modify: `tests/conftest.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: 现有 `client`、`auth_headers`、`unauthorized_headers`
- Produces: `trace_id_headers` fixture（32 hex `X-Trace-Id`），供 `test_trace.py` T-TRC-02 及新用例复用

- [ ] **Step 1: 更新 `tests/conftest.py` 注释块与新增 fixture**

将顶部注释块替换为：

```python
# Fixture contract (BOOT-006):
# - client: TestClient(app) for all backend HTTP tests
# - auth_headers: {"Authorization": "Bearer dev"} for protected routes in development
# - unauthorized_headers: {"Authorization": "Bearer invalid"} for 401 negative cases
# - trace_id_headers: {"X-Trace-Id": "<32-hex>"} for TraceId passthrough tests
```

在 `unauthorized_headers` fixture 之后追加：

```python
@pytest.fixture
def trace_id_headers() -> dict[str, str]:
    return {"X-Trace-Id": "a1b2c3d4e5f6789012345678abcdef01"}
```

- [ ] **Step 2: 重构 T-TRC-02 使用 fixture（可选但推荐，验证契约）**

在 `tests/test_trace.py` 的 `test_health_preserves_incoming_trace_id` 中，将函数签名改为接受 `trace_id_headers`：

```python
def test_health_preserves_incoming_trace_id(client, trace_id_headers):
    """T-TRC-02: 透传已有 X-Trace-Id 请求头。"""
    incoming = trace_id_headers["X-Trace-Id"]
    response = client.get("/health", headers=trace_id_headers)
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == incoming
```

- [ ] **Step 3: 运行全量 backend 测试验证 fixture 无回归**

Run:

```bash
cd backend && ruff check . && pytest -v
```

Expected: 全绿（含既有 test_me、test_auth 等）

- [ ] **Step 4: Commit**

```bash
git add tests/conftest.py tests/test_trace.py
git commit -m "test(BOOT-006): add trace_id_headers fixture and update T-TRC-02"
```

---

### Task 5: BOOT-001 — CORS 非法 Origin 与公开路径边界

**Files:**
- Modify: `tests/test_health.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `client` fixture
- Produces: `test_health_cors_preflight_illegal_origin_no_acao`、`test_redoc_public`、`test_health_get_allowed_origin_returns_acao`、`test_openapi_json_has_version_key`

- [ ] **Step 1: 在 `tests/test_health.py` 追加 T-HLT-09~12**

```python
def test_health_cors_preflight_illegal_origin_no_acao(client):
    """T-HLT-09: OPTIONS /health 非法 Origin 无 Access-Control-Allow-Origin。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin is None or allow_origin != "http://evil.example"


def test_redoc_public(client):
    """T-HLT-10: GET /redoc 公开可访问。"""
    response = client.get("/redoc")
    assert response.status_code == 200


def test_health_get_allowed_origin_returns_acao(client):
    """T-HLT-11: GET /health 带允许 Origin 返回 ACAO。"""
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_openapi_json_has_version_key(client):
    """T-HLT-12: OpenAPI 文档含 openapi 3.x 版本键。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert "openapi" in body
    assert str(body["openapi"]).startswith("3.")
```

- [ ] **Step 2: 运行 health 测试验证通过**

Run:

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: 12 passed（T-HLT-01~12 全绿）

- [ ] **Step 3: Commit**

```bash
git add tests/test_health.py
git commit -m "test(BOOT-001): add illegal Origin CORS, /redoc public, GET ACAO cases"
```

---

### Task 6: BOOT-004 — TraceId 全链路与 LOG_LEVEL 边界

**Files:**
- Modify: `tests/test_trace.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `client`、`trace_id_headers`（Task 4）、`JsonFormatter`、`configure_logging`、`get_settings`
- Produces: `test_request_finished_log_contains_trace_id`、`test_settings_default_log_level_is_info`、`test_configure_logging_accepts_debug_level`、`test_empty_trace_id_header_generates_new_trace`、`test_configure_logging_rejects_invalid_log_level`

- [ ] **Step 1: 在 `tests/test_trace.py` 顶部追加 import**

```python
from app.core.config import Settings, get_settings
from app.core.logging import JsonFormatter, configure_logging
```

- [ ] **Step 2: 追加 T-TRC-04~08 五个测试函数**

```python
def test_request_finished_log_contains_trace_id(client):
    """T-TRC-04: request_finished 日志 JSON 含 traceId。"""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        trace_id = response.headers["X-Trace-Id"]
        lines = [line for line in stream.getvalue().splitlines() if line.strip()]
        payloads = [json.loads(line) for line in lines]
        finished = next(p for p in payloads if p.get("message") == "request_finished")
        assert finished.get("traceId") == trace_id
    finally:
        logger.removeHandler(handler)


def test_settings_default_log_level_is_info():
    """T-TRC-05: Settings 默认 log_level == INFO。"""
    assert get_settings().log_level == "INFO"


def test_configure_logging_accepts_debug_level(monkeypatch):
    """T-TRC-06: LOG_LEVEL=DEBUG 可加载。"""
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    get_settings.cache_clear()
    configure_logging(get_settings())
    assert logging.getLogger().level == logging.DEBUG


def test_empty_trace_id_header_generates_new_trace(client):
    """T-TRC-07: 空 X-Trace-Id 生成新 trace。"""
    response = client.get("/health", headers={"X-Trace-Id": ""})
    assert response.status_code == 200
    trace_id = response.headers.get("X-Trace-Id")
    assert trace_id
    assert TRACE_ID_HEX_PATTERN.match(trace_id)


def test_configure_logging_rejects_invalid_log_level():
    """T-TRC-08: 非法 LOG_LEVEL 结构化失败。"""
    settings = Settings(
        database_url="postgresql+psycopg://ci:ci@localhost:5432/ci",
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        log_level="NOT_A_LEVEL",
    )
    with pytest.raises(ValueError):
        configure_logging(settings)
```

- [ ] **Step 3: 在 `tests/test_trace.py` 追加 pytest import（若 Step 1 未含）**

文件顶部需有 `import pytest`（T-TRC-08 使用 `pytest.raises`）。

- [ ] **Step 4: 运行 trace 测试验证通过**

Run:

```bash
cd backend && pytest tests/test_trace.py -v
```

Expected: 8 passed（T-TRC-01~08 全绿）

- [ ] **Step 5: Commit**

```bash
git add tests/test_trace.py
git commit -m "test(BOOT-004): add request_finished traceId and LOG_LEVEL boundary cases"
```

---

### Task 7: BOOT-006 — 全量 CI 等价验证

**Files:**
- 只读核对: `.github/workflows/ci.yml`（无变更则记「已核对」）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**Interfaces:**
- Consumes: Task 1~6 全部交付
- Produces: 本地与 CI 命令等价确认

- [ ] **Step 1: 运行 backend 全量门禁**

Run:

```bash
cd backend && ruff check . && pytest -v
```

Expected: 全绿；新增用例 T-MIG-07~11、T-HLT-09~12、T-TRC-04~08 均被拾取

- [ ] **Step 2: 运行 frontend 全量门禁**

Run:

```bash
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

Expected: vitest + node:test 全绿（≥11 项）；build 与 check:design 全绿

- [ ] **Step 3: 核对 CI 与本地命令等价**

对照 `.github/workflows/ci.yml`：

| Job | CI 命令 | 本地等价 |
|-----|---------|----------|
| backend | `ruff check .` + `pytest -v` | `cd backend && ruff check . && pytest -v` |
| frontend | `pnpm test` + `pnpm build` + `pnpm run check:design` | `cd fe && pnpm test && pnpm build && pnpm run check:design` |

Expected: 命令一致，无需修改 `ci.yml`

- [ ] **Step 4: Commit（若有未提交变更则跳过）**

```bash
git status --short
```

Expected: 工作区干净

---

## 自检清单（P2）

- [x] 覆盖 round-target 全部 5 子项（BOOT-005/002/006/001/004）
- [x] 每个 design 子项有对应 Task（1→5、2→2+3、3→4+7、4→5、5→6）
- [x] 无 TBD/TODO/占位符
- [x] 每 Task 含 Files 与验证命令
- [x] 触及 `fe/` 的 Task 2、3 含 UI skill 与 UI Acceptance
- [x] 预估 8 文件（≤20）
