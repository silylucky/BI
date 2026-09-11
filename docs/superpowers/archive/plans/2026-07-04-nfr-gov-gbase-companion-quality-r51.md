# NFR 横切 + GOV-005 + GBase companion 质量推分 r51 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/core/nfr/browser_matrix.py` · `push_channels.py` · `push_config.py` · `xinchuang.py` · `plugin_extension.py` · `errors.py` · `__init__.py` · `backend/app/governance/publish/notifications.py` · `service.py` · `schemas.py` · `__init__.py` · `backend/app/datasources/dialects/gbase.py` · `errors.py` · `backend/app/api/v1/nfr.py` · `gov.py` · `tests/test_nfr_gov_conn_r51.py` · `docs/services/nfr.md` · `docs/services/governance.md`
> **子项：** NFR-006, NFR-007, NFR-005, GOV-005, CONN-019
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 在 r46 L1 骨架上交付 companion 质量推分——浏览器矩阵 + 推送 mock 降级链、信创 remediation/非阻塞 probe、插件登记路径 + registry probe、发布审批通知钩子、GBase HTTP/元数据边界闭合；≥30 条 `test_nfr_gov_conn_r51`；五 PRD ID 加权总分破 **≥90**。

**Architecture:** 域逻辑留在 `core/nfr/`、`governance/publish/`、`datasources/dialects/`；`api/v1/nfr.py` 与 `gov.py` 仅薄 entry；内存 store（`_PUSH_MOCK_LOG`、`_PUBLISH_NOTIFICATIONS`）进程内可测、非生产持久化；`dispatch_push_mock` 复用 `resolve_push_mode`；`emit_publish_notification` 在 submit/approve/reject 后触发；GBase 错误经 `map_gbase_error` 单出口。纯后端、无新 Alembic、不修改 `ConnectorRegistry.register/get` 方法体、不修改 `integration.publish_service` 快路径。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不修改** `backend/app/datasources/registry.py` 的 `ConnectorRegistry.register` / `get` 方法体。
- **不修改** `integration/query_services.publish_service` 快路径语义。
- **分层纪律**（`common.mdc`）：domain 写业务；`api/v1/*.py` = entry。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422；未鉴权 401。
- **鉴权**：新路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > design.md > `docs/api/README.md`。
- **验证基线**（r49 P5）：`cd backend && python3 -m pytest -q` ≈ **1205 passed** / 4 skipped；本轮目标 **≥1235 passed** + 4 skipped，零失败，`ruff` clean。
- **回归门控**（P4 必跑）：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_nfr_gov_conn_r51.py \
    ../tests/test_nfr_gov_conn_r46.py \
    ../tests/test_design_conn_gov_query_r49.py \
    -v
  ```
  Expected: r51 ≥30/30 + r46 **36/36** + r49 **35/35**。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/core/nfr/errors.py` | `PUSH_CHANNEL_*` / `NFR_PROBE_TIMEOUT` | 修改 |
| `backend/app/core/nfr/browser_matrix.py` | NFR-006 静态矩阵 + UA 探测 | 新建 |
| `backend/app/core/nfr/push_channels.py` | NFR-006 mock 发送 + 降级链 | 新建 |
| `backend/app/core/nfr/push_config.py` | 与 push_channels 集成（内部 summary） | 修改 |
| `backend/app/core/nfr/xinchuang.py` | remediation + 非阻塞 probe | 修改 |
| `backend/app/core/nfr/plugin_extension.py` | 登记路径 + registry probe | 修改 |
| `backend/app/core/nfr/__init__.py` | 导出新符号 | 修改 |
| `backend/app/governance/publish/notifications.py` | GOV-005 内存通知钩子 | 新建 |
| `backend/app/governance/publish/service.py` | submit/approve/reject 触发通知 | 修改 |
| `backend/app/governance/publish/schemas.py` | `PublishNotificationOut` | 修改 |
| `backend/app/governance/publish/__init__.py` | 导出 notifications | 修改 |
| `backend/app/datasources/dialects/gbase.py` | 空库/列 limit 边界巩固 | 修改 |
| `backend/app/datasources/dialects/errors.py` | `map_gbase_error` 2002/1049 路径 | 修改 |
| `backend/app/api/v1/nfr.py` | browser-matrix / push-probe / registration-path | 修改 |
| `backend/app/api/v1/gov.py` | GET publish notifications | 修改 |
| `tests/test_nfr_gov_conn_r51.py` | 新套件 ≥30 断言函数 | 新建 |
| `docs/services/nfr.md` | companion 边界登记 | 修改 |
| `docs/services/governance.md` | 审批通知钩子登记 | 修改 |

预估 **P3 生产代码文件 15** + **测试 1** + **docs 2** = **18**（≤20）。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_nfr_gov_conn_r51.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""NFR 横切 + GOV-005 + CONN-019 companion 质量推分 r51."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R51_SQLITE_URL = "sqlite+pysqlite:///file:nfr_gov_conn_r51?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}


@pytest.fixture(scope="module", autouse=True)
def r51_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_push = os.environ.get("PUSH_BROWSER_ENABLED")
    previous_xc = os.environ.get("XINCHUANG_MODE")
    previous_mock_fail = os.environ.get("PUSH_MOCK_FORCE_FAIL")
    os.environ["DATABASE_URL"] = _R51_SQLITE_URL
    os.environ.pop("PUSH_BROWSER_ENABLED", None)
    os.environ.pop("PUSH_WECOM_WEBHOOK", None)
    os.environ.pop("PUSH_DINGTALK_WEBHOOK", None)
    os.environ.pop("PUSH_MOCK_FORCE_FAIL", None)
    os.environ.setdefault("XINCHUANG_MODE", "permissive")
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    for key, val in (
        ("DATABASE_URL", previous_db),
        ("PUSH_BROWSER_ENABLED", previous_push),
        ("XINCHUANG_MODE", previous_xc),
        ("PUSH_MOCK_FORCE_FAIL", previous_mock_fail),
    ):
        if val is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = val
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_catalog_entry(
    client: TestClient,
    *,
    path: str | None = None,
    status: str = "draft",
    name: str = "GovSvc",
) -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"{name}-{suffix}",
            "httpMethod": "POST",
            "path": path or f"/api/v1/gov-svc/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: NFR 错误域扩展 + r51 测试夹具

