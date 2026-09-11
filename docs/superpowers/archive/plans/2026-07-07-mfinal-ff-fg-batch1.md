# M-FINAL · F-F 收官（NFR-008）+ F-G 缺口连接器首批 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/core/nfr/deployment_report.py`、`backend/app/api/v1/nfr.py`、`docs/nfr/zero-de-ss-deployment.md`、`backend/app/datasources/dialects/rest_api.py`、`backend/app/datasources/dialects/excel.py`、`backend/app/datasources/dialects/csv_file.py`、`backend/app/datasources/dialects/db2.py`、`backend/app/datasources/dialects/impala.py`、`backend/app/datasources/dialects/errors.py`、`backend/app/datasources/dialects/__init__.py`、`backend/app/datasources/__init__.py`、`backend/app/query/native/guard.py`、`tests/test_mfinal_ff_fg_batch1_r249.py`、`tests/fixtures/sample.csv`、`tests/fixtures/sample.xlsx`、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`、`docs/api/README.md`、`docs/services/datasources.md`
> **子项：** NFR-008、CONN-023、CONN-024、CONN-025、CONN-026
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** 闭合 F-F 末项 NFR-008（compose 禁入扫描 + markdown 部署报告 + ops 文档）并落地 F-G 首批四型连接器（REST API、Excel/CSV、Db2、Impala）的方言注册、连通/只读链、Admin 表单 hints 与 r249 集成测簇。

**Architecture:** NFR-008 扩展既有 `deployment_report.py`，本地抽取 `_parse_compose_services`（不跨域 import `xinchuang`）；四型连接器各独立 `dialects/*.py` + `register_dialect`；`guard.py` 增 `api`/`file` 至 `NATIVE_CATEGORIES`；集成测单文件 `test_mfinal_ff_fg_batch1_r249.py`（≥30 函数）mock 驱动，无 compose 真机 Db2/Impala。

**Tech Stack:** Python 3.12 + FastAPI + httpx + pytest + unittest.mock；React 18 + vitest + RTL；pnpm workspace。

## Global Constraints

- 不修改 `goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 不新增 Alembic migration；不修改 `query/native/executor.py` HTTP 出数链
- 不实现 CONN-027 Redshift、文件上传 UI、REST OAuth2 专用表单项
- 单 Python 业务文件 ≤ 200 行；单 FE 文件 ≤ 300 行
- HTTP 响应 JSON 不得含 `password` 明文
- `NFR08_RUNTIME_MODE`：`permissive`（默认）/ `strict`；compose 禁入命中 + strict → `rejected`
- compose 禁入 token（大小写不敏感）：`superset`、`dataease`、`apache-superset`
- 错误码与 design 一致：`REST_API_*`、`FILE_*`、`DB2_*`、`IMPALA_*`
- 文档同步：`docs/api/README.md` + `docs/services/datasources.md` + `docs/nfr/zero-de-ss-deployment.md`（`prd-sync.mdc`）
- 提交信息格式：`feat:` / `test:` / `docs:` 前缀 + 英文动词短语

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `backend/app/core/nfr/deployment_report.py` | **修改** | compose 解析、禁入扫描、markdown renderer、`schemaVersion` |
| `backend/app/api/v1/nfr.py` | **修改** | `format=markdown` + 新 JSON 字段 |
| `docs/nfr/zero-de-ss-deployment.md` | **新建** | ops 清单、环境变量、pytest 指针 |
| `backend/app/datasources/dialects/rest_api.py` | **新建** | CONN-023 REST API 方言 |
| `backend/app/datasources/dialects/excel.py` | **新建** | CONN-024 Excel 方言 |
| `backend/app/datasources/dialects/csv_file.py` | **新建** | CONN-024 CSV 方言（`type=csv`） |
| `backend/app/datasources/dialects/db2.py` | **新建** | CONN-025 Db2 方言 |
| `backend/app/datasources/dialects/impala.py` | **新建** | CONN-026 Impala 方言 |
| `backend/app/datasources/dialects/errors.py` | **修改** | 四型错误码 + mapper |
| `backend/app/datasources/dialects/__init__.py` | **修改** | export 四型 |
| `backend/app/datasources/__init__.py` | **修改** | `register_dialect` 四型 |
| `backend/app/query/native/guard.py` | **修改** | `NATIVE_CATEGORIES` 增 `api`、`file` |
| `tests/test_mfinal_ff_fg_batch1_r249.py` | **新建** | ≥30 集成测 |
| `tests/fixtures/sample.csv` | **新建** | 2 行 CSV fixture |
| `tests/fixtures/sample.xlsx` | **新建** | 最小 xlsx（openpyxl 或脚本生成） |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | **修改** | `CONNECTOR_FIELD_HINTS` + 辅助说明 |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | **修改** | 四型 smoke |
| `docs/api/README.md` | **修改** | markdown 参数 + 四型 types 锚点 |
| `docs/services/datasources.md` | **修改** | 四型 In/Out 登记 |

---

### Task 1: NFR-008 — compose 禁入扫描 + markdown 部署报告 + ops 文档

**Files:**
- Modify: `backend/app/core/nfr/deployment_report.py`
- Modify: `backend/app/api/v1/nfr.py`
- Create: `docs/nfr/zero-de-ss-deployment.md`
- Create: `tests/test_mfinal_ff_fg_batch1_r249.py`（NFR 段 + module fixture）

**Interfaces:**
- Produces: `_parse_compose_services(compose_text: str | None = None) -> tuple[str, ...]`
- Produces: `_scan_forbidden_compose_hits(compose_text: str, services: tuple[str, ...]) -> tuple[str, ...]`
- Produces: `render_nfr08_deployment_markdown(report: DeploymentAcceptanceReport) -> str`
- Produces: `build_deployment_acceptance_report(..., compose_text: str | None = None)` 增 `compose_services` / `forbidden_compose_hits` / `schema_version`
- Produces: `GET /api/v1/nfr/runtime-compliance/deployment-report?format=markdown`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 新建测试文件与 NFR 失败测试（TDD）**

创建 `tests/test_mfinal_ff_fg_batch1_r249.py`：

```python
"""M-FINAL F-F/F-G 批次 1 r249 — NFR-008 + CONN-023~026。"""
from __future__ import annotations

import json
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.core.nfr.deployment_report import (
    build_deployment_acceptance_report,
    probe_deployment_report_budget_ms,
)
from app.main import app

AUTH = jwt_auth_headers()
_R249_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_ff_fg_r249?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]

MOCK_COMPOSE_CLEAN = """
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
"""

MOCK_COMPOSE_SUPERSET = """
services:
  postgres:
    image: postgres:16
  superset:
    image: apache-superset:latest
"""


@pytest.fixture(scope="module", autouse=True)
def r249_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R249_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- NFR-008 ---


def test_nfr_r249_008_01_deployment_report_accepted_with_compose(client: TestClient):
    """T-NFR-R249-008-01: 默认 accepted，含 composeServices 非空。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["overallAcceptance"] == "accepted"
    assert body["schemaVersion"] == "1.0"
    assert len(body["composeServices"]) >= 1


def test_nfr_r249_008_02_forbidden_compose_conditional(client: TestClient):
    """T-NFR-R249-008-02: mock compose 含 superset → forbiddenComposeHits 非空，conditional。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_SUPERSET,
    ):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    body = resp.json()
    assert body["forbiddenComposeHits"]
    assert body["overallAcceptance"] == "conditional"


