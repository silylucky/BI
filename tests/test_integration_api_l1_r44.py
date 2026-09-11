"""M8/M12/M13 integration API L1 kickoff r44 — API-003/004/005/006/007."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R44_SQLITE_URL = "sqlite+pysqlite:///file:integration_r44?mode=memory&cache=shared&uri=true"
SEED_TEMPLATE_ID = "00000000-0000-4000-8000-0000000000a1"


@pytest.fixture(scope="module", autouse=True)
def r44_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R44_SQLITE_URL
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


from app.integration.errors import IntegrationError


def test_integration_error_fields_default():
    """T-API-R44-000-01(unit): IntegrationError fields 默认空列表。"""
    err = IntegrationError("TEST", "msg", 400)
    assert err.code == "TEST"
    assert err.fields == []
    assert err.trace_id is None


from app.auth.deps import UserContext, get_current_user


def test_services_list_unauthorized_r44(client):
    """T-API-R44-003-01: GET /services 无鉴权 → 401。"""
    resp = client.get("/api/v1/services")
    assert resp.status_code == 401


def test_services_list_empty_r44(client):
    """T-API-R44-003-02: 空库 → items=[] total=0。"""
    resp = client.get("/api/v1/services", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_services_list_published_only_r44(client):
    """T-API-R44-003-03: published 出现；draft 不出现。"""
    pub_id = _create_catalog_entry(client, path="/api/v1/svc/pub", status="published")
    _create_catalog_entry(client, path="/api/v1/svc/draft", status="draft")
    resp = client.get("/api/v1/services", headers=AUTH)
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert pub_id in ids
    assert resp.json()["total"] >= 1


def test_services_get_ok_r44(client):
    """T-API-R44-003-04: GET /services/{id} published → 200 version=v1。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/detail")
    resp = client.get(f"/api/v1/services/{eid}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["version"] == "v1"


def test_services_get_not_found_r44(client):
    """T-API-R44-003-05: 未知 id → 404 SERVICE_NOT_FOUND。"""
    resp = client.get(f"/api/v1/services/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "SERVICE_NOT_FOUND"


def test_services_get_draft_r44(client):
    """T-API-R44-003-06: draft → 400 SERVICE_NOT_PUBLISHED。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/d", status="draft")
    resp = client.get(f"/api/v1/services/{eid}", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "SERVICE_NOT_PUBLISHED"


def test_services_openapi_fragment_r44(client):
    """T-API-R44-003-07: GET openapi → paths + info.version。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/oapi")
    resp = client.get(f"/api/v1/services/{eid}/openapi", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "paths" in body
    assert body["info"]["version"] == "v1"


def test_services_execute_ok_r44(client):
    """T-API-R44-003-08: POST execute → rowCount>=1。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/exec;handler=demo")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 200
    assert resp.json()["rowCount"] >= 1


def test_services_execute_forbidden_r44(client):
    """T-API-R44-003-09: 非 admin/integration → 403。"""
    eid = _create_catalog_entry(client, path="/api/v1/svc/forbid;handler=demo")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=_headers_with_permissions("governance:read"),
        json={"parameters": {}},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "SERVICE_EXECUTE_FORBIDDEN"


def test_services_execute_force_error_r44(client):
    """T-API-R44-003-10: force-error path → 502 SERVICE_EXECUTE_FAILED。"""
    eid = _create_catalog_entry(client, path="/api/v1/force-error/demo")
    resp = client.post(
        f"/api/v1/services/{eid}/execute",
        headers=AUTH,
        json={"parameters": {}},
    )
    assert resp.status_code == 502
    assert resp.json()["code"] == "SERVICE_EXECUTE_FAILED"


from app.governance.bus.adapter import InMemoryBusAdapter, register_with_retry
from app.governance.catalog.schemas import CatalogEntryOut
from datetime import UTC, datetime
from jwt_auth import AUTH, jwt_auth_headers


def _headers_with_permissions(*codes: str):
    from app.auth.jwt import create_access_token
    from app.auth.models import AuthRole, AuthUser, AuthUserRole, get_meta_session
    from app.auth.permissions import AuditWriteContext, replace_role_permissions

    session = get_meta_session()
    try:
        user = AuthUser(username=f"gov_{uuid.uuid4().hex[:8]}", is_active=True)
        session.add(user)
        session.flush()
        role = AuthRole(code=f"gov_only_{uuid.uuid4().hex[:6]}", name="Gov Only", is_active=True)
        session.add(role)
        session.flush()
        replace_role_permissions(
            session,
            role.id,
            list(codes),
            expected_version=0,
            audit=AuditWriteContext(actor_id="test", actor_username="test", trace_id="t"),
        )
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
        session.commit()
        session.refresh(user)
        token = create_access_token(str(user.id), user.username, token_version=user.token_version)
        return {"Authorization": f"Bearer {token}"}
    finally:
        session.close()


def test_register_with_retry_timeout_exhausted_r44():
    """T-API-R44-004-07(unit): timeout 重试次数 ≤ maxAttempts。"""
    entry = CatalogEntryOut(
        id=uuid.uuid4(),
        name="T",
        http_method="POST",
        path="/api/v1/force-timeout/r44",
        category_codes=["CAT-01"],
        status="published",
        created_at=datetime.now(UTC),
    )
    adapter = InMemoryBusAdapter()
    result = register_with_retry(
        adapter, entry=entry, trace_id="t1", max_attempts=3
    )
    assert result.status == "failed"
    assert result.error_code == "BUS_REGISTRATION_TIMEOUT"


def test_integration_bus_unauthorized_r44(client):
    """T-API-R44-004-01: 无鉴权 → 401。"""
    resp = client.post(
        "/api/v1/integration/bus/register",
        json={"catalogEntryId": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


def test_integration_bus_forbidden_r44(client):
    """T-API-R44-004-02: 非 integration/admin → 403。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/forbid")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=_headers_with_permissions("governance:manage"),
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "BUS_REGISTER_INTEGRATION_FORBIDDEN"


def test_integration_bus_success_r44(client):
    """T-API-R44-004-03: published entry → 201 + busResponse.busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/ok-r44")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 201
    assert resp.json()["busResponse"]["busId"]


def test_integration_bus_idempotent_r44(client):
    """T-API-R44-004-04: 重复 POST → 200 同 busId。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/idempotent-r44")
    first = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    second = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["busResponse"]["busId"] == first.json()["busResponse"]["busId"]


def test_integration_bus_timeout_retry_r44(client):
    """T-API-R44-004-05: force-timeout + retry → 502 BUS_REGISTER_RETRY_EXHAUSTED。"""
    eid = _create_catalog_entry(client, path="/api/v1/force-timeout/r44-bus")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid, "retry": {"maxAttempts": 3}},
    )
    assert resp.status_code in (502, 504)
    assert resp.json()["code"] in (
        "BUS_REGISTER_RETRY_EXHAUSTED",
        "BUS_REGISTRATION_TIMEOUT",
    )


def test_integration_bus_draft_r44(client):
    """T-API-R44-004-06: draft → 400 BUS_ENTRY_NOT_PUBLISHABLE。"""
    eid = _create_catalog_entry(client, path="/api/v1/bus/draft", status="draft")
    resp = client.post(
        "/api/v1/integration/bus/register",
        headers=AUTH,
        json={"catalogEntryId": eid},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "BUS_ENTRY_NOT_PUBLISHABLE"


def test_reports_export_unauthorized_r44(client):
    """T-API-R44-005-01: 无鉴权 → 401。"""
    resp = client.get("/api/v1/reports/export?templateId=x&format=pdf")
    assert resp.status_code == 401


def test_reports_export_ok_r44(client):
    """T-API-R44-005-02: seed template → 200 status=ready + downloadUrl（r45 companion）。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["downloadUrl"]


def test_reports_export_invalid_format_r44(client):
    """T-API-R44-005-03: format=invalid → 422。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=invalid",
        headers=AUTH,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_EXPORT_INVALID_FORMAT"


def test_reports_export_not_found_r44(client):
    """T-API-R44-005-04: 未知 template → 404。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={uuid.uuid4()}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 404


def test_reports_export_forbidden_r44(client):
    """T-API-R44-005-05: 非授权角色 → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.get(
            f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
            headers=AUTH,
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reports_export_rate_limit_headers_r44(client):
    """T-API-R44-005-06: 含 X-RateLimit-* 头。"""
    resp = client.get(
        f"/api/v1/reports/export?templateId={SEED_TEMPLATE_ID}&format=pdf",
        headers=AUTH,
    )
    assert resp.headers.get("X-RateLimit-Limit") == "60"
    assert resp.headers.get("X-RateLimit-Remaining") == "59"


def test_reports_export_rate_limited_r44(client):
    """T-API-R44-005-07: force-rate-limit template → 429。"""
    tid = "00000000-0000-4000-8000-force-rate-limit"
    resp = client.get(
        f"/api/v1/reports/export?templateId={tid}&format=pdf",
        headers=AUTH,
    )
    assert resp.status_code == 429
    assert resp.json()["code"] == "REPORT_EXPORT_RATE_LIMITED"


def test_embed_token_unauthorized_r44(client):
    """T-API-R44-006-01: POST 无鉴权 → 401。"""
    resp = client.post("/api/v1/embed/token", json={"chartId": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_embed_token_ok_r44(client):
    """T-API-R44-006-02: chartId + 合法 origins → 201 token + sdkParams.apiBase。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["token"]
    assert body["sdkParams"]["apiBase"]


def test_embed_token_default_expires_7_days_r44(client):
    """公开/嵌入 token 默认有效期 7 天。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(uuid.uuid4()), "allowedOrigins": []},
    )
    assert resp.status_code == 201
    expires_at = datetime.fromisoformat(resp.json()["expiresAt"].replace("Z", "+00:00"))
    delta_sec = (expires_at - datetime.now(UTC)).total_seconds()
    assert 6.9 * 86400 <= delta_sec <= 7.1 * 86400


def test_embed_token_dashboard_screen_path_r44(client):
    """Phase 2.5 A4: dashboardId token → /embed/screen/{id}。"""
    dash_id = uuid.uuid4()
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "dashboardId": str(dash_id),
            "allowedOrigins": ["https://portal.example.com"],
            "theme": "dark",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert f"/embed/screen/{dash_id}" in body["embedUrl"]
    assert "/embed/chart/" not in body["embedUrl"]


def test_embed_token_conflict_r44(client):
    """T-API-R44-006-03: 双 target → 422 EMBED_TARGET_CONFLICT。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "dashboardId": str(uuid.uuid4()),
            "allowedOrigins": [],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "EMBED_TARGET_CONFLICT"


def test_embed_token_invalid_origin_r44(client):
    """T-API-R44-006-04: 非法 origin → 422 EMBED_INVALID_ORIGIN。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["not-a-url"],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "EMBED_INVALID_ORIGIN"


def test_embed_token_forbidden_role_r44(client):
    """T-API-R44-006-05: 非 share/admin → 403。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/embed/token",
            headers=AUTH,
            json={"chartId": str(uuid.uuid4()), "allowedOrigins": []},
        )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_embed_origin_denied_r44(client):
    """T-API-R44-006-06: Origin 不在白名单 → 403。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers={**AUTH, "Origin": "https://evil.com"},
        json={
            "chartId": str(uuid.uuid4()),
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "EMBED_ORIGIN_DENIED"


def test_embed_sdk_params_ok_r44(client):
    """T-API-R44-006-07: GET sdk-params 有效 token → containerId + target。"""
    chart_id = uuid.uuid4()
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(chart_id), "shareMode": "public", "allowedOrigins": []},
    )
    token = created.json()["token"]
    resp = client.get(f"/api/v1/embed/sdk-params?token={token}", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["containerId"]
    assert body["shareMode"] == "public"
    assert body["targetType"] == "chart"
    assert body["targetId"] == str(chart_id)


def test_embed_sdk_params_invalid_r44(client):
    """T-API-R44-006-08: 无效 token → 404 EMBED_TOKEN_INVALID。"""
    resp = client.get(
        "/api/v1/embed/sdk-params?token=invalid-token-xyz",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "EMBED_TOKEN_INVALID"


def test_embed_public_share_token_r44(client):
    """API-006 F-D: public shareMode → embedUrl 含 shareMode=public。"""
    dash_id = uuid.uuid4()
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"dashboardId": str(dash_id), "shareMode": "public"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "shareMode=public" in body["embedUrl"]
    assert f"/embed/screen/{dash_id}" in body["embedUrl"]


def test_embed_dashboard_layout_anonymous_r44(client):
    """API-006 F-D: 无 Bearer 可 GET dashboard-layout?token=…。"""
    dash_id = uuid.uuid4()
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"dashboardId": str(dash_id), "shareMode": "public"},
    )
    token = created.json()["token"]
    resp = client.get(
        f"/api/v1/embed/dashboard-layout?token={token}&dashboardId={dash_id}",
    )
    assert resp.status_code in (200, 404)


def test_embed_public_share_rejects_origins_r44(client):
    """API-006 F-D: public + allowedOrigins → 422。"""
    resp = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "dashboardId": str(uuid.uuid4()),
            "shareMode": "public",
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "EMBED_PUBLIC_ORIGINS_FORBIDDEN"


def _seed_dashboard_chart(client: TestClient, chart_id: uuid.UUID) -> str:
    dash = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Embed Chart", "slug": f"embed-{chart_id.hex[:8]}"},
    )
    assert dash.status_code == 201, dash.text
    dash_id = dash.json()["id"]
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": str(chart_id),
                "type": "chart",
                "title": "Embed",
                "colSpan": 6,
                "rowSpan": 1,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "chartId": str(chart_id),
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "mode": "sql",
                    "sql": "SELECT 1 AS id",
                },
            }
        ],
        "globalFilters": [],
    }
    put = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    return dash_id


