"""M11 batch3 r237 — VIZ-005 timeRange + VIZ-007 SDK FE + CAT-04~06 m11-probe."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from jwt_auth import AUTH

_R237_SQLITE_URL = "sqlite+pysqlite:///file:m11_batch3_r237?mode=memory&cache=shared&uri=true"


def _minimal_sql_chart(**extra) -> dict:
    base = {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT * FROM t WHERE d >= :time_start AND d <= :time_end",
        "dimensions": [{"field": "d"}],
        "metrics": [{"field": "cnt"}],
    }
    base.update(extra)
    return base


@pytest.fixture(scope="module", autouse=True)
def r237_sqlite_env():
    import os
    from app.core.config import get_settings

    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R237_SQLITE_URL
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
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()


@pytest.fixture
def client():
    from app.main import app as fastapi_app
    return TestClient(fastapi_app)


def test_viz_r237_005_01_validate_relative_time_range(client: TestClient):
    payload = _minimal_sql_chart(
        timeRange={
            "enabled": True,
            "mode": "relative",
            "relativePreset": "last_7d",
        }
    )
    resp = client.post("/api/v1/charts/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200


def test_viz_r237_005_02_validate_absolute_start_after_end_422(client: TestClient):
    payload = _minimal_sql_chart(
        timeRange={
            "enabled": True,
            "mode": "absolute",
            "start": "2026-07-07",
            "end": "2026-06-01",
        }
    )
    resp = client.post("/api/v1/charts/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422


def test_cat_r237_004_01_m11_probe_200_category_code(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/classification/m11-probe", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["categoryCode"] == "CAT-04"
    assert "listProbeOk" in body
    assert "moveProbeOk" in body
    assert "elapsedMs" in body


def test_cat_r237_004_02_enterprise_out_of_scope_create_403(client: TestClient):
    from app.governance.catalog.classification import service as class_service

    class_service.set_user_class_scope("enterprise-r237", "CAT")
    from app.auth.deps import UserContext, get_current_user
    from app.main import app as fastapi_app

    def _enterprise():
        return UserContext(id="enterprise-r237", username="ent", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    try:
        resp = client.post(
            "/api/v1/gov/catalog/classification/nodes",
            headers=AUTH,
            json={"code": "OTHER_NODE", "name": "X", "parentId": None, "kind": "folder", "sortOrder": 0},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT_CLASS_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_r237_005_01_m11_probe_200(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/tickets/m11-probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["categoryCode"] == "CAT-05"


def test_cat_r237_005_02_stats_probe_elapsed(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/tickets/m11-probe", headers=AUTH)
    body = resp.json()
    assert isinstance(body["statsProbeOk"], bool)
    assert body["elapsedMs"] < 200


def test_cat_r237_005_03_enterprise_forbidden_stats(client: TestClient):
    from app.governance.catalog.cat05 import service as cat05_service
    from app.governance.catalog.cat05.schemas import TicketStatsItemIn
    from app.auth.deps import UserContext, get_current_user
    from app.main import app as fastapi_app

    admin = UserContext(id="admin-r237", username="admin", roles=["admin"])
    key = "TICKET_SCOPE_A"
    cat05_service.create_ticket_item(
        TicketStatsItemIn.model_validate({
            "ticketCategoryKey": key,
            "displayName": "A",
            "statusFilters": ["open"],
        }),
        admin,
    )
    cat05_service.set_user_ticket_scope("ent-r237", "TICKET_OTHER")
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="ent-r237", username="ent", roles=["enterprise"]
    )
    try:
        resp = client.get(f"/api/v1/gov/catalog/tickets/items/{key}/stats", headers=AUTH)
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT05_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_r237_005_04_viewer_create_forbidden(client: TestClient):
    from app.auth.deps import UserContext, get_current_user
    from app.main import app as fastapi_app

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-r237", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/catalog/tickets/items",
            headers=AUTH,
            json={
                "ticketCategoryKey": "TICKET_VIEWER_R237",
                "displayName": "X",
                "statusFilters": ["open"],
            },
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT05_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_r237_006_01_m11_probe_200(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/production-stats/m11-probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["categoryCode"] == "CAT-06"


def test_cat_r237_006_02_validate_and_stats_probe(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/production-stats/m11-probe", headers=AUTH)
    body = resp.json()
    assert isinstance(body["validateProbeOk"], bool)
    assert isinstance(body["statsProbeOk"], bool)


def test_cat_r237_006_03_enterprise_brand_forbidden(client: TestClient):
    from app.auth.deps import UserContext, get_current_user
    from app.governance.catalog.cat06 import service as cat06_service
    from app.governance.catalog.cat06.schemas import ProductionStatsItemIn
    from app.main import app as fastapi_app

    key = "PS_BR_R237"
    admin = UserContext(id="admin-r237", username="admin", roles=["admin"])
    cat06_service.create_production_stats(
        ProductionStatsItemIn.model_validate({
            "statsKey": key,
            "displayName": "Brand99",
            "vendorType": "enterprise",
            "brandId": "BRAND99",
            "locType": "all",
            "metricKeys": ["inbound"],
        }),
        admin,
    )
    cat06_service.set_user_brand_scope("ent-r237", "BRAND01")
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="ent-r237", username="ent", roles=["enterprise"]
    )
    try:
        resp = client.get(f"/api/v1/gov/catalog/production-stats/{key}/stats", headers=AUTH)
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT06_BRAND_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_r237_006_04_m6_probe_regression(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates/m6-probe", headers=AUTH)
    assert resp.status_code == 200


def test_viz_r237_007_04_public_sdk_exposes_vitalspan_embed():
    from pathlib import Path

    content = Path(__file__).resolve().parents[1].joinpath("fe/public/sdk/vitalspan-embed.js").read_text()
    assert "VitalSpanEmbed" in content