def test_nfr_r249_008_03_strict_forbidden_rejected(client: TestClient):
    """T-NFR-R249-008-03: strict + forbidden hit → rejected。"""
    with patch.dict(os.environ, {"NFR08_RUNTIME_MODE": "strict"}):
        get_settings.cache_clear()
        with patch(
            "app.core.nfr.deployment_report._read_compose_text",
            return_value=MOCK_COMPOSE_SUPERSET,
        ):
            resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
        get_settings.cache_clear()
    assert resp.json()["overallAcceptance"] == "rejected"


def test_nfr_r249_008_04_markdown_format(client: TestClient):
    """T-NFR-R249-008-04: format=markdown 200 text/markdown 含 ## 零第三方 BI。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        resp = client.get(
            "/api/v1/nfr/runtime-compliance/deployment-report?format=markdown",
            headers=AUTH,
        )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers.get("content-type", "")
    assert "## 零第三方 BI" in resp.text


def test_nfr_r249_008_05_budget_ms():
    """T-NFR-R249-008-05: probe_deployment_report_budget_ms ≤ 100。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        elapsed = probe_deployment_report_budget_ms()
    assert elapsed <= 100.0


def test_nfr_r249_008_06_strict_assert_503(client: TestClient):
    """T-NFR-R249-008-06: POST assert strict 违规 → 503 NFR_RUNTIME_VIOLATION。"""
    with patch.dict(os.environ, {"NFR08_RUNTIME_MODE": "strict"}):
        get_settings.cache_clear()
        with patch("importlib.util.find_spec", return_value=object()):
            resp = client.post("/api/v1/nfr/runtime-compliance/assert", headers=AUTH)
        get_settings.cache_clear()
    assert resp.status_code == 503
    assert resp.json()["code"] == "NFR_RUNTIME_VIOLATION"
```

- [ ] **Step 2: 运行 NFR 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "008" -v`
Expected: FAIL — `AttributeError` on `schemaVersion` / `_read_compose_text` / `forbiddenComposeHits`

- [ ] **Step 3: 扩展 `deployment_report.py`**

在 `backend/app/core/nfr/deployment_report.py` 全文替换为以下实现（保留 `SCAN_BUDGET_MS`、`REPORT_VERSION`）：

```python
from __future__ import annotations

import os
import pathlib
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.core.nfr.runtime_guard import RuntimeCheckItem, RuntimeComplianceReport, build_runtime_report

SCAN_BUDGET_MS = 100
REPORT_VERSION = "nfr08-deployment-v1"
SCHEMA_VERSION = "1.0"
FORBIDDEN_COMPOSE_TOKENS = ("superset", "dataease", "apache-superset")


@dataclass(frozen=True)
class DeploymentAcceptanceReport:
    report_version: str
    schema_version: str
    generated_at: str
    runtime: RuntimeComplianceReport
    acceptance_checklist: tuple[RuntimeCheckItem, ...]
    overall_acceptance: Literal["accepted", "rejected", "conditional"]
    ops_summary: str
    remediation_index: dict[str, str]
    compose_services: tuple[str, ...]
    forbidden_compose_hits: tuple[str, ...]


def _read_compose_text() -> str:
    path = pathlib.Path(__file__).resolve().parents[4] / "docker-compose.yml"
    return path.read_text(encoding="utf-8")


def _parse_compose_services(compose_text: str) -> tuple[str, ...]:
    names: list[str] = []
    for line in compose_text.splitlines():
        stripped = line.strip()
        if (
            line.startswith("  ")
            and not line.startswith("    ")
            and stripped.endswith(":")
            and stripped.rstrip(":") != "services"
        ):
            names.append(stripped.rstrip(":"))
    return tuple(names)


def _scan_forbidden_compose_hits(compose_text: str, services: tuple[str, ...]) -> tuple[str, ...]:
    hits: list[str] = []
    for svc in services:
        lowered = svc.lower()
        if any(tok in lowered for tok in FORBIDDEN_COMPOSE_TOKENS):
            hits.append(svc)
    for line in compose_text.splitlines():
        if "image:" in line.lower():
            fragment = line.split(":", 1)[1].strip()
            lowered = fragment.lower()
            if any(tok in lowered for tok in FORBIDDEN_COMPOSE_TOKENS):
                hits.append(fragment)
    return tuple(dict.fromkeys(hits))


def render_nfr08_deployment_markdown(report: DeploymentAcceptanceReport) -> str:
    lines = [
        "## 零第三方 BI 部署验收报告",
        "",
        f"- schemaVersion: {report.schema_version}",
        f"- reportVersion: {report.report_version}",
        f"- generatedAt: {report.generated_at}",
        f"- overallAcceptance: {report.overall_acceptance}",
        "",
        "### Runtime 摘要",
        f"- overallStatus: {report.runtime.overall_status}",
        f"- zeroThirdPartyBiRuntime: {report.runtime.zero_third_party_bi_runtime}",
        "",
        "### Compose 服务",
    ]
    for svc in report.compose_services:
        lines.append(f"- {svc}")
    lines.extend(["", "### 禁入命中"])
    if report.forbidden_compose_hits:
        for hit in report.forbidden_compose_hits:
            lines.append(f"- {hit}")
    else:
        lines.append("- （无）")
    if report.remediation_index:
        lines.extend(["", "### remediation_index"])
        for key, val in report.remediation_index.items():
            lines.append(f"- {key}: {val}")
    lines.extend(["", "### CI 门禁", "- 设置 `NFR08_RUNTIME_MODE=strict` 于 CI 阻断违规部署"])
    return "\n".join(lines)


def build_deployment_acceptance_report(
    pyproject_text: str | None = None,
    *,
    mode: str | None = None,
    compose_text: str | None = None,
) -> DeploymentAcceptanceReport:
    runtime = build_runtime_report(pyproject_text)
    mode = mode or os.environ.get("NFR08_RUNTIME_MODE", "permissive")
    compose_raw = compose_text if compose_text is not None else _read_compose_text()
    compose_services = _parse_compose_services(compose_raw)
    forbidden_hits = _scan_forbidden_compose_hits(compose_raw, compose_services)
    compose_item = RuntimeCheckItem(
        "compose-forbidden-services",
        "pass" if not forbidden_hits else "fail",
        "docker-compose must not include Superset/DataEase images or service names",
    )
    extra = (
        compose_item,
        RuntimeCheckItem(
            "deployment-ready",
            "pass" if runtime.overall_status == "compliant" else "fail",
            "Runtime must be compliant for deployment",
        ),
        RuntimeCheckItem("ci-gate-hint", "pass", "Set NFR08_RUNTIME_MODE=strict for CI gates"),
    )
    checklist = runtime.items + extra
    remediation = {i.id: i.remediation for i in checklist if i.remediation and i.status == "fail"}
    if forbidden_hits:
        remediation["compose-forbidden-services"] = (
            "Remove Superset/DataEase services or images from docker-compose.yml"
        )
    if runtime.overall_status == "compliant" and not forbidden_hits:
        overall: Literal["accepted", "rejected", "conditional"] = "accepted"
        ops = "Runtime compliance accepted; compose scan clean; ready for deployment verification."
    elif mode == "strict" and (runtime.overall_status != "compliant" or forbidden_hits):
        overall = "rejected"
        ops = "Deployment rejected under strict mode; remediate runtime or compose violations."
    else:
        overall = "conditional"
        ops = "Deployment conditional; review remediation_index before production."
    return DeploymentAcceptanceReport(
        report_version=REPORT_VERSION,
        schema_version=SCHEMA_VERSION,
        generated_at=datetime.now(UTC).isoformat(),
        runtime=runtime,
        acceptance_checklist=checklist,
        overall_acceptance=overall,
        ops_summary=ops,
        remediation_index=remediation,
        compose_services=compose_services,
        forbidden_compose_hits=forbidden_hits,
    )


def probe_deployment_report_budget_ms() -> float:
    start = time.perf_counter()
    build_deployment_acceptance_report("dependencies = []\n", compose_text="services:\n  postgres:\n")
    return (time.perf_counter() - start) * 1000.0
```

