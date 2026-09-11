"""CAT-003 — geo region catalog M6 integration."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.catalog.cat03 import service as cat03_service
from app.main import app as fastapi_app
from jwt_auth import AUTH

_CAT003_SQLITE = "sqlite+pysqlite:///file:cat_003_m6?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def cat003_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _CAT003_SQLITE
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


def _geo_payload(region_code: str = "CN-BJ") -> dict:
    return {
        "regionCode": region_code,
        "name": "Beijing",
        "level": "city",
        "sortOrder": 0,
    }


def test_cat_003_m6_01_probe_ok(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/geo-regions/m6-probe", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["categoryCode"] == "CAT-03"
    assert body["listProbeOk"] is True
    assert body["moveProbeOk"] is True


def test_cat_003_m6_02_invalid_region_code(client: TestClient):
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json={"regionCode": "bad", "name": "X", "level": "country", "sortOrder": 0},
    )
    assert resp.status_code == 422


def test_cat_003_m6_03_viewer_create_forbidden(client: TestClient):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-cat003", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/catalog/geo-regions/nodes",
            headers=AUTH,
            json=_geo_payload(f"CN-{uuid.uuid4().hex[:4].upper()}"),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT03_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_003_m6_04_enterprise_scope_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-cat003", username="enterprise", roles=["enterprise"])

    cat03_service.set_user_region_scope("ent-cat003", "CN")
    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    try:
        resp = client.post(
            "/api/v1/gov/catalog/geo-regions/nodes",
            headers=AUTH,
            json=_geo_payload("US-NY"),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT03_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_003_m6_05_probe_under_50ms(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/geo-regions/m6-probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["elapsedMs"] < 50
