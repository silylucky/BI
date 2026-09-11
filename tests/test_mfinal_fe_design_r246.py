"""M-FINAL F-E r246 — DESIGN-004~005 + GOV-004~006 批次 2。"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import jwt_auth_headers

_R246_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_r246?mode=memory&cache=shared&uri=true"
REF_ID = "00000000-0000-4000-8000-000000000002"

# Task 4 起 AuthMiddleware 从 DB 解析身份（无 admin 回退），隔离 DB 必须存在真实
# root 管理员，否则 admin_headers 会触发 503/403。admin 复用 conftest 的
# _ADMIN_USER_ID（UUID 全 0…1，username="admin"），与 conftest 幂等 reseed 收敛。
_ADMIN_UID = "00000000-0000-0000-0000-000000000001"
_VIEWER_UID = "00000000-0000-4000-8000-000000000098"


def _seed_root_admin(engine) -> None:
    """幂等 seed root admin + 无权限 viewer；与 conftest reseed 不冲突。"""
    from app.auth.models import AuthRole, AuthUser, AuthUserRole

    with Session(engine) as session:
        admin_role = session.query(AuthRole).filter(AuthRole.code == "admin").first()
        if admin_role is None:
            admin_role = AuthRole(
                code="admin", name="管理员", is_active=True, is_system=True, is_root=True
            )
            session.add(admin_role)
            session.flush()
        if session.get(AuthUser, uuid.UUID(_ADMIN_UID)) is None:
            admin_user = AuthUser(
                id=uuid.UUID(_ADMIN_UID),
                username="admin",
                display_name="Admin",
                is_active=True,
                token_version=1,
            )
            session.add(admin_user)
            session.flush()
            session.add(AuthUserRole(user_id=admin_user.id, role_id=admin_role.id))

        if session.query(AuthRole).filter(AuthRole.code == "viewer").first() is None:
            viewer_role = AuthRole(code="viewer", name="查看者", is_active=True)
            session.add(viewer_role)
            session.flush()
            viewer_user = AuthUser(
                id=uuid.UUID(_VIEWER_UID),
                username="viewer",
                display_name="Viewer",
                is_active=True,
                token_version=1,
            )
            session.add(viewer_user)
            session.flush()
            session.add(AuthUserRole(user_id=viewer_user.id, role_id=viewer_role.id))
        session.commit()

VALID_CONDITIONS = {
    "schemaVersion": "1.0",
    "logic": "AND",
    "conditions": [
        {
            "fieldId": "order_amount",
            "operator": "gt",
            "value": 100,
            "valueType": "number",
        }
    ],
    "refType": "design_draft",
    "refId": REF_ID,
}

VALID_RULES = {
    "schemaVersion": "1.0",
    "rules": [
        {
            "id": "r1",
            "name": "sum amount",
            "ruleType": "sum",
            "targetField": "amount",
            "expression": "sum(order_amount)",
            "dependsOn": [],
        }
    ],
    "refType": "design_draft",
    "refId": REF_ID,
}

VALID_OUTPUT = {
    "schemaVersion": "1.0",
    "fields": [{"fieldId": "order_amount", "alias": "amount", "visible": True}],
    "aggregates": [{"fn": "sum", "fieldId": "order_amount", "groupBy": []}],
    "refType": "design_draft",
    "refId": REF_ID,
}


@pytest.fixture(scope="module", autouse=True)
def r246_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R246_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    _seed_root_admin(engine)
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
def admin_headers() -> dict[str, str]:
    return jwt_auth_headers(user_id=_ADMIN_UID)


@pytest.fixture
def viewer_headers() -> dict[str, str]:
    return jwt_auth_headers(user_id=_VIEWER_UID, username="viewer")


def _seed_designer_blocks(client: TestClient, headers: dict[str, str], ref_id: str = REF_ID) -> None:
    client.put("/api/v1/designer/conditions", headers=headers, json={**VALID_CONDITIONS, "refId": ref_id})
    client.put("/api/v1/designer/compute-rules", headers=headers, json={**VALID_RULES, "refId": ref_id})
    client.put("/api/v1/designer/output-fields", headers=headers, json={**VALID_OUTPUT, "refId": ref_id})


def _submit_design(client: TestClient, headers: dict[str, str], ref_id: str | None = None) -> dict:
    if ref_id is None:
        ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, headers, ref_id)
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=headers,
        json={"designerItemId": ref_id, "templateId": "standard_query_release", "designType": "query"},
    )
    assert resp.status_code == 201
    return resp.json()


def _to_designing(client: TestClient, headers: dict[str, str], instance_id: str) -> None:
    client.post(
        f"/api/v1/gov/workflow/instances/{instance_id}/transition",
        headers=headers,
        json={"action": "approve", "actorRole": "approver"},
    )


def _to_pending_publish(client: TestClient, headers: dict[str, str], instance_id: str) -> None:
    _to_designing(client, headers, instance_id)
    client.post(
        f"/api/v1/gov/workflow/instances/{instance_id}/confirm-design",
        headers=headers,
    )


# --- DESIGN-004 ---


def test_design_r246_004_01_snapshot_get_admin(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    snap_id = submit["designSnapshotId"]
    resp = client.get(f"/api/v1/designer/snapshots/{snap_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["conditions"]["logic"] == "AND"


def test_design_r246_004_02_snapshot_forbidden_viewer(client, admin_headers, viewer_headers):
    from app.auth.deps import UserContext, get_current_user

    async def _admin() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000099", username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _admin
    submit = _submit_design(client, admin_headers)
    snap_id = submit["designSnapshotId"]

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000098", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.get(f"/api/v1/designer/snapshots/{snap_id}", headers=viewer_headers)
        assert resp.status_code == 403
        assert resp.json()["code"] == "DESIGN_SNAPSHOT_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_design_r246_004_03_link_by_instance(client, admin_headers):
    ref_id = str(uuid.uuid4())
    submit = _submit_design(client, admin_headers, ref_id)
    by_item = client.get(f"/api/v1/designer/workflow-link?designerItemId={ref_id}", headers=admin_headers)
    by_inst = client.get(
        f"/api/v1/designer/workflow-link?workflowInstanceId={submit['workflowInstanceId']}",
        headers=admin_headers,
    )
    assert by_item.status_code == 200
    assert by_inst.status_code == 200
    assert by_item.json()["workflowInstanceId"] == by_inst.json()["workflowInstanceId"]


def test_design_r246_004_04_delete_link_draft_only(client, admin_headers):
    ref_id = str(uuid.uuid4())
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": "standard_query_release", "refId": ref_id},
    )
    iid = inst.json()["id"]
    client.put(
        "/api/v1/designer/workflow-link",
        headers=admin_headers,
        json={"designerItemId": ref_id, "workflowInstanceId": iid, "designType": "query"},
    )
    ok = client.delete(f"/api/v1/designer/workflow-link?designerItemId={ref_id}", headers=admin_headers)
    assert ok.status_code == 204

    ref_id2 = str(uuid.uuid4())
    submit = _submit_design(client, admin_headers, ref_id2)
    blocked = client.delete(f"/api/v1/designer/workflow-link?designerItemId={ref_id2}", headers=admin_headers)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "DESIGN_WORKFLOW_LINK_NOT_REVOKABLE"
    assert submit["workflowInstanceId"]


def test_design_r246_004_05_instances_list(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    resp = client.get("/api/v1/gov/workflow/instances", headers=admin_headers)
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert submit["workflowInstanceId"] in ids


def test_design_r246_004_06_include_design_snapshot(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    resp = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}?includeDesignSnapshot=true",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    snap = resp.json()["designSnapshot"]
    assert snap["conditions"]["logic"] == "AND"
    assert snap.get("computeRules")
    assert snap.get("outputFields")


def test_design_r246_004_07_snapshot_revision(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    inst = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}",
        headers=admin_headers,
    )
    rev = inst.json().get("snapshotRevision")
    assert rev is not None
    assert "query_conditions" in rev


def test_design_r246_004_08_immutable_snapshot(client, admin_headers):
    ref_id = str(uuid.uuid4())
    submit = _submit_design(client, admin_headers, ref_id)
    snap1 = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}?includeDesignSnapshot=true",
        headers=admin_headers,
    ).json()["designSnapshot"]
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_headers,
        json={**VALID_CONDITIONS, "refId": ref_id, "logic": "OR"},
    )
    snap2 = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}?includeDesignSnapshot=true",
        headers=admin_headers,
    ).json()["designSnapshot"]
    assert snap2 == snap1


# --- DESIGN-005 ---


def test_design_r246_005_01_design_mode_roundtrip(client, admin_headers):
    resp = client.put(
        "/api/v1/designer/design-mode",
        headers=admin_headers,
        json={"refId": REF_ID, "mode": "sql"},
    )
    assert resp.status_code == 200
    assert resp.json()["mode"] == "sql"
    get = client.get(f"/api/v1/designer/design-mode?refId={REF_ID}", headers=admin_headers)
    assert get.json()["mode"] == "sql"


def test_design_r246_005_02_sql_validate_dml(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=admin_headers,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "DELETE FROM t", "refId": REF_ID},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r246_005_03_sql_mode_submit_incomplete(client, admin_headers):
    ref_id = str(uuid.uuid4())
    client.put("/api/v1/designer/design-mode", headers=admin_headers, json={"refId": ref_id, "mode": "sql"})
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "designType": "query"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SUBMIT_INCOMPLETE"


def test_design_r246_005_04_visual_submit_regression(client, admin_headers):
    ref_id = str(uuid.uuid4())
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_headers,
        json={**VALID_CONDITIONS, "refId": ref_id},
    )
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "designType": "query"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SUBMIT_INCOMPLETE"


def test_design_r246_005_05_sql_save_get_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    ds_id = str(uuid.uuid4())
    put = client.put(
        "/api/v1/designer/sql-mode",
        headers=admin_headers,
        json={"dataSourceId": ds_id, "sql": "SELECT 1", "refId": ref_id},
    )
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/sql-mode?refId={ref_id}", headers=admin_headers)
    assert get.json()["sql"] == "SELECT 1"


def test_design_r246_005_06_probe_sql_validate_budget():
    from app.designer.sql_mode import probe_validate_sql_mode

    assert probe_validate_sql_mode().elapsed_ms <= 50


# --- GOV-004 ---


def test_gov_r246_004_01_not_approved_404(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    resp = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}/approved-design",
        headers=admin_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_NOT_APPROVED"


def test_gov_r246_004_02_designing_200(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_designing(client, admin_headers, submit["workflowInstanceId"])
    resp = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}/approved-design",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_gov_r246_004_03_viewer_confirm_forbidden(client, admin_headers, viewer_headers):
    from app.auth.deps import UserContext, get_current_user

    submit = _submit_design(client, admin_headers)
    _to_designing(client, admin_headers, submit["workflowInstanceId"])

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000098", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.post(
            f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}/confirm-design",
            headers=viewer_headers,
        )
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r246_004_04_approver_confirm_pending_publish(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_designing(client, admin_headers, submit["workflowInstanceId"])
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}/confirm-design",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_publish"


def test_gov_r246_004_05_double_confirm_409(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    again = client.post(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}/confirm-design",
        headers=admin_headers,
    )
    assert again.status_code == 409


def test_gov_r246_004_06_query_design_readable_after_confirm(client, admin_headers):
    ref_id = str(uuid.uuid4())
    submit = _submit_design(client, admin_headers, ref_id)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    resp = client.get(f"/api/v1/gov/query-design?refId={ref_id}", headers=admin_headers)
    assert resp.status_code == 200


# --- GOV-005 ---


def test_gov_r246_005_01_publish_happy_path(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    resp = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    assert resp.status_code == 200
    inst = client.get(
        f"/api/v1/gov/workflow/instances/{submit['workflowInstanceId']}",
        headers=admin_headers,
    )
    assert inst.json()["status"] == "published"


def test_gov_r246_005_02_invalid_state_400(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    resp = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    assert resp.status_code == 400


def test_gov_r246_005_03_viewer_publish_forbidden(client, admin_headers, viewer_headers):
    from app.auth.deps import UserContext, get_current_user

    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000098", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.post(
            "/api/v1/gov/publish/from-workflow",
            headers=viewer_headers,
            json={"workflowInstanceId": submit["workflowInstanceId"]},
        )
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r246_005_04_idempotent_publish(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    first = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    second = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["catalogEntryId"] == second.json()["catalogEntryId"]
    assert second.json()["idempotent"] is True


def test_gov_r246_005_05_link_catalog_entry_id(client, admin_headers):
    ref_id = str(uuid.uuid4())
    submit = _submit_design(client, admin_headers, ref_id)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    link = client.get(f"/api/v1/designer/workflow-link?designerItemId={ref_id}", headers=admin_headers)
    assert link.json()["catalogEntryId"] == pub.json()["catalogEntryId"]


def test_gov_r246_005_06_rollback_version_history(client, admin_headers):
    from app.datasources.models import get_meta_session
    from app.governance.publish import service as publish_service

    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    entry_id = uuid.UUID(pub.json()["catalogEntryId"])
    session = get_meta_session()
    try:
        publish_service.rollback_entry_skeleton(session, entry_id)
        from app.query.config_store import service as config_store

        rec = config_store.get_config_by_ref(session, "publish_version_history", "catalog", entry_id)
        assert len(rec.payload["history"]) >= 1
    finally:
        session.close()


# --- GOV-006 ---


def test_gov_r246_006_01_openapi_after_publish(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    entry_id = pub.json()["catalogEntryId"]
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/openapi", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["openapi"] == "3.1.0"


def test_gov_r246_006_02_draft_openapi_422(client, admin_headers):
    created = client.post(
        "/api/v1/gov/catalog/entries",
        headers=admin_headers,
        json={
            "name": "draft svc",
            "httpMethod": "POST",
            "path": f"/api/v1/services/draft-{uuid.uuid4().hex[:6]}",
            "categoryCodes": ["CAT-02"],
        },
    )
    entry_id = created.json()["id"]
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/openapi", headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_DOC_NOT_PUBLISHED"


def test_gov_r246_006_03_redact_password_fields():
    from app.governance.openapi.service import redact_openapi_fields

    schema = {"type": "object", "properties": {"limit": {"type": "integer"}, "password_hash": {"type": "string"}}}
    out = redact_openapi_fields(schema)
    assert "password_hash" not in out["properties"]
    assert "limit" in out["properties"]


def test_gov_r246_006_04_probe_openapi_budget(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    from app.datasources.models import get_meta_session
    from app.governance.openapi.service import probe_generate_openapi_budget_ms

    entry_id = uuid.UUID(pub.json()["catalogEntryId"])
    session = get_meta_session()
    try:
        assert probe_generate_openapi_budget_ms(session, entry_id) <= 50
    finally:
        session.close()


def test_gov_r246_006_05_mapping_registered(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    entry_id = uuid.UUID(pub.json()["catalogEntryId"])
    from app.governance.openapi import service as openapi_service

    mappings = openapi_service.list_mappings(entry_id)
    assert len(mappings.items) >= 1


def test_gov_r246_006_06_openapi_operation_id(client, admin_headers):
    submit = _submit_design(client, admin_headers)
    _to_pending_publish(client, admin_headers, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=admin_headers,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    doc = client.get(
        f"/api/v1/gov/publish/entries/{pub.json()['catalogEntryId']}/openapi",
        headers=admin_headers,
    ).json()
    path_key = next(iter(doc["paths"]))
    op = doc["paths"][path_key]["post"]
    assert op["operationId"].startswith("query_")
