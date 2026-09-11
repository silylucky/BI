"""R0 theme drill SQL safety + dashboard/dataset minimal ACL."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme.query import build_drill_query
from app.dashboard.theme.schemas import EntityThemeConfig
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:r0_acl_safety?mode=memory&cache=shared&uri=true"


def _theme_config() -> EntityThemeConfig:
    return EntityThemeConfig.model_validate({
        "refType": "dashboard",
        "refId": str(uuid.uuid4()),
        "entityType": "orders",
        "timeGranularity": "day",
        "dimensions": [{"dimensionId": "region", "label": "Region"}],
    })


def test_build_drill_query_escapes_filter_literals() -> None:
    sql = build_drill_query(_theme_config(), "region", {"region": "East' OR '1'='1"})
    assert "East'' OR ''1''=''1" in sql
    assert "OR '1'='1" not in sql


def test_build_drill_query_rejects_unsafe_filter_value() -> None:
    with pytest.raises(ThemeAnalysisError) as exc:
        build_drill_query(_theme_config(), "region", {"region": "x; DROP TABLE t"})
    assert exc.value.code == "DASH_THEME_FILTER_UNSAFE"


def test_build_drill_query_rejects_injected_filter_key() -> None:
    with pytest.raises(ThemeAnalysisError) as exc:
        build_drill_query(_theme_config(), "region", {"region;drop": "x"})
    assert exc.value.code == "DASH_THEME_FILTER_UNSAFE"


@pytest.fixture(scope="module", autouse=True)
def r0_sqlite_env():
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


@pytest.fixture(autouse=True)
def clear_datasets():
    from app.metadata.dataset import service as dataset_service

    dataset_service._store.clear()
    yield
    dataset_service._store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def owner_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def other_id() -> str:
    return str(uuid.uuid4())


def test_dashboard_get_forbidden_for_non_owner(client, owner_id, other_id):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id,
        username="owner",
        roles=["analyst"],
        permissions={"dashboard:read", "dashboard:edit"},
    )
    created = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Mine", "slug": f"mine-{uuid.uuid4().hex[:8]}"},
    )
    assert created.status_code == 201, created.text
    dash_id = created.json()["id"]

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=other_id,
        username="other",
        roles=["analyst"],
        permissions={"dashboard:read"},
    )
    resp = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FORBIDDEN"
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_dashboard_owner_can_get(client, owner_id):
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id,
        username="owner",
        roles=["analyst"],
        permissions={"dashboard:read", "dashboard:edit"},
    )
    created = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Own", "slug": f"own-{uuid.uuid4().hex[:8]}"},
    )
    assert created.status_code == 201
    dash_id = created.json()["id"]
    resp = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["id"] == dash_id
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_dataset_get_enforces_allowed_roles(client):
    admin_id = str(uuid.uuid4())
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=admin_id,
        username="admin",
        roles=["admin"],
        is_root=True,
    )
    ds_id = f"ds-r0-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={
            "datasetId": ds_id,
            "displayName": "ACL",
            "tables": [{"name": "orders"}],
            "allowedRoles": ["analyst"],
        },
    )
    assert created.status_code == 201, created.text

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()),
        username="viewer",
        roles=["viewer"],
        permissions={"dataset:read"},
    )
    forbidden = client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "META_DATASET_FORBIDDEN"

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()),
        username="analyst",
        roles=["analyst"],
        permissions={"dataset:read"},
    )
    ok = client.get(f"/api/v1/datasets/{ds_id}", headers=AUTH)
    assert ok.status_code == 200
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_dashboard_list_filters_by_resource_grant(client, auth_headers):
    """T-AUTH-DASH-ACL: 资源授权后非 owner 用户可在列表看到仪表板。"""
    owner_id = str(uuid.uuid4())
    viewer_id = str(uuid.uuid4())
    role = client.post(
        "/api/v1/roles",
        json={"code": f"dash_acl_{uuid.uuid4().hex[:6]}", "name": "Dash ACL Viewer"},
        headers=auth_headers,
    ).json()
    client.put(
        f"/api/v1/roles/{role['id']}/permissions",
        json={"permissionCodes": ["dashboard:read"], "expectedVersion": 0},
        headers=auth_headers,
    )

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id,
        username="owner",
        roles=["analyst"],
        permissions={"dashboard:read", "dashboard:edit"},
    )
    slug = f"grant-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Granted Dash", "slug": slug},
    )
    assert created.status_code == 201, created.text
    dash_id = created.json()["id"]

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=viewer_id,
        username="viewer",
        roles=[role["code"]],
        permissions={"dashboard:read"},
    )
    listed = client.get("/api/v1/dashboards", headers=AUTH)
    assert listed.status_code == 200
    ids_before = {item["id"] for item in listed.json()["items"]}
    assert dash_id not in ids_before

    fastapi_app.dependency_overrides.pop(get_current_user, None)
    grant = client.post(
        "/api/v1/resource-grants",
        json={
            "role_id": role["id"],
            "resource_type": "dashboard",
            "resource_id": dash_id,
        },
        headers=auth_headers,
    )
    assert grant.status_code == 201

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=viewer_id,
        username="viewer",
        roles=[role["code"]],
        permissions={"dashboard:read"},
    )
    listed_after = client.get("/api/v1/dashboards", headers=AUTH)
    ids_after = {item["id"] for item in listed_after.json()["items"]}
    assert dash_id in ids_after
    fastapi_app.dependency_overrides.pop(get_current_user, None)