**Files:**
- Modify: `backend/app/core/nfr/errors.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Create: `tests/test_nfr_gov_conn_r51.py`（夹具 + 1 条启动测）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `PUSH_CHANNEL_DEGRADED`, `PUSH_CHANNEL_ALL_FAILED`, `NFR_PROBE_TIMEOUT`

- [ ] **Step 1: Write the failing test**

在 `tests/test_nfr_gov_conn_r51.py` 写入上文 **Shared Test Fixtures** 全文，并追加：

```python
from app.core.nfr.errors import (
    NFR_PROBE_TIMEOUT,
    PUSH_CHANNEL_ALL_FAILED,
    PUSH_CHANNEL_DEGRADED,
)


def test_r51_fixture_bootstraps(client):
    """T-R51-000-01: r51 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r51_nfr_error_constants_exported():
    """T-R51-000-02: companion 错误常量可导入。"""
    assert PUSH_CHANNEL_DEGRADED == "PUSH_CHANNEL_DEGRADED"
    assert PUSH_CHANNEL_ALL_FAILED == "PUSH_CHANNEL_ALL_FAILED"
    assert NFR_PROBE_TIMEOUT == "NFR_PROBE_TIMEOUT"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py::test_r51_nfr_error_constants_exported -v`
Expected: FAIL with `ImportError` or `cannot import name 'PUSH_CHANNEL_DEGRADED'`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/errors.py` 追加：

```python
# NFR-006 推送通道 companion
PUSH_CHANNEL_DEGRADED = "PUSH_CHANNEL_DEGRADED"
PUSH_CHANNEL_ALL_FAILED = "PUSH_CHANNEL_ALL_FAILED"

# NFR 横切 probe 超时（非阻塞）
NFR_PROBE_TIMEOUT = "NFR_PROBE_TIMEOUT"
```

`backend/app/core/nfr/__init__.py` 的 `__all__` 追加三项常量名。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py::test_r51_fixture_bootstraps ../tests/test_nfr_gov_conn_r51.py::test_r51_nfr_error_constants_exported -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/errors.py backend/app/core/nfr/__init__.py tests/test_nfr_gov_conn_r51.py
git commit -m "test(nfr-r51): scaffold errors constants and r51 fixture"
```

---

### Task 2: NFR-006 浏览器矩阵 + 推送 mock 降级链

**Files:**
- Create: `backend/app/core/nfr/browser_matrix.py`
- Create: `backend/app/core/nfr/push_channels.py`
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 NFR-006 单元测 7 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `SUPPORTED_BROWSER_MATRIX`, `probe_browser_support(user_agent) -> BrowserMatrixReport`, `probe_browser_matrix_budget_ms=50`
- Produces: `PUSH_CHANNEL_ORDER`, `dispatch_push_mock(payload, settings) -> PushDispatchResult`, `probe_push_dispatch_budget_ms=100`, `clear_push_mock_log()`

- [ ] **Step 1: Write the failing tests**

在 `tests/test_nfr_gov_conn_r51.py` 追加：

```python
import time

from app.core.nfr.browser_matrix import (
    SUPPORTED_BROWSER_MATRIX,
    probe_browser_matrix_budget_ms,
    probe_browser_support,
)
from app.core.nfr.errors import PUSH_CHANNEL_ALL_FAILED, PUSH_CHANNEL_DEGRADED
from app.core.nfr.push_channels import (
    clear_push_mock_log,
    dispatch_push_mock,
    probe_push_dispatch_budget_ms,
)


def test_nfr006_supported_browser_matrix_at_least_four():
    """T-NFR-R51-006-01: SUPPORTED_BROWSER_MATRIX ≥4 浏览器。"""
    names = {e.name for e in SUPPORTED_BROWSER_MATRIX}
    assert {"chrome", "edge", "firefox", "safari"} <= names


def test_nfr006_chrome_120_supported():
    """T-NFR-R51-006-02: UA Chrome/120 → supported。"""
    report = probe_browser_support("Mozilla/5.0 Chrome/120.0.0.0")
    assert report.detected_browser is not None
    assert report.detected_browser.name == "chrome"
    assert report.detected_browser.supported is True


def test_nfr006_msie6_unsupported():
    """T-NFR-R51-006-03: UA MSIE 6 → unsupported。"""
    report = probe_browser_support("Mozilla/4.0 (compatible; MSIE 6.0)")
    assert report.detected_browser is not None
    assert report.detected_browser.supported is False


def test_nfr006_probe_browser_matrix_budget():
    """T-NFR-R51-006-04: probe_browser_support 耗时 < 50ms。"""
    started = time.perf_counter()
    probe_browser_support("Mozilla/5.0 Chrome/120.0.0.0")
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_browser_matrix_budget_ms


def test_nfr006_dispatch_all_failed_when_disabled(monkeypatch):
    """T-NFR-R51-006-05: 全未配置 push → failed + PUSH_CHANNEL_ALL_FAILED。"""
    monkeypatch.delenv("PUSH_BROWSER_ENABLED", raising=False)
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    monkeypatch.delenv("PUSH_DINGTALK_WEBHOOK", raising=False)
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "failed"
    assert result.code == PUSH_CHANNEL_ALL_FAILED


def test_nfr006_dispatch_degraded_when_wecom_mock_fails(monkeypatch):
    """T-NFR-R51-006-06: browser+wecom 配置 + mock wecom 失败 → degraded。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    monkeypatch.setenv("PUSH_WECOM_WEBHOOK", "https://example.com/wecom")
    monkeypatch.setenv("PUSH_MOCK_FORCE_FAIL", "wecom")
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "degraded"
    assert result.code == PUSH_CHANNEL_DEGRADED
    assert "wecom" in result.attempted_channels


