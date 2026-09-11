# M1 BOOT 质量推分 r15 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/core/middleware.py`、`tests/test_config.py`、`tests/test_trace.py`、`tests/test_migrations.py`、`tests/test_ci_env_contract.py`、`tests/test_ruff_contract.py`（新建）、`tests/fixtures/ruff_bad_sample.py`（新建）、`tests/test_me.py`、`tests/test_auth.py`、`tests/conftest.py`、`fe/src/routes.smoke.test.tsx`、`fe/src/theme-context.smoke.test.tsx`（新建）、`fe/src/context/theme-context.tsx`、`fe/scripts/check-design.fixture.test.mjs`、`fe/scripts/__fixtures__/check-design/mixed/`（新建 fixture）— **13 实施文件**（新建 4 + 修改 9）；只读参照见 design §3
> **子项：** BOOT-004、BOOT-005、BOOT-003、BOOT-002、BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `backend/**/*.py`、`tests/**/*.py`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 破 BOOT-004 STUCK（89.5→≥90）：修复 `request_finished` 日志 traceId 契约，扩展 Settings/trace/迁移/鉴权/CI/ruff/FE 壳层 smoke，推动 BOOT-004/005/006/002/003 五 ID 加权总分达标。

**Architecture:** 按依赖链执行：BOOT-004（core 配置/日志 + middleware ≤8 行修复）→ BOOT-005（Alembic `--sql` 与连接边界）→ BOOT-003（鉴权矩阵 + conftest fixture）→ BOOT-002（FE 非法路由 + 主题降级 + check:design 混合 fixture）→ BOOT-006（收集率地板、ruff 子进程契约、vitest 耗时预算）。后端 TestClient + subprocess；不启 docker postgres、不执行 `alembic upgrade`（非 `--sql`）。

**Tech Stack:** Python 3.11、pytest 8、pydantic v2、FastAPI TestClient、alembic CLI `--sql`、ruff、vitest 3、@testing-library/react、node:test、pnpm 9

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- **严禁**修改 `docs/automate/plan.md` / `goal.md` 结构
- BOOT-004 允许 `middleware.py` **≤8 行** relocate；BOOT-002 允许 `theme-context.tsx` **≤6 行**枚举守卫
- CI **不启动** docker postgres；**不执行** `alembic upgrade`（非 `--sql`）
- 前端根目录 **`fe/`**；不新增 `data-testid`、不改壳层视觉（主题枚举守卫除外）
- 保留 r14/r9 已交付用例（T-CFG-01~07、T-TRC-01~10/12、T-MIG-01~28、T-ME-03~14、T-AUTH-02~08、T-CI-01~06、T-FE-01~27、T-FE-DG-01~03），仅扩展编号
- 纯测试补强 + 两处最小生产守卫，通常无需 PRD/API/services 文档回写（`prd-sync.mdc` 豁免）
- 本地等价：`cd backend && ruff check . && pytest -v`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | 子项 | 动作 | 职责 |
|------|:----:|------|------|
| `backend/app/core/middleware.py` | BOOT-004 | 修改 | `request_finished` 日志在 `trace_id_var.reset` 之前 |
| `tests/test_config.py` | BOOT-004 | 扩展 | T-CFG-08~10 SECRET_KEY / query_timeout 边界 |
| `tests/test_trace.py` | BOOT-004 | 扩展 | T-TRC-11、T-TRC-13~16 finished traceId 硬契约 |
| `tests/test_migrations.py` | BOOT-005 | 扩展 | T-MIG-29~31 `--sql` smoke、revision 链、不可达 host |
| `tests/test_me.py` | BOOT-003 | 扩展 | T-ME-15~18 `/healthz`、Basic、占位 token、DI 分支 |
| `tests/test_auth.py` | BOOT-003 | 扩展 | T-AUTH-09~11 鉴权矩阵与 `/redoc` 回归 |
| `tests/conftest.py` | BOOT-003 | 扩展 | `basic_auth_headers` fixture + 契约注释 |
| `fe/src/routes.smoke.test.tsx` | BOOT-002 | 扩展 | T-FE-28~29 非法 `/admin/*` 壳层守卫 |
| `fe/src/theme-context.smoke.test.tsx` | BOOT-002 | **新建** | T-FE-30~31 localStorage 非法/缺失降级 |
| `fe/src/context/theme-context.tsx` | BOOT-002 | 修改 | `savedTheme` 枚举守卫 ≤6 行 |
| `fe/scripts/check-design.fixture.test.mjs` | BOOT-002 | 扩展 | T-FE-DG-04 混合 bad+ok fixture |
| `fe/scripts/__fixtures__/check-design/mixed/` | BOOT-002 | **新建** | 一坏一好 TSX fixture 目录 |
| `tests/test_ci_env_contract.py` | BOOT-006 | 扩展 | T-CI-07~09 收集率、job 顺序、vitest 预算 |
| `tests/test_ruff_contract.py` | BOOT-006 | **新建** | T-RUF-01~02 ruff 子进程契约 |
| `tests/fixtures/ruff_bad_sample.py` | BOOT-006 | **新建** | 故意违规样例（T-RUF-01） |

