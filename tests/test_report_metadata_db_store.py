"""Report metadata DB persistence."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:rpt_meta_persist?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.auth.models  # noqa: F401
    import app.reports.persistence.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture(autouse=True)
def _reset():
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    yield
    reset_metadata_for_tests()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_catalog_persists_with_db_store(client: TestClient, monkeypatch):
    monkeypatch.setenv("RPT_METADATA_STORE", "db")
    get_settings.cache_clear()
    created = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Persist Folder", "nodeType": "folder"},
    )
    assert created.status_code == 201, created.text
    node_id = created.json()["id"]
    listed = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    assert any(item["id"] == node_id for item in listed.json())
    monkeypatch.delenv("RPT_METADATA_STORE", raising=False)
    get_settings.cache_clear()