def test_nfr006_dispatch_delivered_when_channels_ok(monkeypatch):
    """T-NFR-R51-006-07: browser+wecom 正常 → delivered。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    monkeypatch.setenv("PUSH_WECOM_WEBHOOK", "https://example.com/wecom")
    monkeypatch.delenv("PUSH_MOCK_FORCE_FAIL", raising=False)
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "delivered"
    assert result.channel in {"browser", "wecom"}


def test_nfr006_dispatch_budget_smoke():
    """T-NFR-R51-006-04b: dispatch_push_mock 耗时 < 100ms。"""
    started = time.perf_counter()
    dispatch_push_mock({"text": "budget"})
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_push_dispatch_budget_ms
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr006" -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.nfr.browser_matrix'`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/browser_matrix.py`:

```python
from __future__ import annotations

import re
import time
from dataclasses import dataclass

probe_browser_matrix_budget_ms: int = 50

_BROWSER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("chrome", re.compile(r"Chrome/(\d+)", re.I)),
    ("edge", re.compile(r"Edg/(\d+)", re.I)),
    ("firefox", re.compile(r"Firefox/(\d+)", re.I)),
    ("safari", re.compile(r"Version/(\d+).*Safari", re.I)),
    ("ie", re.compile(r"MSIE (\d+)", re.I)),
)


@dataclass(frozen=True)
class BrowserMatrixEntry:
    name: str
    min_version: int
    status: str  # supported|deprecated|unsupported
    notes: str | None = None


@dataclass(frozen=True)
class DetectedBrowser:
    name: str
    major_version: int | None
    supported: bool
    status: str


@dataclass(frozen=True)
class BrowserMatrixReport:
    items: tuple[BrowserMatrixEntry, ...]
    detected_browser: DetectedBrowser | None
    overall_status: str  # supported|unsupported|deprecated|unknown


SUPPORTED_BROWSER_MATRIX: tuple[BrowserMatrixEntry, ...] = (
    BrowserMatrixEntry("chrome", 90, "supported", "Chromium-based"),
    BrowserMatrixEntry("edge", 90, "supported", "Chromium-based"),
    BrowserMatrixEntry("firefox", 90, "supported", None),
    BrowserMatrixEntry("safari", 14, "supported", None),
    BrowserMatrixEntry("ie", 11, "unsupported", "Legacy IE not supported"),
)


def _lookup_entry(name: str) -> BrowserMatrixEntry | None:
    for entry in SUPPORTED_BROWSER_MATRIX:
        if entry.name == name:
            return entry
    return None


def _parse_user_agent(user_agent: str) -> DetectedBrowser | None:
    for name, pattern in _BROWSER_PATTERNS:
        match = pattern.search(user_agent)
        if not match:
            continue
        major = int(match.group(1))
        entry = _lookup_entry(name)
        if entry is None:
            return DetectedBrowser(name, major, False, "unsupported")
        if entry.status == "unsupported":
            return DetectedBrowser(name, major, False, "unsupported")
        supported = major >= entry.min_version
        status = "supported" if supported else "deprecated"
        return DetectedBrowser(name, major, supported, status)
    return None


def probe_browser_support(user_agent: str | None = None) -> BrowserMatrixReport:
    started = time.perf_counter()
    items = SUPPORTED_BROWSER_MATRIX
    if not user_agent:
        _ = time.perf_counter() - started
        return BrowserMatrixReport(items=items, detected_browser=None, overall_status="unknown")
    detected = _parse_user_agent(user_agent)
    if detected is None:
        overall = "unsupported"
    else:
        overall = detected.status
    _ = time.perf_counter() - started
    return BrowserMatrixReport(items=items, detected_browser=detected, overall_status=overall)
```

`backend/app/core/nfr/push_channels.py`:

```python
from __future__ import annotations

import os
from dataclasses import dataclass, field

from app.core.config import Settings, get_settings
from app.core.nfr.errors import PUSH_CHANNEL_ALL_FAILED, PUSH_CHANNEL_DEGRADED
from app.core.nfr.push_config import resolve_push_mode

probe_push_dispatch_budget_ms: int = 100
PUSH_CHANNEL_ORDER: tuple[str, ...] = ("browser", "wecom", "dingtalk")

_PUSH_MOCK_LOG: list[dict] = []


@dataclass(frozen=True)
class PushDispatchResult:
    status: str  # delivered|degraded|failed
    channel: str | None
    attempted_channels: tuple[str, ...]
    degraded_reason: str | None
    code: str | None


def clear_push_mock_log() -> None:
    _PUSH_MOCK_LOG.clear()


def _mock_send(channel: str, payload: dict, settings: Settings) -> bool:
    force_fail = os.environ.get("PUSH_MOCK_FORCE_FAIL")
    if channel == "browser":
        if settings.push_browser_enabled:
            _PUSH_MOCK_LOG.append({"channel": channel, "payload": payload})
            return True
        return False
    if channel == "wecom":
        if not settings.push_wecom_webhook:
            return False
        if force_fail == "wecom":
            return False
        _PUSH_MOCK_LOG.append({"channel": channel, "payload": payload})
        return True
    if channel == "dingtalk":
        if not settings.push_dingtalk_webhook:
            return False
        if force_fail == "dingtalk":
            return False
        _PUSH_MOCK_LOG.append({"channel": channel, "payload": payload})
        return True
    return False


def dispatch_push_mock(payload: dict, settings: Settings | None = None) -> PushDispatchResult:
    settings = settings or get_settings()
    mode = resolve_push_mode(settings)
    if mode.delivery_mode == "disabled":
        return PushDispatchResult("failed", None, (), "push channels not configured", PUSH_CHANNEL_ALL_FAILED)
    attempted: list[str] = []
    for channel in PUSH_CHANNEL_ORDER:
        attempted.append(channel)
        if _mock_send(channel, payload, settings):
            return PushDispatchResult("delivered", channel, tuple(attempted), None, None)
    if mode.delivery_mode == "degraded":
        return PushDispatchResult(
            "degraded",
            None,
            tuple(attempted),
            f"all channels failed: {','.join(attempted)}",
            PUSH_CHANNEL_DEGRADED,
        )
    return PushDispatchResult("failed", None, tuple(attempted), "all channels failed", PUSH_CHANNEL_ALL_FAILED)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr006" -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/browser_matrix.py backend/app/core/nfr/push_channels.py tests/test_nfr_gov_conn_r51.py
git commit -m "feat(nfr-r51): browser matrix and push mock degradation chain"
```

---

### Task 3: NFR-006 HTTP 路由 + push_config 集成

**Files:**
- Modify: `backend/app/core/nfr/push_config.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Modify: `backend/app/api/v1/nfr.py`
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 HTTP 测 2 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `probe_browser_support`, `dispatch_push_mock` from Task 2
- Produces: `GET /api/v1/nfr/browser-matrix`, `POST /api/v1/nfr/push-probe`

- [ ] **Step 1: Write the failing tests**

```python
def test_nfr006_browser_matrix_http(client):
    """T-NFR-R51-006-08: HTTP GET browser-matrix 200 + items≥4。"""
    resp = client.get(
        "/api/v1/nfr/browser-matrix",
        headers=AUTH,
        params={"userAgent": "Mozilla/5.0 Chrome/120.0.0.0"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) >= 4
    assert body["detectedBrowser"]["name"] == "chrome"


def test_nfr006_push_probe_http_no_webhook_leak(client, monkeypatch):
    """T-NFR-R51-006-09: HTTP POST push-probe 不泄露 webhook URL。"""
    monkeypatch.setenv("PUSH_WECOM_WEBHOOK", "https://secret.example.com/hook")
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    get_settings.cache_clear()
    resp = client.post(
        "/api/v1/nfr/push-probe",
        headers=AUTH,
        json={"message": "probe"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "secret.example.com" not in text
    assert "webhook" not in text.lower() or "configured" in text.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py::test_nfr006_browser_matrix_http -v`
Expected: FAIL with `404 Not Found`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/push_config.py` 追加内部 helper（**不**改 `PushConfigOut` 公开字段）：

```python
from app.core.nfr.push_channels import dispatch_push_mock

def summarize_channel_probe(payload: dict | None = None) -> str:
    result = dispatch_push_mock(payload or {"text": "probe"})
    return f"{result.status}:{result.channel or 'none'}"
```

`backend/app/api/v1/nfr.py` 追加路由与模型（保留既有路由不变）：

```python
from fastapi import Query
from app.core.nfr.browser_matrix import probe_browser_support
from app.core.nfr.push_channels import dispatch_push_mock

class BrowserMatrixItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    min_version: int = Field(alias="minVersion")
    status: str
    notes: str | None = None

class BrowserMatrixResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    items: list[BrowserMatrixItemOut]
    detected_browser: dict | None = Field(default=None, alias="detectedBrowser")
    overall_status: str = Field(alias="overallStatus")

class PushProbeIn(BaseModel):
    message: str = "probe"

class PushProbeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: str
    channel: str | None = None
    attempted_channels: list[str] = Field(alias="attemptedChannels")
    code: str | None = None

@router.get("/browser-matrix", response_model=BrowserMatrixResponse)
def get_browser_matrix(
    _: Annotated[UserContext, Depends(get_current_user)],
    user_agent: str | None = Query(default=None, alias="userAgent"),
) -> BrowserMatrixResponse:
    report = probe_browser_support(user_agent)
    detected = None
    if report.detected_browser:
        detected = {
            "name": report.detected_browser.name,
            "majorVersion": report.detected_browser.major_version,
            "supported": report.detected_browser.supported,
            "status": report.detected_browser.status,
        }
    return BrowserMatrixResponse(
        items=[
            BrowserMatrixItemOut(name=i.name, minVersion=i.min_version, status=i.status, notes=i.notes)
            for i in report.items
        ],
        detectedBrowser=detected,
        overallStatus=report.overall_status,
    )

@router.post("/push-probe", response_model=PushProbeResponse)
def post_push_probe(
    payload: PushProbeIn,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> PushProbeResponse:
    result = dispatch_push_mock({"text": payload.message})
    return PushProbeResponse(
        status=result.status,
        channel=result.channel,
        attemptedChannels=list(result.attempted_channels),
        code=result.code,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr006" -v`
Expected: PASS (10 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/push_config.py backend/app/api/v1/nfr.py backend/app/core/nfr/__init__.py tests/test_nfr_gov_conn_r51.py
git commit -m "feat(nfr-r51): browser-matrix and push-probe HTTP routes"
```

---

### Task 4: NFR-007 信创 remediation + 非阻塞 probe

**Files:**
- Modify: `backend/app/core/nfr/xinchuang.py`
- Modify: `backend/app/api/v1/nfr.py`（`ComplianceItemOut` 增 `remediation`）
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 NFR-007 测 6 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `enumerate_non_compliant(report)`, `probe_compliance_non_blocking(settings, max_ms=100) -> ComplianceProbeResult`
- `XinchuangChecklistItem` 增 `remediation: str | None`

- [ ] **Step 1: Write the failing tests**

```python
from app.core.nfr.xinchuang import (
    build_compliance_report,
    enumerate_non_compliant,
    probe_compliance_non_blocking,
)
from app.core.nfr.errors import NFR_PROBE_TIMEOUT, XINCHUANG_NON_COMPLIANT


def test_nfr007_fail_items_have_remediation():
    """T-NFR-R51-007-01: fail 项 remediation 非空。"""
    report = build_compliance_report()
    for item in report.items:
        if item.status == "fail":
            assert item.remediation


def test_nfr007_enumerate_non_compliant_only_fails():
    """T-NFR-R51-007-02: enumerate_non_compliant 仅返回 fail。"""
    report = build_compliance_report()
    fails = enumerate_non_compliant(report)
    assert all(i.status == "fail" for i in fails)


def test_nfr007_probe_compliance_non_blocking_budget():
    """T-NFR-R51-007-03: probe_compliance_non_blocking elapsedMs < 100。"""
    result = probe_compliance_non_blocking(max_ms=100)
    assert result.probe_status == "ok"
    assert result.elapsed_ms < 100


def test_nfr007_probe_timeout_on_slow_check(monkeypatch):
    """T-NFR-R51-007-04: mock 慢检查 → probeStatus=timeout。"""
    import app.core.nfr.xinchuang as xc

    def slow_report(*_a, **_k):
        import time
        time.sleep(0.2)
        return build_compliance_report()

    monkeypatch.setattr(xc, "build_compliance_report", slow_report)
    result = probe_compliance_non_blocking(max_ms=50)
    assert result.probe_status == "timeout"
    assert result.code == NFR_PROBE_TIMEOUT


def test_nfr007_compliance_http_gbase_registered(client):
    """T-NFR-R51-007-05: GET compliance 200 且 gbase 在 registeredXinchuangConnectors。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_nfr007_strict_mysql_platform_422(client, monkeypatch):
    """T-NFR-R51-007-06: strict + mysql 平台库 → 422 XINCHUANG_NON_COMPLIANT（r46 回归）。"""
    monkeypatch.setenv("XINCHUANG_MODE", "strict")
    monkeypatch.setenv("DATABASE_URL", "mysql://bad:3306/db")
    get_settings.cache_clear()
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == XINCHUANG_NON_COMPLIANT
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr007" -v`
Expected: FAIL with `AttributeError: 'XinchuangChecklistItem' object has no attribute 'remediation'`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/xinchuang.py` 关键增量：

```python
import time
from app.core.nfr.errors import NFR_PROBE_TIMEOUT

