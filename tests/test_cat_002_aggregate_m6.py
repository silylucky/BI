"""CAT-002 — aggregate catalog M6 integration."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.catalog.cat02 import service as cat02_service
from app.main import app as fastapi_app
from jwt_auth import AUTH

_CAT002_SQLITE = "sqlite+pysqlite:///file:cat_002_m6?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def cat002_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _CAT002_SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.auth.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _aggregate_payload(key: str = "AGG_SALES") -> dict:
    return {
        "aggregateKey": key,
        "displayName": "Sales Aggregate",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "poc-sales-v1",
    }


def test_cat_002_m6_01_probe_ok(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/aggregate-templates/m6-probe", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["categoryCode"] == "CAT-02"
    assert body["listProbeOk"] is True
    assert body["validateProbeOk"] is True
    assert body["attributionReady"] is True


def test_cat_002_m6_02_duplicate_dimension(client: TestClient):
    payload = {
        "aggregateKey": "AGG_DUP",
        "displayName": "Dup",
        "dimensions": ["a", "a"],
        "metrics": ["m"],
        "aggregationFn": "sum",
        "attributionLabel": "x",
    }
    resp = client.post("/api/v1/gov/catalog/aggregate-templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_DUPLICATE_DIMENSION"


def test_cat_002_m6_03_enterprise_scope_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-cat002", username="enterprise", roles=["enterprise"])

    cat02_service.set_user_aggregate_scope("ent-cat002", "AGG")
    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    try:
        payload = _aggregate_payload("OUT_SCOPE")
        resp = client.post("/api/v1/gov/catalog/aggregate-templates", headers=AUTH, json=payload)
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT02_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_002_m6_04_probe_under_50ms(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/aggregate-templates/m6-probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["elapsedMs"] < 50
