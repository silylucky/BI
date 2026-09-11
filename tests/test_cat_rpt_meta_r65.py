"""跨域 companion 质量推分 r65 — CAT/RPT/META."""
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

_R65_SQLITE_URL = "sqlite+pysqlite:///file:cat_rpt_meta_r65?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r65_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R65_SQLITE_URL
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
    from app.governance.catalog.cat03 import service as cat03_service
    from app.governance.catalog.classification import service as class_service
    from app.governance.catalog.cat06 import service as cat06_service
    from app.metadata.physical import service as physical_service
    from app.reports.persistence import memory_stores

    cat03_service._nodes.clear()
    cat03_service._codes.clear()
    class_service._nodes.clear()
    class_service._codes.clear()
    cat06_service._store.clear()
    memory_stores.analysis_packs.clear()
    physical_service._store.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r65", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat03 import service as cat03_service
    from app.governance.catalog.classification import service as class_service
    from app.governance.catalog.cat06 import service as cat06_service
    from app.reports.persistence import memory_stores

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r65", username="enterprise", roles=["enterprise"])

    cat03_service.set_user_region_scope("enterprise-r65", "CN")
    class_service.set_user_class_scope("enterprise-r65", "CAT")
    cat06_service.set_user_brand_scope("enterprise-r65", "BRAND01")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r65_fixture_bootstraps(client):
    """T-R65-000-01: r65 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def _geo_node_payload(code: str = "CN-SH", parent_id: str | None = None) -> dict:
    return {
        "regionCode": code,
        "name": f"Region {code}",
        "parentId": parent_id,
        "level": "province",
        "sortOrder": 0,
    }


def _class_node(code: str | None = None, parent_id: str | None = None) -> dict:
    return {
        "code": code or f"CAT_{uuid.uuid4().hex[:6].upper()}",
        "name": "Category Node",
        "parentId": parent_id,
        "kind": "folder",
        "sortOrder": 0,
    }


def _production_stats_payload(stats_key: str | None = None, brand_id: str = "BRAND01") -> dict:
    key = stats_key or f"PS_{uuid.uuid4().hex[:6].upper()}"
    return {
        "statsKey": key,
        "displayName": "Production Demo",
        "vendorType": "enterprise",
        "brandId": brand_id,
        "locType": "all",
        "metricKeys": ["inbound", "inventory", "activation"],
    }


def _standard_pack_payload(pack_key: str | None = None) -> dict:
    return {
        "packKey": pack_key or f"pack-{uuid.uuid4().hex[:8]}",
        "displayName": "Customer Lifecycle",
        "businessObjectCode": "customer",
        "physicalTableFqn": "ops.customer",
        "dataSourceId": str(uuid.uuid4()),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": ["analyst"],
        "snapshotCronPreset": "daily",
    }


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


def test_cat_r65_003_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R65-003-01: viewer POST create 403 CAT03_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-VIEWER"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT03_FORBIDDEN"


def test_cat_r65_003_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R65-003-02: enterprise scope 外 regionCode 403 CAT03_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("US-NY"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT03_FORBIDDEN"


def test_cat_r65_003_probe_list_under_50ms(client):
    """T-CAT-R65-003-03: probe_list_geo_nodes_budget_ms < 50ms。"""
    from app.governance.catalog.cat03.probe import probe_list_geo_nodes_budget_ms

    result = probe_list_geo_nodes_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_003_probe_move_under_50ms(client):
    """T-CAT-R65-003-04: probe_move_geo_region_budget_ms < 50ms。"""
    from app.governance.catalog.cat03.probe import probe_move_geo_region_budget_ms

    result = probe_move_geo_region_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_003_move_cycle_regression(client):
    """T-CAT-R65-003-05: move 成环仍 422 CAT03_CYCLE（r61 回归）。"""
    suffix = uuid.uuid4().hex[:4].upper()
    a = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload(f"CN-A{suffix}"),
    ).json()
    b = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload(f"CN-B{suffix}", parent_id=a["regionId"]),
    ).json()
    resp = client.post(
        f"/api/v1/gov/catalog/geo-regions/nodes/{a['regionId']}/move",
        headers=AUTH,
        json={"parentId": b["regionId"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT03_CYCLE"


def test_cat_r65_003_enterprise_scope_ok(client, enterprise_user):
    """T-CAT-R65-003-06: enterprise scope 内 regionCode 201。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-SCOPED"),
    )
    assert resp.status_code == 201, resp.text