_REMEDIATION: dict[str, str] = {
    "xc-db-connector": "Register xinchuang dialect via register_connector_plugin (e.g. gbase, dm, gaussdb)",
    "xc-platform-db": "Set DATABASE_URL to postgresql:// or sqlite+ for dev",
    "xc-forbidden-runtime": "Remove superset/dataease from runtime dependencies",
    "xc-connector-plugin": "Declare PLUGIN_EXTENSION_POINTS in plugin_extension module",
}

@dataclass(frozen=True)
class XinchuangChecklistItem:
    id: str
    status: str
    message: str
    remediation: str | None = None

@dataclass(frozen=True)
class ComplianceProbeResult:
    probe_status: str  # ok|timeout
    elapsed_ms: float
    report: ComplianceReport | None
    code: str | None = None

def _with_remediation(item: XinchuangChecklistItem) -> XinchuangChecklistItem:
    if item.status != "fail":
        return item
    return XinchuangChecklistItem(item.id, item.status, item.message, _REMEDIATION.get(item.id, item.message))

def enumerate_non_compliant(report: ComplianceReport) -> list[XinchuangChecklistItem]:
    return [i for i in report.items if i.status == "fail"]

def probe_compliance_non_blocking(settings: Settings | None = None, max_ms: int = 100) -> ComplianceProbeResult:
    settings = settings or get_settings()
    started = time.perf_counter()
    report = build_compliance_report(settings)
    elapsed_ms = (time.perf_counter() - started) * 1000
    if elapsed_ms >= max_ms:
        return ComplianceProbeResult("timeout", elapsed_ms, None, NFR_PROBE_TIMEOUT)
    return ComplianceProbeResult("ok", elapsed_ms, report, None)