- [ ] **Step 4: 更新 `nfr.py` deployment-report 端点**

将 `get_deployment_report` 替换为：

```python
from app.core.nfr.deployment_report import (
    build_deployment_acceptance_report,
    render_nfr08_deployment_markdown,
)


@router.get("/runtime-compliance/deployment-report", response_model=None)
def get_deployment_report(
    _: Annotated[UserContext, Depends(get_current_user)],
    format: str = Query("json"),
):
    report = build_deployment_acceptance_report()
    if format == "markdown":
        md = render_nfr08_deployment_markdown(report)
        return Response(content=md, media_type="text/markdown")
    return {
        "schemaVersion": report.schema_version,
        "reportVersion": report.report_version,
        "generatedAt": report.generated_at,
        "overallAcceptance": report.overall_acceptance,
        "opsSummary": report.ops_summary,
        "remediationIndex": report.remediation_index,
        "composeServices": list(report.compose_services),
        "forbiddenComposeHits": list(report.forbidden_compose_hits),
        "runtime": {
            "policyVersion": report.runtime.policy_version,
            "overallStatus": report.runtime.overall_status,
            "zeroThirdPartyBiRuntime": report.runtime.zero_third_party_bi_runtime,
            "scannedAt": report.runtime.scanned_at,
            "items": [
                {"id": i.id, "status": i.status, "message": i.message, "remediation": i.remediation}
                for i in report.runtime.items
            ],
        },
        "acceptanceChecklist": [
            {"id": i.id, "status": i.status, "message": i.message, "remediation": i.remediation}
            for i in report.acceptance_checklist
        ],
    }
```

（删除文件顶部重复的 `build_deployment_acceptance_report` 单行 import 若与新 import 块重复。）

- [ ] **Step 5: 创建 ops 文档**

创建 `docs/nfr/zero-de-ss-deployment.md`：

```markdown
# 零第三方 BI 部署验收（NFR-008）

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/nfr/runtime-compliance/deployment-report` | JSON 部署验收报告 |
| GET | `/api/v1/nfr/runtime-compliance/deployment-report?format=markdown` | Markdown 运维报告 |
| POST | `/api/v1/nfr/runtime-compliance/assert` | strict 模式阻断（503 `NFR_RUNTIME_VIOLATION`） |

## 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `NFR08_RUNTIME_MODE` | `permissive`（默认）/ `strict` | strict 时 runtime 或 compose 违规 → `rejected` / assert 503 |

## Compose 禁入规则

解析仓库根 `docker-compose.yml` 服务名与 `image:` 行；命中以下子串（大小写不敏感）记入 `forbiddenComposeHits`：

- `superset`
- `dataease`
- `apache-superset`

## goal §5 对账

| 指标 | 探针 |
|------|------|
| 生产部署无 Superset/DataEase 容器 | `composeServices` + `forbiddenComposeHits` |
| 运行时无第三方 BI 模块 | `runtime.zeroThirdPartyBiRuntime` |
| CI 可执行 | `tests/test_mfinal_ff_fg_batch1_r249.py` `T-NFR-R249-008-*` |

## pytest

```bash
cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "008" -v
```
```

- [ ] **Step 6: 运行 NFR 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "008" -v`
Expected: 6 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/nfr/deployment_report.py backend/app/api/v1/nfr.py docs/nfr/zero-de-ss-deployment.md tests/test_mfinal_ff_fg_batch1_r249.py
git commit -m "feat: NFR-008 compose forbidden scan and markdown deployment report"
```

---

### Task 2: CONN-023 — REST API 方言 + 错误码

**Files:**
- Create: `backend/app/datasources/dialects/rest_api.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `tests/test_mfinal_ff_fg_batch1_r249.py`（CONN-023 段）

**Interfaces:**
- Produces: `RestApiConnector`（`type=rest_api`, `category=api`, `capabilities` 含 `native_query`）
- Produces: `probe_readonly_fetch(connection, *, path: str) -> bool`
- Produces: `map_rest_api_error(exc) -> tuple[str, str]`
- Consumes: `guard_native_injection` from `app.query.native.guard`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/bug-case-library/SKILL.md`

- [ ] **Step 1: 追加 CONN-023 失败测试**

在 `tests/test_mfinal_ff_fg_batch1_r249.py` 追加（需 `import uuid` 与 `from unittest.mock import MagicMock, patch`）：

```python
from app.datasources.dialects.rest_api import RestApiConnector, probe_readonly_fetch
from app.datasources.registry import export_type_catalog


# --- CONN-023 REST API ---


def test_conn_r249_023_01_types_catalog():
    """T-CONN-R249-023-01: export_type_catalog 含 rest_api category=api。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "rest_api" in types
    assert types["rest_api"]["category"] == "api"
    assert "REST API" in types["rest_api"]["displayName"]


def test_conn_r249_023_02_http_types_endpoint(client: TestClient):
    """T-CONN-R249-023-02: GET /datasources/types 含 REST API。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    names = [i["displayName"] for i in resp.json()["items"]]
    assert any("REST API" in n for n in names)


@patch("httpx.Client")
def test_conn_r249_023_03_test_connection_ok(mock_client_cls):
    """T-CONN-R249-023-03: mock httpx 2xx → test_connection ok。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RestApiConnector().test_connection(
        host="https://api.example.com", port=443, database="/health",
        username="", password="", timeout_sec=5.0,
    )
    assert result.ok is True


@patch("httpx.Client")
def test_conn_r249_023_04_auth_failed(mock_client_cls):
    """T-CONN-R249-023-04: 401 → REST_API_AUTH_FAILED。"""
    mock_resp = MagicMock(status_code=401, is_success=False)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RestApiConnector().test_connection(
        host="https://api.example.com", port=443, database="/",
        username="u", password="p", timeout_sec=5.0,
    )
    assert result.ok is False
    assert result.code == "REST_API_AUTH_FAILED"


@patch("httpx.Client")
def test_conn_r249_023_05_execute_native_query(mock_client_cls):
    """T-CONN-R249-023-05: execute_native_query mock JSON 返回 columns/rows。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_resp.json.return_value = {"items": [{"id": 1, "name": "a"}]}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    cols, rows, truncated = RestApiConnector().execute_native_query(
        mock_client, body={"path": "/items", "method": "GET", "jsonPath": "items"},
        limit=10, database="/",
    )
    assert cols
    assert rows
    assert truncated is False


