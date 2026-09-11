# M1 BOOT 测试与安全补强（r2）实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `tests/test_migrations.py`、`tests/test_auth.py`、`tests/test_health.py`、`tests/conftest.py`、`fe/src/routes.smoke.test.tsx`、`fe/src/layouts/AdminLayout.smoke.test.tsx`、`fe/scripts/check-design.mjs`、`fe/scripts/check-design.fixture.test.mjs`、`fe/scripts/__fixtures__/check-design/`、`fe/package.json`、`.github/workflows/ci.yml`（共 10 主文件 + 2 fixture；≤20）
> **子项：** BOOT-005、BOOT-002、BOOT-003、BOOT-001、BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Task **Files** 与 **Skills** 按需 Read）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`、`common.mdc`、`prd-sync.mdc` alwaysApply；`backend-fastapi.mdc` 触及 `tests/**/*.py`；`fe-ui.mdc` 触及 `fe/**`）
> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（option 1，每 Task 独立 subagent + 任务间 review）

**Goal:** 扩展 pytest/vitest 边缘用例与鉴权负例矩阵，推动 BOOT-005/002/003/001/006 测试覆盖维由 45–80% 向 ≥90 靠拢；本地与 CI 命令等价。

**Architecture:** 子项 1–4 各自扩展/新建独立测试文件；子项 5 收尾 `conftest` fixture 契约与 CI `pytest -v`。后端 `TestClient` + monkeypatch，不启 docker postgres；前端 vitest smoke + `node --test` 跑 design 门禁负向，不修改 UI 组件视觉。

**Tech Stack:** Python 3.11、pytest 8、pydantic ValidationError、FastAPI TestClient、vitest 3、@testing-library/react、jsdom、node:test、pnpm 9、GitHub Actions

## Global Constraints

- 零第三方 BI 运行时依赖（NFR-08）
- **不修改** `backend/app/auth/`、`backend/app/core/config.py`、`backend/migrations/env.py` 生产逻辑（`check-design.mjs` 仅增可选 `--root` 测试参数）
- CI **不启动** docker postgres；**不执行** `alembic upgrade`
- 前端根目录 **`fe/`**；测试仅 smoke render，不改 `AdminLayout` 视觉、不新增 `data-testid`
- 保留上轮 T-MIG-01/02、T-HLT-01~04、T-FE-01/02 基础断言，仅扩展边缘场景
- `test_me.py` 行为不变；`test_auth.py` 不重复 T-AUTH-01（由 `test_me.py` 覆盖）
- 纯测试补强，通常无需 PRD/API/services 文档回写（`prd-sync.mdc` 豁免）
- 本地等价：`cd backend && ruff check . && pytest -v`；`cd fe && pnpm test && pnpm build && pnpm run check:design`

---

## 文件结构总览

| 文件 | 子项 | 动作 | 职责 |
|------|:----:|------|------|
| `tests/test_migrations.py` | 1 | 扩展 | T-MIG-03~06 Settings 负例与 alembic.ini 一致性 |
| `tests/test_auth.py` | 3 | 新建 | T-AUTH-02~08 鉴权负例与公开路径矩阵 |
| `tests/test_health.py` | 4 | 扩展 | T-HLT-05~08 404 与 OpenAPI paths 契约 |
| `tests/conftest.py` | 5 | 微调 | `unauthorized_headers` fixture + 文档注释 |
| `fe/src/routes.smoke.test.tsx` | 2 | 扩展 | T-FE-03~05 `/admin` 嵌套与未知路径 |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | 2 | 新建 | T-FE-06~07 侧栏/main/主题切换 smoke |
| `fe/scripts/check-design.mjs` | 2 | 微调 | 可选 `--root <dir>` 供 fixture 测试 |
| `fe/scripts/check-design.fixture.test.mjs` | 2 | 新建 | T-FE-DG-01/02 违规与豁免边界 |
| `fe/scripts/__fixtures__/check-design/*.tsx` | 2 | 新建 | git 跟踪的 fixture 样例 |
| `fe/package.json` | 2,5 | 修改 | `test` script 串联 vitest + node:test |
| `.github/workflows/ci.yml` | 5 | 修改 | `pytest` → `pytest -v` |

---

### Task 1: BOOT-005 — Settings 负例与 Alembic 目录一致性

**Files:**
- Modify: `tests/test_migrations.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `conftest` 预设 `DATABASE_URL`/`SECRET_KEY`/`CREDENTIAL_FERNET_KEY`；`clear_settings_cache` autouse fixture（本文件已有）
- Produces: `test_settings_missing_database_url_raises`、`test_settings_env_override_database_url`、`test_alembic_ini_script_location_matches_repo`、`test_settings_empty_database_url_documents_current_behavior`

- [ ] **Step 1: 在 `tests/test_migrations.py` 顶部追加 import**

```python
from configparser import ConfigParser
from pathlib import Path

from pydantic import ValidationError
```

- [ ] **Step 2: 追加 T-MIG-03~06 四个测试函数**

```python
def test_settings_missing_database_url_raises(monkeypatch):
    """T-MIG-03: 缺 DATABASE_URL 时 Settings 实例化失败。"""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        Settings(
            secret_key="ci-test-secret-key-min-32-chars-long!!",
            credential_fernet_key="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        )


def test_settings_env_override_database_url(monkeypatch):
    """T-MIG-04: env 覆盖 DATABASE_URL 生效。"""
    alt = "postgresql+psycopg://alt:alt@localhost:5432/alt"
    monkeypatch.setenv("DATABASE_URL", alt)
    get_settings.cache_clear()
    assert get_settings().database_url == alt


def test_alembic_ini_script_location_matches_repo():
    """T-MIG-05: alembic.ini script_location 与 migrations/ 目录一致。"""
    ini_path = Path(__file__).resolve().parents[1] / "backend" / "alembic.ini"
    parser = ConfigParser()
    parser.read(ini_path)
    assert parser.get("alembic", "script_location") == "migrations"
    migrations_dir = ini_path.parent / "migrations"
    assert migrations_dir.is_dir()


def test_settings_empty_database_url_documents_current_behavior(monkeypatch):
    """T-MIG-06: 空白 DATABASE_URL 记录现状（当前无格式校验）。"""
    monkeypatch.setenv("DATABASE_URL", "")
    get_settings.cache_clear()
    assert get_settings().database_url == ""
```

- [ ] **Step 3: 运行迁移测试验证通过**

Run:

```bash
cd backend && pytest tests/test_migrations.py -v
```

Expected: 6 passed（T-MIG-01~06 全绿）

- [ ] **Step 4: Commit**

```bash
git add tests/test_migrations.py
git commit -m "test(BOOT-005): extend Settings and alembic.ini edge cases"
```

---

### Task 2: BOOT-002 — 扩展路由 smoke（T-FE-03~05）

**Files:**
- Modify: `fe/src/routes.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `b-design-system-tailadmin-radix` 壳层契约：`AdminLayout` + `<main>` + logo「VitalSpan」
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡（本轮 jsdom smoke，P4 人工 QA 补截图）
- 默认加载态壳层可回归；不测 empty/error API 态（M1 静态壳层，design §9.2）
- 通过 `pnpm run check:design` 静态检查（生产 `src/` 无硬编码色）

- [ ] **Step 1: 在 `fe/src/routes.smoke.test.tsx` 追加三个用例**

```tsx
  it("renders main content area at /admin (T-FE-03)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows AdminHomePage welcome heading at /admin (T-FE-04)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "欢迎使用 VitalSpan" })).toBeInTheDocument();
  });

  it("redirects unknown paths to admin shell (T-FE-05)", () => {
    render(
      <MemoryRouter initialEntries={["/unknown-route-xyz"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行路由 smoke 验证通过**

Run:

```bash
cd fe && pnpm vitest run src/routes.smoke.test.tsx
```

Expected: 5 passed（T-FE-01~05）

- [ ] **Step 3: Commit**

```bash
git add fe/src/routes.smoke.test.tsx
git commit -m "test(BOOT-002): extend /admin route smoke assertions"
```

---

### Task 3: BOOT-002 — AdminLayout 结构 smoke（T-FE-06~07）

**Files:**
- Create: `fe/src/layouts/AdminLayout.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 断言 `getByRole("navigation")`（`AppSidebar` `<nav aria-label="管理端导航">`）与 `getByRole("main")` 挂载
- `ThemeToggleButton` 通过 `getByRole("button", { name: "切换深浅色主题" })` 可访问
- 不断言具体 px 宽度；遵循 TailAdmin 壳层比例（design §9.3）
- hover/focus：顶栏 toggle 为 `button` 且含 `aria-label`（M1 不测 hover 样式）

- [ ] **Step 1: 新建 `fe/src/layouts/AdminLayout.smoke.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { AdminLayout } from "./AdminLayout";

describe("AdminLayout smoke", () => {
  it("mounts sidebar navigation and main content (T-FE-06)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>child content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "管理端导航" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("child content");
  });

  it("mounts theme toggle in header actions (T-FE-07)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "切换深浅色主题" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行 AdminLayout smoke 验证通过**

Run:

```bash
cd fe && pnpm vitest run src/layouts/AdminLayout.smoke.test.tsx
```

Expected: 2 passed（T-FE-06~07）

- [ ] **Step 3: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx
git commit -m "test(BOOT-002): add AdminLayout structure smoke tests"
```

---

### Task 4: BOOT-002 — design 门禁负向与豁免边界（T-FE-DG-01~02）

**Files:**
- Modify: `fe/scripts/check-design.mjs`
- Create: `fe/scripts/__fixtures__/check-design/bad-color.tsx`
- Create: `fe/scripts/__fixtures__/check-design/ok-exempt.tsx`
- Create: `fe/scripts/check-design.fixture.test.mjs`
- Modify: `fe/package.json`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- T-FE-DG-01 验证硬编码 `#ff0000` 被 `check:design` 拦截（exit 1）
- T-FE-DG-02 验证同行 `// @design-token-ok` 豁免机制（exit 0）
- 默认扫描行为不变：`pnpm run check:design` 仍只扫 `fe/src/`
- 语义 token 与 `@design-token-ok` 规则与 `fe-ui.mdc` 一致

- [ ] **Step 1: 为 `fe/scripts/check-design.mjs` 增加可选 `--root` 参数**

在 `const SRC_ROOT = ...` 之后、`function walk` 之前插入：

```javascript
function parseScanRoot() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  if (rootIdx >= 0 && args[rootIdx + 1]) {
    return path.resolve(args[rootIdx + 1]);
  }
  return SRC_ROOT;
}

const SCAN_ROOT = parseScanRoot();
```

将文件末尾 `const files = walk(SRC_ROOT);` 改为 `const files = walk(SCAN_ROOT);`

- [ ] **Step 2: 创建 fixture 文件**

`fe/scripts/__fixtures__/check-design/bad-color.tsx`:

```tsx
export const Bad = () => <div style={{ color: "#ff0000" }}>bad</div>;
```

`fe/scripts/__fixtures__/check-design/ok-exempt.tsx`:

```tsx
// @design-token-ok
export const Ok = () => <div style={{ color: "#ff0000" }}>exempt</div>;
```

- [ ] **Step 3: 新建 `fe/scripts/check-design.fixture.test.mjs`**

```javascript
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "check-design.mjs");
const fixturesRoot = path.join(__dirname, "__fixtures__/check-design");

function runCheck(rootDir) {
  return spawnSync(process.execPath, [script, "--root", rootDir], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
}

test("T-FE-DG-01: hardcoded hex in fixture fails check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "bad-only"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("T-FE-DG-02: @design-token-ok line exempts hex", () => {
  const result = runCheck(path.join(fixturesRoot, "ok-only"));
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
```

创建子目录并移动 fixture（实施时）：

```bash
mkdir -p fe/scripts/__fixtures__/check-design/bad-only fe/scripts/__fixtures__/check-design/ok-only
cp fe/scripts/__fixtures__/check-design/bad-color.tsx fe/scripts/__fixtures__/check-design/bad-only/
cp fe/scripts/__fixtures__/check-design/ok-exempt.tsx fe/scripts/__fixtures__/check-design/ok-only/
```

- [ ] **Step 4: 更新 `fe/package.json` scripts**

```json
"test": "vitest run && node --test scripts/check-design.fixture.test.mjs"
```

- [ ] **Step 5: 验证 design 门禁测试与生产扫描均通过**

Run:

```bash
cd fe && pnpm test
cd fe && pnpm run check:design
```

Expected: vitest 全部 passed；node:test 2 passed；`check:design passed (N files scanned)` exit 0

- [ ] **Step 6: Commit**

```bash
git add fe/scripts/check-design.mjs fe/scripts/check-design.fixture.test.mjs fe/scripts/__fixtures__/ fe/package.json
git commit -m "test(BOOT-002): add check:design negative fixture tests with --root flag"
```

---

### Task 5: BOOT-003 — 鉴权负例与公开路径矩阵

**Files:**
- Create: `tests/test_auth.py`
- Modify: `tests/conftest.py`（`unauthorized_headers` fixture，可与 Task 7 合并提交）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

**触及域：** `tests/**/*.py`（`backend-fastapi.mdc`）

**Interfaces:**
- Consumes: `conftest.client`、`conftest.auth_headers`；`middleware.PUBLIC_PATHS` 行为
- Produces: `test_me_invalid_bearer_returns_401` 等 7 个函数；不重复 `test_me.py` 无 Token 用例

- [ ] **Step 1: 在 `tests/conftest.py` 追加 `unauthorized_headers` fixture**

```python
@pytest.fixture
def unauthorized_headers() -> dict[str, str]:
  return {"Authorization": "Bearer invalid"}
