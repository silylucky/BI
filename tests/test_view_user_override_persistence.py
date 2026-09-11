"""VIEW-003 user override DB persistence."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_PERSIST_SQLITE = "sqlite+pysqlite:///file:view_user_override_persist?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def persist_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _PERSIST_SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.query.models  # noqa: F401
    import app.views.models  # noqa: F401

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


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"Dash-{uuid.uuid4().hex[:6]}", "description": "persist"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_user_override_survives_new_session(client: TestClient):
    """Created view remains after closing DB session (restart-equivalent)."""
    from app.auth.models import get_meta_engine
    from app.views import user_override_repo

    dash_id = _create_dashboard(client)
    created = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "我的入口", "dashboardId": dash_id, "layout": {}},
    )
    assert created.status_code == 201
    view_id = created.json()["id"]

    with Session(get_meta_engine()) as db:
        items = user_override_repo.list_user_overrides(db, "00000000-0000-0000-0000-000000000001")
    assert len(items) == 1
    assert items[0]["id"] == view_id
    assert items[0]["name"] == "我的入口"


def test_user_override_name_conflict_409(client: TestClient):
    """Duplicate view name for same user returns 409."""
    dash_id = _create_dashboard(client)
    first = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "重复名", "dashboardId": dash_id, "layout": {}},
    )
    second = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "重复名", "dashboardId": dash_id, "layout": {}},
    )
    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["code"] == "VIEW_OVERRIDE_CONFLICT"


def test_user_override_single_default_flag(client: TestClient):
    """Only one view may be marked isDefault per user."""
    dash_id = _create_dashboard(client)
    first = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "A", "dashboardId": dash_id, "layout": {}, "isDefault": True},
    )
    second = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "B", "dashboardId": dash_id, "layout": {}},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    view_b = second.json()["id"]
    updated = client.put(
        f"/api/v1/users/me/views/{view_b}",
        headers=AUTH,
        json={"name": "B", "dashboardId": dash_id, "layout": {}, "isDefault": True},
    )
    assert updated.status_code == 200
    listing = client.get("/api/v1/users/me/views", headers=AUTH)
    items = listing.json()["items"]
    defaults = [item for item in items if item.get("isDefault")]
    assert len(defaults) == 1
    assert defaults[0]["id"] == view_b


def test_user_override_isolated_by_user(client: TestClient):
    """Views created by one user are not visible to another."""
    from app.auth.models import get_meta_engine
    from app.views import user_override_repo

    dash_id = _create_dashboard(client)
    created = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "admin-only", "dashboardId": dash_id, "layout": {}},
    )
    assert created.status_code == 201

    with Session(get_meta_engine()) as db:
        other_items = user_override_repo.list_user_overrides(db, "other-user-id")
    assert other_items == []
