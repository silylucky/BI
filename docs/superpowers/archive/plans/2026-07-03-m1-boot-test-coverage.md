# M1 BOOT 测试覆盖补强实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_migrations.py`、`tests/test_trace.py`、`tests/test_health.py`、`tests/conftest.py`、`fe/package.json`、`fe/pnpm-lock.yaml`、`fe/vite.config.ts`、`fe/src/vitest.setup.ts`、`fe/src/routes.smoke.test.tsx`、`.github/workflows/ci.yml`（共 10 文件；不修改 `backend/app/core/*` 生产代码）
> **子项：** BOOT-005、BOOT-004、BOOT-002、BOOT-001、BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `tests/**/*.py`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 为 M1 BOOT 五项补齐 pytest/vitest 自动化测试，推动测试覆盖维由 8–42% 向 ≥40% 靠拢，CI 在合并前稳定执行 backend + frontend 测试门禁。

**Architecture:** 子项 1–4 各自新增/扩展独立测试文件；子项 5 收尾整合 `conftest` 共享 fixture 与 CI 步骤。后端用 `TestClient` + monkeypatch/mock 隔离 Alembic/Settings，不启 docker postgres；前端用 vitest + jsdom smoke render `AppRoutes` at `/admin`，不修改 UI 组件。

**Tech Stack:** Python 3.11、pytest 8、FastAPI TestClient、vitest 3、@testing-library/react、jsdom、pnpm 9、Vite 6、GitHub Actions

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- **不修改** `backend/app/core/*`、`backend/migrations/env.py` 生产逻辑
- CI **不启动** docker postgres；**不执行** `alembic upgrade`
- 前端根目录 **`fe/`**；测试仅 smoke render，不改 `AdminLayout` 视觉
- `BOOT-003` `tests/test_me.py` 行为不变（可选改用 `auth_headers` fixture）
- 纯测试补强，通常无需 PRD/API/services 文档回写（`prd-sync.mdc` 豁免）
- 本地等价：`cd backend && ruff check . && pytest -v`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | 子项 | 动作 | 职责 |
|------|:----:|------|------|
| `tests/test_migrations.py` | 1 | 新建 | Settings `database_url` + env.py URL 绑定 |
| `tests/test_trace.py` | 2 | 新建 | `X-Trace-Id` 生成/透传 + 可选 JSON 日志 |
| `fe/package.json` | 3,5 | 修改 | vitest 依赖与 `test`/`test:smoke` scripts |
| `fe/pnpm-lock.yaml` | 3 | 修改 | 锁文件（CI `--frozen-lockfile`） |
| `fe/vite.config.ts` | 3 | 修改 | vitest `test` 块 |
| `fe/src/vitest.setup.ts` | 3 | 新建 | `@testing-library/jest-dom` 匹配器 |
| `fe/src/routes.smoke.test.tsx` | 3 | 新建 | `/admin` 路由 + AdminLayout smoke |
| `tests/test_health.py` | 4 | 扩展 | CORS 预检 + `/openapi.json`/`/docs` 公开路径 |
| `tests/conftest.py` | 5 | 扩展 | `auth_headers` fixture |
| `.github/workflows/ci.yml` | 5 | 修改 | frontend job 增 `pnpm test` |

---

### Task 1: BOOT-005 — Settings 与 Alembic 配置测试

**Files:**
- Create: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `conftest` 预设 `DATABASE_URL`；`app.core.config.get_settings`；`migrations/env.py` 模块级 URL 绑定
- Produces: `test_settings_database_url_matches_env`、`test_migrations_env_binds_settings_database_url`

- [ ] **Step 1: 新建 `tests/test_migrations.py`（T-MIG-01 + T-MIG-02）**

```python
import importlib
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings, get_settings


KNOWN_URL = "postgresql+psycopg://mock:mock@localhost:5432/mock"


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_database_url_matches_env():
    """T-MIG-01: Settings 从环境变量加载 database_url。"""
    settings = get_settings()
    assert settings.database_url == os.environ["DATABASE_URL"]


def test_migrations_env_binds_settings_database_url(monkeypatch):
    """T-MIG-02: migrations/env.py 将 settings.database_url 写入 alembic config。"""
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

    with (
        patch("alembic.context.config", mock_config),
        patch("alembic.context.is_offline_mode", return_value=True),
        patch("alembic.context.configure"),
        patch("alembic.context.begin_transaction"),
        patch("alembic.context.run_migrations"),
    ):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", KNOWN_URL)
```

- [ ] **Step 2: 运行迁移测试验证通过**

Run:

```bash
cd backend && pytest tests/test_migrations.py -v
```

Expected: 2 passed（`test_settings_database_url_matches_env`、`test_migrations_env_binds_settings_database_url`）