def test_cat_r65_004_move_unknown_not_found(client):
    """T-CAT-R65-004-01: move 未知 node 404 CAT_CLASS_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.post(
        f"/api/v1/gov/catalog/classification/nodes/{missing}/move",
        headers=AUTH,
        json={"parentId": None},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_NOT_FOUND"


def test_cat_r65_004_delete_unknown_not_found(client):
    """T-CAT-R65-004-02: delete 未知 node 404 CAT_CLASS_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{missing}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_NOT_FOUND"


def test_cat_r65_004_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R65-004-03: viewer POST create 403 CAT_CLASS_FORBIDDEN。"""
    resp = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node())
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT_CLASS_FORBIDDEN"


def test_cat_r65_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R65-004-04: enterprise scope 外 code 403 CAT_CLASS_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node("OTHER_SCOPE"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT_CLASS_FORBIDDEN"


def test_cat_r65_004_probe_list_under_50ms(client):
    """T-CAT-R65-004-05: probe_list_classification_budget_ms < 50ms。"""
    from app.governance.catalog.classification.probe import probe_list_classification_budget_ms

    result = probe_list_classification_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_004_probe_move_under_50ms(client):
    """T-CAT-R65-004-06: probe_classification_move_budget_ms < 50ms。"""
    from app.governance.catalog.classification.probe import probe_classification_move_budget_ms

    result = probe_classification_move_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_006_stats_brand_forbidden(client, enterprise_user):
    """T-CAT-R65-006-01: enterprise GET stats scope 外 brand 403 CAT06_BRAND_FORBIDDEN。"""
    from app.governance.catalog.cat06.schemas import ProductionStatsItemIn

    key = f"PS_BR_{uuid.uuid4().hex[:4].upper()}"
    payload = _production_stats_payload(key, brand_id="BRAND99")
    admin = UserContext(id="admin-r65", username="admin", roles=["admin"])
    from app.governance.catalog.cat06 import service as cat06_service

    cat06_service.create_production_stats(ProductionStatsItemIn.model_validate(payload), admin)
    resp = client.get(f"/api/v1/gov/catalog/production-stats/{key}/stats", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT06_BRAND_FORBIDDEN"


def test_cat_r65_006_empty_metrics(client):
    """T-CAT-R65-006-02: empty metricKeys 422 CAT06_EMPTY_METRICS。"""
    payload = _production_stats_payload()
    payload["metricKeys"] = []
    resp = client.post("/api/v1/gov/catalog/production-stats/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT06_EMPTY_METRICS"


def test_cat_r65_006_probe_stats_under_50ms(client):
    """T-CAT-R65-006-03: probe_production_stats_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.governance.catalog.cat06 import service as cat06_service
    from app.governance.catalog.cat06.schemas import ProductionStatsItemIn

    key = f"PS_PR_{uuid.uuid4().hex[:4].upper()}"
    admin = UserContext(id="admin-r65", username="admin", roles=["admin"])
    cat06_service.create_production_stats(
        ProductionStatsItemIn.model_validate(_production_stats_payload(key)),
        admin,
    )
    result = cat06_service.probe_production_stats_budget_ms(key)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_006_probe_validate_under_50ms(client):
    """T-CAT-R65-006-04: probe_validate_production_stats_budget_ms < 50ms。"""
    from app.governance.catalog.cat06 import service as cat06_service

    result = cat06_service.probe_validate_production_stats_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r65_006_list_filtered_for_enterprise(client, enterprise_user):
    """T-CAT-R65-006-05: enterprise list 仅见 scope 内 brandId。"""
    from app.governance.catalog.cat06 import service as cat06_service
    from app.governance.catalog.cat06.schemas import ProductionStatsItemIn

    in_scope = _production_stats_payload(f"PS_IN_{uuid.uuid4().hex[:4].upper()}", "BRAND01")
    out_scope = _production_stats_payload(f"PS_OUT_{uuid.uuid4().hex[:4].upper()}", "BRAND99")
    admin = UserContext(id="admin-seed", username="admin", roles=["admin"])
    cat06_service.create_production_stats(ProductionStatsItemIn.model_validate(in_scope), admin)
    cat06_service.create_production_stats(ProductionStatsItemIn.model_validate(out_scope), admin)
    listed = client.get("/api/v1/gov/catalog/production-stats", headers=AUTH)
    keys = {i["statsKey"] for i in listed.json()["items"]}
    assert in_scope["statsKey"] in keys
    assert out_scope["statsKey"] not in keys


