"""M12 batch1 r238 — RPT-005/007, VIEW-003, NFR-006, CAT-007 integration gate."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R238_SQLITE_URL = "sqlite+pysqlite:///file:m12_batch1_r238?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r238_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R238_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401
    import app.views.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000002380001", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000002380002", username="ent", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_template_node(client: TestClient, name: str = "Tpl") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "nodeType": "template", "templateKind": "excel"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"Dash-{uuid.uuid4().hex[:6]}", "description": "r238"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _schedule_flow(client: TestClient, node_id: str) -> tuple[str, dict]:
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *", "timezone": "Asia/Shanghai"},
    )
    assert sched.status_code == 201, sched.text
    sid = sched.json()["id"]
    tr = client.post(
        f"/api/v1/reports/schedules/{sid}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    assert tr.status_code == 200, tr.text
    return sid, tr.json()


# --- RPT-005 ---


def test_rpt_r238_005_scheduler_job_registered(client):
    """T-RPT-R238-005-01: transition scheduled registers APScheduler job."""
    from app.reports.scheduler.jobs import get_report_scheduler

    node_id = _create_template_node(client)
    sid, _ = _schedule_flow(client, node_id)
    jobs = get_report_scheduler().get_jobs()
    assert any(j.id == sid for j in jobs)


def test_rpt_r238_005_list_schedules(client):
    """T-RPT-R238-005-02: GET /schedules lists by catalogNodeId."""
    node_id = _create_template_node(client)
    _schedule_flow(client, node_id)
    resp = client.get(f"/api/v1/reports/schedules?catalogNodeId={node_id}", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert body["items"][0]["catalogNodeId"] == node_id


def test_rpt_r238_005_execute_writes_history(client):
    """T-RPT-R238-005-03: execute appends execution history."""
    node_id = _create_template_node(client)
    sid, _ = _schedule_flow(client, node_id)
    key = f"r238-{uuid.uuid4().hex}"
    ex = client.post(
        f"/api/v1/reports/schedules/{sid}/execute",
        headers={**AUTH, "Idempotency-Key": key, "X-Rpt-Semi-Real": "1"},
    )
    assert ex.status_code == 200
    hist = client.get(f"/api/v1/reports/schedules/{sid}/executions", headers=AUTH)
    assert hist.status_code == 200
    assert hist.json()["total"] >= 1


def test_rpt_r238_005_viewer_transition_forbidden(client):
    """T-RPT-R238-005-04: viewer cannot transition schedule."""
    node_id = _create_template_node(client)
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    sid = sched.json()["id"]

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000002380001", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        resp = client.post(
            f"/api/v1/reports/schedules/{sid}/transition",
            headers=AUTH,
            json={"action": "schedule"},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "RPT_SCHEDULE_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_rpt_r238_005_retry_parent_execution(client):
    """T-RPT-R238-005-05: retry links parentExecutionId."""
    node_id = _create_template_node(client)
    sid, _ = _schedule_flow(client, node_id)
    key = f"fail-{uuid.uuid4().hex}"
    ex = client.post(
        f"/api/v1/reports/schedules/{sid}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": key,
            "X-Rpt-Semi-Real": "1",
            "X-Rpt-Delivery-Mock": "fail",
        },
    )
    assert ex.status_code == 200
    parent_id = ex.json()["executionId"]
    assert ex.json()["status"] == "failed"
    retry_key = f"retry-{uuid.uuid4().hex}"
    retry = client.post(
        f"/api/v1/reports/schedules/executions/{parent_id}/retry",
        headers={**AUTH, "Idempotency-Key": retry_key},
    )
    assert retry.status_code == 200
    assert retry.json()["parentExecutionId"] == parent_id


def test_rpt_r238_005_semi_real_probe_budget(client):
    """T-RPT-R238-005-06: semi-real execute probe ≤35ms."""
    from app.reports.scheduler.executor import probe_semi_real_execute_budget_ms

    node_id = _create_template_node(client)
    sid, _ = _schedule_flow(client, node_id)
    elapsed = probe_semi_real_execute_budget_ms(
        uuid.UUID(sid),
        f"probe-{uuid.uuid4().hex}",
        UserContext(id="dev", username="dev", roles=["admin"]),
    )
    assert elapsed <= 35


def test_rpt_r238_005_failed_status_error_message(client):
    """T-RPT-R238-005-07: delivery fail sets errorMessage."""
    node_id = _create_template_node(client)
    sid, _ = _schedule_flow(client, node_id)
    ex = client.post(
        f"/api/v1/reports/schedules/{sid}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": f"em-{uuid.uuid4().hex}",
            "X-Rpt-Semi-Real": "1",
            "X-Rpt-Delivery-Mock": "fail",
        },
    )
    assert ex.json().get("errorMessage") == "delivery failed"


# --- RPT-007 ---


def test_rpt_r238_007_batch_happy_10(client):
    """T-RPT-R238-007-01: 10-item batch happy path."""
    items = [{"name": f"B{i}", "templateKind": "excel"} for i in range(10)]
    resp = client.post("/api/v1/reports/batch", headers=AUTH, json={"items": items})
    assert resp.status_code == 201
    assert len(resp.json()["createdNodeIds"]) == 10


def test_rpt_r238_007_duplicate_name_422(client):
    """T-RPT-R238-007-02: duplicate names in batch → 422."""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={"items": [{"name": "Dup", "templateKind": "excel"}, {"name": "Dup", "templateKind": "pdf"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_BATCH_DUPLICATE_NAME"


def test_rpt_r238_007_partial_failure_failures_index(client):
    """T-RPT-R238-007-03: partial failure failures[0].index === 2."""
    items = [
        {"name": "Ok0", "templateKind": "excel"},
        {"name": "Ok1", "templateKind": "excel"},
        {
            "name": "BadExt",
            "templateKind": "excel",
            "extension": {"catalogNodeId": str(uuid.uuid4()), "metrics": []},
        },
    ]
    resp = client.post("/api/v1/reports/batch", headers=AUTH, json={"items": items})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    failures = detail.get("failures") or []
    assert failures[0]["index"] == 2


def test_rpt_r238_007_idempotent_replay(client):
    """T-RPT-R238-007-04: idempotent replay same body."""
    key = f"idemp-{uuid.uuid4().hex}"
    body = {"items": [{"name": f"I-{uuid.uuid4().hex[:6]}", "templateKind": "excel"}]}
    first = client.post("/api/v1/reports/batch", headers={**AUTH, "Idempotency-Key": key}, json=body)
    second = client.post("/api/v1/reports/batch", headers={**AUTH, "Idempotency-Key": key}, json=body)
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["idempotentReplay"] is True


def test_rpt_batch_dry_run_conflict(client):
    """Batch dry-run flags sibling name conflict without creating nodes."""
    parent = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "batch-parent", "nodeType": "folder"},
    )
    assert parent.status_code == 201
    parent_id = parent.json()["id"]
    existing = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Taken", "nodeType": "template", "templateKind": "excel", "parentId": parent_id},
    )
    assert existing.status_code == 201
    dry = client.post(
        "/api/v1/reports/batch/dry-run",
        headers=AUTH,
        json={"items": [{"name": "Taken", "templateKind": "pdf", "parentId": parent_id}]},
    )
    assert dry.status_code == 200
    dry_body = dry.json()
    assert dry_body["canImport"] is False
    assert dry_body["conflictCount"] == 1
    assert dry_body["items"][0]["status"] == "conflict"


# --- VIEW-003 ---


def test_view_r238_put_delete(client):
    """T-VIEW-R238-003-01: PUT/DELETE user views."""
    dash_id = _create_dashboard(client)
    created = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "默认", "dashboardId": dash_id, "layout": {}},
    )
    assert created.status_code == 201
    view_id = created.json()["id"]
    updated = client.put(
        f"/api/v1/users/me/views/{view_id}",
        headers=AUTH,
        json={"name": "备份", "dashboardId": dash_id, "layout": {}},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "备份"
    deleted = client.delete(f"/api/v1/users/me/views/{view_id}", headers=AUTH)
    assert deleted.status_code == 204
    listing = client.get("/api/v1/users/me/views", headers=AUTH)
    assert listing.json()["items"] == []


def test_view_r238_set_default_preserves_name(client):
    """PUT isDefault=true keeps view name; only one default flag."""
    dash_id = _create_dashboard(client)
    first = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "销售总览", "dashboardId": dash_id, "layout": {}, "isDefault": True},
    )
    second = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "备份视图", "dashboardId": dash_id, "layout": {}},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    view_id = second.json()["id"]
    updated = client.put(
        f"/api/v1/users/me/views/{view_id}",
        headers=AUTH,
        json={
            "name": "备份视图",
            "dashboardId": dash_id,
            "layout": {},
            "isDefault": True,
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "备份视图"
    assert body["isDefault"] is True
    listing = client.get("/api/v1/users/me/views", headers=AUTH)
    items = listing.json()["items"]
    assert len(items) == 2
    defaults = [item for item in items if item.get("isDefault")]
    assert len(defaults) == 1
    assert defaults[0]["id"] == view_id
    assert defaults[0]["name"] == "备份视图"


def test_view_r238_repo_helpers():
    """T-VIEW-R238-003-02: repo update/remove helpers."""
    from app.auth.models import get_meta_engine
    from app.views import user_override_repo
    from sqlalchemy.orm import Session

    view_id = str(uuid.uuid4())
    dash_id = str(uuid.uuid4())
    with Session(get_meta_engine()) as db:
        user_override_repo.add_user_override(
            db,
            "u1",
            {"id": view_id, "name": "默认", "dashboardId": dash_id, "layout": {}},
        )
        user_override_repo.update_user_override(db, "u1", view_id, {"name": "备份"})
        assert user_override_repo.list_user_overrides(db, "u1")[0]["name"] == "备份"
        user_override_repo.remove_user_override(db, "u1", view_id)
        assert user_override_repo.list_user_overrides(db, "u1") == []


# --- NFR-006 ---


def test_nfr_r238_browser_matrix_chrome(client):
    """T-NFR-R238-006-01: Chrome UA → supported."""
    ua = "Mozilla/5.0 Chrome/120.0.0.0"
    resp = client.get("/api/v1/nfr/browser-matrix", headers=AUTH, params={"userAgent": ua})
    assert resp.status_code == 200
    assert resp.json()["overallStatus"] == "supported"
    assert resp.json()["documentationUrl"] == "/docs/nfr/browser-compatibility.md"


def test_nfr_r238_notifications_flow(client):
    """T-NFR-R238-006-02: POST/GET notifications."""
    from app.core.nfr.notifications import clear_notifications

    clear_notifications()
    created = client.post("/api/v1/nfr/notifications", headers=AUTH, json={"message": "probe"})
    assert created.status_code == 201
    nid = created.json()["id"]
    got = client.get(f"/api/v1/nfr/notifications/{nid}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["message"] == "probe"


def test_nfr_r238_notifications_not_found(client):
    """T-NFR-R238-006-03: missing notification → 404."""
    resp = client.get(f"/api/v1/nfr/notifications/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404


# --- CAT-007 ---


def test_cat_r238_m12_probe(client):
    """T-CAT-R238-007-01: m12-probe 200 categoryCode CAT-07."""
    resp = client.get("/api/v1/gov/catalog/workno-behavior/m12-probe", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["categoryCode"] == "CAT-07"
    assert body["taxonomyRegistered"] is True
    assert body["behaviorProbeOk"] is True
    assert body["aclReady"] is True


def test_cat_r238_enterprise_viewer_forbidden(client, enterprise_user):
    """T-CAT-R238-007-02: enterprise viewer cross workno → 403."""
    from app.governance.catalog.cat07 import service as cat07_service

    cat07_service.set_user_workno_scope("00000000-0000-4000-8000-000002380002", "EMP1001")
    resp = client.get(
        "/api/v1/workno/behavior",
        headers=jwt_auth_headers(user_id="00000000-0000-4000-8000-000002380002", username="ent"),
        params={"workno": "EMP2002"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT07_FORBIDDEN"


def test_cat_r238_probe_elapsed_budget(client):
    """T-CAT-R238-007-03: m12-probe elapsedMs recorded."""
    resp = client.get("/api/v1/gov/catalog/workno-behavior/m12-probe", headers=AUTH)
    assert resp.json()["elapsedMs"] >= 0


def test_r238_health(client):
    """T-R238-000-01: health ok."""
    assert client.get("/health").status_code == 200