- [ ] **Step 3: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): add Settings and Alembic env URL binding tests"
```

---

### Task 2: BOOT-004 — TraceId 中间件测试

**Files:**
- Create: `tests/test_trace.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `conftest.client` fixture；`TraceIdMiddleware` 响应头契约（`backend/app/core/middleware.py`）
- Produces: `test_health_response_includes_generated_trace_id`、`test_health_preserves_incoming_trace_id`、`test_request_log_includes_trace_id_json`

- [ ] **Step 1: 新建 `tests/test_trace.py`（T-TRC-01/02/03）**

`caplog` 捕获的是 `getMessage()` 而非 `JsonFormatter` 输出；T-TRC-03 通过临时 `StreamHandler` + `JsonFormatter` 断言 JSON `traceId`。

```python
import io
import json
import logging
import re

TRACE_ID_HEX_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def test_health_response_includes_generated_trace_id(client):
    """T-TRC-01: GET /health 响应含 X-Trace-Id（32 位 hex）。"""
    response = client.get("/health")
    assert response.status_code == 200
    trace_id = response.headers.get("X-Trace-Id")
    assert trace_id is not None
    assert TRACE_ID_HEX_PATTERN.match(trace_id)


def test_health_preserves_incoming_trace_id(client):
    """T-TRC-02: 透传已有 X-Trace-Id 请求头。"""
    incoming = "abc123"
    response = client.get("/health", headers={"X-Trace-Id": incoming})
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == incoming


def test_request_log_json_contains_trace_id(client):
    """T-TRC-03: JsonFormatter 输出 JSON 含 traceId 字段。"""
    from app.core.logging import JsonFormatter

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
        assert lines, "expected JSON log lines"
        payload = json.loads(lines[-1])
        assert payload.get("traceId") == trace_id
    finally:
        logger.removeHandler(handler)
```

- [ ] **Step 2: 运行 TraceId 测试验证通过**

Run:

```bash
cd backend && pytest tests/test_trace.py -v
```

Expected: 3 passed

- [ ] **Step 3: Commit**

```bash
git add tests/test_trace.py
git commit -m "test(BOOT-004): add TraceId middleware response and logging tests"
```

---

### Task 3: BOOT-002 — 前端壳层 vitest smoke

