"""CAT-001 — lifecycle catalog M6 integration."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.catalog.cat01 import service as cat01_service
from app.main import app as fastapi_app
from jwt_auth import AUTH

_CAT001_SQLITE = "sqlite+pysqlite:///file:cat_001_m6?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def cat001_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _CAT001_SQLITE
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


def _lifecycle_payload(key: str = "LIFE_OPS") -> dict:
    return {
        "templateKey": key,
        "displayName": "Ops Lifecycle",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active", "closed"],
        "readOnlyOpenApi": True,
        "allowedRoles": ["analyst"],
    }


def test_cat_001_m6_01_probe_ok(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates/m6-probe", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["categoryCode"] == "CAT-01"
    assert body["listProbeOk"] is True
    assert body["validateProbeOk"] is True
    assert body["aclReady"] is True


def test_cat_001_m6_02_empty_stages(client: TestClient):
    payload = _lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}")
    payload["lifecycleStages"] = []
    resp = client.post("/api/v1/gov/catalog/lifecycle-templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT01_EMPTY_STAGES"


def test_cat_001_m6_03_enterprise_scope_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-cat001", username="enterprise", roles=["enterprise"])

    cat01_service.set_user_entity_scope("ent-cat001", "ticket")
    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    try:
        payload = _lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}")
        payload["entityTypeCode"] = "invoice"
        resp = client.post("/api/v1/gov/catalog/lifecycle-templates", headers=AUTH, json=payload)
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT01_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_001_m6_04_viewer_create_forbidden(client: TestClient):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-cat001", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/catalog/lifecycle-templates",
            headers=AUTH,
            json=_lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}"),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "CAT01_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_cat_001_m6_05_probe_under_50ms(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates/m6-probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["elapsedMs"] < 50