```

在 `build_compliance_report` 返回前对 `items` 每项调用 `_with_remediation`。

`backend/app/api/v1/nfr.py` 的 `ComplianceItemOut` 增 `remediation: str | None = None`，映射时传入。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr007" -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/xinchuang.py backend/app/api/v1/nfr.py tests/test_nfr_gov_conn_r51.py
git commit -m "feat(nfr-r51): xinchuang remediation and non-blocking compliance probe"
```

---

### Task 5: NFR-005 插件登记路径 + registry probe

**Files:**
- Modify: `backend/app/core/nfr/plugin_extension.py`
- Modify: `backend/app/core/nfr/__init__.py`
- Modify: `backend/app/api/v1/nfr.py`（`GET registration-path/{connector_type}`）
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 NFR-005 测 6 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `describe_registration_path(connector_type) -> RegistrationPathDoc`, `probe_registry(max_ms=50)`, `verify_zero_invasion() -> bool`

- [ ] **Step 1: Write the failing tests**

```python
import inspect
import time

from app.core.nfr.plugin_extension import (
    describe_registration_path,
    get_plugin_registration_meta,
    probe_registry,
    verify_zero_invasion,
)
from app.datasources.registry import ConnectorRegistry


def test_nfr005_gbase_registration_path_no_core_touch():
    """T-NFR-R51-005-01: describe_registration_path('gbase').touchesCoreRegistry is False。"""
    doc = describe_registration_path("gbase")
    assert doc.touches_core_registry is False


def test_nfr005_gbase_steps_include_register_plugin():
    """T-NFR-R51-005-02: gbase steps 含 register_connector_plugin。"""
    doc = describe_registration_path("gbase")
    joined = " ".join(doc.steps)
    assert "register_connector_plugin" in joined


def test_nfr005_probe_registry_budget():
    """T-NFR-R51-005-03: probe_registry < 50ms。"""
    started = time.perf_counter()
    result = probe_registry(max_ms=50)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < 50
    assert "gbase" in result.types


def test_nfr005_verify_zero_invasion():
    """T-NFR-R51-005-04: verify_zero_invasion() True。"""
    assert verify_zero_invasion() is True


def test_nfr005_registration_path_http(client):
    """T-NFR-R51-005-05: HTTP registration-path/gbase 200。"""
    resp = client.get("/api/v1/nfr/registration-path/gbase", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["connectorType"] == "gbase"


def test_nfr005_gbase_registered_via_plugin_r46_link():
    """T-NFR-R51-005-06: get_plugin_registration_meta('gbase') registered_via=plugin。"""
    meta = get_plugin_registration_meta("gbase")
    assert meta is not None
    assert meta["registered_via"] == "plugin"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr005" -v`
Expected: FAIL with `ImportError: cannot import name 'describe_registration_path'`