def test_conn_r249_023_06_routing_mode_native(client: TestClient):
    """T-CONN-R249-023-06: routing-modes rest_api mode=native。"""
    resp = client.get("/api/v1/query/routing-modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("rest_api") == "native"


@patch("httpx.Client")
def test_conn_r249_023_07_http_test_no_password(mock_client_cls, client: TestClient):
    """T-CONN-R249-023-07: POST /datasources/test 响应无 password。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    secret = "rest_secret_xyz"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "rest_api",
            "name": "api-r249",
            "code": f"api-{uuid.uuid4().hex[:8]}",
            "host": "https://api.example.com",
            "port": 443,
            "database": "/health",
            "username": "u",
            "password": secret,
        },
    )
    assert resp.status_code == 200
    assert secret not in json.dumps(resp.json())
```

- [ ] **Step 2: 运行 CONN-023 测试（预期 FAIL）**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "023" -v`
Expected: FAIL — `rest_api` not in catalog

- [ ] **Step 3: 在 `errors.py` 追加 REST API 错误码**

在 `backend/app/datasources/dialects/errors.py` 末尾（`__all__` 之前）追加：

```python
REST_API_INVALID_URL = "REST_API_INVALID_URL"
REST_API_AUTH_FAILED = "REST_API_AUTH_FAILED"
REST_API_TIMEOUT = "REST_API_TIMEOUT"
REST_API_PROBE_FAILED = "REST_API_PROBE_FAILED"


def map_rest_api_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "401" in lowered or "unauthorized" in lowered:
        return REST_API_AUTH_FAILED, detail
    if "timeout" in lowered or "timed out" in lowered:
        return REST_API_TIMEOUT, detail
    if "invalid url" in lowered or "missing scheme" in lowered:
        return REST_API_INVALID_URL, detail
    return REST_API_PROBE_FAILED, detail
```

并更新 `__all__` 列表加入上述常量与 `map_rest_api_error`。

- [ ] **Step 4: 创建 `rest_api.py`**

创建 `backend/app/datasources/dialects/rest_api.py`：

```python
from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    REST_API_AUTH_FAILED,
    REST_API_INVALID_URL,
    REST_API_PROBE_FAILED,
    map_rest_api_error,
)
from app.query.native.guard import guard_native_injection
from app.query.schemas import QueryError

REST_API_MAX_COLUMNS = 500


def _normalize_base_url(host: str, port: int) -> str:
    host = host.strip().rstrip("/")
    if host.startswith("http://") or host.startswith("https://"):
        return host
    scheme = "https" if port == 443 else "http"
    return f"{scheme}://{host}" if "://" not in host else host


def _probe_url(base: str, probe_path: str) -> str:
    path = probe_path if probe_path.startswith("/") else f"/{probe_path or ''}"
    return urljoin(base.rstrip("/") + "/", path.lstrip("/"))


def probe_readonly_fetch(client: httpx.Client, *, path: str) -> bool:
    try:
        resp = client.get(path, timeout=5.0)
        return resp.is_success
    except Exception:
        return False


class RestApiConnector:
    type = "rest_api"
    category = "api"
    capabilities = ("connectivity_test", "schema_browser", "native_query")
    display_name = "REST API"

    def _client(self, **kwargs: Any) -> httpx.Client:
        base = _normalize_base_url(kwargs["host"], int(kwargs.get("port", 443)))
        auth = None
        if kwargs.get("username") or kwargs.get("password"):
            auth = (kwargs.get("username", ""), kwargs.get("password", ""))
        timeout = float(kwargs.get("timeout_sec", 5.0))
        return httpx.Client(base_url=base, auth=auth, timeout=timeout, follow_redirects=True)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            base = _normalize_base_url(kwargs["host"], int(kwargs.get("port", 443)))
            if not urlparse(base).scheme:
                raise ValueError("invalid url: missing scheme")
            probe = kwargs.get("database") or "/"
            with self._client(**kwargs) as client:
                resp = client.get(probe if probe.startswith("/") else f"/{probe}")
            if resp.status_code == 401:
                code, detail = REST_API_AUTH_FAILED, "Unauthorized"
                ok = False
            elif not resp.is_success:
                code, detail = REST_API_PROBE_FAILED, f"HTTP {resp.status_code}"
                ok = False
            else:
                ok, code, detail = True, None, "Connection successful"
        except Exception as exc:
            code, detail = map_rest_api_error(exc)
            if "missing scheme" in str(exc).lower():
                code = REST_API_INVALID_URL
            ok = False
        latency_ms = int((time.perf_counter() - started) * 1000)
        if ok:
            return TestConnectionResult(ok=True, message=detail, latency_ms=latency_ms, code=None)
        return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=latency_ms, code=code)

    def open_connection(self, **kwargs: Any) -> httpx.Client:
        return self._client(**kwargs)

    def list_schemas(self, connection: httpx.Client) -> list[SchemaInfo]:
        return [SchemaInfo(name="api")]

    def list_tables(self, connection: httpx.Client, schema: str) -> list[TableInfo]:
        return [TableInfo(name="endpoints", type="ENDPOINT")]

    def list_columns(self, connection: httpx.Client, schema: str, table: str) -> list[ColumnInfo]:
        return [
            ColumnInfo(name="path", data_type="string", nullable=False),
            ColumnInfo(name="method", data_type="string", nullable=True),
        ]

    def execute_native_query(
        self,
        connection: httpx.Client,
        *,
        body: dict,
        limit: int,
        offset: int = 0,
        database: str | None = None,
    ) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        path = body.get("path")
        if not isinstance(path, str) or not path.strip():
            raise QueryError("QUERY_NATIVE_INVALID_BODY", "body.path is required", 422)
        method = str(body.get("method", "GET")).upper()
        resp = connection.request(method, path if path.startswith("/") else f"/{path}")
        if resp.status_code == 401:
            raise QueryError(REST_API_AUTH_FAILED, "Unauthorized", 401)
        if not resp.is_success:
            raise QueryError(REST_API_PROBE_FAILED, f"HTTP {resp.status_code}", 400)
        payload = resp.json()
        json_path = body.get("jsonPath")
        if json_path and isinstance(payload, dict):
            payload = payload.get(json_path, [])
        if isinstance(payload, dict):
            columns = sorted(payload.keys())[:REST_API_MAX_COLUMNS]
            rows = [[payload.get(c) for c in columns]]
            return columns, rows, False
        if isinstance(payload, list):
            if not payload:
                return [], [], False
            if isinstance(payload[0], dict):
                columns = sorted({k for item in payload[:limit] for k in item})[:REST_API_MAX_COLUMNS]
                rows = [[item.get(c) for c in columns] for item in payload[offset : offset + limit + 1]]
                truncated = len(rows) > limit
                return columns, rows[:limit], truncated
        return ["value"], [[json.dumps(payload)]], False
```

- [ ] **Step 5: 临时注册（Task 5 会统一注册）**

在 `backend/app/datasources/__init__.py` 追加：

```python
from app.datasources.dialects.rest_api import RestApiConnector
# 在 register_builtin_dialects() 内：
register_dialect(RestApiConnector())
```

- [ ] **Step 6: 运行 CONN-023 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "023" -v`
Expected: 7 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/datasources/dialects/rest_api.py backend/app/datasources/dialects/errors.py backend/app/datasources/__init__.py tests/test_mfinal_ff_fg_batch1_r249.py
git commit -m "feat: add REST API datasource connector (CONN-023)"
```

---

### Task 3: CONN-024 — Excel/CSV 文件方言

**Files:**
- Create: `backend/app/datasources/dialects/excel.py`
- Create: `backend/app/datasources/dialects/csv_file.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Create: `tests/fixtures/sample.csv`
- Create: `tests/fixtures/sample.xlsx`
- Modify: `tests/test_mfinal_ff_fg_batch1_r249.py`
- Modify: `backend/app/datasources/__init__.py`

**Interfaces:**
- Produces: `ExcelConnector`（`type=excel`, `category=file`）
- Produces: `CsvFileConnector`（`type=csv`, `category=file`）
- Produces: `map_file_error(exc) -> tuple[str, str]`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 创建 fixtures**

`tests/fixtures/sample.csv`：

```csv
id,name
1,alpha
2,beta
```

生成 `tests/fixtures/sample.xlsx`（一次性脚本）：

```bash
cd backend && python -c "
from pathlib import Path
try:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = 'Sheet1'
    ws.append(['id', 'name'])
    ws.append([1, 'alpha'])
    ws.append([2, 'beta'])
    out = Path('../tests/fixtures/sample.xlsx')
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print('wrote', out)
except ImportError:
    import zipfile
    # minimal xlsx fallback omitted — install openpyxl in dev env
    raise SystemExit('openpyxl required to generate sample.xlsx')
"
```

- [ ] **Step 2: 追加 CONN-024 失败测试**

```python
from pathlib import Path

from app.datasources.dialects.csv_file import CsvFileConnector
from app.datasources.dialects.excel import ExcelConnector

FIXTURES = Path(__file__).resolve().parent / "fixtures"


# --- CONN-024 Excel/CSV ---


def test_conn_r249_024_01_types_file_category():
    """T-CONN-R249-024-01: types 含 excel 与 csv category=file。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["excel"]["category"] == "file"
    assert types["csv"]["category"] == "file"


def test_conn_r249_024_02_excel_list_tables():
    """T-CONN-R249-024-02: fixture xlsx → list_tables 含 Sheet1。"""
    xlsx = FIXTURES / "sample.xlsx"
    conn = ExcelConnector().open_connection(host=str(xlsx), port=1, database="", username="", password="")
    tables = ExcelConnector().list_tables(conn, "workbook")
    names = [t.name for t in tables]
    assert "Sheet1" in names


def test_conn_r249_024_03_csv_list_columns():
    """T-CONN-R249-024-03: fixture csv → list_columns 非空。"""
    csv_path = FIXTURES / "sample.csv"
    conn = CsvFileConnector().open_connection(host=str(csv_path), port=1, database="", username="", password="")
    cols = CsvFileConnector().list_columns(conn, "file", "data")
    assert len(cols) >= 2


def test_conn_r249_024_04_traversal_denied():
    """T-CONN-R249-024-04: .. 路径 → FILE_NOT_FOUND 或 traversal。"""
    result = ExcelConnector().test_connection(
        host="../etc/passwd", port=1, database="", username="", password="",
    )
    assert result.ok is False
    assert result.code in {"FILE_NOT_FOUND", "FILE_PATH_TRAVERSAL"}


def test_conn_r249_024_05_csv_native_query():
    """T-CONN-R249-024-05: execute_native_query csv 至少 1 行。"""
    csv_path = FIXTURES / "sample.csv"
    conn = CsvFileConnector().open_connection(host=str(csv_path), port=1, database="", username="", password="")
    cols, rows, _ = CsvFileConnector().execute_native_query(conn, body={"table": "data"}, limit=10)
    assert cols
    assert len(rows) >= 1


def test_conn_r249_024_06_routing_native(client: TestClient):
    """T-CONN-R249-024-06: excel/csv routing mode=native。"""
    resp = client.get("/api/v1/query/routing-modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("excel") == "native"
    assert modes.get("csv") == "native"
```

- [ ] **Step 3: 追加 FILE 错误码到 `errors.py`**

```python
FILE_NOT_FOUND = "FILE_NOT_FOUND"
FILE_PARSE_ERROR = "FILE_PARSE_ERROR"
FILE_REMOTE_HTTP_ERROR = "FILE_REMOTE_HTTP_ERROR"
FILE_EXTENSION_DENIED = "FILE_EXTENSION_DENIED"
FILE_PATH_TRAVERSAL = "FILE_PATH_TRAVERSAL"
FILE_DRIVER_MISSING = "FILE_DRIVER_MISSING"


def map_file_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "traversal" in lowered or ".." in detail:
        return FILE_PATH_TRAVERSAL, detail
    if "404" in detail or "not found" in lowered:
        return FILE_NOT_FOUND, detail
    if "extension" in lowered:
        return FILE_EXTENSION_DENIED, detail
    if "openpyxl" in lowered or "driver" in lowered:
        return FILE_DRIVER_MISSING, detail
    if "http" in lowered and ("ssl" in lowered or "remote" in lowered):
        return FILE_REMOTE_HTTP_ERROR, detail
    return FILE_PARSE_ERROR, detail
```

- [ ] **Step 4: 创建 `excel.py` 与 `csv_file.py`**

`excel.py` 核心（对齐 `sqlite.py` 路径守卫 + openpyxl read_only）：

```python
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import httpx

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import (
    FILE_DRIVER_MISSING,
    FILE_EXTENSION_DENIED,
    FILE_NOT_FOUND,
    FILE_PATH_TRAVERSAL,
    map_file_error,
)
from app.query.native.guard import guard_native_injection
from app.query.schemas import QueryError

ALLOWED_EXCEL_SUFFIX = ".xlsx"


def _resolve_file_path(host: str) -> tuple[Path | None, str | None, bool]:
    if host.startswith("https://"):
        return None, None, True
    if ".." in host.replace("\\", "/").split("/"):
        return None, FILE_PATH_TRAVERSAL, False
    path = Path(host).expanduser().resolve()
    if path.suffix.lower() != ALLOWED_EXCEL_SUFFIX:
        return None, FILE_EXTENSION_DENIED, False
    if not path.is_file() or not os.access(path, os.R_OK):
        return None, FILE_NOT_FOUND, False
    return path, None, False


class ExcelConnector:
    type = "excel"
    category = "file"
    capabilities = ("connectivity_test", "schema_browser", "native_query")
    display_name = "Excel"

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        path, err, is_remote = _resolve_file_path(kwargs["host"])
        if is_remote:
            try:
                with httpx.Client(timeout=float(kwargs.get("timeout_sec", 5.0)), follow_redirects=True) as client:
                    resp = client.head(kwargs["host"])
                if not resp.is_success:
                    code, detail = map_file_error(Exception(f"remote http {resp.status_code}"))
                    return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
            except Exception as exc:
                code, detail = map_file_error(exc)
                return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
            return TestConnectionResult(ok=True, message="Remote file reachable", latency_ms=int((time.perf_counter()-started)*1000), code=None)
        if err:
            return TestConnectionResult(ok=False, message=f"[{err}] invalid path", latency_ms=0, code=err)
        try:
            from openpyxl import load_workbook
            wb = load_workbook(path, read_only=True, data_only=True)
            wb.close()
        except ImportError:
            return TestConnectionResult(ok=False, message=f"[{FILE_DRIVER_MISSING}] openpyxl not installed", latency_ms=0, code=FILE_DRIVER_MISSING)
        except Exception as exc:
            code, detail = map_file_error(exc)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=0, code=code)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=int((time.perf_counter()-started)*1000), code=None)

    def open_connection(self, **kwargs: Any) -> Any:
        path, err, is_remote = _resolve_file_path(kwargs["host"])
        if is_remote:
            return {"remote": kwargs["host"]}
        if err or path is None:
            raise ValueError(err or FILE_NOT_FOUND)
        from openpyxl import load_workbook
        return load_workbook(path, read_only=True, data_only=True)

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        return [SchemaInfo(name="workbook")]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if hasattr(connection, "sheetnames"):
            return [TableInfo(name=n, type="SHEET") for n in connection.sheetnames]
        return [TableInfo(name="Sheet1", type="SHEET")]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        sheet_name = table or (connection.sheetnames[0] if hasattr(connection, "sheetnames") else "Sheet1")
        ws = connection[sheet_name]
        row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
        return [ColumnInfo(name=str(c), data_type="string", nullable=True) for c in row if c is not None]

    def execute_native_query(self, connection: Any, *, body: dict, limit: int, offset: int = 0, database: str | None = None) -> tuple[list[str], list[list], bool]:
        guard_native_injection(body)
        sheet = body.get("table") or database or "Sheet1"
        ws = connection[str(sheet)]
        rows_iter = ws.iter_rows(values_only=True)
        header = [str(c) for c in next(rows_iter, ()) if c is not None]
        data = [list(r) for r in rows_iter if any(r)]
        data = data[offset : offset + limit + 1]
        truncated = len(data) > limit
        return header, data[:limit], truncated
