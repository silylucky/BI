from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.dashboard.schemas import DashboardLayout, DashboardOut
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:dash_out_ser?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def dash_out_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
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
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_dashboard_out_serializes_camel_case_layout_json() -> None:
    layout = DashboardLayout.model_validate(
        {
            "version": 1,
            "widgets": [],
            "globalFilters": [],
        }
    )
    out = DashboardOut(
        id=uuid.uuid4(),
        name="测试看板",
        slug="test-dash",
        description=None,
        layout_json=layout,
        created_by=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    payload = out.model_dump(mode="json", by_alias=True)
    assert "layoutJson" in payload
    assert "layout_json" not in payload
    assert payload["layoutJson"]["globalFilters"] == []


def test_get_dashboard_returns_layout_json_alias(client: TestClient) -> None:
    slug = f"ser-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "序列化测试", "slug": slug},
    )
    assert created.status_code == 201, created.text
    dash_id = created.json()["id"]
    client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [],
                "globalFilters": [],
            },
        },
    )
    resp = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "layoutJson" in body
    assert "layout_json" not in body
    assert body["layoutJson"]["version"] == 1