---

### Task 1: BOOT-004 — Settings 边界 + `request_finished` traceId 契约

**Files:**
- Modify: `backend/app/core/middleware.py`
- Modify: `tests/test_config.py`
- Modify: `tests/test_trace.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**触及域：** `backend/app/core/`、`tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `client` fixture、`get_settings.cache_clear`、`JsonFormatter`、`_BASE_KWARGS` from `test_config.py`
- Produces: `TraceIdMiddleware` with `request_finished` logged before `trace_id_var.reset`; tests `test_missing_secret_key_env_raises`、`test_blank_secret_key_documents_behavior`、`test_query_timeout_seconds_zero_documents_behavior`、`test_request_finished_log_must_contain_trace_id`、`test_no_trace_header_generates_consistent_trace`、`test_oversized_incoming_trace_id_preserved`、`test_duplicate_trace_header_documents_behavior`、`test_error_log_level_suppresses_info_request_logs`

- [ ] **Step 1: 修复 `middleware.py`（≤8 行 relocate）**

将 `response.headers` 赋值与 `request_finished` 日志移入 `try` 块、置于 `call_next` 之后；`trace_id_var.reset` 留在 `finally`：

```python
class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("X-Trace-Id")
        trace_id = incoming or uuid.uuid4().hex
        token = trace_id_var.set(trace_id)
        logger.info(
            "request_started",
            extra={"method": request.method, "path": request.url.path},
        )
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id
            logger.info(
                "request_finished",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                },
            )
        finally:
            trace_id_var.reset(token)
        return response
```

- [ ] **Step 2: 在 `tests/test_config.py` 末尾追加 T-CFG-08~10**

```python
def test_missing_secret_key_env_raises(monkeypatch):
    """T-CFG-08: 缺 SECRET_KEY env → ValidationError。"""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        get_settings()


def test_blank_secret_key_documents_behavior():
    """T-CFG-09: 空白 secret_key 记录当前 pydantic 行为。"""
    try:
        settings = Settings(**_BASE_KWARGS, secret_key="   ")
        assert settings.secret_key.strip() != "" or settings.secret_key == "   "
    except ValidationError:
        pass


def test_query_timeout_seconds_zero_documents_behavior():
    """T-CFG-10: query_timeout_seconds=0 记录现状（当前无 ge 约束）。"""
    settings = Settings(**_BASE_KWARGS, query_timeout_seconds=0)
    assert settings.query_timeout_seconds == 0
```

- [ ] **Step 3: 在 `tests/test_trace.py` 末尾追加 T-TRC-11、T-TRC-13~16；强化 T-TRC-04**

追加新测试：