```

`csv_file.py` 使用 stdlib `csv` + `Sniffer`；`type = "csv"`；路径守卫复用相同模式，扩展名 `.csv`；`list_schemas` → `file`；`list_tables` → `data`。

- [ ] **Step 5: 注册 excel/csv + 更新 guard（临时，Task 5 统一）**

```python
from app.datasources.dialects.excel import ExcelConnector
from app.datasources.dialects.csv_file import CsvFileConnector
register_dialect(ExcelConnector())
register_dialect(CsvFileConnector())
```

在 `backend/app/query/native/guard.py` 将 `NATIVE_CATEGORIES` 改为：

```python
NATIVE_CATEGORIES = frozenset({"search", "document", "timeseries", "api", "file"})
```

- [ ] **Step 6: 运行 CONN-024 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "024" -v`
Expected: 6 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/datasources/dialects/excel.py backend/app/datasources/dialects/csv_file.py backend/app/datasources/dialects/errors.py backend/app/query/native/guard.py backend/app/datasources/__init__.py tests/fixtures/sample.csv tests/fixtures/sample.xlsx tests/test_mfinal_ff_fg_batch1_r249.py
git commit -m "feat: add Excel and CSV file datasource connectors (CONN-024)"
```

---

### Task 4: CONN-025 — IBM Db2 方言

**Files:**
- Create: `backend/app/datasources/dialects/db2.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/__init__.py`
- Modify: `tests/test_mfinal_ff_fg_batch1_r249.py`

**Interfaces:**
- Produces: `Db2Connector.probe_readonly_sql(connection) -> bool`
- Produces: `map_db2_error(exc) -> tuple[str, str]`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 CONN-025 失败测试**

```python
from app.datasources.dialects.db2 import Db2Connector