def test_rpt_r65_002_empty_roles(client):
    """T-RPT-R65-002-01: allowedRoles=[] 422 RPT_STD_EMPTY_ROLES。"""
    key = f"pack-empty-{uuid.uuid4().hex[:4]}"
    payload = _standard_pack_payload(key)
    payload["allowedRoles"] = []
    resp = client.put(f"/api/v1/reports/standard/packs/{key}", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_STD_EMPTY_ROLES"


def test_rpt_r65_002_theme_disabled(client, monkeypatch):
    """T-RPT-R65-002-02: disabled theme run 422 RPT_STD_THEME_DISABLED。"""
    from app.metadata.physical.schemas import PhysicalTableOut, PhysicalColumn

    monkeypatch.setattr(
        "app.reports.standard.service.physical_service.get_physical_table",
        lambda fqn: PhysicalTableOut(
            tableFqn=fqn,
            dataSourceId=uuid.uuid4(),
            displayName="t",
            columns=[PhysicalColumn(name="status", dataType="varchar")],
        ),
    )
    key = f"pack-theme-{uuid.uuid4().hex[:4]}"
    payload = _standard_pack_payload(key)
    payload["enabledThemes"] = ["lifecycle"]
    client.put(f"/api/v1/reports/standard/packs/{key}", headers=AUTH, json=payload)
    resp = client.post(
        f"/api/v1/reports/standard/packs/{key}/run",
        headers=AUTH,
        json={"theme": "distribution"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_STD_THEME_DISABLED"


def test_rpt_r65_002_viewer_forbidden(client, viewer_user):
    """T-RPT-R65-002-03: viewer PUT 403 RPT_STD_FORBIDDEN。"""
    key = f"pack-v-{uuid.uuid4().hex[:4]}"
    resp = client.put(
        f"/api/v1/reports/standard/packs/{key}",
        headers=AUTH,
        json=_standard_pack_payload(key),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] in {"RPT_STD_FORBIDDEN", "PERMISSION_DENIED"}


def test_rpt_r65_002_list_route(client):
    """T-RPT-R65-002-04: GET standard packs 路由可达。"""
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200


def test_rpt_r65_002_not_found(client):
    """T-RPT-R65-002-05: unknown pack GET 404。"""
    resp = client.get("/api/v1/reports/standard/packs/missing-pack-r65", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_STD_NOT_FOUND"


def test_meta_r65_005_viewer_register_forbidden(client, viewer_user):
    """T-META-R65-005-01: viewer POST register 403 META_PHYSICAL_FORBIDDEN。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_PHYSICAL_FORBIDDEN"


def test_meta_r65_005_invalid_column_name(client):
    """T-META-R65-005-02: column name Bad-Column 422 META_PHYSICAL_INVALID_COLUMN。"""
    payload = _physical_payload()
    payload["columns"] = [{"name": "Bad-Column", "dataType": "varchar", "nullable": True}]
    resp = client.post("/api/v1/metadata/physical-tables/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_INVALID_COLUMN"


def test_meta_r65_005_probe_validate_under_50ms(client):
    """T-META-R65-005-03: probe_validate_physical_budget_ms < 50ms。"""
    from app.metadata.physical import service as physical_service

    result = physical_service.probe_validate_physical_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r65_005_probe_list_under_50ms(client):
    """T-META-R65-005-04: probe_list_physical_tables_budget_ms < 50ms。"""
    from app.metadata.physical import service as physical_service

    result = physical_service.probe_list_physical_tables_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r65_005_admin_register_ok(client):
    """T-META-R65-005-05: admin POST register 201（回归）。"""
    resp = client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_payload())
    assert resp.status_code == 201, resp.text


def test_r65_geo_route_exists(client):
    """T-R65-000-02: geo-regions list 路由可达。"""
    resp = client.get("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH)
    assert resp.status_code == 200


def test_r65_standard_route_exists(client):
    """T-R65-000-03: standard packs list 路由可达。"""
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200


def test_r65_physical_route_exists(client):
    """T-R65-000-04: physical-tables list 路由可达。"""
    resp = client.get("/api/v1/metadata/physical-tables", headers=AUTH)
    assert resp.status_code == 200
