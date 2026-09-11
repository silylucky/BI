"""GOV-001 — Appendix E taxonomy L1 catalog."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.catalog.probe import probe_appendix_e_taxonomy_budget_ms
from app.governance.catalog.service import set_user_catalog_taxonomy_scope
from app.main import app as fastapi_app
from jwt_auth import AUTH

_GOV_SQLITE = "sqlite+pysqlite:///file:gov_001_appendix_e?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def gov_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _GOV_SQLITE
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


def test_gov_001_01_appendix_e_returns_seven_categories(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/appendix-e", headers=AUTH)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["appendix"] == "E"
    assert data["version"] == 1
    assert len(data["taxonomy"]) == 7
    codes = {item["code"] for item in data["taxonomy"]}
    assert codes == {f"CAT-{i:02d}" for i in range(1, 8)}
    assert "schema" in data
    assert data["schema"]["$id"] == "vitalspan://gov/appendix-e/v1"


def test_gov_001_02_categories_list_has_seven(client: TestClient):
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    assert resp.status_code == 200
    codes = {item["code"] for item in resp.json()["items"]}
    assert len(codes) == 7


def test_gov_001_03_create_entry_cat04_valid_cat99_invalid(client: TestClient):
    ok = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Timeseries probe",
            "httpMethod": "GET",
            "path": "/api/v1/timeseries",
            "categoryCodes": ["CAT-04"],
        },
    )
    assert ok.status_code == 201
    bad = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Bad",
            "httpMethod": "GET",
            "path": "/api/v1/bad",
            "categoryCodes": ["CAT-99"],
        },
    )
    assert bad.status_code == 400
    assert bad.json()["code"] == "CATALOG_INVALID_CATEGORY"


def test_gov_001_04_probe_within_50ms():
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_appendix_e_taxonomy_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


@pytest.fixture
def enterprise_appendix_scope():
    from app.main import app as fastapi_app

    async def _enterprise() -> UserContext:
        return UserContext(id="enterprise-gov001", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    set_user_catalog_taxonomy_scope("enterprise-gov001", "CAT-0")
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_001_05_enterprise_scope_forbidden(client: TestClient, enterprise_appendix_scope):
    set_user_catalog_taxonomy_scope("enterprise-gov001", "CAT-0")
    resp = client.get("/api/v1/gov/catalog/appendix-e", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_APPENDIX_E_FORBIDDEN"