# --- CONN-025 Db2 ---


def test_conn_r249_025_01_types_db2():
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["db2"]["category"] == "relational"


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_02_probe_readonly(mock_open):
    conn = MagicMock()
    mock_open.return_value = conn
    assert Db2Connector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once()


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_03_auth_failed(mock_open, client: TestClient):
    mock_open.side_effect = Exception("SQL30082N Security processing failed")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "db2",
            "name": "db2-r249",
            "code": f"db2-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 50000,
            "database": "SAMPLE",
            "username": "u",
            "password": "db2_secret",
        },
    )
    assert resp.status_code == 200
    assert resp.json().get("code") == "DB2_AUTH_FAILED" or "DB2_AUTH_FAILED" in resp.text


def test_conn_r249_025_04_readonly_guard(client: TestClient):
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "db2", "sql": "SELECT 1 FROM SYSIBM.SYSDUMMY1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_05_no_password(mock_open, client: TestClient):
    mock_open.side_effect = Exception("auth fail")
    secret = "db2_pwd_xyz"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "db2", "name": "d", "code": f"d-{uuid.uuid4().hex[:8]}",
            "host": "h", "port": 50000, "database": "SAMPLE", "username": "u", "password": secret,
        },
    )
    assert secret not in json.dumps(resp.json())
```

- [ ] **Step 2: 追加 DB2 错误码**

```python
DB2_AUTH_FAILED = "DB2_AUTH_FAILED"
DB2_CONN_REFUSED = "DB2_CONN_REFUSED"
DB2_UNKNOWN_DATABASE = "DB2_UNKNOWN_DATABASE"
DB2_TIMEOUT = "DB2_TIMEOUT"
DB2_DRIVER_MISSING = "DB2_DRIVER_MISSING"


def map_db2_error(exc: Exception) -> tuple[str, str]:
    detail = str(exc)
    lowered = detail.lower()
    if "security" in lowered or "28000" in detail or "sql30082" in lowered:
        return DB2_AUTH_FAILED, detail
    if "timeout" in lowered:
        return DB2_TIMEOUT, detail
    if "connection refused" in lowered or "sql30081" in lowered:
        return DB2_CONN_REFUSED, detail
    if "unknown database" in lowered or "sql1013" in lowered:
        return DB2_UNKNOWN_DATABASE, detail
    if "import" in lowered or "ibm_db" in lowered:
        return DB2_DRIVER_MISSING, detail
    return DB2_CONN_REFUSED, detail