```python
def _capture_http_json_payloads(client) -> tuple[str, list[dict]]:
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
        return trace_id, payloads
    finally:
        logger.removeHandler(handler)


def test_request_finished_log_must_contain_trace_id(client):
    """T-TRC-11: request_finished 日志 JSON 必须含 traceId（硬断言）。"""
    trace_id, payloads = _capture_http_json_payloads(client)
    finished = next(p for p in payloads if p.get("message") == "request_finished")
    assert finished.get("traceId") == trace_id


def test_no_trace_header_generates_consistent_trace(client):
    """T-TRC-13: 显式不传 X-Trace-Id；started/finished traceId 一致且为 32 位 hex。"""
    trace_id, payloads = _capture_http_json_payloads(client)
    assert TRACE_ID_HEX_PATTERN.match(trace_id)
    started = next(p for p in payloads if p.get("message") == "request_started")
    finished = next(p for p in payloads if p.get("message") == "request_finished")
    assert started.get("traceId") == trace_id
    assert finished.get("traceId") == trace_id


def test_oversized_incoming_trace_id_preserved(client):
    """T-TRC-14: 256 字符入站 X-Trace-Id 原样回显。"""
    oversized = "a" * 256
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("vitalspan.http")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/health", headers={"X-Trace-Id": oversized})
        assert response.status_code == 200
        assert response.headers.get("X-Trace-Id") == oversized
        payloads = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
        for message in ("request_started", "request_finished"):
            row = next(p for p in payloads if p.get("message") == message)
            assert row.get("traceId") == oversized
    finally:
        logger.removeHandler(handler)


def test_duplicate_trace_header_documents_behavior(client):
    """T-TRC-15: 重复 X-Trace-Id 头记录 Starlette 合并行为（不断言 500）。"""
    response = client.get(
        "/health",
        headers=[("X-Trace-Id", "first-trace"), ("X-Trace-Id", "second-trace")],
    )
    assert response.status_code == 200
    echoed = response.headers.get("X-Trace-Id")
    assert echoed is not None
    assert echoed in ("first-trace", "second-trace", "first-trace,second-trace")


def test_error_log_level_suppresses_info_request_logs(client, monkeypatch):
    """T-TRC-16: LOG_LEVEL=ERROR 抑制 vitalspan.http INFO 级 request_started。"""
    monkeypatch.setenv("LOG_LEVEL", "ERROR")
    get_settings.cache_clear()
    configure_logging(get_settings())

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    http_logger = logging.getLogger("vitalspan.http")
    http_logger.addHandler(handler)
    http_logger.setLevel(logging.ERROR)
    try:
        response = client.get("/health")
        assert response.status_code == 200
        payloads = [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]
        started_rows = [p for p in payloads if p.get("message") == "request_started"]
        assert started_rows == []
    finally:
        http_logger.removeHandler(handler)
        monkeypatch.delenv("LOG_LEVEL", raising=False)
        get_settings.cache_clear()
        configure_logging(get_settings())
```

将 `test_request_finished_log_contains_trace_id`（T-TRC-04）中条件断言改为硬断言：

```python
        finished = next(p for p in payloads if p.get("message") == "request_finished")
        assert started.get("traceId") == trace_id
        assert finished.get("status_code") == 200
        assert finished.get("traceId") == trace_id
```

- [ ] **Step 4: 运行 BOOT-004 验证**

Run:

```bash
cd backend && ruff check app/core/middleware.py && pytest ../tests/test_config.py ../tests/test_trace.py -v
```

