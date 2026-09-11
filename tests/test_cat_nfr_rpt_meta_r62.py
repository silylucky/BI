"""跨域远期 stub L1 kickoff r62 — CAT/NFR/RPT/META."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R62_SQLITE_URL = "sqlite+pysqlite:///file:cat_nfr_rpt_meta_r62?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r62_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_sla = os.environ.get("DASHBOARD_SLA_MODE")
    os.environ["DATABASE_URL"] = _R62_SQLITE_URL
    os.environ.pop("DASHBOARD_SLA_MODE", None)
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    if previous_sla is None:
        os.environ.pop("DASHBOARD_SLA_MODE", None)
    else:
        os.environ["DASHBOARD_SLA_MODE"] = previous_sla
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat06 import service as cat06_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r62", username="enterprise", roles=["enterprise"])

    cat06_service.set_user_brand_scope("enterprise-r62", "BRAND01")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r62", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r62_fixture_bootstraps(client):
    """T-R62-000-01: r62 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r62_production_stats_route_exists(client):
    """T-R62-000-02: production-stats validate 路由可达。"""
    resp = client.post(
        "/api/v1/gov/catalog/production-stats/validate",
        headers=AUTH,
        json={"statsKey": "PS_DEMO", "displayName": "Demo", "vendorType": "enterprise", "brandId": "BRAND01"},
    )
    assert resp.status_code == 200, resp.text


def _production_stats_payload(stats_key: str = "PS_DEMO", brand_id: str = "BRAND01") -> dict:
    return {
        "statsKey": stats_key,
        "displayName": "Production Demo",
        "vendorType": "enterprise",
        "brandId": brand_id,
        "locType": "all",
        "metricKeys": ["inbound", "inventory", "activation"],
    }


def test_cat_r62_006_validate_ok(client):
    """T-CAT-R62-006-01: POST validate 合法 payload 200 valid=true。"""
    resp = client.post(
        "/api/v1/gov/catalog/production-stats/validate",
        headers=AUTH,
        json=_production_stats_payload(),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] is True
    assert body["statsKey"] == "PS_DEMO"


def test_cat_r62_006_create_and_stats(client):
    """T-CAT-R62-006-02: POST create 201 + GET stats mock 分项。"""
    key = f"PS_{uuid.uuid4().hex[:6].upper()}"
    payload = _production_stats_payload(key)
    create = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert create.status_code == 201, create.text
    stats = client.get(f"/api/v1/gov/catalog/production-stats/{key}/stats", headers=AUTH)
    assert stats.status_code == 200
    body = stats.json()
    assert "inbound" in body and "activated" in body


def test_cat_r62_006_create_conflict(client):
    """T-CAT-R62-006-03: 重复 statsKey 409 CAT06_KEY_CONFLICT。"""
    key = f"PS_DUP_{uuid.uuid4().hex[:4].upper()}"
    payload = _production_stats_payload(key)
    assert client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT06_KEY_CONFLICT"


