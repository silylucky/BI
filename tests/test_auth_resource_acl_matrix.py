"""Resource ACL matrix: dashboard IDOR, report grant filtering, scheduler read protection."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.reports.catalog import service as catalog_service
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.persistence import memory_stores
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleRecipientIn
from app.reports.scheduler.store import reset_schedules_for_tests
from jwt_auth import AUTH, jwt_auth_headers

_SQLITE_URL = "sqlite+pysqlite:///file:auth_resource_acl_matrix?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def matrix_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.dashboard.models import Base as DashBase
    from app.datasources.models import Base, get_meta_engine

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    DashBase.metadata.create_all(engine)
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


@pytest.fixture
def auth_headers() -> dict[str, str]:
    import conftest as _conftest

    _conftest._seed_ci_admin_user()
    return jwt_auth_headers()


@pytest.fixture(autouse=True)
def clean_catalog_and_schedules():
    memory_stores.catalog_nodes.clear()
    memory_stores.catalog_owners.clear()
    reset_schedules_for_tests()
    yield
    memory_stores.catalog_nodes.clear()
    memory_stores.catalog_owners.clear()
    reset_schedules_for_tests()


def _create_dashboard(client: TestClient, owner_id: str, slug: str | None = None) -> str:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id,
        username="owner",
        roles=["analyst"],
        permissions=["dashboard:read", "dashboard:edit"],
    )
    slug = slug or f"dash-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "ACL Dash", "slug": slug},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_dashboard_global_filters_idor_forbidden(client: TestClient) -> None:
    """Non-owner without grant cannot read dashboard global-filters."""
    owner_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())
    dash_id = _create_dashboard(client, owner_id)
    fastapi_app.dependency_overrides.pop(get_current_user, None)

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=other_id,
        username="other",
        roles=["analyst"],
        permissions=["dashboard:read"],
    )
    resp = client.get(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_report_catalog_grant_filters_list_and_get(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Report catalog nodes visible only to owner or granted role."""
    owner_id = str(uuid.uuid4())
    viewer_id = str(uuid.uuid4())
    role = client.post(
        "/api/v1/roles",
        json={"code": f"rpt_acl_{uuid.uuid4().hex[:6]}", "name": "Report ACL"},
        headers=auth_headers,
    ).json()
    client.put(
        f"/api/v1/roles/{role['id']}/permissions",
        json={"permissionCodes": ["report:read"], "expectedVersion": 0},
        headers=auth_headers,
    )

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=owner_id,
        username="owner",
        roles=["editor"],
        permissions=["report:read", "report:manage"],
    )
    node = catalog_service.create_node(
        CatalogNodeCreate(name="Secret Report", nodeType="folder", parentId=None, sortOrder=0),
        UserContext(id=owner_id, username="owner", roles=["editor"], permissions=["report:manage"]),
    )
    node_id = node.id

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=viewer_id,
        username="viewer",
        roles=[role["code"]],
        permissions=["report:read"],
    )
    listed = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    assert listed.status_code == 200
    assert all(item["id"] != str(node_id) for item in listed.json())

    denied = client.get(f"/api/v1/reports/catalog/nodes/{node_id}", headers=AUTH)
    assert denied.status_code == 403

    fastapi_app.dependency_overrides.pop(get_current_user, None)
    grant = client.post(
        "/api/v1/resource-grants",
        json={
            "role_id": role["id"],
            "resource_type": "report",
            "resource_id": str(node_id),
        },
        headers=auth_headers,
    )
    assert grant.status_code == 201

    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=viewer_id,
        username="viewer",
        roles=[role["code"]],
        permissions=["report:read"],
    )
    listed_after = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    assert any(item["id"] == str(node_id) for item in listed_after.json())
    ok = client.get(f"/api/v1/reports/catalog/nodes/{node_id}", headers=AUTH)
    assert ok.status_code == 200
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_scheduler_get_schedule_read_protection(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Viewer cannot read another user's schedule by id."""
    from unittest.mock import MagicMock, patch

    reset_schedules_for_tests()
    mock_settings = MagicMock()
    mock_settings.rpt_schedule_store = "memory"
    monkeypatch.setattr("app.reports.scheduler.store.get_settings", lambda: mock_settings)

    pack = MagicMock()
    pack.pack_key = "equipment-overview"
    pack.display_name = "设备标准分析"
    pack.enabled_themes = ["distribution"]
    repo_row = {"packKey": pack.pack_key, "displayName": pack.display_name}

    owner = UserContext(id="sched-owner", username="owner", roles=["analyst"], permissions=["report:manage"])
    viewer = UserContext(id="sched-viewer", username="viewer", roles=["viewer"], permissions=["report:read"])

    with (
        patch("app.reports.scheduler.service.get_pack", return_value=pack),
        patch("app.reports.persistence.standard_repo.get_pack", return_value=repo_row),
    ):
        created = scheduler_service.create_schedule(
            ScheduleCreate(
                sourceType="standard",
                sourceKey="equipment-overview",
                name="Private schedule",
                cron="0 8 * * *",
                recipients=[ScheduleRecipientIn(type="email", value="ops@example.com")],
                attachmentFormats=["pdf"],
                deliveryChannels=["email"],
            ),
            owner,
        )

        from app.reports.scheduler.errors import ScheduleError

        with pytest.raises(ScheduleError) as exc:
            scheduler_service.get_schedule(created.id, viewer)
        assert exc.value.code == "RPT_SCHEDULE_FORBIDDEN"

        out = scheduler_service.get_schedule(created.id, owner)
        assert out.id == created.id


def test_create_schedule_requires_dashboard_access(client: TestClient) -> None:
    """Cannot schedule delivery for a dashboard the actor cannot access."""
    owner_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())
    dash_id = _create_dashboard(client, owner_id)
    fastapi_app.dependency_overrides.pop(get_current_user, None)

    actor = UserContext(
        id=other_id,
        username="other",
        roles=["analyst"],
        permissions=["dashboard:schedule", "report:manage"],
    )
    payload = ScheduleCreate(
        sourceType="dashboard",
        sourceId=uuid.UUID(dash_id),
        name="Stolen schedule",
        cron="0 9 * * *",
        recipients=[ScheduleRecipientIn(type="email", value="x@example.com")],
        attachmentFormats=["pdf"],
        deliveryChannels=["email"],
    )
    from app.reports.scheduler.errors import ScheduleError

    with pytest.raises(ScheduleError) as exc:
        scheduler_service.create_schedule(payload, actor)
    assert exc.value.status == 403