**Files:**
- Modify: `fe/package.json`
- Modify: `fe/pnpm-lock.yaml`（`pnpm install` 生成）
- Modify: `fe/vite.config.ts`
- Create: `fe/src/vitest.setup.ts`
- Create: `fe/src/routes.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 本轮**不修改** UI 组件或页面视觉；仅增 vitest smoke
- 断言锚点：侧栏 logo 文案「VitalSpan」（`AdminLayout` → `AppSidebar` logo prop）
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡（P4 人工 QA；本轮 jsdom 不测响应式截图）
- hover/focus/active/loading/empty/error：本轮仅验证默认加载态壳层挂载；不测 empty/error/权限（M1 静态壳层无 API）
- `pnpm run check:design` 继续拦截硬编码 hex；测试不断言具体色值

**触及域：** `fe/**`（`fe-ui.mdc`）

**Interfaces:**
- Consumes: `fe/src/routes.tsx` 导出 `AppRoutes`；`AdminLayout` 内嵌 `ThemeProvider`/`SidebarProvider`
- Produces: `pnpm test` / `pnpm run test:smoke` 脚本；`T-FE-01`、`T-FE-02` 用例

- [ ] **Step 1: 修改 `fe/package.json` 增 devDependencies 与 scripts**

在 `scripts` 中追加：

```json
"test": "vitest run",
"test:smoke": "vitest run src/routes.smoke.test.tsx"
```

在 `devDependencies` 中追加：

```json
"@testing-library/jest-dom": "^6.6.3",
"@testing-library/react": "^16.1.0",
"jsdom": "^25.0.1",
"vitest": "^3.0.5"
```

- [ ] **Step 2: 安装依赖并更新 lockfile**

Run:

```bash
cd fe && pnpm install
```

Expected: `fe/pnpm-lock.yaml` 更新，无 peer dependency 致命错误

- [ ] **Step 3: 修改 `fe/vite.config.ts` 增 vitest 配置**

```typescript
/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: 新建 `fe/src/vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: 新建 `fe/src/routes.smoke.test.tsx`（T-FE-01 + T-FE-02）**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "./routes";

describe("AppRoutes smoke", () => {
  it("renders AdminLayout at /admin with VitalSpan logo (T-FE-01)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText("VitalSpan")).toBeInTheDocument();
  });

  it("redirects / to admin shell (T-FE-02)", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText("VitalSpan")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行前端测试与既有门禁**

Run:

```bash
cd fe && pnpm test
cd fe && pnpm build && pnpm run check:design
```

Expected: vitest 2 passed；`tsc -b && vite build` 成功；`check:design` exit 0

- [ ] **Step 7: Commit**

```bash
git add fe/package.json fe/pnpm-lock.yaml fe/vite.config.ts fe/src/vitest.setup.ts fe/src/routes.smoke.test.tsx
git commit -m "test(BOOT-002): add vitest smoke for /admin AdminLayout shell"
```

---

### Task 4: BOOT-001 — 健康检查与 CORS 预检测试

**Files:**
- Modify: `tests/test_health.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `conftest.client`；`Settings.cors_origins` 默认 `http://localhost:5173`（`backend/app/core/config.py`）
- Produces: 保留 `test_health_returns_ok`；新增 `test_health_cors_preflight`、`test_openapi_json_public`、`test_docs_public`

- [ ] **Step 1: 扩展 `tests/test_health.py`**

```python
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_cors_preflight(client):
    """T-HLT-02: OPTIONS /health CORS 预检含 Access-Control-Allow-Origin。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_openapi_json_public(client):
    """T-HLT-03: GET /openapi.json 公开可访问。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert "openapi" in body


def test_docs_public(client):
    """T-HLT-04: GET /docs 公开可访问。"""
    response = client.get("/docs")
    assert response.status_code == 200
```

- [ ] **Step 2: 运行 health 测试验证通过**

Run:

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: 4 passed

- [ ] **Step 3: Commit**

```bash
git add tests/test_health.py
git commit -m "test(BOOT-001): extend health tests with CORS preflight and OpenAPI public paths"
```

---

### Task 5: BOOT-006 — conftest 加固与 CI 整合

**Files:**
- Modify: `tests/conftest.py`
- Modify: `tests/test_me.py`（可选 DRY：`auth_headers`）
- Modify: `.github/workflows/ci.yml`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）；`.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1–4 全部测试文件
- Produces: `auth_headers` fixture；CI frontend `pnpm test` 步骤

- [ ] **Step 1: 扩展 `tests/conftest.py`**

在现有 `client` fixture 之后追加：

```python
@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev"}
```

完整文件：

```python
import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://ci:ci@localhost:5432/ci",
)
os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-min-32-chars-long!!")
os.environ.setdefault(
    "CREDENTIAL_FERNET_KEY",
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
)

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer dev"}
```

- [ ] **Step 2: 可选 DRY — 修改 `tests/test_me.py` 使用 `auth_headers`**

```python
def test_me_without_token_returns_401(client):
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json() == {
        "code": "UNAUTHORIZED",
        "message": "Missing or invalid bearer token",
        "detail": None,
    }


def test_me_with_bearer_dev_returns_200(client, auth_headers):
    response = client.get("/api/v1/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {
        "id": "dev",
        "username": "dev",
        "roles": ["admin"],
    }
```

- [ ] **Step 3: 修改 `.github/workflows/ci.yml` frontend job 增测试步骤**

在 `Install frontend` 之后、`Build` 之前插入：

```yaml
      - name: Test
        run: pnpm test
```

完整 frontend job：

```yaml
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: fe
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: fe/pnpm-lock.yaml
      - name: Install frontend
        run: pnpm install --frozen-lockfile
      - name: Test
        run: pnpm test
      - name: Build
        run: pnpm build
      - name: Design check
        run: pnpm run check:design
```

- [ ] **Step 4: 全量本地验证（与 CI 等价）**

Run:

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

Expected:
- backend: ruff 无违规；pytest 全部通过（`test_health` 4 + `test_me` 2 + `test_migrations` 2 + `test_trace` 3 = 11+）
- frontend: vitest 2 passed；build + check:design 成功

- [ ] **Step 5: Commit**

```bash
git add tests/conftest.py tests/test_me.py .github/workflows/ci.yml
git commit -m "test(BOOT-006): add auth_headers fixture and CI frontend vitest step"
```

---

## 执行顺序与依赖

```mermaid
flowchart LR
  T1[Task1 BOOT-005] --> T5[Task5 BOOT-006]
  T2[Task2 BOOT-004] --> T5
  T3[Task3 BOOT-002] --> T5
  T4[Task4 BOOT-001] --> T5
```

Task 1–4 可并行实施；Task 5 必须在 1–4 完成后执行以整合 CI 与全量验证。

## 文档同步评估

| 变更 | 同步 | 说明 |
|------|:----:|------|
| 仅增测试与 CI 步骤 | 否 | 行为不变；`prd-sync.mdc` 纯测试豁免 |
| `prd/F01-BOOT.md` 8 维 | P5 | 由 scorer 重评后更新 |

## 完成自检

- [x] 5 个 design 子项各对应 1 个 Task
- [x] 10 文件 ≤ round-target 上限 20
- [x] 无 TBD/TODO 占位
- [x] 每 Task 含验证命令与完整代码
- [x] Task 3 含 UI skill 与 UI Acceptance