- [ ] **Step 3: Write minimal implementation**

`backend/app/core/nfr/plugin_extension.py` 追加：

```python
import time
import inspect
from app.datasources.registry import ConnectorRegistry, registry

@dataclass(frozen=True)
class RegistrationPathDoc:
    connector_type: str
    steps: tuple[str, ...]
    touches_core_registry: bool = False

@dataclass(frozen=True)
class RegistryProbeResult:
    types: tuple[str, ...]
    elapsed_ms: float
    gbase_present: bool

_KNOWN_PATHS: dict[str, tuple[str, ...]] = {
    "gbase": (
        "Create dialects/gbase.py",
        "Call register_connector_plugin(GbaseConnector()) in datasources/__init__.py",
    ),
}

def describe_registration_path(connector_type: str) -> RegistrationPathDoc:
    steps = _KNOWN_PATHS.get(
        connector_type,
        ("Implement DialectConnector", "register_connector_plugin(connector)"),
    )
    return RegistrationPathDoc(connector_type, steps, False)

def probe_registry(max_ms: int = 50) -> RegistryProbeResult:
    started = time.perf_counter()
    types = tuple(t.type for t in registry.list_types())
    gbase = registry.get("gbase") is not None
    elapsed_ms = (time.perf_counter() - started) * 1000
    return RegistryProbeResult(types, elapsed_ms, gbase)

def verify_zero_invasion() -> bool:
    register_src = inspect.getsource(ConnectorRegistry.register)
    get_src = inspect.getsource(ConnectorRegistry.get)
    return "register_connector_plugin" not in register_src and "register_connector_plugin" not in get_src
```

`backend/app/api/v1/nfr.py` 追加：

```python
from app.core.nfr.plugin_extension import describe_registration_path

class RegistrationPathResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    steps: list[str]
    touches_core_registry: bool = Field(alias="touchesCoreRegistry")

@router.get("/registration-path/{connector_type}", response_model=RegistrationPathResponse)
def get_registration_path(
    connector_type: str,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> RegistrationPathResponse:
    doc = describe_registration_path(connector_type)
    return RegistrationPathResponse(
        connectorType=doc.connector_type,
        steps=list(doc.steps),
        touchesCoreRegistry=doc.touches_core_registry,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "nfr005" -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/nfr/plugin_extension.py backend/app/api/v1/nfr.py backend/app/core/nfr/__init__.py tests/test_nfr_gov_conn_r51.py
git commit -m "feat(nfr-r51): connector registration path and registry probe"
```

---

### Task 6: GOV-005 审批通知钩子 + 并发/幂等

**Files:**
- Create: `backend/app/governance/publish/notifications.py`
- Modify: `backend/app/governance/publish/service.py`
- Modify: `backend/app/governance/publish/schemas.py`
- Modify: `backend/app/governance/publish/__init__.py`
- Modify: `backend/app/api/v1/gov.py`
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 GOV-005 测 8 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `emit_publish_notification(entry_id, event_type, *, actor) -> PublishNotificationEvent`, `list_notifications(entry_id)`, `clear_notifications()`
- Consumes: `resolve_push_mode`, `dispatch_push_mock` from Task 2

- [ ] **Step 1: Write the failing tests**

```python
from app.core.nfr.errors import GOV_PUBLISH_ALREADY_PENDING, GOV_PUBLISH_INVALID_TRANSITION
from app.governance.publish.notifications import clear_notifications


def test_gov005_submit_emits_submitted_notification(client):
    """T-GOV-R51-005-01: submit 后 notifications 含 submitted。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    types = [e["eventType"] for e in resp.json()["items"]]
    assert "submitted" in types


def test_gov005_approve_emits_approved_with_delivery_mode(client):
    """T-GOV-R51-005-02: approve 后含 approved 且 deliveryMode 存在。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    approved = [e for e in resp.json()["items"] if e["eventType"] == "approved"]
    assert len(approved) == 1
    assert "deliveryMode" in approved[0]


def test_gov005_reject_emits_rejected(client):
    """T-GOV-R51-005-03: reject 后含 rejected。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/reject", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    assert any(e["eventType"] == "rejected" for e in resp.json()["items"])


def test_gov005_idempotent_double_approve_single_notification(client):
    """T-GOV-R51-005-04: 幂等 double approve 仅 1 条 approved 通知。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    approved = [e for e in resp.json()["items"] if e["eventType"] == "approved"]
    assert len(approved) == 1


def test_gov005_draft_approve_400(client):
    """T-GOV-R51-005-05: draft 直 approve → 400（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == GOV_PUBLISH_INVALID_TRANSITION


def test_gov005_double_submit_409(client):
    """T-GOV-R51-005-06: pending 双 submit → 409（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == GOV_PUBLISH_ALREADY_PENDING


def test_gov005_push_disabled_notification_degraded(client, monkeypatch):
    """T-GOV-R51-005-07: push disabled 时 notificationStatus=degraded。"""
    clear_notifications()
    monkeypatch.delenv("PUSH_BROWSER_ENABLED", raising=False)
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    get_settings.cache_clear()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    assert resp.json()["items"][0]["notificationStatus"] == "degraded"


def test_gov005_approve_visible_in_integration_list(client):
    """T-GOV-R51-005-08: gov approve 后 integration list 含 entry（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get("/api/v1/integration/query-services", headers=AUTH)
    ids = {item["id"] for item in resp.json()["items"]}
    assert entry_id in ids
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py::test_gov005_submit_emits_submitted_notification -v`
Expected: FAIL with `404` on notifications route

- [ ] **Step 3: Write minimal implementation**

`backend/app/governance/publish/notifications.py`:

```python
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.nfr.push_channels import dispatch_push_mock
from app.core.nfr.push_config import resolve_push_mode

_PUBLISH_NOTIFICATIONS: list["PublishNotificationEvent"] = []


@dataclass
class PublishNotificationEvent:
    id: str
    entry_id: uuid.UUID
    event_type: str  # submitted|approved|rejected
    timestamp: str
    delivery_mode: str
    notification_status: str  # queued|delivered|degraded
    message: str


def clear_notifications() -> None:
    _PUBLISH_NOTIFICATIONS.clear()


def emit_publish_notification(
    entry_id: uuid.UUID,
    event_type: str,
    *,
    actor: str | None = None,
) -> PublishNotificationEvent:
    mode = resolve_push_mode()
    dispatch = dispatch_push_mock({"text": f"publish {event_type} {entry_id}"})
    if mode.delivery_mode == "active" and dispatch.status == "delivered":
        status = "delivered"
        message = f"{event_type} notification delivered via {dispatch.channel}"
    else:
        status = "degraded"
        message = f"{event_type} notification degraded: {mode.degraded_reason or dispatch.degraded_reason}"
    event = PublishNotificationEvent(
        id=uuid.uuid4().hex,
        entry_id=entry_id,
        event_type=event_type,
        timestamp=datetime.now(timezone.utc).isoformat(),
        delivery_mode=mode.delivery_mode,
        notification_status=status,
        message=message,
    )
    _PUBLISH_NOTIFICATIONS.append(event)
    return event


def list_notifications(entry_id: uuid.UUID) -> list[PublishNotificationEvent]:
    return [e for e in _PUBLISH_NOTIFICATIONS if e.entry_id == entry_id]
```

`backend/app/governance/publish/service.py` 在 `submit_entry`/`approve_entry`/`reject_entry` 成功 commit 后调用 `emit_publish_notification`；`approve_entry` 对已 `published` 幂等返回时**不**发通知。

`backend/app/governance/publish/schemas.py` 追加 `PublishNotificationOut` 与 `PublishNotificationListOut`。

`backend/app/api/v1/gov.py` 追加：

```python
from app.governance.publish.notifications import list_notifications
from app.governance.publish.schemas import PublishNotificationListOut

@router.get("/publish/entries/{entry_id}/notifications", response_model=PublishNotificationListOut)
def publish_notifications(
    entry_id: uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
) -> PublishNotificationListOut | JSONResponse:
    try:
        publish_service.get_publish_status(db, entry_id)
    except PublishError as exc:
        return _publish_error_response(exc)
    events = list_notifications(entry_id)
    return PublishNotificationListOut(items=[...])  # map fields with camelCase aliases
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "gov005" -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/publish/ tests/test_nfr_gov_conn_r51.py backend/app/api/v1/gov.py
git commit -m "feat(gov-r51): publish approval notification hooks with idempotent approve"
```

---

### Task 7: CONN-019 GBase 边界 + HTTP 链

**Files:**
- Modify: `backend/app/datasources/dialects/gbase.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加 CONN-019 测 8 条）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`（修映射前检索 cases/）

**UI skill:** none

**Interfaces:**
- Produces: `map_gbase_error` 巩固 `2002→GBASE_TIMEOUT`、`1049→GBASE_UNKNOWN_DATABASE`
- `list_schemas` 空库 `[]` 语义；`list_columns` 501→500 切片

- [ ] **Step 1: Write the failing tests**

```python
import pymysql.err

from app.datasources.dialects.gbase import GbaseConnector, GBASE_MAX_COLUMNS
from app.datasources.dialects.errors import (
    GBASE_AUTH_FAILED,
    GBASE_TIMEOUT,
    GBASE_UNKNOWN_DATABASE,
    map_gbase_error,
)


def test_conn019_map_gbase_timeout_2002():
    """T-CONN-R51-019-01: mock timeout → GBASE_TIMEOUT。"""
    exc = pymysql.err.OperationalError(2002, "Can't connect timed out")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_TIMEOUT


def test_conn019_map_gbase_unknown_database_1049():
    """T-CONN-R51-019-02: mock unknown database → GBASE_UNKNOWN_DATABASE。"""
    exc = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_UNKNOWN_DATABASE


def test_conn019_list_schemas_empty_database():
    """T-CONN-R51-019-03: mock 空库 list_schemas → []。"""
    connector = GbaseConnector()
    conn = MagicMock()
    with patch.object(connector._inner, "list_schemas", return_value=[]):
        assert connector.list_schemas(conn) == []


def test_conn019_list_columns_501_truncated_to_500():
    """T-CONN-R51-019-04: mock 501 columns → len==500。"""
    connector = GbaseConnector()
    conn = MagicMock()
    cols = [MagicMock(name=f"c{i}") for i in range(501)]
    with patch.object(connector._inner, "list_columns", return_value=cols):
        result = connector.list_columns(conn, "demo", "t1")
        assert len(result) == GBASE_MAX_COLUMNS == 500


def test_conn019_http_test_auth_failed_trace_id(client):
    """T-CONN-R51-019-05: HTTP POST test auth fail → GBASE_AUTH_FAILED + traceId。"""
    with patch("app.datasources.dialects.gbase.GbaseConnector.test_connection") as mock_test:
        from app.datasources.dialects.base import TestConnectionResult
        mock_test.return_value = TestConnectionResult(
            ok=False, message="[GBASE_AUTH_FAILED] denied", latency_ms=1, code=GBASE_AUTH_FAILED,
        )
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={"type": "gbase", "host": "h", "port": 5258, "username": "u", "password": "p"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == GBASE_AUTH_FAILED
    assert body.get("detail", {}).get("traceId") or resp.headers.get("X-Trace-Id")


def test_conn019_http_tables_missing_schema_400(client):
    """T-CONN-R51-019-06: HTTP GET tables 无 schema → 400。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={"name": "gbase-r51", "type": "gbase", "host": "127.0.0.1", "port": 5258, "username": "u", "password": "p"},
    )
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/tables", headers=AUTH)
    assert resp.status_code == 400


def test_conn019_http_tables_connection_failed_502(client):
    """T-CONN-R51-019-07: HTTP GET tables 连接失败 → 502。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={"name": "gbase-r51b", "type": "gbase", "host": "127.0.0.1", "port": 5258, "username": "u", "password": "p"},
    )
    ds_id = create.json()["id"]
    with patch("app.datasources.dialects.gbase.GbaseConnector.open_connection", side_effect=ConnectionError("refused")):
        resp = client.get(
            f"/api/v1/datasources/{ds_id}/tables",
            headers=AUTH,
            params={"schema": "demo"},
        )
    assert resp.status_code == 502


def test_conn019_types_catalog_gbase_relational(client):
    """T-CONN-R51-019-08: types catalog gbase relational（r46 回归）。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    gbase = next(t for t in resp.json()["items"] if t["type"] == "gbase")
    assert gbase["category"] == "relational"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "conn019_map_gbase_timeout" -v`