```

- [ ] **Step 2: 新建 `tests/test_auth.py`**

```python
import pytest

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token",
    "detail": None,
}


def test_me_invalid_bearer_returns_401(client, unauthorized_headers):
    """T-AUTH-02: Authorization: Bearer invalid → 401。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_empty_bearer_token_returns_401(client):
    """T-AUTH-03: Authorization: Bearer（空 token）→ 401。"""
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer "})
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_bearer_dev_returns_200(client, auth_headers):
    """T-AUTH-04: Bearer dev → 200（与 test_me.py 行为一致）。"""
    response = client.get("/api/v1/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == "dev"


@pytest.mark.parametrize(
    "path",
    ["/health", "/openapi.json", "/docs"],
)
def test_public_paths_accessible_without_token(client, path):
    """T-AUTH-05~07: 公开路径无 Token → 200。"""
    response = client.get(path)
    assert response.status_code == 200


def test_options_preflight_not_blocked_by_auth(client):
    """T-AUTH-08: OPTIONS 预检不被鉴权中间件 401 拦截。"""
    response = client.options(
        "/api/v1/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code != 401
```

- [ ] **Step 3: 运行鉴权测试与全量 backend 测试**

Run:

```bash
cd backend && pytest tests/test_auth.py -v
cd backend && pytest tests/test_me.py tests/test_auth.py -v
```

Expected: `test_auth.py` 7 passed；`test_me.py` 2 passed；无重复失败

- [ ] **Step 4: Commit**

```bash
git add tests/test_auth.py tests/conftest.py
git commit -m "test(BOOT-003): add auth middleware negative and public path matrix"
```

---

### Task 6: BOOT-001 — 404 与 OpenAPI paths 契约

**Files:**
- Modify: `tests/test_health.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**Interfaces:**
- Consumes: `conftest.client`；保留 T-HLT-01~04
- Produces: `test_unknown_route_returns_404`、`test_openapi_paths_include_health_and_me`、`test_health_cors_preflight_regression`

- [ ] **Step 1: 在 `tests/test_health.py` 追加三个测试**

```python
def test_unknown_route_returns_404(client):
    """T-HLT-05: GET /nonexistent-route-xyz → 404。"""
    response = client.get("/nonexistent-route-xyz")
    assert response.status_code == 404


def test_openapi_paths_include_health_and_me(client):
    """T-HLT-06/07: OpenAPI paths 含 /health 与 /api/v1/me。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/health" in paths
    assert "/api/v1/me" in paths


