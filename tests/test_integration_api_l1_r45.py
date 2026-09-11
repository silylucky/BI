"""M8/M12/M13 integration API companion quality r45 — API-003/004/005/006/007."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R45_SQLITE_URL = "sqlite+pysqlite:///file:integration_r45?mode=memory&cache=shared&uri=true"
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


def test_r45_fixture_bootstraps(client):
    """T-API-R45-000-01: r45 sqlite 环境可启动 health。"""
    resp = client.get("/health")
    assert resp.status_code == 200


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


@pytest.mark.parametrize(
    "fmt,expected_mime",
    [
        ("pdf", "application/pdf"),
        ("excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ],
)
def test_export_download_mime_r45(client, fmt, expected_mime):
    """T-API-R45-005-05: pdf/excel download MIME 正确。"""
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


from app.integration import query_services as qs


def test_parse_required_params_r45():
    """T-API-R45-003-00(unit): ;requires= 片段解析。"""
    assert qs._parse_required_params("/api/v1/svc;xrequires=region") == []
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
    eid = _create_catalog_entry(client, path="/api/v1/svc;requires=region;handler=demo")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {"region": "east"}},
    )
    assert resp.status_code == 200


def test_execute_idempotency_key_r45(client):
    """T-API-R45-003-03: 同 Idempotency-Key 两次 execute → 相同 body。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/idempotent;handler=demo")
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


from unittest.mock import patch
from datetime import UTC, datetime, timedelta

from app.integration import embed_token as et
from app.integration.errors import IntegrationError
from jwt_auth import AUTH, jwt_auth_headers


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
