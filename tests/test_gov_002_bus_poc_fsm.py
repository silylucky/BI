"""GOV-002 — semi-auto bus PoC FSM M6 integration."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.bus.poc_fsm import set_user_bus_register_scope
from app.main import app as fastapi_app
from jwt_auth import AUTH

_GOV002_SQLITE = "sqlite+pysqlite:///file:gov_002_fsm?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def gov002_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _GOV002_SQLITE
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


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _create_entry(client: TestClient, *, path: str) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Gov002",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": "active",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_gov_002_01_register_then_fsm_registered(client: TestClient):
    eid = _create_entry(client, path="/api/v1/gov002/success")
    reg = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert reg.status_code == 201
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.status_code == 200
    body = fsm.json()
    assert body["fsmState"] == "registered"
    assert body["catalogEntryId"] == eid
    assert body.get("busId")


def test_gov_002_02_force_fail_fsm_failed(client: TestClient):
    eid = _create_entry(client, path="/api/v1/force-fail/gov002")
    reg = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert reg.status_code == 502
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.status_code == 200
    assert fsm.json()["fsmState"] == "failed"


def test_gov_002_03_idempotent_stays_registered(client: TestClient):
    eid = _create_entry(client, path="/api/v1/gov002/idempotent")
    first = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    second = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code == 201 and second.status_code == 200
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={eid}", headers=AUTH)
    assert fsm.json()["fsmState"] == "registered"


def test_gov_002_04_viewer_forbidden(client: TestClient):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-gov002", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_entry(client, path="/api/v1/gov002/viewer")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_002_05_enterprise_scope_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-gov002", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    set_user_bus_register_scope("ent-gov002", "/api/v1/allowed/")
    try:
        eid = _create_entry(client, path="/api/v1/out-of-scope/gov002")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_002_06_semi_auto_probe_under_50ms(client: TestClient):
    resp = client.get("/api/v1/gov/bus/register/probe", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["elapsedMs"] < 50