def test_health_cors_preflight_regression(client):
    """T-HLT-08: CORS 预检回归（中间件链未破坏公开路径）。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: 运行 health 测试验证通过**

Run:

```bash
cd backend && pytest tests/test_health.py -v
```

Expected: 7 passed（T-HLT-01~08）

- [ ] **Step 3: Commit**

```bash
git add tests/test_health.py
git commit -m "test(BOOT-001): add 404 and OpenAPI path contract tests"
```

---

### Task 7: BOOT-006 — conftest 契约固化与 CI 整合

**Files:**
- Modify: `tests/conftest.py`（若 Task 5 已提交则仅补文档注释）
- Modify: `.github/workflows/ci.yml`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: 在 `tests/conftest.py` fixture 上方补契约注释**

```python
# Fixture contract (BOOT-006):
# - client: TestClient(app) for all backend HTTP tests
# - auth_headers: {"Authorization": "Bearer dev"} for protected routes in development
# - unauthorized_headers: {"Authorization": "Bearer invalid"} for 401 negative cases
```

- [ ] **Step 2: 更新 `.github/workflows/ci.yml` backend Pytest 步骤**

将：

```yaml
      - name: Pytest
        run: pytest
```

改为：

```yaml
      - name: Pytest
        run: pytest -v
```

- [ ] **Step 3: 全量本地验证（与 CI 等价）**

Run:

```bash
cd backend && ruff check . && pytest -v
cd fe && pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm run check:design
```

Expected: ruff 无错误；backend 全部 pytest passed；frontend vitest + node:test + build + check:design 全绿

- [ ] **Step 4: Commit**

```bash
git add tests/conftest.py .github/workflows/ci.yml
git commit -m "chore(BOOT-006): align CI pytest -v and document test fixtures"
```

---

## 自检清单（P2）

| 检查项 | 状态 |
|--------|------|
| design 5 子项均有对应 Task | Task 1→BOOT-005；2–4→BOOT-002；5→BOOT-003；6→BOOT-001；7→BOOT-006 |
| 无 TBD/TODO/适当处理 | ✓ |
| 每 Task 含验证命令与期望输出 | ✓ |
| 前端 Task 含 UI skill + UI Acceptance | Task 2–4 |
| 预估文件数 ≤20 | 10 主文件 + 2 fixture 子目录 |
| 不修改 auth/core 生产逻辑 | ✓（仅 check-design.mjs 测试参数） |

## 执行顺序

Task 1 → 2 → 3 → 4 → 5 → 6 → 7（subagent-driven-development option 1，每 Task 完成后 Spec review + Quality review）