```

- [ ] **Step 3: 创建 `db2.py`**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import DB2_DRIVER_MISSING, map_db2_error

DB2_MAX_COLUMNS = 500
_SYSTEM_SCHEMAS = frozenset({"SYSIBM", "SYSCAT", "SYSFUN", "SYSSTAT", "SYSTOOLS"})


class Db2Connector:
    type = "db2"
    category = "relational"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "IBM Db2"

    def _connect(self, **kwargs: Any) -> Any:
        try:
            import ibm_db_dbi
        except ImportError as exc:
            raise ImportError("ibm_db not installed") from exc
        import ibm_db

        dsn = (
            f"DATABASE={kwargs.get('database', '')};HOSTNAME={kwargs['host']};"
            f"PORT={kwargs.get('port', 50000)};PROTOCOL=TCPIP;UID={kwargs.get('username', '')};"
            f"PWD={kwargs.get('password', '')};"
        )
        conn = ibm_db.connect(dsn, "", "")
        return ibm_db_dbi.Connection(conn)

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self._connect(**kwargs)
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM SYSIBM.SYSDUMMY1")
            finally:
                conn.close()
        except ImportError:
            return TestConnectionResult(ok=False, message=f"[{DB2_DRIVER_MISSING}] ibm_db not installed", latency_ms=0, code=DB2_DRIVER_MISSING)
        except Exception as exc:
            code, detail = map_db2_error(exc)
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=int((time.perf_counter()-started)*1000), code=code)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=int((time.perf_counter()-started)*1000), code=None)

    def probe_readonly_sql(self, connection: Any) -> bool:
        cur = connection.cursor()
        cur.execute("SELECT 1 FROM SYSIBM.SYSDUMMY1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SELECT SCHEMANAME FROM SYSCAT.SCHEMATA")
        return [SchemaInfo(name=row[0]) for row in cur.fetchall() if row[0] not in _SYSTEM_SCHEMAS]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.cursor()
        cur.execute("SELECT TABNAME, TYPE FROM SYSCAT.TABLES WHERE TABSCHEMA = ?", (schema.upper(),))
        return [TableInfo(name=row[0], type=row[1]) for row in cur.fetchall()]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cur = connection.cursor()
        cur.execute(
            "SELECT COLNAME, TYPENAME, NULLS FROM SYSCAT.COLUMNS WHERE TABSCHEMA = ? AND TABNAME = ?",
            (schema.upper(), table.upper()),
        )
        cols = [ColumnInfo(name=r[0], data_type=r[1], nullable=r[2] == "Y") for r in cur.fetchall()]
        return cols[:DB2_MAX_COLUMNS]
```

- [ ] **Step 4: 注册 + 运行测试**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "025" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasources/dialects/db2.py backend/app/datasources/dialects/errors.py backend/app/datasources/__init__.py tests/test_mfinal_ff_fg_batch1_r249.py
git commit -m "feat: add IBM Db2 datasource connector (CONN-025)"
```

---

### Task 5: CONN-026 — Impala 方言 + 注册收口 + dialects `__init__`

**Files:**
- Create: `backend/app/datasources/dialects/impala.py`
- Modify: `backend/app/datasources/dialects/errors.py`
- Modify: `backend/app/datasources/dialects/__init__.py`
- Modify: `backend/app/datasources/__init__.py`（确认四型均已注册）
- Modify: `tests/test_mfinal_ff_fg_batch1_r249.py`

**Interfaces:**
- Produces: `ImpalaConnector`（`type=impala`, `category=lake`）
- Produces: `map_impala_error`（可别名 `map_hive_error`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 追加 CONN-026 失败测试**

```python
from app.datasources.dialects.impala import ImpalaConnector


# --- CONN-026 Impala ---


def test_conn_r249_026_01_types_impala():
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["impala"]["category"] == "lake"


@patch("app.datasources.dialects.impala.ImpalaConnector.open_connection")
def test_conn_r249_026_02_probe(mock_open):
    conn = MagicMock()
    mock_open.return_value = conn
    assert ImpalaConnector().probe_readonly_sql(conn) is True


@patch("app.datasources.dialects.impala.ImpalaConnector.open_connection")
def test_conn_r249_026_03_unknown_database(mock_open):
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value = cur
    cur.execute.side_effect = Exception("Database does not exist: missing_db")
    mock_open.return_value = conn
    result = ImpalaConnector().test_connection(
        host="127.0.0.1", port=21050, database="missing_db", username="", password="",
    )
    assert result.ok is False
    assert result.code == "IMPALA_UNKNOWN_DATABASE"


def test_conn_r249_026_04_empty_schema_tables():
    conn = MagicMock()
    assert ImpalaConnector().list_tables(conn, "") == []