def test_cat_r62_006_stats_not_found(client):
    """T-CAT-R62-006-04: 未知 statsKey 404 CAT06_NOT_FOUND。"""
    resp = client.get("/api/v1/gov/catalog/production-stats/MISSING_KEY/stats", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT06_NOT_FOUND"


def test_cat_r62_006_enterprise_brand_forbidden(client, enterprise_user):
    """T-CAT-R62-006-05: enterprise 用户跨 brandId 403 CAT06_BRAND_FORBIDDEN。"""
    payload = _production_stats_payload(f"PS_BR_{uuid.uuid4().hex[:4].upper()}", brand_id="BRAND99")
    resp = client.post("/api/v1/gov/catalog/production-stats", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT06_BRAND_FORBIDDEN"


def test_cat_r62_006_invalid_vendor(client):
    """T-CAT-R62-006-06: 非法 vendorType 422 CAT06_INVALID_VENDOR。"""
    payload = _production_stats_payload()
    payload["vendorType"] = "invalid_vendor"
    resp = client.post("/api/v1/gov/catalog/production-stats/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT06_INVALID_VENDOR"


def _sla_probe_payload(dashboard_id: str | None = None, **kwargs) -> dict:
    body = {"dashboardId": dashboard_id or str(uuid.uuid4()), "windowHours": 24, "slaTargetPercent": 99.5}
    body.update(kwargs)
    return body


def test_nfr_r62_003_validate_ok(client):
    """T-NFR-R62-003-01: POST validate 200 valid=true。"""
    resp = client.post("/api/v1/nfr/dashboard-sla/validate", headers=AUTH, json=_sla_probe_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r62_003_empty_dashboard(client):
    """T-NFR-R62-003-02: 空 dashboardId 422 DASHBOARD_SLA_DASHBOARD_REQUIRED。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json={"dashboardId": "", "windowHours": 24},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_DASHBOARD_REQUIRED"


def test_nfr_r62_003_probe_within_sla(client):
    """T-NFR-R62-003-03: POST probe 200 withinSla=true（mock 99.7）。"""
    resp = client.post("/api/v1/nfr/dashboard-sla/probe", headers=AUTH, json=_sla_probe_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["withinSla"] is True
    assert body["uptimePercent"] >= 99.5


def test_nfr_r62_003_probe_breach(client, monkeypatch):
    """T-NFR-R62-003-04: simulateBreach probe 503 DASHBOARD_SLA_BELOW_TARGET。"""
    payload = _sla_probe_payload(simulateBreach=True)
    resp = client.post("/api/v1/nfr/dashboard-sla/probe", headers=AUTH, json=payload)
    assert resp.status_code == 503
    assert resp.json()["code"] == "DASHBOARD_SLA_BELOW_TARGET"


def test_nfr_r62_003_alerts(client):
    """T-NFR-R62-003-05: GET alerts 200 configured 字段存在。"""
    resp = client.get("/api/v1/nfr/dashboard-sla/alerts", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "configured" in body
    assert "channels" in body


def test_nfr_r62_003_window_out_of_range(client):
    """T-NFR-R62-003-06: windowHours 越界 422 DASHBOARD_SLA_WINDOW_OUT_OF_RANGE。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json=_sla_probe_payload(windowHours=200),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_WINDOW_OUT_OF_RANGE"


def _standard_pack_payload(pack_key: str | None = None) -> dict:
    return {
        "packKey": pack_key or f"pack-{uuid.uuid4().hex[:8]}",
        "displayName": "Customer Lifecycle",
        "businessObjectCode": "customer",
        "physicalTableFqn": "ops.customer",
        "dataSourceId": "00000000-0000-4000-8000-000000000099",
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": ["analyst"],
        "snapshotCronPreset": "daily",
    }


def test_rpt_r62_002_list_empty(client):
    """T-RPT-R62-002-01: GET standard packs 空列表 200。"""
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []


def test_rpt_r62_002_viewer_forbidden(client, viewer_user):
    """T-RPT-R62-002-05: viewer 角色 PUT 403 RPT_STD_FORBIDDEN。"""
    key = f"pack-v-{uuid.uuid4().hex[:4]}"
    resp = client.put(
        f"/api/v1/reports/standard/packs/{key}",
        headers=AUTH,
        json=_standard_pack_payload(key),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] in {"RPT_STD_FORBIDDEN", "PERMISSION_DENIED"}


def test_rpt_r62_002_empty_roles(client):
    """T-RPT-R62-002-03: allowedRoles=[] 422 RPT_STD_EMPTY_ROLES。"""
    key = f"pack-empty-{uuid.uuid4().hex[:4]}"
    payload = _standard_pack_payload(key)
    payload["allowedRoles"] = []
    resp = client.put(f"/api/v1/reports/standard/packs/{key}", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_STD_EMPTY_ROLES"


def _template_payload(template_key: str | None = None) -> dict:
    key = template_key or f"tmpl-{uuid.uuid4().hex[:8]}"
    return {
        "templateKey": key,
        "format": "pdf",
        "displayName": "Sales Report",
        "blocks": [{"blockType": "sql", "queryRef": "q_sales_summary"}],
    }


def test_rpt_r62_003_validate_word_sql(client):
    """T-RPT-R62-003-01: POST validate word+sql 块 200。"""
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=_template_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_rpt_r62_003_empty_blocks(client):
    """T-RPT-R62-003-02: 空 blocks 422 RPT_TEMPLATE_EMPTY_BLOCKS。"""
    payload = _template_payload()
    payload["blocks"] = []
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_EMPTY_BLOCKS"


def test_rpt_r62_003_invalid_block(client):
    """T-RPT-R62-003-03: 非法 blockType 422 RPT_TEMPLATE_INVALID_BLOCK。"""
    payload = _template_payload()
    payload["blocks"] = [{"blockType": "unknown", "queryRef": "x"}]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_INVALID_BLOCK"


def test_rpt_r62_003_put_get_roundtrip(client):
    """T-RPT-R62-003-04: PUT 登记后 GET 200 回读一致。"""
    key = f"tmpl-rt-{uuid.uuid4().hex[:6]}"
    payload = _template_payload(key)
    assert client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=payload).status_code == 200
    got = client.get(f"/api/v1/reports/templates/{key}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["displayName"] == payload["displayName"]


def test_rpt_r62_003_not_found(client):
    """T-RPT-R62-003-05: GET 未知 templateKey 404 RPT_TEMPLATE_NOT_FOUND。"""
    resp = client.get("/api/v1/reports/templates/missing-template-key", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_TEMPLATE_NOT_FOUND"


def test_rpt_r62_003_chart_block(client):
    """T-RPT-R62-003-06: chart 块须 chartType 合法 200。"""
    payload = _template_payload()
    payload["format"] = "pdf"
    payload["blocks"] = [{"blockType": "chart", "chartType": "line"}]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200


def _physical_payload(fqn: str | None = None) -> dict:
    fqn_val = fqn or f"sales.orders_{uuid.uuid4().hex[:6]}"
    return {
        "tableFqn": fqn_val,
        "dataSourceId": str(uuid.uuid4()),
        "displayName": "Orders Table",
        "entityTypeCode": "order",
        "columns": [
            {"name": "id", "dataType": "bigint", "nullable": False},
            {"name": "amount", "dataType": "decimal", "nullable": True},
        ],
    }


def test_meta_r62_005_register(client):
    """T-META-R62-005-01: POST register 201。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 201, resp.text


def test_meta_r62_005_duplicate_conflict(client):
    """T-META-R62-005-02: 重复 fqn 409 META_PHYSICAL_CONFLICT。"""
    fqn = f"sales.dup_{uuid.uuid4().hex[:6]}"
    payload = _physical_payload(fqn)
    assert client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_PHYSICAL_CONFLICT"


def test_meta_r62_005_empty_columns(client):
    """T-META-R62-005-03: POST validate 空 columns 422 META_PHYSICAL_EMPTY_COLUMNS。"""
    payload = _physical_payload()
    payload["columns"] = []
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_EMPTY_COLUMNS"


def test_meta_r62_005_not_found(client):
    """T-META-R62-005-04: GET 未知 fqn 404 META_PHYSICAL_NOT_FOUND。"""
    resp = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "missing.table"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_PHYSICAL_NOT_FOUND"


def test_meta_r62_005_duplicate_column(client):
    """T-META-R62-005-05: 列名重复 422 META_PHYSICAL_DUPLICATE_COLUMN。"""
    payload = _physical_payload()
    payload["columns"] = [
        {"name": "id", "dataType": "bigint", "nullable": False},
        {"name": "id", "dataType": "int", "nullable": True},
    ]
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_DUPLICATE_COLUMN"


def test_meta_r62_005_list_contains(client):
    """T-META-R62-005-06: GET list 含已登记项。"""
    fqn = f"inventory.stock_{uuid.uuid4().hex[:6]}"
    assert client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload(fqn)).status_code == 201
    listed = client.get("/api/v1/metadata/physical-tables", headers=AUTH)
    assert listed.status_code == 200
    assert any(i["tableFqn"] == fqn for i in listed.json()["items"])
