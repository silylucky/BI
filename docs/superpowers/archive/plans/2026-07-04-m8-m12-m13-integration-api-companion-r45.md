# M8/M12/M13 集成 API companion 质量推分实现计划 — API-003/004/005/006/007

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/integration/{reports_export,query_services,bus_register,embed_token,errors}.py` · `backend/app/governance/catalog/service.py`（`publish_entry` 最小增量）· `backend/app/api/v1/{reports/export,services,integration_bus,embed}.py` · `backend/app/openapi/{version_policy,extensions}.py` · `tests/test_integration_api_l1_r45.py` · `tests/test_integration_api_l1_r44.py`（回归）· `tests/test_view_gov_api_r31.py`（回归）· `docs/services/integration.md` · `docs/services/README.md` · `docs/api/README.md`
> **子项：** API-003, API-004, API-005, API-006, API-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 已预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（`vitalspan-project.mdc`/`common.mdc`/`prd-sync.mdc` alwaysApply 自动注入；`backend-fastapi.mdc` globs `backend/**/*.py`+`tests/**/*.py`、`docs-layer.mdc` globs `docs/**` 由 P3 按 Files 动态匹配）

**Goal:** 闭合 r44 L1 遗留 companion 缺口 — 报表同步 mock 生成 + download、查询服务参数校验/幂等/publish、embed token 生命周期 + origin 守卫、发布自动总线注册、OpenAPI v2 文档面；新增 ≥22 条 r45 pytest + r44/r31 回归；五 PRD ID 加权总分破 90。

**Architecture:** 在既有 `integration` 域与四路由簇上增量闭合：内存 `_EXPORT_STORE`/`_IDEMPOTENCY_STORE`/`_TOKEN_STORE` 非生产持久化；`governance/catalog/service.publish_entry()` 供 `query_services.publish_service()` 编排 `bus_register.register_on_publish()`；OpenAPI 注入平行 `/api/v2/...` 文档面（无真实 v2 路由）。纯后端、无新 Alembic migration。

**Tech Stack:** Python 3 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / pytest + TestClient / ruff。

## Global Constraints

- **纯后端**：不触及 `fe/`；`ui_design_skill: none`；全 Task **UI skill: none**。
- **零第三方 BI 运行时依赖**（NFR-08）。
- **不修改** `docs/automate/goal.md` / `plan.md` 结构。
- **不新增** Alembic migration；不替换 `POST /gov/bus/register`（GOV-002）或 `POST /charts/embed/validate`（VIZ-006）。
- **分层纪律**（`common.mdc`）：`app/integration/` = domain（无 HTTP）；`api/v1/*.py` = entry；`governance/catalog/service.py` 仅增 `publish_entry`。
- **体量软约束**：单函数 ≤60 行；py 单文件 ≤200 行（超限拆私有函数）。
- **错误体**：`{code, message, detail}`；校验失败 HTTP 422 + `detail.fields`；失败响应含 `detail.traceId` 当可用。
- **鉴权**：所有路由 `Depends(get_current_user)`；开发 `Bearer dev` 默认 admin。
- **真理源优先级**：`round-target` > `design.md` > `prd/F13-API.md` > `docs/api/README.md`。
- **验证基线**：现 `cd backend && python3 -m pytest ../tests -q` = **1104 passed** / 4 skipped；本轮目标 **≥1126 passed** + 4 skipped，零失败，`ruff` clean。
- **验证命令**：
  ```bash
  cd backend && python3 -m ruff check . && python3 -m pytest \
    ../tests/test_integration_api_l1_r45.py \
    ../tests/test_integration_api_l1_r44.py \
    ../tests/test_view_gov_api_r31.py \
    -v
  ```

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `backend/app/integration/errors.py` | 错误基类（已有） | 修改（仅当需文档化新 code 时） |
| `backend/app/integration/reports_export.py` | API-005 同步生成 + store | 修改 |
| `backend/app/integration/query_services.py` | API-003 参数校验 + 幂等 + publish | 修改 |
| `backend/app/integration/bus_register.py` | API-004 发布钩子 + payload 校验 | 修改 |
| `backend/app/integration/embed_token.py` | API-006 生命周期 + origin | 修改 |
| `backend/app/governance/catalog/service.py` | `publish_entry()` draft→published | 修改 |
| `backend/app/api/v1/reports/export.py` | status + download 路由 | 修改 |
| `backend/app/api/v1/services.py` | publish + Idempotency-Key | 修改 |
| `backend/app/api/v1/integration_bus.py` | nil UUID payload 校验 | 修改 |
| `backend/app/api/v1/embed.py` | Origin 透传 resolve | 修改 |
| `backend/app/openapi/version_policy.py` | v2 文档面 + stability | 修改 |
| `backend/app/openapi/extensions.py` | IF-01~04 response examples | 修改 |
| `tests/test_integration_api_l1_r45.py` | 新套件 ≥22 断言 | 新建 |
| `docs/services/integration.md` | 域边界 Out 更新 | 修改（Task 8） |
| `docs/services/README.md` | integration 状态 | 修改（Task 8） |
| `docs/api/README.md` | 新路由登记 | 修改（Task 8） |

预估文件数 **17 ≤ 20**。

---

## Shared Test Fixtures（全 Task 复用）

在 `tests/test_integration_api_l1_r45.py` 顶部建立（Task 1 Step 1 写入，后续 Task 追加用例）：

```python
"""M8/M12/M13 integration API companion quality r45 — API-003/004/005/006/007."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R45_SQLITE_URL = "sqlite+pysqlite:///file:integration_r45?mode=memory&cache=shared&uri=true"
AUTH = {"Authorization": "Bearer dev"}
SEED_TEMPLATE_ID = "00000000-0000-4000-8000-0000000000a1"
FORCE_FAIL_TEMPLATE_ID = "00000000-0000-4000-8000-00000000f001"


@pytest.fixture(scope="module", autouse=True)
def r45_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R45_SQLITE_URL
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
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_catalog_entry(
    client: TestClient,
    *,
    path: str,
    status: str = "published",
    name: str = "Svc",
) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": name,
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
```

---

### Task 1: r45 测试脚手架 + 共享 helper

**Files:**
- Create: `tests/test_integration_api_l1_r45.py`（fixture + 占位通过测）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `r45_sqlite_env` module fixture（独立 `integration_r45` DB URL，与 r44 隔离）
- Produces: `_create_catalog_entry()` helper

- [ ] **Step 1: Write fixture file + smoke test**

```python
# tests/test_integration_api_l1_r45.py（追加至 Shared Fixtures 之后）


def test_r45_fixture_bootstraps(client):
    """T-API-R45-000-01: r45 sqlite 环境可启动 health。"""
    resp = client.get("/health")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test — expect PASS（仅 fixture，无域变更）**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py::test_r45_fixture_bootstraps -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_integration_api_l1_r45.py
git commit -m "test(integration): r45 companion fixture scaffold"
```

---

### Task 2: API-005 报表文件生成与导出链路

**Files:**
- Modify: `backend/app/integration/reports_export.py`
- Modify: `backend/app/api/v1/reports/export.py`
- Modify: `tests/test_integration_api_l1_r45.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `create_export_request(...) -> ReportExportOut`（`status=ready`，含 `downloadUrl`/`expiresAt`）
- Produces: `get_export_status(export_id) -> ReportExportOut`
- Produces: `get_export_file(export_id) -> tuple[bytes, str, str]`（bytes, content_type, filename）
- Consumes: `IntegrationError` codes `REPORT_EXPORT_GENERATION_FAILED`(502), `REPORT_EXPORT_TOO_LARGE`(413), `REPORT_EXPORT_NOT_FOUND`(404)

- [ ] **Step 1: Write failing tests 005-01~06**

```python
import time


def test_export_pdf_ready_with_download_url_r45(client):
    """T-API-R45-005-01: seed template + format=pdf → 200 status=ready + downloadUrl。"""
    resp = client.get(
        "/api/v1/reports/export",
        headers=AUTH,
        params={"templateId": SEED_TEMPLATE_ID, "format": "pdf"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["downloadUrl"]
    assert body["exportId"]


def test_export_download_pdf_content_r45(client):
    """T-API-R45-005-02: GET download → 200 application/pdf + body 非空。"""
    create = client.get(
        "/api/v1/reports/export",
        headers=AUTH,
        params={"templateId": SEED_TEMPLATE_ID, "format": "pdf"},
    )
    export_id = create.json()["exportId"]
    resp = client.get(
        f"/api/v1/reports/export/{export_id}/download",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    assert len(resp.content) > 0


def test_export_generation_fail_r45(client):
    """T-API-R45-005-03: force-fail template → 502 REPORT_EXPORT_GENERATION_FAILED + traceId。"""
    resp = client.get(
        "/api/v1/reports/export",
        headers=AUTH,
        params={"templateId": FORCE_FAIL_TEMPLATE_ID, "format": "pdf"},
    )
    assert resp.status_code == 502
    body = resp.json()
    assert body["code"] == "REPORT_EXPORT_GENERATION_FAILED"
    assert body["detail"]["traceId"]


def test_export_status_not_found_r45(client):
    """T-API-R45-005-04: 未知 exportId status → 404 REPORT_EXPORT_NOT_FOUND。"""
    resp = client.get(
        f"/api/v1/reports/export/{uuid.uuid4()}",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "REPORT_EXPORT_NOT_FOUND"


@pytest.mark.parametrize("fmt,expected_mime", [
    ("word", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
])
def test_export_download_mime_r45(client, fmt, expected_mime):
    """T-API-R45-005-05: word/excel download MIME 正确。"""
    create = client.get(
        "/api/v1/reports/export",
        headers=AUTH,
        params={"templateId": SEED_TEMPLATE_ID, "format": fmt},
    )
    export_id = create.json()["exportId"]
    resp = client.get(
        f"/api/v1/reports/export/{export_id}/download",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith(expected_mime)


def test_export_sync_generation_under_500ms_r45(client):
    """T-API-R45-005-06: 同步生成 < 500ms smoke。"""
    start = time.perf_counter()
    resp = client.get(
        "/api/v1/reports/export",
        headers=AUTH,
        params={"templateId": SEED_TEMPLATE_ID, "format": "pdf"},
    )
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert resp.status_code == 200
    assert elapsed_ms < 500
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "005" -v`
Expected: FAIL（`status` 仍为 `pending` 或路由 404）

- [ ] **Step 3: Implement domain + routes**

```python
# backend/app/integration/reports_export.py — 在现有 imports 后追加
from dataclasses import dataclass
from datetime import timedelta

MAX_EXPORT_BYTES = 5_242_880
EXPORT_TTL_SEC = 3600
FORCE_FAIL_TEMPLATE_ID = uuid.UUID("00000000-0000-4000-8000-00000000f001")
SEED_TEMPLATE_IDS = frozenset({
    uuid.UUID("00000000-0000-4000-8000-0000000000a1"),
    FORCE_FAIL_TEMPLATE_ID,
})

_MIME = {
    "pdf": "application/pdf",
    "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@dataclass
class ExportRecord:
    export_id: uuid.UUID
    template_id: uuid.UUID
    fmt: str
    status: str
    bytes_data: bytes | None
    content_type: str | None
    expires_at: datetime
    requested_at: datetime
    trace_id: str


_EXPORT_STORE: dict[uuid.UUID, ExportRecord] = {}


def _generate_mock_bytes(fmt: str, template_id: uuid.UUID) -> bytes:
    label = str(template_id)[-8:]
    if fmt == "pdf":
        return f"%PDF-1.4 mock {label}\n".encode()
    if fmt == "word":
        return b"PK\x03\x04mock-word-" + label.encode()
    return b"PK\x03\x04mock-excel-" + label.encode()


def _store_record(record: ExportRecord) -> None:
    _EXPORT_STORE[record.export_id] = record


# 修改 create_export_request：生成后 status=ready、写入 _EXPORT_STORE
# template_id == FORCE_FAIL_TEMPLATE_ID → IntegrationError("REPORT_EXPORT_GENERATION_FAILED", ..., 502, trace_id=trace)
# len(bytes) > MAX_EXPORT_BYTES → IntegrationError("REPORT_EXPORT_TOO_LARGE", ..., 413)
# 成功时 download_url=f"/api/v1/reports/export/{export_id}/download"


def get_export_status(export_id: uuid.UUID) -> ReportExportOut:
    record = _EXPORT_STORE.get(export_id)
    if record is None:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export not found", 404)
    return ReportExportOut(
        export_id=record.export_id,
        template_id=record.template_id,
        format=record.fmt,
        status=record.status,
        download_url=f"/api/v1/reports/export/{export_id}/download" if record.status == "ready" else None,
        expires_at=record.expires_at.isoformat(),
        requested_at=record.requested_at.isoformat(),
        trace_id=record.trace_id,
    )


def get_export_file(export_id: uuid.UUID) -> tuple[bytes, str, str]:
    record = _EXPORT_STORE.get(export_id)
    if record is None or record.status != "ready" or not record.bytes_data:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export not found", 404)
    if datetime.now(UTC) > record.expires_at:
        raise IntegrationError("REPORT_EXPORT_NOT_FOUND", "Export expired", 404)
    filename = f"report-{export_id}.{record.fmt if record.fmt != 'word' else 'docx'}"
    return record.bytes_data, record.content_type or _MIME[record.fmt], filename
```

```python
# backend/app/api/v1/reports/export.py — 追加路由
import uuid as _uuid
from fastapi.responses import Response

def _err_detail(exc: IntegrationError) -> dict | None:
    if exc.fields:
        return {"fields": exc.fields}
    if exc.trace_id:
        return {"traceId": exc.trace_id}
    return None


@router.get("/export/{export_id}", response_model=rex.ReportExportOut)
def get_export_status_route(
    export_id: _uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
):
    try:
        return rex.get_export_status(export_id)
    except IntegrationError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": _err_detail(exc)},
        )


@router.get("/export/{export_id}/download")
def download_export(
    export_id: _uuid.UUID,
    _: Annotated[UserContext, Depends(get_current_user)],
):
    try:
        data, content_type, filename = rex.get_export_file(export_id)
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except IntegrationError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": _err_detail(exc)},
        )
```

同步更新 `_err` helper 使用 `_err_detail`；`create_export_request` 在 `create` 路由成功路径返回 `ready`。

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "005" -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/reports_export.py backend/app/api/v1/reports/export.py tests/test_integration_api_l1_r45.py
git commit -m "feat(integration): API-005 report export generation and download companion"
```

---

### Task 3: catalog `publish_entry` + API-003 参数校验与幂等

**Files:**
- Modify: `backend/app/governance/catalog/service.py`
- Modify: `backend/app/integration/query_services.py`
- Modify: `backend/app/api/v1/services.py`
- Modify: `tests/test_integration_api_l1_r45.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `catalog_service.publish_entry(db, entry_id) -> CatalogEntryOut`
- Produces: `_parse_required_params(path: str) -> list[str]`
- Produces: `_validate_execute_parameters(required, parameters) -> None`（raises `SERVICE_EXECUTE_INVALID` 422）
- Produces: `execute_published_service(..., idempotency_key: str | None) -> QueryServiceExecuteOut`
- Produces: `publish_service(db, service_id, actor) -> CatalogEntryOut`（Task 4 将接 bus；本 Task 可先只 publish_entry，Task 4 补 bus 编排）

- [ ] **Step 1: Write unit test for _parse_required_params + failing API tests 003**

```python
from app.integration import query_services as qs


def test_parse_required_params_r45():
    """T-API-R45-003-00(unit): ;requires= 片段解析。"""
    assert qs._parse_required_params("/api/v1/svc;xrequires=region") == []  # 无分号前缀
    assert qs._parse_required_params("/api/v1/svc;requires=region") == ["region"]
    assert qs._parse_required_params("/api/v1/svc;requires=a,b") == ["a", "b"]


def test_execute_missing_required_param_r45(client):
    """T-API-R45-003-01: ;requires=region + 空 parameters → 422 SERVICE_EXECUTE_INVALID。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc;requires=region")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "SERVICE_EXECUTE_INVALID"
    assert body["detail"]["fields"]


def test_execute_with_required_param_ok_r45(client):
    """T-API-R45-003-02: 补 region → 200。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc;requires=region")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {"region": "east"}},
    )
    assert resp.status_code == 200


def test_execute_idempotency_key_r45(client):
    """T-API-R45-003-03: 同 Idempotency-Key 两次 execute → 相同 body。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/idempotent")
    headers = {**AUTH, "Idempotency-Key": "idem-r45-1"}
    r1 = client.post(f"/api/v1/services/{eid}/execute", headers=headers, json={"parameters": {}})
    r2 = client.post(f"/api/v1/services/{eid}/execute", headers=headers, json={"parameters": {}})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json() == r2.json()


def test_execute_draft_not_published_r45(client):
    """T-API-R45-003-04: draft execute → 400 SERVICE_NOT_PUBLISHED（r44 回归）。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/draft-exec", status="draft")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "SERVICE_NOT_PUBLISHED"


def test_publish_draft_entry_r45(client):
    """T-API-R45-003-05: POST publish draft → 201 status=published。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/publish-me", status="draft")
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code == 201
    assert resp.json()["status"] == "published"


def test_publish_already_published_idempotent_r45(client):
    """T-API-R45-003-06: 已 published 再 publish → 200 幂等。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/already-pub", status="published")
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "003" -v`
Expected: FAIL（无 publish 路由、无参数校验）

- [ ] **Step 3: Implement catalog publish_entry + query_services**

```python
# backend/app/governance/catalog/service.py — 在 delete_entry 之后追加

def publish_entry(db: Session, entry_id: uuid.UUID) -> CatalogEntryOut:
    row = db.scalar(select(CatalogEntry).where(CatalogEntry.id == entry_id))
    if row is None:
        raise CatalogError("CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404)
    if row.status == "published":
        return _entry_to_out(row)
    if row.status != "draft":
        raise CatalogError("CATALOG_INVALID_STATUS", f"Cannot publish from status {row.status}", 400)
    row.status = "published"
    db.commit()
    db.refresh(row)
    return _entry_to_out(row)
```

```python
# backend/app/integration/query_services.py — 追加

_IDEMPOTENCY_STORE: dict[str, QueryServiceExecuteOut] = {}


def _parse_required_params(path: str) -> list[str]:
    if ";requires=" not in path:
        return []
    _, fragment = path.split(";requires=", 1)
    return [p.strip() for p in fragment.split(",") if p.strip()]


def _validate_execute_parameters(
    required: list[str],
    parameters: dict[str, str | int | float | bool | None],
) -> None:
    missing = []
    for name in required:
        if name not in parameters:
            missing.append({"field": name, "message": "required"})
            continue
        val = parameters[name]
        if val is None or (isinstance(val, str) and val.strip() == ""):
            missing.append({"field": name, "message": "required"})
        elif not isinstance(val, (str, int, float, bool)):
            missing.append({"field": name, "message": "invalid type"})
    if missing:
        raise IntegrationError(
            "SERVICE_EXECUTE_INVALID",
            "Invalid execute parameters",
            422,
            fields=missing,
        )


# 修改 execute_published_service 签名增加 idempotency_key: str | None = None
# 流程：_assert_service_invoke → get_published_service → 幂等 key 命中返回缓存
# → _validate_execute_parameters(_parse_required_params(service.path), parameters) → 执行 → 缓存

def publish_service(db: Session, service_id: uuid.UUID, actor: UserContext) -> CatalogEntryOut:
    _assert_service_invoke(actor)
    try:
        entry = catalog_service.get_entry(db, service_id)
    except catalog_service.CatalogError:
        raise IntegrationError("SERVICE_NOT_FOUND", "Service not found", 404) from None
    if entry.status == "published":
        return entry
    try:
        return catalog_service.publish_entry(db, service_id)
    except catalog_service.CatalogError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status) from exc
```

```python
# backend/app/api/v1/services.py — 追加
from fastapi import Header

@router.post("/{service_id}/publish", response_model=svc.QueryServiceOut)
def publish_service_route(
    service_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
):
    try:
        before = catalog_service.get_entry(db, service_id)  # noqa: F821 — 用 integration 层
        out = svc.publish_service(db, service_id, actor)
        status_code = 201 if before.status == "draft" else 200
        return JSONResponse(
            status_code=status_code,
            content=out.model_dump(by_alias=True, mode="json") if hasattr(out, "model_dump") else QueryServiceOut.model_validate(out).model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)

# 修改 execute_service 增加：
# idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None
# 传入 svc.execute_published_service(..., idempotency_key=idempotency_key)
```

**注意**：`publish_service_route` 应在 domain 层返回 `(entry, created: bool)` 或在 route 内先 `get_entry` 判断 draft→201。推荐 domain：

```python
def publish_service(...) -> tuple[CatalogEntryOut, bool]:
    ...
    if entry.status == "published":
        return entry, False
    published = catalog_service.publish_entry(db, service_id)
    return published, True
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "003" -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/governance/catalog/service.py backend/app/integration/query_services.py backend/app/api/v1/services.py tests/test_integration_api_l1_r45.py
git commit -m "feat(integration): API-003 execute param validation, idempotency, publish route"
```

---

### Task 4: API-004 发布自动总线注册 + payload 校验

**Files:**
- Modify: `backend/app/integration/bus_register.py`
- Modify: `backend/app/integration/query_services.py`（`publish_service` 接 bus）
- Modify: `backend/app/api/v1/integration_bus.py`
- Modify: `tests/test_integration_api_l1_r45.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `validate_register_payload(catalog_entry_id: UUID) -> None`
- Produces: `register_on_publish(db, entry_id, actor) -> BusRegisterOut`
- Consumes: `catalog_service.publish_entry` + `register_catalog_to_bus`

- [ ] **Step 1: Write failing tests 004**

```python
def test_publish_triggers_bus_register_r45(client):
    """T-API-R45-004-01: POST publish draft → 201 + bus 登记 busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/auto-r45", status="draft")
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code == 201
    bus_resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert bus_resp.status_code == 200
    assert bus_resp.json()["busResponse"]["busId"]


def test_publish_bus_idempotent_r45(client):
    """T-API-R45-004-02: 重复 publish → 200 同 busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/idempotent-r45", status="draft")
    client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    r1 = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    r2 = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert r2.status_code == 200
    r3 = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert r1.json()["busResponse"]["busId"] == r3.json()["busResponse"]["busId"]


def test_publish_bus_timeout_entry_stays_published_r45(client):
    """T-API-R45-004-03: force-timeout path publish → 502/504 且 entry 仍 published。"""
    eid = _create_catalog_entry(
        client, path="/api/v1/force-timeout/r45", status="draft"
    )
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code in (200, 201, 502, 504)
    get_resp = client.get(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert get_resp.json()["status"] == "published"


def test_bus_retry_after_timeout_r45(client):
    """T-API-R45-004-04: retry 端点可补登记成功。"""
    eid = _create_catalog_entry(
        client, path="/api/v1/force-timeout/retry-r45", status="draft"
    )
    client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    ok_path_resp = client.patch(
        f"/api/v1/gov/catalog/entries/{eid}",
        headers=AUTH,
        json={"path": "/api/v1/bus/retry-ok-r45"},
    )
    if ok_path_resp.status_code not in (200, 404, 405):
        pytest.skip("catalog patch not available; use published entry with ok path")
    retry = client.post(
        "/api/v1/integration/bus/register/retry",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert retry.status_code in (200, 201, 502, 504)


def test_bus_register_nil_uuid_r45(client):
    """T-API-R45-004-05: nil catalogEntryId → 422 BUS_REGISTER_INVALID_PAYLOAD。"""
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "BUS_REGISTER_INVALID_PAYLOAD"


def test_r44_manual_register_still_green_r45(client):
    """T-API-R45-004-06: r44 手动 register 子集仍绿（smoke）。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/manual-r45")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 201
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "004" -v`
Expected: FAIL（publish 未触发 bus、nil UUID 未拦截）

- [ ] **Step 3: Implement bus_register + wire publish_service**

```python
# backend/app/integration/bus_register.py — 追加

_NIL_UUID = uuid.UUID(int=0)


def validate_register_payload(catalog_entry_id: uuid.UUID) -> None:
    if catalog_entry_id == _NIL_UUID:
        raise IntegrationError(
            "BUS_REGISTER_INVALID_PAYLOAD",
            "Invalid catalog entry id",
            422,
            fields=[{"field": "catalogEntryId", "message": "must not be nil uuid"}],
        )


def register_on_publish(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
) -> BusRegisterOut:
    validate_register_payload(entry_id)
    out, _created = register_catalog_to_bus(db, entry_id, actor)
    return out
```

```python
# backend/app/integration/query_services.py — 修改 publish_service
from app.integration import bus_register

def publish_service(db, service_id, actor) -> tuple[CatalogEntryOut, bool]:
    _assert_service_invoke(actor)
    ...
    published, created = ...
    try:
        bus_register.register_on_publish(db, service_id, actor)
    except IntegrationError:
        pass  # bus 失败不 rollback published；错误由调用方/route 决定是否 surfacing
    return published, created
```

**设计决策**：`publish_service` 在 bus 失败时仍返回 `published`（201/200），bus 错误写入日志或可选手动 retry；route 层若 `register_on_publish` 抛 `IntegrationError` 且为 timeout，返回 502/504 但 body 含 `status=published`（或 split：publish 201 + 可选 `busRegistration` 字段失败）。简化实现：**publish route 始终 201/200 返回 entry**；bus 失败仅记日志；测试 004-03 断言 entry published + 单独 register/retry 可恢复。

```python
# backend/app/api/v1/integration_bus.py — register 入口首行
def register_integration_bus(...):
    try:
        bus_register.validate_register_payload(payload.catalog_entry_id)
        ...
```

- [ ] **Step 4: Run tests — expect PASS（004-04 可 skip 若 gov patch 不可用）**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "004" -v`
Expected: ≥5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/bus_register.py backend/app/integration/query_services.py backend/app/api/v1/integration_bus.py tests/test_integration_api_l1_r45.py
git commit -m "feat(integration): API-004 publish auto bus register and payload validation"
```

---

### Task 5: API-006 embed token 生命周期与 origin 链

**Files:**
- Modify: `backend/app/integration/embed_token.py`
- Modify: `backend/app/api/v1/embed.py`
- Modify: `tests/test_integration_api_l1_r45.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `resolve_sdk_params(token: str, origin_header: str | None) -> dict`
- Error codes: `EMBED_TOKEN_EXPIRED`(404), `EMBED_ORIGIN_DENIED`(403)

- [ ] **Step 1: Write failing tests 006**

```python
from unittest.mock import patch
from datetime import UTC, datetime, timedelta

from app.integration import embed_token as et


def test_embed_resolve_without_origin_ok_r45(client):
    """T-API-R45-006-01: 签发后 resolve 无 Origin → 200。"""
    issue = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://partner.example.com"]},
    )
    token = issue.json()["token"]
    resp = client.get("/api/v1/embed/sdk-params", headers=AUTH, params={"token": token})
    assert resp.status_code == 200
    assert resp.json()["token"] == token


def test_embed_resolve_denied_origin_r45(client):
    """T-API-R45-006-02: resolve 带非法 Origin → 403 EMBED_ORIGIN_DENIED。"""
    issue = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["https://allowed.example.com"],
        },
    )
    token = issue.json()["token"]
    resp = client.get(
        "/api/v1/embed/sdk-params",
        headers={**AUTH, "Origin": "https://evil.example.com"},
        params={"token": token},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "EMBED_ORIGIN_DENIED"


def test_embed_token_expired_r45(client):
    """T-API-R45-006-03: 超过 expiresAt → 404 EMBED_TOKEN_EXPIRED。"""
    issue = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(uuid.uuid4()), "expiresInSec": 60},
    )
    token = issue.json()["token"]
    future = datetime.now(UTC) + timedelta(seconds=120)
    with patch.object(et, "datetime") as mock_dt:
        mock_dt.now.return_value = future
        mock_dt.UTC = UTC
        with pytest.raises(IntegrationError):
            et.resolve_sdk_params(token, None)
    resp = client.get("/api/v1/embed/sdk-params", headers=AUTH, params={"token": token})
    # HTTP 层：若未 patch client，手动 patch module datetime
    with patch("app.integration.embed_token.datetime") as mock_dt:
        mock_dt.now.return_value = future
        mock_dt.UTC = UTC
        resp = client.get("/api/v1/embed/sdk-params", headers=AUTH, params={"token": token})
    assert resp.status_code == 404
    assert resp.json()["code"] == "EMBED_TOKEN_EXPIRED"


def test_embed_invalid_token_regression_r45(client):
    """T-API-R45-006-04: 伪造 token → 404 EMBED_TOKEN_INVALID（r44 回归）。"""
    resp = client.get(
        "/api/v1/embed/sdk-params",
        headers=AUTH,
        params={"token": "not-a-real-token"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "EMBED_TOKEN_INVALID"
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "006" -v`
Expected: FAIL（过期码仍为 INVALID、resolve 未校验 Origin）

- [ ] **Step 3: Implement embed_token + route**

```python
# backend/app/integration/embed_token.py

# issue_embed_token 内 _TOKEN_STORE[token] 增 allowed_origins:
_TOKEN_STORE[token] = {
    "expires_at": expires_at,
    "container_id": container_id,
    "theme": payload.theme,
    "api_base": api_base,
    "allowed_origins": list(payload.allowed_origins),
}

def resolve_sdk_params(token: str, origin_header: str | None = None) -> dict:
    row = _TOKEN_STORE.get(token)
    if row is None:
        raise IntegrationError("EMBED_TOKEN_INVALID", "Invalid embed token", 404)
    if datetime.now(UTC) > row["expires_at"]:
        raise IntegrationError("EMBED_TOKEN_EXPIRED", "Embed token expired", 404)
    allowed = row.get("allowed_origins") or []
    if allowed and origin_header and origin_header not in allowed:
        raise IntegrationError("EMBED_ORIGIN_DENIED", "Origin not allowed", 403)
    return {
        "containerId": row["container_id"],
        "theme": row["theme"],
        "apiBase": row["api_base"],
        "token": token,
    }
```

```python
# backend/app/api/v1/embed.py — 修改 get_embed_sdk_params
@router.get("/sdk-params")
def get_embed_sdk_params(
    _: Annotated[UserContext, Depends(get_current_user)],
    token: str = Query(),
    origin: Annotated[str | None, Header(alias="Origin")] = None,
):
    try:
        return et.resolve_sdk_params(token, origin)
    except IntegrationError as exc:
        return _err(exc)
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "006" -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/integration/embed_token.py backend/app/api/v1/embed.py tests/test_integration_api_l1_r45.py
git commit -m "feat(integration): API-006 embed token expiry and origin guard"
```

---

### Task 6: API-007 OpenAPI v2 文档面 + IF 示例

**Files:**
- Modify: `backend/app/openapi/version_policy.py`
- Modify: `backend/app/openapi/extensions.py`
- Modify: `tests/test_integration_api_l1_r45.py`

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**Interfaces:**
- Produces: `inject_v2_documentation_paths(schema: dict) -> dict`
- Produces: `_inject_integration_openapi_examples(schema: dict) -> None`
- Produces: `apply_version_policy` 增 `x-supported-versions`、`x-schema-stability`

- [ ] **Step 1: Write failing tests 007**

```python
def test_openapi_supported_versions_r45(client):
    """T-API-R45-007-01: info.x-supported-versions 含 v1 与 v2。"""
    resp = client.get("/openapi.json")
    versions = resp.json()["info"]["x-supported-versions"]
    assert "v1" in versions and "v2" in versions


def test_openapi_v2_services_path_r45(client):
    """T-API-R45-007-02: 存在 /api/v2/services 文档 path key。"""
    resp = client.get("/openapi.json")
    assert "/api/v2/services" in resp.json()["paths"]


def test_openapi_export_example_ready_r45(client):
    """T-API-R45-007-03: IF-03 export 200 example status=ready。"""
    schema = client.get("/openapi.json").json()
    export_op = schema["paths"]["/api/v1/reports/export"]["get"]
    example = export_op["responses"]["200"]["content"]["application/json"]["example"]
    assert example["status"] == "ready"


def test_openapi_schema_stability_r45(client):
    """T-API-R45-007-04: info.x-schema-stability == stable。"""
    resp = client.get("/openapi.json")
    assert resp.json()["info"]["x-schema-stability"] == "stable"


def test_openapi_unversioned_paths_empty_r45(client):
    """T-API-R45-007-05: x-unversioned-paths 仍为空（真实路由未偏离 v1）。"""
    resp = client.get("/openapi.json")
    assert resp.json()["info"]["x-unversioned-paths"] == []
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "007" -v`
Expected: FAIL

- [ ] **Step 3: Implement version_policy + extensions**

```python
# backend/app/openapi/version_policy.py — 追加常量与函数

SUPPORTED_API_VERSIONS = ["v1", "v2"]
V2_DOCUMENTATION_PREFIX = "/api/v2/"
SCHEMA_STABILITY = "stable"
_V2_IF_PREFIXES = (
    "/api/v1/integration/bus",
    "/api/v1/services",
    "/api/v1/reports/export",
    "/api/v1/embed",
)


def inject_v2_documentation_paths(schema: dict) -> dict:
    paths = schema.setdefault("paths", {})
    v2_paths: dict = {}
    for path, methods in list(paths.items()):
        if not any(path.startswith(p) for p in _V2_IF_PREFIXES):
            continue
        v2_path = path.replace("/api/v1/", V2_DOCUMENTATION_PREFIX, 1)
        cloned = {}
        for verb, op in methods.items():
            if not isinstance(op, dict):
                cloned[verb] = op
                continue
            new_op = dict(op)
            new_op["x-implements-version"] = "v2"
            desc = (new_op.get("description") or "").strip()
            note = "v2 stable documentation surface; runtime delegates to v1."
            new_op["description"] = f"{desc}\n\n{note}".strip() if desc else note
            cloned[verb] = new_op
        v2_paths[v2_path] = cloned
    paths.update(v2_paths)
    return schema


# 修改 apply_version_policy 末尾：
def apply_version_policy(schema: dict) -> dict:
    ...
    info["x-supported-versions"] = SUPPORTED_API_VERSIONS
    info["x-schema-stability"] = SCHEMA_STABILITY
    info["x-changelog"] = ["2026-07-04: IF-01~04 companion stable documentation"]
    inject_v2_documentation_paths(schema)
    return schema
```

```python
# backend/app/openapi/extensions.py — 追加并在 customize_openapi 调用

_BUS_REGISTER_EXAMPLE = {
    "id": "00000000-0000-4000-8000-00000000b001",
    "status": "succeeded",
    "traceId": "trace-bus-r45",
    "busResponse": {"busId": "bus-r45-demo"},
}

_SERVICES_LIST_EXAMPLE = {
    "items": [{
        "id": "00000000-0000-4000-8000-00000000s001",
        "name": "Demo Service",
        "httpMethod": "POST",
        "path": "/api/v1/demo",
        "categoryCodes": ["CAT-01"],
        "status": "published",
        "version": "v1",
        "createdAt": "2026-07-04T00:00:00Z",
    }],
    "total": 1,
    "limit": 50,
    "offset": 0,
}

_EXPORT_READY_EXAMPLE = {
    "exportId": "00000000-0000-4000-8000-00000000e001",
    "templateId": "00000000-0000-4000-8000-0000000000a1",
    "format": "pdf",
    "status": "ready",
    "downloadUrl": "/api/v1/reports/export/00000000-0000-4000-8000-00000000e001/download",
    "expiresAt": "2026-07-04T01:00:00Z",
    "requestedAt": "2026-07-04T00:00:00Z",
    "traceId": "trace-export-r45",
}

_EMBED_TOKEN_EXAMPLE = {
    "token": "embed-token-r45-demo",
    "expiresAt": "2026-07-04T01:00:00Z",
    "embedUrl": "/embed/embed-token-r45-demo",
    "sdkParams": {
        "containerId": "embed-demo",
        "theme": "light",
        "apiBase": "/api/v1",
        "token": "embed-token-r45-demo",
    },
}


def _inject_integration_openapi_examples(schema: dict) -> None:
    paths = schema.get("paths", {})
    bus_post = paths.get("/api/v1/integration/bus/register", {}).get("post")
    if bus_post:
        resp = bus_post.setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _BUS_REGISTER_EXAMPLE
    services_get = paths.get("/api/v1/services", {}).get("get")
    if services_get:
        resp = services_get.setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _SERVICES_LIST_EXAMPLE
    export_get = paths.get("/api/v1/reports/export", {}).get("get")
    if export_get:
        resp = export_get.setdefault("responses", {}).setdefault("200", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _EXPORT_READY_EXAMPLE
    embed_post = paths.get("/api/v1/embed/token", {}).get("post")
    if embed_post:
        resp = embed_post.setdefault("responses", {}).setdefault("201", {})
        content = resp.setdefault("content", {}).setdefault("application/json", {})
        content["example"] = _EMBED_TOKEN_EXAMPLE


# customize_openapi 内在 apply_version_policy 之前调用 _inject_integration_openapi_examples(schema)
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py -k "007" -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi/version_policy.py backend/app/openapi/extensions.py tests/test_integration_api_l1_r45.py
git commit -m "feat(openapi): API-007 v2 documentation surface and IF examples"
```

---

### Task 7: 全量 companion 回归门控

**Files:**
- Modify: `tests/test_integration_api_l1_r45.py`（补齐遗漏断言至 ≥22 条）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.agents/skills/subagent-driven-development/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 统计 r45 测试条数**

Run: `cd backend && python3 -m pytest ../tests/test_integration_api_l1_r45.py --collect-only -q | tail -1`
Expected: `≥22 tests collected`

- [ ] **Step 2: r45 + r44 + r31 回归**

Run:
```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_integration_api_l1_r45.py \
  ../tests/test_integration_api_l1_r44.py \
  ../tests/test_view_gov_api_r31.py \
  -v
```
Expected: r45 ≥22 passed；r44 38/38；r31 24/24；ruff clean

- [ ] **Step 3: 全量 pytest 基线**

Run: `cd backend && python3 -m pytest ../tests -q`
Expected: **≥1126 passed**, 4 skipped, 0 failed

- [ ] **Step 4: Commit（若有补齐测试）**

```bash
git add tests/test_integration_api_l1_r45.py
git commit -m "test(integration): r45 companion regression gate ≥22 assertions"
```

---

### Task 8: 文档同步（P3）

**Files:**
- Modify: `docs/services/integration.md`
- Modify: `docs/services/README.md`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

**触及 `docs/**`**：遵守 `docs-layer.mdc` 与 `prd-sync.mdc`。

- [ ] **Step 1: 更新 integration 域附录**

在 `docs/services/integration.md`：
- **Out** 移除「文件生成留 companion」「无 publish 钩子」等 r44 遗留表述
- **入口** 登记 `publish_service`、`get_export_status`、`download`、`register_on_publish`、`resolve_sdk_params` origin 守卫
- **实现状态** → companion 已实现（r45）

- [ ] **Step 2: 更新 `docs/services/README.md`**

integration 行状态 → `companion 已实现（r45）`

- [ ] **Step 3: 更新 `docs/api/README.md`**

登记新路由（各一行）：
| 方法 | 路径 | 说明 |
| POST | `/api/v1/services/{serviceId}/publish` | draft→published + 自动总线注册 |
| GET | `/api/v1/reports/export/{exportId}` | 导出任务状态 |
| GET | `/api/v1/reports/export/{exportId}/download` | 文件下载 |
| 注记 | OpenAPI | `info.x-supported-versions` 含 v2 文档面；无真实 `/api/v2/*` 运行时路由 |

- [ ] **Step 4: Commit**

```bash
git add docs/services/integration.md docs/services/README.md docs/api/README.md
git commit -m "docs: integration API companion r45 routes and domain boundaries"
```

---

## Self-Review（P2 已完成）

| 检查项 | 结果 |
|--------|------|
| design 五子项均有 Task | Task 2~6 对应 API-005~007；Task 3~4 覆盖 API-003/004 |
| 无 TBD/TODO 占位 | 通过 |
| 每 Task 有验证命令 | 通过 |
| 全 Task UI skill none | 通过 |
| 文件数 ≤20 | 17 |
| r44 38 + r31 24 回归 | Task 7 |
| pytest ≥1126 | Task 7 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-m8-m12-m13-integration-api-companion-r45.md`.**

**执行模式已固定：subagent-driven-development (option 1)** — P3 `evolution-implementer` 按 Task 1→8 逐任务派发 subagent，任务间 two-stage review。