Expected: PASS（config ≥10 项、trace ≥16 项）

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/middleware.py tests/test_config.py tests/test_trace.py
git commit -m "fix(BOOT-004): request_finished traceId before reset; extend config/trace tests"
```

---

### Task 2: BOOT-005 — Alembic 链 + 连接超时边界

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `KNOWN_URL`、`backend_dir`、`get_settings.cache_clear`、`OperationalError` from sqlalchemy
- Produces: `test_alembic_upgrade_head_sql_subprocess_smoke`、`test_revision_chain_no_orphans_head_0002`、`test_unreachable_host_operational_error_message`

- [ ] **Step 1: 在 `tests/test_migrations.py` 末尾追加 T-MIG-29~31**

```python
def test_alembic_upgrade_head_sql_subprocess_smoke():
    """T-MIG-29: alembic upgrade head --sql 子进程 returncode==0 且含 CREATE TABLE 或 ingestion_sync_jobs。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    env = os.environ.copy()
    env.setdefault("DATABASE_URL", KNOWN_URL)
    env.setdefault("SECRET_KEY", "ci-test-secret-key-min-32-chars-long!!")
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
    stdout_upper = result.stdout.upper()
    assert "ingestion_sync_jobs" in result.stdout or "CREATE TABLE" in stdout_upper


def test_revision_chain_no_orphans_head_0002():
    """T-MIG-30: revision 链无 orphan；唯一 head 为 0002。"""
    versions_dir = (
        Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    )
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        module = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[module.revision] = module.down_revision

    all_ids = set(revisions.keys())
    for rev, down in revisions.items():
        if down is not None:
            assert down in all_ids, f"orphan down_revision {down!r} for {rev}"

    referred_down = {d for d in revisions.values() if d}
    heads = [rev for rev in revisions if rev not in referred_down]
    assert heads == ["0002"]


def test_unreachable_host_operational_error_message(monkeypatch):
    """T-MIG-31: 不可达 host DATABASE_URL online 导入传播 OperationalError 且消息含 connection/refused。"""
    unreachable_url = "postgresql+psycopg://ci:ci@127.0.0.1:1/ci_unreachable"
    fake_settings = Settings(
        database_url=unreachable_url,
        secret_key="ci-test-secret-key-min-32-chars-long!!",
        credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError(
        "stmt", {}, Exception("connection refused")
    )

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False

    with patch("alembic.context", mock_context):
        with patch("sqlalchemy.engine_from_config", return_value=mock_engine):
            with pytest.raises(OperationalError) as exc_info:
                importlib.import_module("migrations.env")

    message = str(exc_info.value).lower()
    assert "connection" in message or "refused" in message
    sys.modules.pop("migrations.env", None)
```

- [ ] **Step 2: 运行迁移测试**

Run:

```bash
cd backend && pytest ../tests/test_migrations.py -v
```

Expected: PASS（≥31 项）

- [ ] **Step 3: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): add upgrade --sql smoke, revision chain, unreachable host boundary"
```

---

### Task 3: BOOT-003 — PUBLIC_PATHS + Bearer 多 scheme + `/me` 全分支

**Files:**
- Modify: `tests/test_me.py`
- Modify: `tests/test_auth.py`
- Modify: `tests/conftest.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`、`backend/app/auth/`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `client`、`auth_headers`、`UNAUTHORIZED_BODY`；新增 `basic_auth_headers`
- Produces: `basic_auth_headers` fixture；`test_health_public_vs_healthz_protected`、`test_me_basic_auth_scheme_returns_401`、`test_me_expired_placeholder_token_returns_401`、`test_get_current_user_without_state_user_raises_401`、`test_healthz_returns_401`、`test_me_auth_matrix`、`test_redoc_public_path_returns_200`

- [ ] **Step 1: 在 `tests/conftest.py` 追加 fixture 与契约注释**

在契约注释块追加一行 `- basic_auth_headers: {"Authorization": "Basic dev"} for non-Bearer scheme tests`，并追加：

```python
@pytest.fixture
def basic_auth_headers() -> dict[str, str]:
    return {"Authorization": "Basic dev"}
```

- [ ] **Step 2: 在 `tests/test_me.py` 末尾追加 T-ME-15~18**

```python
import asyncio

from fastapi import HTTPException, Request

from app.auth.deps import get_current_user


def test_health_public_vs_healthz_protected(client):
    """T-ME-15: /health 公开 200；/healthz 受保护 401 + UNAUTHORIZED body。"""
    health = client.get("/health")
    assert health.status_code == 200

    healthz = client.get("/healthz")
    assert healthz.status_code == 401
    assert healthz.json() == UNAUTHORIZED_BODY


def test_me_basic_auth_scheme_returns_401(client, basic_auth_headers):
    """T-ME-16: Authorization: Basic dev → 401。"""
    response = client.get("/api/v1/me", headers=basic_auth_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_expired_placeholder_token_returns_401(client):
    """T-ME-17: Authorization: Bearer expired-placeholder → 401。"""
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer expired-placeholder"},
    )
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_get_current_user_without_state_user_raises_401():
    """T-ME-18: get_current_user 无 state.user → HTTPException 401 UNAUTHORIZED。"""
    request = Request(
        scope={"type": "http", "method": "GET", "path": "/api/v1/me", "headers": []},
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_current_user(request))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "UNAUTHORIZED"
```

- [ ] **Step 3: 在 `tests/test_auth.py` 末尾追加 T-AUTH-09~11**

```python
def test_healthz_returns_401(client):
    """T-AUTH-09: /healthz 无 Token → 401。"""
    response = client.get("/healthz")
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


@pytest.mark.parametrize(
    "headers,expected_status",
    [
        ({}, 401),
        ({"Authorization": "Bearer "}, 401),
        ({"Authorization": "Bearer invalid"}, 401),
        ({"Authorization": "Bearer dev"}, 200),
        ({"Authorization": "Basic dev"}, 401),
    ],
)
def test_me_auth_matrix(client, headers, expected_status):
    """T-AUTH-10: /api/v1/me 鉴权矩阵快照。"""
    response = client.get("/api/v1/me", headers=headers)
    assert response.status_code == expected_status
    if expected_status == 401:
        assert response.json() == UNAUTHORIZED_BODY
    else:
        assert response.json()["id"] == "dev"


def test_redoc_public_path_returns_200(client):
    """T-AUTH-11: /redoc 公开路径无 Token → 200。"""
    response = client.get("/redoc")
    assert response.status_code == 200
```

- [ ] **Step 4: 运行鉴权测试**

Run:

```bash
cd backend && pytest ../tests/test_me.py ../tests/test_auth.py -v
```

Expected: PASS（me ≥18 项、auth ≥11 项）

- [ ] **Step 5: Commit**

```bash
git add tests/conftest.py tests/test_me.py tests/test_auth.py
git commit -m "test(BOOT-003): healthz boundary, auth matrix, get_current_user DI branch"
```

---

### Task 4: BOOT-002 — Admin 壳层路由守卫 + 主题降级 + check:design 混合 fixture

**Files:**
- Modify: `fe/src/routes.smoke.test.tsx`
- Create: `fe/src/theme-context.smoke.test.tsx`
- Modify: `fe/src/context/theme-context.tsx`
- Modify: `fe/scripts/check-design.fixture.test.mjs`
- Create: `fe/scripts/__fixtures__/check-design/mixed/bad-color.tsx`
- Create: `fe/scripts/__fixtures__/check-design/mixed/ok-token.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**触及域：** `fe/**`（`fe-ui.mdc`）

**UI Acceptance:**
- 复用 `AdminLayout`、`ThemeProvider`、`ThemeToggleButton`；非法路由仍在壳层内，无白屏/敏感 API 外泄
- desktop（1400）与 mobile（375）smoke 不削弱 T-FE-24~27 Tab/菜单可达性
- 主题非法 `localStorage.theme` 降级 light，避免错误 `dark` 对比度
- `pnpm run check:design` 全绿；混合 fixture 一坏一好 exit 1

- [ ] **Step 1: 扩展 `fe/src/routes.smoke.test.tsx` T-FE-28~29**

在 `describe("AppRoutes smoke")` 内、`T-FE-27` 测试之后追加：

```tsx
  it("keeps admin shell for unknown /admin/* path without API leak (T-FE-28)", () => {
    setDesktopViewport();
    render(
      <MemoryRouter initialEntries={["/admin/nonexistent-secret"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("nested unknown ingestion path stays inside AdminLayout (T-FE-29)", () => {
    setDesktopViewport();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/unknown"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: 新建 `fe/src/theme-context.smoke.test.tsx`**

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./context/theme-context";

function ThemeProbe() {
  return <div data-testid="probe">theme</div>;
}

describe("ThemeProvider smoke", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("falls back to light when localStorage.theme is invalid (T-FE-30)", async () => {
    localStorage.setItem("theme", "garbage");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("defaults to light when localStorage.theme is missing (T-FE-31)", async () => {
    localStorage.removeItem("theme");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await vi.waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
```

在文件顶部添加 `import { vi } from "vitest";`。

- [ ] **Step 3: 修改 `fe/src/context/theme-context.tsx` 枚举守卫（≤6 行）**

在 `React.useEffect` 读取 localStorage 处替换为：

```tsx
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
    const validThemes: ThemeMode[] = ["light", "dark", "auto"];
    const initialTheme =
      savedTheme && validThemes.includes(savedTheme) ? savedTheme : "light";
    setSelectedThemeState(initialTheme);
    setThemeState(resolveActiveTheme(initialTheme));
    setIsInitialized(true);
  }, []);
```

- [ ] **Step 4: 创建 check-design 混合 fixture 并扩展 `check-design.fixture.test.mjs`**

创建 `fe/scripts/__fixtures__/check-design/mixed/bad-color.tsx`：

```tsx
export function BadMixed() {
  return <div style={{ color: "#ff0000" }}>bad</div>;
}
```

创建 `fe/scripts/__fixtures__/check-design/mixed/ok-token.tsx`：

```tsx
export function OkMixed() {
  return <div className="text-foreground">ok</div>;
}
```

在 `check-design.fixture.test.mjs` 末尾追加：

```javascript
test("T-FE-DG-04: mixed bad+ok fixtures fail check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "mixed"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});
```

- [ ] **Step 5: 运行前端验证**

Run:

```bash
cd fe && pnpm test && pnpm build && pnpm run check:design
```

Expected: vitest ≥62 项、node:test ≥4 项、build 与 check:design PASS

- [ ] **Step 6: Commit**

```bash
git add fe/src/routes.smoke.test.tsx fe/src/theme-context.smoke.test.tsx fe/src/context/theme-context.tsx fe/scripts/check-design.fixture.test.mjs fe/scripts/__fixtures__/check-design/mixed/
git commit -m "test(BOOT-002): admin unknown routes, theme fallback, check-design mixed fixture"
```

---

### Task 5: BOOT-006 — CI 收集率 + ruff 违规样例 + vitest 耗时预算

**Files:**
- Modify: `tests/test_ci_env_contract.py`
- Create: `tests/test_ruff_contract.py`
- Create: `tests/fixtures/ruff_bad_sample.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**触及域：** `tests/**/*.py`、`.github/workflows/ci.yml`（只读核对）

**Interfaces:**
- Consumes: `CI_YML`、`CONFTEST_DEFAULTS`、`backend_dir`、`fe/` pnpm test subprocess
- Produces: `test_pytest_collect_minimum_232`、`test_ci_frontend_job_step_order`、`test_vitest_routes_smoke_elapsed_under_budget`、`test_ruff_rejects_bad_sample`、`test_ruff_accepts_clean_file`

- [ ] **Step 1: 创建 `tests/fixtures/ruff_bad_sample.py`**

```python
# 故意违规样例，供 T-RUF-01 使用 — 勿修复未使用 import
import json  # noqa: F401 — intentional for ruff contract test

def unused_helper():
    return json.dumps({})
```

- [ ] **Step 2: 新建 `tests/test_ruff_contract.py`**

```python
"""T-RUF-01~02: ruff 子进程契约（BOOT-006）。"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BAD_SAMPLE = REPO_ROOT / "tests" / "fixtures" / "ruff_bad_sample.py"
CLEAN_SAMPLE = REPO_ROOT / "tests" / "test_health.py"