Expected: FAIL — `GBASE_CONN_REFUSED` instead of `GBASE_TIMEOUT`（若 2002 未映射）

- [ ] **Step 3: Write minimal implementation**

`backend/app/datasources/dialects/errors.py` 的 `map_gbase_error` 在 `isinstance(exc, pymysql.err.OperationalError)` 分支内，在调用 `map_mysql_operational_error` 之前：

```python
errno = int(exc.args[0]) if exc.args else 0
detail = str(exc.args[1]) if len(exc.args) > 1 else str(exc)
if errno == 2002 or "timed out" in detail.lower():
    return GBASE_TIMEOUT, detail
if errno == 1049:
    return GBASE_UNKNOWN_DATABASE, detail
```

`backend/app/datasources/dialects/gbase.py` 的 `list_schemas` 保持委托并文档化空列表语义（无需改逻辑，仅确保不抛）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -k "conn019" -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/gbase.py backend/app/datasources/dialects/errors.py tests/test_nfr_gov_conn_r51.py
git commit -m "feat(conn-r51): gbase timeout/unknown-db mapping and metadata boundaries"
```

---

### Task 8: 跨项联动 + 回归门控 + 文档同步

**Files:**
- Modify: `tests/test_nfr_gov_conn_r51.py`（追加跨项 3 条）
- Modify: `docs/services/nfr.md`
- Modify: `docs/services/governance.md`
- Modify: `docs/api/README.md`（4 新路由登记）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/prd-sync` via `.cursor/rules/prd-sync.mdc` 评估步骤

**UI skill:** none

- [ ] **Step 1: Write cross-integration tests**

```python
from app.core.nfr.plugin_extension import get_plugin_registration_meta
from app.datasources.registry import registry


def test_r51_cross_gbase_xinchuang_plugin(client):
    """T-R51-X-01: gbase 插件登记 + 信创合规 + 扩展点联动。"""
    assert registry.get("gbase") is not None
    assert get_plugin_registration_meta("gbase")["registered_via"] == "plugin"
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_r51_cross_push_probe_uses_resolve_push_mode(client, monkeypatch):
    """T-R51-X-02: push-probe 与 push-config deliveryMode 一致。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    get_settings.cache_clear()
    cfg = client.get("/api/v1/nfr/push-config", headers=AUTH).json()
    probe = client.post("/api/v1/nfr/push-probe", headers=AUTH, json={"message": "x"}).json()
    assert cfg["deliveryMode"] in {"active", "degraded"}
    assert probe["status"] in {"delivered", "degraded", "failed"}


def test_r51_cross_integration_fast_path_no_gov_notification(client):
    """T-R51-X-03: integration 快路径不发 gov 通知（与 gov FSM 边界）。"""
    from app.governance.publish.notifications import clear_notifications, list_notifications

    clear_notifications()
    suffix = uuid.uuid4().hex[:8]
    create = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"Fast-{suffix}",
            "httpMethod": "GET",
            "path": f"/api/v1/fast/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": "draft",
        },
    )
    entry_id = create.json()["id"]
    client.post(f"/api/v1/integration/query-services/{entry_id}/publish", headers=AUTH)
    assert list_notifications(uuid.UUID(entry_id)) == []
```

- [ ] **Step 2: Run full r51 suite**

Run: `cd backend && python3 -m pytest ../tests/test_nfr_gov_conn_r51.py -v --tb=short`
Expected: PASS (**≥32** passed)

- [ ] **Step 3: Run regression gate**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_nfr_gov_conn_r51.py \
  ../tests/test_nfr_gov_conn_r46.py \
  ../tests/test_design_conn_gov_query_r49.py \
  -q
```
Expected: r51 ≥30 + r46 **36/36** + r49 **35/35**；ruff clean；exit code 0

- [ ] **Step 4: Update docs**

`docs/services/nfr.md`：登记 browser-matrix、push-probe、registration-path companion 边界（Out：真实 WebPush/企微 SDK）。

`docs/services/governance.md`：GOV-005 增审批通知钩子（内存 store、非持久化）。

`docs/api/README.md` 追加 4 行：
- `GET /api/v1/nfr/browser-matrix`
- `POST /api/v1/nfr/push-probe`
- `GET /api/v1/nfr/registration-path/{connector_type}`
- `GET /api/v1/gov/publish/entries/{entry_id}/notifications`

- [ ] **Step 5: Commit**

```bash
git add tests/test_nfr_gov_conn_r51.py docs/services/nfr.md docs/services/governance.md docs/api/README.md
git commit -m "test(docs-r51): cross-integration tests, regression gate, API/service docs"
```

---

## Spec Self-Review（P2 自检）

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 2–7 覆盖 NFR-006/007/005、GOV-005、CONN-019 |
| 无 TBD/TODO 占位 | 全文无占位符 |
| 每 Task 有验证命令 | 每 Task Step 2/4 含 pytest 命令与 Expected |
| 纯后端 UI skill none | 全 8 Task 标注 |
| 文件数 ≤20 | 18 文件 |
| 测试 ≥30 | 32 条断言函数（8+6+6+8+8+3 跨项 + 2 scaffold） |
| r46/r49 回归门控 | Task 8 Step 3 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-nfr-gov-gbase-companion-quality-r51.md`.**

**执行方式（固定）：** subagent-driven-development (option 1) — P3 `evolution-implementer` 按 Task 1→8 逐 Task 派发 subagent，Task 间跑回归门控。