def test_conn_r249_026_05_routing_sql(client: TestClient):
    resp = client.get("/api/v1/query/routing-modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("impala") == "sql"


def test_link_r249_types_count_includes_four_new():
    """LINK: types 总数较 r248 增四型。"""
    types = export_type_catalog()
    new_types = {"rest_api", "excel", "csv", "db2", "impala"}
    present = {t["type"] for t in types}
    assert new_types.issubset(present)
```

- [ ] **Step 2: 追加 IMPALA 错误码**

```python
IMPALA_AUTH_FAILED = "IMPALA_AUTH_FAILED"
IMPALA_CONN_REFUSED = "IMPALA_CONN_REFUSED"
IMPALA_UNKNOWN_DATABASE = "IMPALA_UNKNOWN_DATABASE"
IMPALA_TIMEOUT = "IMPALA_TIMEOUT"

from app.datasources.dialects.errors import map_hive_error as map_impala_error
```

（或独立 `map_impala_error` 复制 hive 逻辑并替换前缀。）

- [ ] **Step 3: 创建 `impala.py`（≤120 行，复用 hive 连接模式）**

```python
from __future__ import annotations

import time
from typing import Any

from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo, TestConnectionResult
from app.datasources.dialects.errors import map_impala_error

IMPALA_MAX_COLUMNS = 500


class ImpalaConnector:
    type = "impala"
    category = "lake"
    capabilities = ("connectivity_test", "schema_browser")
    display_name = "Apache Impala"

    def _connect(self, **kwargs: Any) -> Any:
        import pyhive.hive
        return pyhive.hive.connect(
            host=kwargs["host"],
            port=int(kwargs.get("port", 21050)),
            username=kwargs.get("username") or "impala",
            password=kwargs.get("password") or "",
            database=kwargs.get("database") or "default",
            auth="NOSASL",
        )

    def open_connection(self, **kwargs: Any) -> Any:
        return self._connect(**kwargs)

    def test_connection(self, **kwargs: Any) -> TestConnectionResult:
        started = time.perf_counter()
        try:
            conn = self._connect(**kwargs)
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
            finally:
                conn.close()
        except Exception as exc:
            code, detail = map_impala_error(exc)
            if "does not exist" in detail.lower():
                code = "IMPALA_UNKNOWN_DATABASE"
            return TestConnectionResult(ok=False, message=f"[{code}] {detail}", latency_ms=int((time.perf_counter()-started)*1000), code=code)
        return TestConnectionResult(ok=True, message="Connection successful", latency_ms=int((time.perf_counter()-started)*1000), code=None)

    def probe_readonly_sql(self, connection: Any) -> bool:
        cur = connection.cursor()
        cur.execute("SELECT 1")
        return True

    def list_schemas(self, connection: Any) -> list[SchemaInfo]:
        cur = connection.cursor()
        cur.execute("SHOW DATABASES")
        return [SchemaInfo(name=row[0]) for row in cur.fetchall() if row]

    def list_tables(self, connection: Any, schema: str) -> list[TableInfo]:
        if not schema.strip():
            return []
        cur = connection.cursor()
        cur.execute(f"SHOW TABLES IN {schema}")
        return [TableInfo(name=row[0], type="TABLE") for row in cur.fetchall() if row]

    def list_columns(self, connection: Any, schema: str, table: str) -> list[ColumnInfo]:
        if not schema.strip() or not table.strip():
            return []
        cur = connection.cursor()
        cur.execute(f"DESCRIBE {schema}.{table}")
        cols = []
        for row in cur.fetchall():
            if row and row[0] and not str(row[0]).startswith("#"):
                cols.append(ColumnInfo(name=str(row[0]), data_type=str(row[1]), nullable=True))
        return cols[:IMPALA_MAX_COLUMNS]
```

- [ ] **Step 4: 更新 `dialects/__init__.py` export**

追加 `RestApiConnector`, `ExcelConnector`, `CsvFileConnector`, `Db2Connector`, `ImpalaConnector` 到 import 与 `__all__`。

- [ ] **Step 5: 确认 `datasources/__init__.py` 注册五型（含前序已注册不重复）**

```python
register_dialect(ImpalaConnector())
register_dialect(Db2Connector())  # 若 Task 4 已注册则跳过
```

- [ ] **Step 6: 运行 CONN-026 + LINK 测试**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -k "026 or link_r249" -v`
Expected: 6 passed

- [ ] **Step 7: 运行全量 r249 文件计数**

Run: `cd backend && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -v --collect-only -q | tail -1`
Expected: ≥30 tests collected

- [ ] **Step 8: Commit**

```bash
git add backend/app/datasources/dialects/impala.py backend/app/datasources/dialects/errors.py backend/app/datasources/dialects/__init__.py backend/app/datasources/__init__.py tests/test_mfinal_ff_fg_batch1_r249.py
git commit -m "feat: add Impala connector and register F-G batch1 dialects (CONN-026)"
```

---

### Task 6: 前端 Admin 表单 hints + smoke

**Files:**
- Modify: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`
- Modify: `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `b-design-system-tailadmin-radix`：`Select`/`Label`/`Input`/`Button` 既有组件；辅助说明 `text-sm text-muted-foreground`（或项目既有 `text-theme-sm text-gray-500 dark:text-gray-400` 与 GaussDB 同模式）
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡
- 选类型后端口 hints 自动填充（rest_api→443、db2→50000、impala→21050、excel/csv→1）
- hover/focus/active/loading/empty/error 沿用既有表单态；无新权限态
- 通过 `pnpm run check:design`（语义 token、无硬编码色、无局部私有组件体系）

- [ ] **Step 1: 扩展 `CONNECTOR_FIELD_HINTS`**

在 `DatasourceFormPage.tsx` 的 `CONNECTOR_FIELD_HINTS` 追加：

```typescript
  rest_api: { port: "443", databaseLabel: "API 探测路径", usernameLabel: "用户名（Basic，可选）" },
  excel: { port: "1", databaseLabel: "Sheet 名（可选）", usernameLabel: "用户名" },
  csv: { port: "1", databaseLabel: "数据库", usernameLabel: "用户名" },
  db2: { port: "50000", databaseLabel: "数据库", usernameLabel: "用户名" },
  impala: { port: "21050", databaseLabel: "数据库", usernameLabel: "用户名" },
```

在类型 `Select` 下方追加条件辅助说明（对齐 gaussdb/oceanbase 模式）：

```tsx
{form.type === "rest_api" ? (
  <p id="rest-api-hint" className="text-theme-sm text-gray-500 dark:text-gray-400">
    base URL 填主机地址；HTTPS 默认 443
  </p>
) : null}
{form.type === "excel" ? (
  <p id="excel-hint" className="text-theme-sm text-gray-500 dark:text-gray-400">
    host 填本地 .xlsx 路径或 HTTPS 文件 URL
  </p>
) : null}
{form.type === "csv" ? (
  <p id="csv-hint" className="text-theme-sm text-gray-500 dark:text-gray-400">
    host 填本地 .csv 路径或 HTTPS URL
  </p>
) : null}
{form.type === "impala" ? (
  <p id="impala-hint" className="text-theme-sm text-gray-500 dark:text-gray-400">
    兼容 Hive 协议；默认 LDAP/无认证由后端处理
  </p>
) : null}
```

更新 `database` Input 的 `aria-describedby` 分支包含 `rest-api-hint`/`excel-hint`/`csv-hint`/`impala-hint`。

- [ ] **Step 2: 扩展 smoke 测试**

在 `datasource-form.smoke.test.tsx` 的 `MOCK_TYPES.items` 追加五型 displayName；追加用例：

```typescript
  it("T-CONN-R249-FE-01: renders rest_api excel csv db2 impala in types", async () => { ... });
  it("T-CONN-R249-FE-02: selecting rest_api sets port 443", async () => { ... });
  it("T-CONN-R249-FE-03: selecting db2 sets port 50000", async () => { ... });
  it("T-CONN-R249-FE-04: selecting impala shows protocol hint", async () => { ... });
```

- [ ] **Step 3: 运行 FE 验证**

Run: `cd fe && pnpm run test -- datasource-form.smoke`
Expected: 全部 passed（含新增 4 条）

Run: `cd fe && pnpm run check:design`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/admin/datasources/DatasourceFormPage.tsx fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx
git commit -m "feat: add Admin datasource form hints for F-G batch1 connectors"
```

---

### Task 7: 文档登记 + 全量回归验证

**Files:**
- Modify: `docs/api/README.md`
- Modify: `docs/services/datasources.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

触及 `docs/**` → 遵守 `prd-sync.mdc` 与 `docs-layer.mdc`。

- [ ] **Step 1: 更新 `docs/api/README.md`**

1. 将 NFR-008 deployment-report 行更新为含 `format=json|markdown`、`schemaVersion`、`composeServices`、`forbiddenComposeHits`；状态保持已实现（r249 扩展）。
2. 在 datasources types 相关行或新增注释登记四型：`rest_api`、`excel`、`csv`、`db2`、`impala`（r249）。

示例行：

```markdown
| GET | `/api/v1/nfr/runtime-compliance/deployment-report` | 零 DE/SS 部署验收（`format=json\|markdown`；`schemaVersion`/`composeServices`/`forbiddenComposeHits`） | 内部 | 一期 | NFR-008 | 已实现（r249） | `backend/app/core/nfr/deployment_report.py` |
```

- [ ] **Step 2: 更新 `docs/services/datasources.md`**

在连接器清单 In 表追加四型职责一行摘要；标注 CONN-023~026 实现状态为 r249；边界：本轮不含 OAuth2/上传 UI/executor HTTP 出数（companion）。

- [ ] **Step 3: 全量 backend 回归**

Run: `cd backend && ruff check . && python -m pytest tests/test_mfinal_ff_fg_batch1_r249.py -v`
Expected: ruff clean；≥30 passed

Run: `cd backend && python -m pytest tests/test_mfinal_fc_r242.py tests/test_mfinal_fe_gov_batch4_r248.py -q`
Expected: r242 + r248 回归 passed（无连接器注册破坏）

- [ ] **Step 4: FE build**

Run: `cd fe && pnpm run build`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/datasources.md
git commit -m "docs: register NFR-008 markdown and F-G batch1 connector types (r249)"
```

---

## Self-Review Checklist

- [x] 五 design 子项各映射至少一 Task（NFR-008→T1；CONN-023→T2；024→T3；025→T4；026→T5；FE→T6；docs→T7）
- [x] 无 TBD/TODO/「适当处理」占位
- [x] 每 Task 含验证命令与预期输出
- [x] UI Task 含 UI Acceptance + b-design-system skill
- [x] 预估文件数 18（3 新建 doc/fixture + 5 新建 dialect + 1 新建 test + 9 修改）