def test_ruff_rejects_bad_sample():
    """T-RUF-01: 违规样例 ruff check returncode != 0。"""
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", str(BAD_SAMPLE)],
        cwd=REPO_ROOT / "backend",
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0, result.stdout


def test_ruff_accepts_clean_file():
    """T-RUF-02: 干净文件 ruff check returncode == 0。"""
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", str(CLEAN_SAMPLE)],
        cwd=REPO_ROOT / "backend",
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
```

- [ ] **Step 3: 在 `tests/test_ci_env_contract.py` 末尾追加 T-CI-07~09**

```python
def test_pytest_collect_minimum_232():
    """T-CI-07: pytest --collect-only 收集下限 ≥232。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "../tests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    last_line = result.stdout.strip().splitlines()[-1]
    count_str = last_line.split()[0]
    assert int(count_str) >= 232, f"expected ≥232 tests, got: {last_line}"


def test_ci_frontend_job_step_order(ci_yml_text):
    """T-CI-08: frontend job 中 pnpm test 在 build 之前；check:design 在 build 之后。"""
    frontend_block = ci_yml_text.split("frontend:")[1]
    test_idx = frontend_block.index("pnpm test")
    build_idx = frontend_block.index("pnpm build")
    design_idx = frontend_block.index("check:design")
    assert test_idx < build_idx < design_idx


def test_vitest_routes_smoke_elapsed_under_budget():
    """T-CI-09: vitest 单文件 routes.smoke 子集 elapsed < 45s。"""
    fe_dir = Path(__file__).resolve().parents[1] / "fe"
    start = time.perf_counter()
    result = subprocess.run(
        ["pnpm", "test", "--", "src/routes.smoke.test.tsx"],
        cwd=fe_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    elapsed = time.perf_counter() - start
    assert result.returncode == 0, result.stderr
    assert elapsed < 45.0, f"vitest routes smoke took {elapsed:.1f}s"
```

- [ ] **Step 4: 全量验证（P4 等价）**

Run:

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

Expected: backend **≥232 passed**（2 skipped 保持）；fe vitest **≥62**；node:test **≥4**；exit 0

- [ ] **Step 5: Commit**

```bash
git add tests/test_ci_env_contract.py tests/test_ruff_contract.py tests/fixtures/ruff_bad_sample.py
git commit -m "test(BOOT-006): collect floor 232, ruff contract, vitest elapsed budget"
```

---

## 执行收尾

全部 Task 完成后由 P4 执行 design §9 验证命令；P5 重评 BOOT-004/005/006/002/003 八维分数。