def test_embed_chart_view_anonymous_public_r44(client):
    """API-006 F-D: 无 Bearer 可 GET chart-view?token=…（public shareMode）。"""
    chart_id = uuid.uuid4()
    _seed_dashboard_chart(client, chart_id)
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": str(chart_id), "shareMode": "public"},
    )
    assert created.status_code == 201
    token = created.json()["token"]
    resp = client.get(f"/api/v1/embed/chart-view?token={token}&chartId={chart_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["chartType"] in ("table", "table-info")
    assert body["chartId"] == str(chart_id)


def test_embed_chart_view_iframe_fe_origin_r44(client):
    """iframe 内请求 Origin 为 FE 域时，chart-view 不因 portal 白名单拒载。"""
    chart_id = uuid.uuid4()
    _seed_dashboard_chart(client, chart_id)
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={
            "chartId": str(chart_id),
            "allowedOrigins": ["https://portal.example.com"],
        },
    )
    assert created.status_code == 201
    token = created.json()["token"]
    resp = client.get(
        f"/api/v1/embed/chart-view?token={token}&chartId={chart_id}",
        headers={"Origin": "http://testserver"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["chartType"] in ("table", "table-info")
    assert body["chartId"] == str(chart_id)


def test_embed_dataset_execute_requires_token_r44(client):
    """嵌入 Dataset 查数无 token → 401。"""
    resp = client.post(
        "/api/v1/embed/dataset/execute",
        json={
            "dataSourceId": "00000000-0000-4000-8000-000000000010",
            "configId": "00000000-0000-4000-8000-000000000011",
            "limit": 10,
            "parameters": {},
            "rls": {"enabled": False},
        },
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHORIZED"


def test_openapi_version_policy_extension_r44(client):
    """T-API-R44-007-01: info.x-api-version-policy 存在。"""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "x-api-version-policy" in resp.json()["info"]


def test_openapi_if02_tag_r44(client):
    """T-API-R44-007-02: /services operations 含 IF-02 tag。"""
    schema = client.get("/openapi.json").json()
    op = schema["paths"]["/api/v1/services"]["get"]
    assert "IF-02" in op.get("tags", [])


def test_openapi_if_operation_id_prefixes_r44(client):
    """T-API-R44-007-03: IF-01~04 operationId 前缀 if01.~if04.。"""
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert paths["/api/v1/integration/bus/register"]["post"]["operationId"].startswith("if01.")
    assert paths["/api/v1/services"]["get"]["operationId"].startswith("if02.")
    assert paths["/api/v1/reports/export"]["get"]["operationId"].startswith("if03.")
    assert paths["/api/v1/embed/token"]["post"]["operationId"].startswith("if04.")


def test_openapi_unversioned_paths_empty_r44(client):
    """T-API-R44-007-04: x-unversioned-paths==[]。"""
    info = client.get("/openapi.json").json()["info"]
    assert info.get("x-unversioned-paths", []) == []


def test_openapi_info_version_matches_settings_r44(client):
    """T-API-R44-007-05: info.version == settings.api_openapi_version。"""
    from app.core.config import get_settings

    schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == get_settings().api_openapi_version
