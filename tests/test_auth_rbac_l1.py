import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from jwt_auth import jwt_auth_headers
from app.auth.models import Base, get_meta_engine
from app.core.config import get_settings

_AUTH_RBAC_SQLITE_URL = "sqlite+pysqlite:///file:auth_rbac_test?mode=memory&cache=shared&uri=true"
_META_FALLBACK_SQLITE_URL = "sqlite+pysqlite:///file:vitalspan_meta_test?mode=memory&cache=shared&uri=true"


def _postgres_meta_available() -> bool:
    import socket

    try:
        with socket.create_connection(("127.0.0.1", 5432), timeout=1.0):
            return True
    except OSError:
        return False


@pytest.fixture(scope="module", autouse=True)
def auth_rbac_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _AUTH_RBAC_SQLITE_URL
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    elif _postgres_meta_available():
        os.environ["DATABASE_URL"] = previous
    else:
        os.environ["DATABASE_URL"] = _META_FALLBACK_SQLITE_URL
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


from app.main import app

get_settings.cache_clear()
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_auth_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        for table in (
            "auth_role_dimension_groups",
            "auth_role_dimension_values",
            "auth_dimension_group_values",
            "auth_dimension_groups",
            "auth_audit_events",
            "auth_dimension_type_refs",
            "auth_user_roles",
            "auth_resource_grants",
            "auth_dimension_types",
            "auth_org_nodes",
            "auth_users",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture(autouse=True)
def clean_auth_tables_between_tests():
    yield
    engine = get_meta_engine()
    with engine.begin() as conn:
        for table in (
            "auth_role_dimension_groups",
            "auth_role_dimension_values",
            "auth_dimension_group_values",
            "auth_dimension_groups",
            "auth_audit_events",
            "auth_dimension_type_refs",
            "auth_user_roles",
            "auth_resource_grants",
            "auth_dimension_types",
            "auth_org_nodes",
            "auth_users",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """RBAC 模块使用独立 sqlite 并在用例间清空 auth 表；每次请求前幂等 seed root admin。"""
    import conftest as _conftest

    _conftest._seed_ci_admin_user()
    return jwt_auth_headers()


from app.auth.deps import UserContext, get_current_user

_ADMIN_CTX = {
    "actor_id": "dev",
    "actor_username": "dev",
    "actor_roles": ["admin"],
    "trace_id": "test-trace",
}

_AUDIT_CTX = {
    "actor_id": "dev",
    "actor_username": "dev",
    "trace_id": "test-trace",
}


@pytest.fixture
def operator_client(client):
    async def _operator():
        return UserContext(id="op-1", username="operator", roles=["operator"])

    app.dependency_overrides[get_current_user] = _operator
    yield client
    app.dependency_overrides.pop(get_current_user, None)


def test_auth_rbac_infra_tables_exist():
    """T-AUTH-INFRA: auth 六表 create_all 成功。"""
    engine = get_meta_engine()
    tables = set(Base.metadata.tables.keys())
    for name in (
        "auth_roles",
        "auth_org_nodes",
        "auth_users",
        "auth_user_roles",
        "auth_resource_grants",
        "auth_dimension_types",
    ):
        assert name in tables
    assert engine is not None


def test_role_create_list_roundtrip(client, auth_headers):
    """T-AUTH-R01: POST 创建角色 roundtrip。"""
    payload = {"code": "analyst", "name": "Analyst", "description": "read only"}
    created = client.post("/api/v1/roles", json=payload, headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["code"] == "analyst"
    assert body["name"] == "Analyst"

    listed = client.get("/api/v1/roles", headers=auth_headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["items"]]
    assert body["id"] in ids


def test_role_duplicate_code_conflict(client, auth_headers):
    """T-AUTH-R02: 重复 code → 409 ROLE_CODE_CONFLICT。"""
    payload = {"code": "viewer", "name": "Viewer"}
    assert client.post("/api/v1/roles", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/roles", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "ROLE_CODE_CONFLICT"


def test_role_invalid_code_422(client, auth_headers):
    """T-AUTH-R03: 非法 code → 422。"""
    resp = client.post("/api/v1/roles", json={"code": "BAD", "name": "x"}, headers=auth_headers)
    assert resp.status_code == 422


def test_role_update_name(client, auth_headers):
    """T-AUTH-R04: PUT 更新 name；code 不变。"""
    created = client.post(
        "/api/v1/roles", json={"code": "editor", "name": "Editor"}, headers=auth_headers
    ).json()
    updated = client.put(
        f"/api/v1/roles/{created['id']}",
        json={"name": "Content Editor", "description": "d"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Content Editor"
    assert updated.json()["code"] == "editor"


def test_role_delete_idle(client, auth_headers):
    """T-AUTH-R05: DELETE 空闲角色 → 204；GET → 404。"""
    created = client.post(
        "/api/v1/roles", json={"code": "temp_role", "name": "Temp"}, headers=auth_headers
    ).json()
    deleted = client.delete(f"/api/v1/roles/{created['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/roles/{created['id']}", headers=auth_headers).status_code == 404


def test_openapi_contains_roles_paths(client):
    """T-AUTH-R06: OpenAPI 含 /api/v1/roles CRUD。"""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/roles" in paths
    assert "/api/v1/roles/{role_id}" in paths


def test_org_root_and_child_paths(client, auth_headers):
    """T-AUTH-O01: 根 level=0 path=/{id}；子 level=1。"""
    root = client.post("/api/v1/orgs", json={"name": "HQ"}, headers=auth_headers).json()
    assert root["level"] == 0
    assert root["path"] == f"/{root['id']}"

    child = client.post(
        "/api/v1/orgs",
        json={"name": "Branch", "parent_id": root["id"]},
        headers=auth_headers,
    ).json()
    assert child["level"] == 1
    assert child["path"].startswith(root["path"] + "/")


def test_org_invalid_parent_404(client, auth_headers):
    """T-AUTH-O02: 非法 parent_id → 404 ORG_PARENT_NOT_FOUND。"""
    import uuid

    resp = client.post(
        "/api/v1/orgs",
        json={"name": "x", "parent_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "ORG_PARENT_NOT_FOUND"


def test_org_move_cycle_409(client, auth_headers):
    """T-AUTH-O03: 移节点成环 → 409 ORG_CYCLE。"""
    root = client.post("/api/v1/orgs", json={"name": "R"}, headers=auth_headers).json()
    child = client.post(
        "/api/v1/orgs", json={"name": "C", "parent_id": root["id"]}, headers=auth_headers
    ).json()
    resp = client.put(
        f"/api/v1/orgs/{root['id']}",
        json={"parent_id": child["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ORG_CYCLE"


def test_org_delete_with_children_409(client, auth_headers):
    """T-AUTH-O04: 删除有子节点 → 409 ORG_HAS_CHILDREN。"""
    root = client.post("/api/v1/orgs", json={"name": "R"}, headers=auth_headers).json()
    client.post("/api/v1/orgs", json={"name": "C", "parent_id": root["id"]}, headers=auth_headers)
    resp = client.delete(f"/api/v1/orgs/{root['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ORG_HAS_CHILDREN"


def test_org_move_updates_subtree_paths(client, auth_headers):
    """T-AUTH-O05: 移中间节点后子孙 path 前缀正确。"""
    a = client.post("/api/v1/orgs", json={"name": "A"}, headers=auth_headers).json()
    b = client.post("/api/v1/orgs", json={"name": "B", "parent_id": a["id"]}, headers=auth_headers).json()
    c = client.post("/api/v1/orgs", json={"name": "C", "parent_id": b["id"]}, headers=auth_headers).json()
    d = client.post("/api/v1/orgs", json={"name": "D"}, headers=auth_headers).json()
    client.put(f"/api/v1/orgs/{b['id']}", json={"parent_id": d["id"]}, headers=auth_headers)
    items = {item["id"]: item for item in client.get("/api/v1/orgs", headers=auth_headers).json()["items"]}
    assert items[c["id"]]["path"].startswith(items[b["id"]]["path"] + "/")


def test_org_list_fields(client, auth_headers):
    """T-AUTH-O06: GET 列表含 parent_id/path/level。"""
    client.post("/api/v1/orgs", json={"name": "L"}, headers=auth_headers)
    item = client.get("/api/v1/orgs", headers=auth_headers).json()["items"][0]
    assert {"parent_id", "path", "level", "name", "id"} <= set(item.keys())


def test_user_bind_roles_roundtrip(client, auth_headers):
    """T-AUTH-U01: 创建用户 + 绑定角色。"""
    role = client.post("/api/v1/roles", json={"code": "bind_r1", "name": "R1"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_bind_1", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    bind = client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    assert bind.status_code == 200
    roles = client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]
    assert any(r["code"] == "bind_r1" for r in roles)


def test_user_bind_idempotent(client, auth_headers):
    """T-AUTH-U02: 重复 POST bind → 200；仅一行。"""
    role = client.post("/api/v1/roles", json={"code": "bind_r2", "name": "R2"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_bind_2", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    url = f"/api/v1/users/{user['id']}/roles/{role['id']}"
    assert client.post(url, headers=auth_headers).status_code == 200
    assert client.post(url, headers=auth_headers).status_code == 200
    assert len(client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]) == 1


def test_user_bind_invalid_role_404(client, auth_headers):
    """T-AUTH-U03: 非法 roleId → 404。"""
    import uuid

    user = client.post("/api/v1/users", json={"username": "u_bind_3", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    resp = client.post(f"/api/v1/users/{user['id']}/roles/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_user_unbind_not_found_404(client, auth_headers):
    """T-AUTH-U04: 解绑不存在 → 404 BINDING_NOT_FOUND。"""
    import uuid

    user = client.post("/api/v1/users", json={"username": "u_bind_4", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    resp = client.delete(f"/api/v1/users/{user['id']}/roles/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == "BINDING_NOT_FOUND"


def test_user_replace_roles(client, auth_headers):
    """T-AUTH-U05: PUT 全量替换 role_ids。"""
    r1 = client.post("/api/v1/roles", json={"code": "rep_r1", "name": "A"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "rep_r2", "name": "B"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "u_rep", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{r1['id']}", headers=auth_headers)
    client.put(
        f"/api/v1/users/{user['id']}/roles",
        json={"role_ids": [r2["id"]]},
        headers=auth_headers,
    )
    codes = [r["code"] for r in client.get(f"/api/v1/users/{user['id']}/roles", headers=auth_headers).json()["items"]]
    assert codes == ["rep_r2"]


def test_me_roles_from_db_dev_user(client, auth_headers):
    """T-AUTH-U06: 当前登录用户绑定 viewer 后 GET /me roles 含 viewer。

    Task 4 身份模型：auth_headers 解析为 DB 中真实 seed 的 root 管理员，不再有
    username=dev 中间件回退。故直接为当前登录用户追加 viewer 绑定，验证 /me
    角色聚合来自 DB（而非硬编码或回退身份）。
    """
    import uuid as _uuid

    from sqlalchemy import delete

    from app.auth.models import AuthUserRole, get_meta_session

    me_before = client.get("/api/v1/me", headers=auth_headers)
    assert me_before.status_code == 200
    current_user_id = me_before.json()["id"]

    role_resp = client.post(
        "/api/v1/roles", json={"code": "viewer", "name": "Viewer"}, headers=auth_headers
    )
    if role_resp.status_code == 201:
        role = role_resp.json()
    else:
        role = client.get(
            "/api/v1/roles?code_prefix=viewer&limit=1", headers=auth_headers
        ).json()["items"][0]

    bind = client.post(
        f"/api/v1/users/{current_user_id}/roles/{role['id']}", headers=auth_headers
    )
    assert bind.status_code in (200, 201, 204, 409)

    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.status_code == 200
    assert "viewer" in me.json()["roles"]

    # cleanup：移除本用例追加的 viewer 绑定，避免污染共享内存 DB（保留 root 用户本身）
    session = get_meta_session()
    try:
        session.execute(
            delete(AuthUserRole).where(
                AuthUserRole.user_id == _uuid.UUID(current_user_id),
                AuthUserRole.role_id == _uuid.UUID(role["id"]),
            )
        )
        session.commit()
    finally:
        session.close()


import uuid as uuid_mod

from app.auth.models import get_meta_session
from app.auth.resources.service import check_resource_access


def test_resource_grant_create_list(client, auth_headers):
    """T-AUTH-G01: POST 授权 datasource。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r1", "name": "G"}, headers=auth_headers).json()
    rid = str(uuid_mod.uuid4())
    created = client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": rid},
        headers=auth_headers,
    )
    assert created.status_code == 201
    items = client.get("/api/v1/resource-grants", headers=auth_headers).json()["items"]
    assert any(i["resource_id"] == rid for i in items)
    audit = client.get("/api/v1/audit/events?action=grant.create&limit=20", headers=auth_headers)
    assert audit.status_code == 200
    assert any(e["action"] == "grant.create" for e in audit.json()["items"])


def test_resource_grant_duplicate_409(client, auth_headers):
    """T-AUTH-G02: 重复授权 → 409 GRANT_ALREADY_EXISTS。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r2", "name": "G"}, headers=auth_headers).json()
    rid = str(uuid_mod.uuid4())
    payload = {"role_id": role["id"], "resource_type": "datasource", "resource_id": rid}
    assert client.post("/api/v1/resource-grants", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/resource-grants", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "GRANT_ALREADY_EXISTS"


def test_resource_grant_invalid_role_404(client, auth_headers):
    """T-AUTH-G03: 非法 role_id → 404。"""
    resp = client.post(
        "/api/v1/resource-grants",
        json={"role_id": str(uuid_mod.uuid4()), "resource_type": "dashboard", "resource_id": str(uuid_mod.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_check_resource_access_positive(client, auth_headers):
    """T-AUTH-G04: 授权角色 → check_resource_access True。"""
    role = client.post("/api/v1/roles", json={"code": "grant_r4", "name": "G"}, headers=auth_headers).json()
    rid = uuid_mod.uuid4()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(rid)},
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        assert check_resource_access(session, ["grant_r4"], "datasource", rid) is True
    finally:
        session.close()


def test_check_resource_access_negative(client, auth_headers):
    """T-AUTH-G05: 未授权角色 → False。"""
    session = get_meta_session()
    try:
        assert check_resource_access(session, ["unknown"], "datasource", uuid_mod.uuid4()) is False
    finally:
        session.close()


def test_dimension_type_create(client, auth_headers):
    """T-AUTH-D01: POST 注册维度类型。"""
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "region", "name": "Region", "value_type": "string"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["code"] == "region"
    assert body["value_type"] == "string"


def test_dimension_type_duplicate_409(client, auth_headers):
    """T-AUTH-D02: 重复 code → 409。"""
    payload = {"code": "dup_dim", "name": "D", "value_type": "number"}
    assert client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers).status_code == 201
    assert client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers).status_code == 409


def test_dimension_type_org_ref_sets_flag(client, auth_headers):
    """T-AUTH-D03: value_type=org_ref → org_dimension=true。"""
    client.post("/api/v1/orgs", json={"name": "OrgRoot"}, headers=auth_headers)
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "organization", "name": "Organization", "value_type": "org_ref"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["org_dimension"] is True


def test_dimension_type_update_name(client, auth_headers):
    """T-AUTH-D04: PUT 更新 name。"""
    created = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "dim_upd", "name": "Old", "value_type": "boolean"},
        headers=auth_headers,
    ).json()
    updated = client.put(
        f"/api/v1/rls/dimensions/{created['id']}",
        json={"name": "New"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "New"


def test_dimension_type_delete_idle(client, auth_headers):
    """T-AUTH-D05: DELETE 空闲类型 → 204。"""
    created = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "dim_del", "name": "Del", "value_type": "string"},
        headers=auth_headers,
    ).json()
    assert client.delete(f"/api/v1/rls/dimensions/{created['id']}", headers=auth_headers).status_code == 204


from app.auth.resources.service import (
    VisibilityError,
    ensure_resource_visible,
    list_visible_resource_ids,
)


def test_grant_revoke_visibility(client, auth_headers):
    """T-AUTH-G06: 撤权后 ensure_resource_visible 抛 403 RESOURCE_FORBIDDEN。"""
    role = client.post("/api/v1/roles", json={"code": "vis_r1", "name": "V"}, headers=auth_headers).json()
    rid = uuid_mod.uuid4()
    grant = client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(rid)},
        headers=auth_headers,
    ).json()
    session = get_meta_session()
    try:
        ensure_resource_visible(session, ["vis_r1"], "datasource", rid)
    finally:
        session.close()
    client.delete(f"/api/v1/resource-grants/{grant['id']}", headers=auth_headers)
    session = get_meta_session()
    try:
        with pytest.raises(VisibilityError) as exc:
            ensure_resource_visible(session, ["vis_r1"], "datasource", rid)
        assert exc.value.code == "RESOURCE_FORBIDDEN"
        assert exc.value.status == 403
    finally:
        session.close()


def test_horizontal_privilege_denied(client, auth_headers):
    """T-AUTH-G07: role_a 授权、role_b 未授权 → check False。"""
    role_a = client.post("/api/v1/roles", json={"code": "role_a", "name": "A"}, headers=auth_headers).json()
    client.post("/api/v1/roles", json={"code": "role_b", "name": "B"}, headers=auth_headers)
    rid = uuid_mod.uuid4()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role_a["id"], "resource_type": "dashboard", "resource_id": str(rid)},
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        assert check_resource_access(session, ["role_b"], "dashboard", rid) is False
    finally:
        session.close()


def test_list_visible_resource_ids(client, auth_headers):
    """T-AUTH-G08: 两角色各一资源 → 合并 role_codes 返回 2 个 id。"""
    r1 = client.post("/api/v1/roles", json={"code": "lv_r1", "name": "1"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "lv_r2", "name": "2"}, headers=auth_headers).json()
    id1, id2 = uuid_mod.uuid4(), uuid_mod.uuid4()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": r1["id"], "resource_type": "report", "resource_id": str(id1)},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": r2["id"], "resource_type": "report", "resource_id": str(id2)},
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        visible = list_visible_resource_ids(session, ["lv_r1", "lv_r2"], "report")
        assert set(visible) == {id1, id2}
    finally:
        session.close()


def test_invalid_resource_type_422():
    """T-AUTH-G09: 非法 resource_type → 422 INVALID_RESOURCE_TYPE。"""
    session = get_meta_session()
    try:
        with pytest.raises(VisibilityError) as exc:
            ensure_resource_visible(session, ["any"], "widget", uuid_mod.uuid4())
        assert exc.value.code == "INVALID_RESOURCE_TYPE"
        assert exc.value.status == 422
    finally:
        session.close()


def test_empty_roles_forbidden():
    """T-AUTH-G10: role_codes=[] → ensure 403。"""
    session = get_meta_session()
    try:
        with pytest.raises(VisibilityError) as exc:
            ensure_resource_visible(session, [], "datasource", uuid_mod.uuid4())
        assert exc.value.code == "RESOURCE_FORBIDDEN"
        assert exc.value.status == 403
    finally:
        session.close()


from app.auth.org import service as org_service
from app.auth.users import service as users_service


def test_user_org_bind_roundtrip(client, auth_headers):
    """T-AUTH-OU01: 建 org + user → assign → get_user_org 一致。"""
    org = client.post("/api/v1/orgs", json={"name": "Dept"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "ou_user", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        users_service.assign_user_org(
            session, uuid_mod.UUID(user["id"]), uuid_mod.UUID(org["id"]), **_ADMIN_CTX
        )
        node = users_service.get_user_org(session, uuid_mod.UUID(user["id"]))
        assert node is not None
        assert str(node.id) == org["id"]
    finally:
        session.close()


def test_user_org_idempotent(client, auth_headers):
    """T-AUTH-OU02: 重复 assign 同 org 仍成功。"""
    org = client.post("/api/v1/orgs", json={"name": "Dept2"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "ou_idem", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        uid, oid = uuid_mod.UUID(user["id"]), uuid_mod.UUID(org["id"])
        users_service.assign_user_org(session, uid, oid, **_ADMIN_CTX)
        users_service.assign_user_org(session, uid, oid, **_ADMIN_CTX)
        assert users_service.get_user_org(session, uid).id == oid
    finally:
        session.close()


def test_user_org_invalid_org_404(client, auth_headers):
    """T-AUTH-OU03: assign 随机 org UUID → 404 ORG_NOT_FOUND。"""
    user = client.post("/api/v1/users", json={"username": "ou_bad", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        with pytest.raises(users_service.UserError) as exc:
            users_service.assign_user_org(session, uuid_mod.UUID(user["id"]), uuid_mod.uuid4(), **_ADMIN_CTX)
        assert exc.value.code == "ORG_NOT_FOUND"
        assert exc.value.status == 404
    finally:
        session.close()


def test_user_org_clear(client, auth_headers):
    """T-AUTH-OU04: clear 后 get → None。"""
    org = client.post("/api/v1/orgs", json={"name": "Clr"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "ou_clr", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        uid, oid = uuid_mod.UUID(user["id"]), uuid_mod.UUID(org["id"])
        users_service.assign_user_org(session, uid, oid, **_ADMIN_CTX)
        users_service.clear_user_org(session, uid, **_ADMIN_CTX)
        assert users_service.get_user_org(session, uid) is None
    finally:
        session.close()


def test_delete_org_with_users_409(client, auth_headers):
    """T-AUTH-O07: 用户绑定叶子 org → delete → 409 ORG_HAS_USERS。"""
    org = client.post("/api/v1/orgs", json={"name": "Leaf"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "leaf_u", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        users_service.assign_user_org(
            session, uuid_mod.UUID(user["id"]), uuid_mod.UUID(org["id"]), **_ADMIN_CTX
        )
        with pytest.raises(org_service.OrgError) as exc:
            org_service.delete_org_node(session, uuid_mod.UUID(org["id"]), **_AUDIT_CTX)
        assert exc.value.code == "ORG_HAS_USERS"
        assert exc.value.status == 409
    finally:
        session.close()


def test_delete_idle_leaf_org_204(client, auth_headers):
    """T-AUTH-O08: 空闲叶子 → delete 成功。"""
    org = client.post("/api/v1/orgs", json={"name": "IdleLeaf"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        org_service.delete_org_node(session, uuid_mod.UUID(org["id"]), **_AUDIT_CTX)
    finally:
        session.close()


def test_org_orphan_parent_still_404(client, auth_headers):
    """T-AUTH-O09: 孤儿 parent 创建 → 404 ORG_PARENT_NOT_FOUND（回归）。"""
    resp = client.post(
        "/api/v1/orgs",
        json={"name": "Orphan", "parent_id": str(uuid_mod.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "ORG_PARENT_NOT_FOUND"


def test_user_org_http_roundtrip(client, auth_headers):
    """T-AUTH-O10: PUT/GET/DELETE user-org HTTP 状态码与 body 一致。"""
    org = client.post("/api/v1/orgs", json={"name": "HttpOrg"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "http_ou", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    put = client.put(
        f"/api/v1/users/{user['id']}/org",
        json={"org_node_id": org["id"]},
        headers=auth_headers,
    )
    assert put.status_code == 200
    got = client.get(f"/api/v1/users/{user['id']}/org", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["id"] == org["id"]
    deleted = client.delete(f"/api/v1/users/{user['id']}/org", headers=auth_headers)
    assert deleted.status_code == 204
    missing = client.get(f"/api/v1/users/{user['id']}/org", headers=auth_headers)
    assert missing.status_code == 404
    assert missing.json()["code"] == "USER_ORG_NOT_SET"


def test_dimension_delete_org_ref_in_use(client, auth_headers):
    """T-AUTH-D06: org_ref 维度 + org 节点存在 → DELETE 409 DIMENSION_IN_USE。"""
    client.post("/api/v1/orgs", json={"name": "OrgDim"}, headers=auth_headers)
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "org_dim", "name": "Org", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    resp = client.delete(f"/api/v1/rls/dimensions/{dim['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "DIMENSION_IN_USE"


def test_dimension_delete_idle_non_org(client, auth_headers):
    """T-AUTH-D07: 空闲非 org 维度 → 204（回归 D05）。"""
    created = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "free_dim", "name": "Free", "value_type": "string"},
        headers=auth_headers,
    ).json()
    assert client.delete(f"/api/v1/rls/dimensions/{created['id']}", headers=auth_headers).status_code == 204


def test_dimension_invalid_value_type_422(client, auth_headers):
    """T-AUTH-D08: value_type=map → 422。"""
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "bad_vt", "name": "Bad", "value_type": "map"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_bind_roles_batch(client, auth_headers):
    """T-AUTH-U07: 批量绑定两角色 → GET roles 含 2 codes。"""
    r1 = client.post("/api/v1/roles", json={"code": "batch_a", "name": "A"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "batch_b", "name": "B"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "batch_u", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        roles = users_service.bind_roles_batch(
            session,
            uuid_mod.UUID(user["id"]),
            [uuid_mod.UUID(r1["id"]), uuid_mod.UUID(r2["id"])],
            **_ADMIN_CTX,
        )
        codes = {r.code for r in roles}
        assert codes == {"batch_a", "batch_b"}
    finally:
        session.close()


def test_bind_invalid_user_404(client, auth_headers):
    """T-AUTH-U08: 随机 user UUID bind → 404 USER_NOT_FOUND。"""
    role = client.post("/api/v1/roles", json={"code": "bind_u8", "name": "R"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        with pytest.raises(users_service.UserError) as exc:
            users_service.bind_role(session, uuid_mod.uuid4(), uuid_mod.UUID(role["id"]), **_ADMIN_CTX)
        assert exc.value.code == "USER_NOT_FOUND"
    finally:
        session.close()


def test_me_after_unbind(client, auth_headers):
    """T-AUTH-U09: 当前登录用户绑定 a+b → 解绑 a → /me 含 b 不含 a。

    Task 4 身份模型：auth_headers 解析为真实 seed 用户，直接对当前用户增删绑定。
    """
    from sqlalchemy import delete

    from app.auth.models import AuthUserRole

    ra = client.post("/api/v1/roles", json={"code": "me_a", "name": "A"}, headers=auth_headers).json()
    rb = client.post("/api/v1/roles", json={"code": "me_b", "name": "B"}, headers=auth_headers).json()
    current_user_id = client.get("/api/v1/me", headers=auth_headers).json()["id"]
    client.post(f"/api/v1/users/{current_user_id}/roles/{ra['id']}", headers=auth_headers)
    client.post(f"/api/v1/users/{current_user_id}/roles/{rb['id']}", headers=auth_headers)
    client.delete(f"/api/v1/users/{current_user_id}/roles/{ra['id']}", headers=auth_headers)
    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.status_code == 200
    roles = me.json()["roles"]
    assert "me_b" in roles
    assert "me_a" not in roles
    # cleanup：移除本用例追加的 me_b 绑定，避免污染共享内存 DB
    session = get_meta_session()
    try:
        session.execute(
            delete(AuthUserRole).where(
                AuthUserRole.user_id == uuid_mod.UUID(current_user_id),
                AuthUserRole.role_id == uuid_mod.UUID(rb["id"]),
            )
        )
        session.commit()
    finally:
        session.close()


def test_me_roles_sorted(client, auth_headers):
    """T-AUTH-U10: 多角色 me roles 按 code 字典序。"""
    r1 = client.post("/api/v1/roles", json={"code": "z_role", "name": "Z"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "a_role", "name": "A"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "dev", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    admin_resp = client.post("/api/v1/roles", json={"code": "admin", "name": "Admin"}, headers=auth_headers)
    if admin_resp.status_code == 201:
        admin_id = admin_resp.json()["id"]
    else:
        admin_id = client.get("/api/v1/roles?code_prefix=admin&limit=1", headers=auth_headers).json()["items"][0]["id"]
    session = get_meta_session()
    try:
        users_service.bind_role(session, uuid_mod.UUID(user["id"]), uuid_mod.UUID(admin_id), **_ADMIN_CTX)
    finally:
        session.close()
    client.put(
        f"/api/v1/users/{user['id']}/roles",
        json={"role_ids": [r1["id"], r2["id"]]},
        headers=auth_headers,
    )
    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.json()["roles"] == sorted(me.json()["roles"])


def test_role_delete_with_user_binding_409(client, auth_headers):
    """T-AUTH-R07: bind user → DELETE role → 409 ROLE_IN_USE。"""
    role = client.post("/api/v1/roles", json={"code": "in_use", "name": "IU"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "iu_user", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    resp = client.delete(f"/api/v1/roles/{role['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ROLE_IN_USE"


def test_role_empty_name_422(client, auth_headers):
    """T-AUTH-R08: POST name=\"\" → 422。"""
    resp = client.post("/api/v1/roles", json={"code": "empty_nm", "name": ""}, headers=auth_headers)
    assert resp.status_code == 422


def test_role_list_limit(client, auth_headers):
    """T-AUTH-R09: 创建 3 角色；GET ?limit=2 → items 长度 ≤2。"""
    for code in ("lim_a", "lim_b", "lim_c"):
        client.post("/api/v1/roles", json={"code": code, "name": code}, headers=auth_headers)
    resp = client.get("/api/v1/roles?limit=2", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 2


def test_audit_bind_role_writes_event(client, auth_headers):
    """T-AUTH-A01: bind_role 写审计。"""
    role = client.post("/api/v1/roles", json={"code": "aud_r", "name": "A"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_u", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    assert client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers).status_code == 200
    audit = client.get(f"/api/v1/audit/events?target_id={user['id']}", headers=auth_headers).json()
    assert audit["total"] >= 1
    actions = [i["action"] for i in audit["items"]]
    assert "user.role.bind" in actions
    row = next(i for i in audit["items"] if i["action"] == "user.role.bind")
    assert row["actor_id"]
    assert row["trace_id"]


def test_audit_unbind_writes_event(client, auth_headers):
    """T-AUTH-A02: unbind 留痕。"""
    role = client.post("/api/v1/roles", json={"code": "aud_u2", "name": "A"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_u2", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    assert client.delete(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers).status_code == 204
    audit = client.get(f"/api/v1/audit/events?target_id={user['id']}", headers=auth_headers).json()
    assert "user.role.unbind" in [i["action"] for i in audit["items"]]


def test_audit_replace_roles_writes_event(client, auth_headers):
    """T-AUTH-A03: replace_roles 留痕且 detail 含 role_ids。"""
    r1 = client.post("/api/v1/roles", json={"code": "aud_rp1", "name": "1"}, headers=auth_headers).json()
    r2 = client.post("/api/v1/roles", json={"code": "aud_rp2", "name": "2"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_rp", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.put(
        f"/api/v1/users/{user['id']}/roles",
        json={"role_ids": [r1["id"], r2["id"]]},
        headers=auth_headers,
    )
    audit = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.roles.replace",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1
    assert audit["items"][0]["detail"] is not None


def test_audit_org_assign_and_clear(client, auth_headers):
    """T-AUTH-A04: assign_org / clear_org 对应 action。"""
    org = client.post("/api/v1/orgs", json={"name": "AudOrg"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_org", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.put(f"/api/v1/users/{user['id']}/org", json={"org_node_id": org["id"]}, headers=auth_headers)
    client.delete(f"/api/v1/users/{user['id']}/org", headers=auth_headers)
    audit = client.get(f"/api/v1/audit/events?target_id={user['id']}", headers=auth_headers).json()
    actions = {i["action"] for i in audit["items"]}
    assert "user.org.assign" in actions
    assert "user.org.clear" in actions


def test_audit_idempotent_bind_no_duplicate(client, auth_headers):
    """T-AUTH-A05: 幂等 bind 不增加审计条数。"""
    role = client.post("/api/v1/roles", json={"code": "aud_idem", "name": "I"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_idem", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    before = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.role.bind",
        headers=auth_headers,
    ).json()["total"]
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    after = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.role.bind",
        headers=auth_headers,
    ).json()["total"]
    assert after == before


def test_audit_invalid_user_no_row(client, auth_headers):
    """T-AUTH-A06: 非法 userId bind → 404 且无审计。"""
    role = client.post("/api/v1/roles", json={"code": "aud_bad", "name": "B"}, headers=auth_headers).json()
    fake_user = str(uuid_mod.uuid4())
    resp = client.post(f"/api/v1/users/{fake_user}/roles/{role['id']}", headers=auth_headers)
    assert resp.status_code == 404
    audit = client.get(f"/api/v1/audit/events?target_id={fake_user}", headers=auth_headers).json()
    assert audit["total"] == 0


def test_audit_concurrent_bind_at_most_one(client, auth_headers):
    """T-AUTH-A07: 连续两次 bind 同一对 → 审计至多 1 条 bind。"""
    role = client.post("/api/v1/roles", json={"code": "aud_con", "name": "C"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_con", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    total = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.role.bind",
        headers=auth_headers,
    ).json()["total"]
    assert total == 1


def test_binding_forbidden_non_admin(client, auth_headers):
    """T-AUTH-A08: 无功能权限 operator → 403 PERMISSION_DENIED；无审计。"""
    role = client.post("/api/v1/roles", json={"code": "aud_op", "name": "O"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_op", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()

    async def _operator():
        return UserContext(id="op-1", username="operator", roles=["operator"])

    app.dependency_overrides[get_current_user] = _operator
    try:
        resp = client.post(
            f"/api/v1/users/{user['id']}/roles/{role['id']}",
            headers=jwt_auth_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"
    audit = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.role.bind",
        headers=auth_headers,
    ).json()
    assert audit["total"] == 0


def test_audit_pagination_limit_offset(client, auth_headers):
    """T-AUTH-A09: 审计分页 limit/offset/total。"""
    role = client.post("/api/v1/roles", json={"code": "aud_pg", "name": "P"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "aud_pg", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    for i in range(3):
        r = client.post(
            "/api/v1/roles",
            json={"code": f"aud_pg_r{i}", "name": f"R{i}"},
            headers=auth_headers,
        ).json()
        client.post(f"/api/v1/users/{user['id']}/roles/{r['id']}", headers=auth_headers)
        client.delete(f"/api/v1/users/{user['id']}/roles/{r['id']}", headers=auth_headers)
    page = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&limit=2&offset=0",
        headers=auth_headers,
    ).json()
    assert len(page["items"]) <= 2
    assert page["total"] >= 3


def test_dimension_duplicate_code_regression(client, auth_headers):
    """T-AUTH-D09: 重复 code → 409 DIMENSION_CODE_CONFLICT。"""
    payload = {"code": "dup_dim_r19", "name": "D", "value_type": "string"}
    assert client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/rls/dimensions", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "DIMENSION_CODE_CONFLICT"


def test_dimension_invalid_value_type_regression(client, auth_headers):
    """T-AUTH-D10: value_type=map → 422。"""
    resp = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "bad_vt_r19", "name": "B", "value_type": "map"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_dimension_delete_with_refs_409(client, auth_headers):
    """T-AUTH-D11: auth_dimension_type_refs 存在 → 409 DIMENSION_IN_USE。"""
    from app.auth.models import AuthDimensionTypeRef, get_meta_session

    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "ref_dim", "name": "R", "value_type": "string"},
        headers=auth_headers,
    ).json()
    session = get_meta_session()
    try:
        session.add(AuthDimensionTypeRef(dimension_type_id=uuid_mod.UUID(dim["id"]), ref_source="group"))
        session.commit()
    finally:
        session.close()
    resp = client.delete(f"/api/v1/rls/dimensions/{dim['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "DIMENSION_IN_USE"


def test_dimension_list_pagination_performance(client, auth_headers):
    """T-AUTH-D12: 60 类型分页 limit=50；耗时 <2s。"""
    import time

    for i in range(60):
        client.post(
            "/api/v1/rls/dimensions",
            json={"code": f"perf_d{i:02d}", "name": f"P{i}", "value_type": "string"},
            headers=auth_headers,
        )
    start = time.perf_counter()
    resp = client.get("/api/v1/rls/dimensions?limit=50", headers=auth_headers)
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 50
    assert body["total"] >= 60
    assert elapsed < 2.0


def test_role_code_format_boundary(client, auth_headers):
    """T-AUTH-R13: code 过短 → 422；合法 ab → 201。"""
    assert client.post("/api/v1/roles", json={"code": "A", "name": "x"}, headers=auth_headers).status_code == 422
    assert client.post("/api/v1/roles", json={"code": "x", "name": "x"}, headers=auth_headers).status_code == 422
    ok = client.post("/api/v1/roles", json={"code": "ab", "name": "OK"}, headers=auth_headers)
    assert ok.status_code == 201


def test_role_delete_bound_regression(client, auth_headers):
    """T-AUTH-R14: 删除已绑定角色 → 409 ROLE_IN_USE（回归 R07）。"""
    role = client.post("/api/v1/roles", json={"code": "bound_r19", "name": "B"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "bound_u19", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    resp = client.delete(f"/api/v1/roles/{role['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ROLE_IN_USE"


def test_role_list_filter_sort(client, auth_headers):
    """T-AUTH-R15: code_prefix + limit 边界。"""
    client.post("/api/v1/roles", json={"code": "pre_a", "name": "A"}, headers=auth_headers)
    client.post("/api/v1/roles", json={"code": "pre_b", "name": "B"}, headers=auth_headers)
    resp = client.get("/api/v1/roles?code_prefix=pre_&limit=1", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    codes = [i["code"] for i in items]
    assert codes == sorted(codes)


def test_org_depth_exceeded(client, auth_headers):
    """T-AUTH-O11: 链式 32 层后再加子 → 422 ORG_DEPTH_EXCEEDED。"""
    parent_id = None
    for i in range(32):
        payload = {"name": f"L{i}"}
        if parent_id:
            payload["parent_id"] = parent_id
        node = client.post("/api/v1/orgs", json=payload, headers=auth_headers).json()
        parent_id = node["id"]
    resp = client.post("/api/v1/orgs", json={"name": "TooDeep", "parent_id": parent_id}, headers=auth_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "ORG_DEPTH_EXCEEDED"


def test_org_move_subtree_regression(client, auth_headers):
    """T-AUTH-O12: 移节点子树 path 更新（回归 O05）。"""
    a = client.post("/api/v1/orgs", json={"name": "DA"}, headers=auth_headers).json()
    b = client.post("/api/v1/orgs", json={"name": "DB", "parent_id": a["id"]}, headers=auth_headers).json()
    c = client.post("/api/v1/orgs", json={"name": "DC", "parent_id": b["id"]}, headers=auth_headers).json()
    d = client.post("/api/v1/orgs", json={"name": "DD"}, headers=auth_headers).json()
    client.put(f"/api/v1/orgs/{b['id']}", json={"parent_id": d["id"]}, headers=auth_headers)
    items = {i["id"]: i for i in client.get("/api/v1/orgs", headers=auth_headers).json()["items"]}
    assert items[c["id"]]["path"].startswith(items[d["id"]]["path"])


def test_org_delete_with_children_regression(client, auth_headers):
    """T-AUTH-O13: 删除有子节点 → 409 ORG_HAS_CHILDREN（回归 O04）。"""
    root = client.post("/api/v1/orgs", json={"name": "R19"}, headers=auth_headers).json()
    client.post("/api/v1/orgs", json={"name": "C19", "parent_id": root["id"]}, headers=auth_headers)
    resp = client.delete(f"/api/v1/orgs/{root['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ORG_HAS_CHILDREN"


from app.auth.models import get_meta_session
from app.auth.resources.service import (
    VisibilityError,
    check_resource_access,
    delete_grants_batch,
    ensure_resource_visible,
    list_visible_resource_ids,
)


def test_multi_resource_type_visibility(client, auth_headers):
    """T-AUTH-G11: datasource/dashboard/report 各授权可见。"""
    role = client.post("/api/v1/roles", json={"code": "multi_rt", "name": "M"}, headers=auth_headers).json()
    ids = {t: uuid_mod.uuid4() for t in ("datasource", "dashboard", "report")}
    for rtype, rid in ids.items():
        client.post(
            "/api/v1/resource-grants",
            json={"role_id": role["id"], "resource_type": rtype, "resource_id": str(rid)},
            headers=auth_headers,
        )
    session = get_meta_session()
    try:
        for rtype, rid in ids.items():
            visible = list_visible_resource_ids(session, ["multi_rt"], rtype)
            assert rid in visible
    finally:
        session.close()


def test_delete_grants_batch(client, auth_headers):
    """T-AUTH-G12: delete_grants_batch 撤权后 check False。"""
    role = client.post("/api/v1/roles", json={"code": "batch_g", "name": "B"}, headers=auth_headers).json()
    grant_ids = []
    rid = uuid_mod.uuid4()
    for _ in range(3):
        g = client.post(
            "/api/v1/resource-grants",
            json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(rid)},
            headers=auth_headers,
        )
        if g.status_code == 201:
            grant_ids.append(uuid_mod.UUID(g.json()["id"]))
    session = get_meta_session()
    try:
        deleted = delete_grants_batch(session, grant_ids)
        assert deleted == len(grant_ids)
        assert check_resource_access(session, ["batch_g"], "datasource", rid) is False
    finally:
        session.close()


def test_resource_horizontal_forbidden_matrix(client, auth_headers):
    """T-AUTH-G13: role_a 仅 ds1；role_b 仅 ds2；交叉 ensure → 403。"""
    role_a = client.post("/api/v1/roles", json={"code": "role_a_g", "name": "A"}, headers=auth_headers).json()
    client.post("/api/v1/roles", json={"code": "role_b_g", "name": "B"}, headers=auth_headers)
    ds1, ds2 = uuid_mod.uuid4(), uuid_mod.uuid4()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role_a["id"], "resource_type": "datasource", "resource_id": str(ds1)},
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        ensure_resource_visible(session, ["role_a_g"], "datasource", ds1)
        with pytest.raises(VisibilityError) as exc:
            ensure_resource_visible(session, ["role_b_g"], "datasource", ds1)
        assert exc.value.code == "RESOURCE_FORBIDDEN"
    finally:
        session.close()


def test_resource_vertical_forbidden_regression(client, auth_headers):
    """T-AUTH-G14: 空 roles / 未授权 resource → 403。"""
    session = get_meta_session()
    try:
        with pytest.raises(VisibilityError) as exc1:
            ensure_resource_visible(session, [], "datasource", uuid_mod.uuid4())
        assert exc1.value.code == "RESOURCE_FORBIDDEN"
        with pytest.raises(VisibilityError) as exc2:
            ensure_resource_visible(session, ["nobody"], "datasource", uuid_mod.uuid4())
        assert exc2.value.code == "RESOURCE_FORBIDDEN"
    finally:
        session.close()


def _ensure_org_dim(client, auth_headers):
    org = client.post("/api/v1/orgs", json={"name": "RLS Root"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "org_dim_gp", "name": "Org", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    return org, dim


def _put_dimension_values(client, auth_headers, role_id, dim_id, values, *, version=0, confirm_empty=False):
    resp = client.put(
        f"/api/v1/roles/{role_id}/dimension-values",
        json={
            "dimensionTypeId": dim_id,
            "values": values,
            "expectedVersion": version,
            "confirmEmpty": confirm_empty,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    return resp.json()


def _put_dimension_groups(client, auth_headers, role_id, group_ids, *, version=0, confirm_empty=False):
    resp = client.put(
        f"/api/v1/roles/{role_id}/dimension-groups",
        json={
            "groupIds": group_ids,
            "expectedVersion": version,
            "confirmEmpty": confirm_empty,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    return resp.json()


def test_group_create_root_gp01(client, auth_headers):
    """T-AUTH-GP01: POST 创建根分组。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    resp = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "east", "name": "East"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["dimension_type_id"] == dim["id"]
    listed = client.get(f"/api/v1/rls/groups?dimension_type_id={dim['id']}", headers=auth_headers).json()
    assert any(g["id"] == body["id"] for g in listed["items"])


def test_group_duplicate_code_gp02(client, auth_headers):
    """T-AUTH-GP02: 重复 code → 409 GROUP_CODE_CONFLICT。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    payload = {"dimension_type_id": dim["id"], "code": "dup_gp", "name": "D"}
    assert client.post("/api/v1/rls/groups", json=payload, headers=auth_headers).status_code == 201
    dup = client.post("/api/v1/rls/groups", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["code"] == "GROUP_CODE_CONFLICT"


def test_group_invalid_dimension_gp03(client, auth_headers):
    """T-AUTH-GP03: 非法 dimension_type_id → 404 DIMENSION_NOT_FOUND。"""
    fake = str(uuid_mod.uuid4())
    resp = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": fake, "code": "bad", "name": "B"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DIMENSION_NOT_FOUND"


def test_group_cycle_gp04(client, auth_headers):
    """T-AUTH-GP04: 更新分组形成环 → 409 GROUP_CYCLE。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    parent = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_p", "name": "P"},
        headers=auth_headers,
    ).json()
    child = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_c", "name": "C", "parent_id": parent["id"]},
        headers=auth_headers,
    ).json()
    resp = client.put(
        f"/api/v1/rls/groups/{parent['id']}",
        json={"parent_id": child["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "GROUP_CYCLE"


def test_group_values_add_list_gp05_gp06(client, auth_headers):
    """T-AUTH-GP05~GP06: 分组成员值添加与列表。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_vals", "name": "V"},
        headers=auth_headers,
    ).json()
    add = client.post(
        f"/api/v1/rls/groups/{group['id']}/values",
        json={"values": [org["id"]]},
        headers=auth_headers,
    )
    assert add.status_code == 200
    assert org["id"] in add.json()["items"]
    listed = client.get(f"/api/v1/rls/groups/{group['id']}/values", headers=auth_headers).json()
    assert org["id"] in listed["items"]


def test_role_dimension_values_gp07(client, auth_headers):
    """T-AUTH-GP07: 角色直绑维度值。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = client.post("/api/v1/roles", json={"code": "gp_r7", "name": "R"}, headers=auth_headers).json()
    body = _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org["id"]])
    assert body["values"] == [org["id"]]
    assert body["version"] == 1
    eff = client.get(
        f"/api/v1/roles/{role['id']}/effective-dimensions?dimension_type_id={dim['id']}",
        headers=auth_headers,
    ).json()
    assert org["id"] in eff["values"]


def test_role_dimension_groups_effective_gp08(client, auth_headers):
    """T-AUTH-GP08: 角色分组绑定 → 有效维度集含分组值。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_g8", "name": "G"},
        headers=auth_headers,
    ).json()
    client.post(
        f"/api/v1/rls/groups/{group['id']}/values",
        json={"values": [org["id"]]},
        headers=auth_headers,
    )
    role = client.post("/api/v1/roles", json={"code": "gp_r8", "name": "R"}, headers=auth_headers).json()
    body = _put_dimension_groups(client, auth_headers, role["id"], [group["id"]])
    assert body["groupIds"] == [group["id"]]
    assert body["version"] == 1
    eff = client.get(
        f"/api/v1/roles/{role['id']}/effective-dimensions?dimension_type_id={dim['id']}",
        headers=auth_headers,
    ).json()
    assert org["id"] in eff["values"]


def test_group_values_idempotent_gp09(client, auth_headers):
    """T-AUTH-GP09: 重复添加分组成员值幂等。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_idem", "name": "I"},
        headers=auth_headers,
    ).json()
    payload = {"values": [org["id"]]}
    client.post(f"/api/v1/rls/groups/{group['id']}/values", json=payload, headers=auth_headers)
    again = client.post(f"/api/v1/rls/groups/{group['id']}/values", json=payload, headers=auth_headers)
    assert again.status_code == 200
    assert again.json()["items"].count(org["id"]) == 1


def test_role_dimension_invalid_role_gp10(client, auth_headers):
    """T-AUTH-GP10: 非法 roleId → 404 ROLE_NOT_FOUND。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    fake_role = str(uuid_mod.uuid4())
    resp = client.put(
        f"/api/v1/roles/{fake_role}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [],
            "expectedVersion": 0,
            "confirmEmpty": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "ROLE_NOT_FOUND"


def test_group_binding_forbidden_non_admin_gp11(client, auth_headers):
    """T-AUTH-GP11: 无功能权限写分组 → 403 PERMISSION_DENIED。"""
    _, dim = _ensure_org_dim(client, auth_headers)

    async def _operator():
        return UserContext(id="op-1", username="operator", roles=["operator"])

    app.dependency_overrides[get_current_user] = _operator
    try:
        resp = client.post(
            "/api/v1/rls/groups",
            json={"dimension_type_id": dim["id"], "code": "gp_op", "name": "O"},
            headers=auth_headers,
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_group_delete_in_use_gp12(client, auth_headers):
    """T-AUTH-GP12: 角色引用分组时删除 → 409 GROUP_IN_USE。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_del", "name": "D"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "gp_r12", "name": "R"}, headers=auth_headers).json()
    _put_dimension_groups(client, auth_headers, role["id"], [group["id"]])
    resp = client.delete(f"/api/v1/rls/groups/{group['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "GROUP_IN_USE"


def test_rls_no_binding_returns_false_predicate_rls03(client, auth_headers):
    """T-AUTH-RLS03: 无绑定 → build_org_rls_fragment → 1=0。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import build_org_rls_fragment, resolve_user_org_node_ids

    user = client.post("/api/v1/users", json={"username": "rls_u3", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        frag = build_org_rls_fragment(allowed, column="org_node_id", alias="t")
        assert frag.strip() == "1=0" or "1=0" in frag
    finally:
        session.close()


def test_rls_subtree_expansion_rls01_rls02(client, auth_headers):
    """T-AUTH-RLS01~RLS02: 绑定父 org → 子树节点均在允许集。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import resolve_user_org_node_ids

    parent = client.post("/api/v1/orgs", json={"name": "RLS P"}, headers=auth_headers).json()
    child = client.post(
        "/api/v1/orgs",
        json={"name": "RLS C", "parent_id": parent["id"]},
        headers=auth_headers,
    ).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_dim01", "name": "O", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "rls_r01", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u01", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [parent["id"]])
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        assert uuid_mod.UUID(parent["id"]) in allowed
        assert uuid_mod.UUID(child["id"]) in allowed
    finally:
        session.close()


def test_rls_fragment_in_clause_rls04(client, auth_headers):
    """T-AUTH-RLS04: 有权限时片段含 IN 与 org id。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import build_org_rls_fragment, resolve_user_org_node_ids

    org, dim = _ensure_org_dim(client, auth_headers)
    role = client.post("/api/v1/roles", json={"code": "rls_r04", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u04", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org["id"]])
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        frag = build_org_rls_fragment(allowed, column="org_node_id", alias="t")
        assert " IN (" in frag
        assert org["id"] in frag
    finally:
        session.close()


def test_rls_union_direct_and_group_rls05(client, auth_headers):
    """T-AUTH-RLS05: 直绑与分组值并集展开。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import resolve_user_org_node_ids

    org1 = client.post("/api/v1/orgs", json={"name": "RLS A"}, headers=auth_headers).json()
    org2 = client.post("/api/v1/orgs", json={"name": "RLS B"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_dim05", "name": "O", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "rls_g05", "name": "G"},
        headers=auth_headers,
    ).json()
    client.post(
        f"/api/v1/rls/groups/{group['id']}/values",
        json={"values": [org2["id"]]},
        headers=auth_headers,
    )
    role = client.post("/api/v1/roles", json={"code": "rls_r05", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u05", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    v1 = _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org1["id"]])["version"]
    _put_dimension_groups(client, auth_headers, role["id"], [group["id"]], version=v1)
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        assert uuid_mod.UUID(org1["id"]) in allowed
        assert uuid_mod.UUID(org2["id"]) in allowed
    finally:
        session.close()


def _simulate_row_filter(rows: list[dict], allowed: set[uuid_mod.UUID]) -> list[dict]:
    return [r for r in rows if uuid_mod.UUID(str(r["org_node_id"])) in allowed]


def test_rls_unauthorized_row_hidden_rls06(client, auth_headers):
    """T-AUTH-RLS06: 允许集外 org 行不可见。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import resolve_user_org_node_ids

    parent = client.post("/api/v1/orgs", json={"name": "RLS P6"}, headers=auth_headers).json()
    other = client.post("/api/v1/orgs", json={"name": "RLS O6"}, headers=auth_headers).json()
    child = client.post(
        "/api/v1/orgs",
        json={"name": "RLS C6", "parent_id": parent["id"]},
        headers=auth_headers,
    ).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_dim06", "name": "O", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "rls_r06", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u06", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [parent["id"]])
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        rows = [
            {"org_node_id": parent["id"]},
            {"org_node_id": child["id"]},
            {"org_node_id": other["id"]},
        ]
        visible = _simulate_row_filter(rows, allowed)
        visible_ids = {str(r["org_node_id"]) for r in visible}
        assert other["id"] not in visible_ids
        assert parent["id"] in visible_ids
        assert child["id"] in visible_ids
    finally:
        session.close()


def test_rls_empty_allowed_hides_all_rls07(client, auth_headers):
    """T-AUTH-RLS07: 无权限用户所有行被过滤。"""
    from app.auth.models import get_meta_session
    from app.auth.rls.predicate import resolve_user_org_node_ids

    org = client.post("/api/v1/orgs", json={"name": "RLS O7"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u07", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        rows = [{"org_node_id": org["id"]}]
        visible = _simulate_row_filter(rows, allowed)
        assert visible == []
    finally:
        session.close()


def test_rls_query_hook_rls08(client, auth_headers):
    """T-AUTH-RLS08: get_query_rls_fragment 返回有效片段。"""
    from app.auth.deps import UserContext
    from app.auth.models import get_meta_session
    from app.auth.rls.hooks import get_query_rls_fragment

    org, dim = _ensure_org_dim(client, auth_headers)
    role = client.post("/api/v1/roles", json={"code": "rls_r08", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u08", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org["id"]])
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=["rls_r08"])
        frag = get_query_rls_fragment(session, ctx)
        assert "IN (" in frag
        assert org["id"] in frag
    finally:
        session.close()


def test_audit_role_create_au01(client, auth_headers):
    """T-AUTH-AU01: POST 创建角色 → role.create。"""
    role = client.post(
        "/api/v1/roles", json={"code": "au_role", "name": "AU"}, headers=auth_headers
    ).json()
    audit = client.get(
        f"/api/v1/audit/events?target_id={role['id']}&action=role.create",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_role_update_au02(client, auth_headers):
    """T-AUTH-AU02: PUT 更新角色 → role.update。"""
    role = client.post(
        "/api/v1/roles", json={"code": "au_upd", "name": "U"}, headers=auth_headers
    ).json()
    client.put(f"/api/v1/roles/{role['id']}", json={"name": "U2"}, headers=auth_headers)
    audit = client.get(
        f"/api/v1/audit/events?target_id={role['id']}&action=role.update",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_org_create_au03(client, auth_headers):
    """T-AUTH-AU03: POST 创建组织 → org.create。"""
    org = client.post("/api/v1/orgs", json={"name": "AU Org"}, headers=auth_headers).json()
    audit = client.get(
        f"/api/v1/audit/events?target_id={org['id']}&action=org.create",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_dimension_create_au04(client, auth_headers):
    """T-AUTH-AU04: POST 创建维度类型 → dimension.create。"""
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "au_dim", "name": "D", "value_type": "string"},
        headers=auth_headers,
    ).json()
    audit = client.get(
        f"/api/v1/audit/events?target_id={dim['id']}&action=dimension.create",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_group_create_au05(client, auth_headers):
    """T-AUTH-AU05: POST 创建分组 → group.create。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "au_grp", "name": "G"},
        headers=auth_headers,
    ).json()
    audit = client.get(
        f"/api/v1/audit/events?target_id={group['id']}&action=group.create",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_role_dimension_replace_au06(client, auth_headers):
    """T-AUTH-AU06: 角色维度替换 → role.dimension.replace。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = client.post("/api/v1/roles", json={"code": "au_rd", "name": "R"}, headers=auth_headers).json()
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org["id"]])
    audit = client.get(
        f"/api/v1/audit/events?target_id={role['id']}&action=role.dimension.replace",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_forbidden_non_admin_au07(client, operator_client, auth_headers):
    """T-AUTH-AU07: 无功能权限查询审计 → 403 PERMISSION_DENIED。"""
    resp = operator_client.get("/api/v1/audit/events", headers=jwt_auth_headers())
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_audit_filter_target_type_au08(client, auth_headers):
    """T-AUTH-AU08: target_type 过滤。"""
    client.post("/api/v1/roles", json={"code": "au_ft", "name": "F"}, headers=auth_headers)
    audit = client.get("/api/v1/audit/events?target_type=role", headers=auth_headers).json()
    assert audit["total"] >= 1
    assert all(i["target_type"] == "role" for i in audit["items"])


def test_audit_r19_bind_regression_au09(client, auth_headers):
    """T-AUTH-AU09: user.role.bind 仍写入；r19 绑定审计行为保持。"""
    role = client.post("/api/v1/roles", json={"code": "au_r19", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "au_r19_u", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    assert client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers).status_code == 200
    audit = client.get(
        f"/api/v1/audit/events?target_id={user['id']}&action=user.role.bind",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1


def test_audit_filter_actor_id_au10(client, auth_headers):
    """T-AUTH-AU10: actor_id 过滤。

    Task 4 身份模型：actor_id 为当前登录用户（真实 UUID），不再是硬编码 "dev"。
    从实际写入的角色审计事件取 actor_id，验证按其过滤生效。
    """
    client.post("/api/v1/roles", json={"code": "au_act", "name": "A"}, headers=auth_headers)
    recent = client.get(
        "/api/v1/audit/events?target_type=role&limit=1", headers=auth_headers
    ).json()
    assert recent["total"] >= 1
    actor_id = recent["items"][0]["actor_id"]
    audit = client.get(
        f"/api/v1/audit/events?actor_id={actor_id}", headers=auth_headers
    ).json()
    assert audit["total"] >= 1
    assert all(i["actor_id"] == actor_id for i in audit["items"])


def test_rls_multi_dimension_and_combination_rls09(client, auth_headers):
    """T-AUTH-RLS09: org + string 双维度 AND 组合。"""
    from app.auth.rls.hooks import prepare_query_rls

    org, org_dim = _ensure_org_dim(client, auth_headers)
    str_dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_str09", "name": "S", "value_type": "string"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "rls_r09", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u09", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    v1 = _put_dimension_values(client, auth_headers, role["id"], org_dim["id"], [org["id"]])["version"]
    _put_dimension_values(client, auth_headers, role["id"], str_dim["id"], ["east"], version=v1)
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=["viewer"])
        frag = prepare_query_rls(
            session,
            ctx,
            column_by_dimension_id={
                uuid_mod.UUID(org_dim["id"]): "org_node_id",
                uuid_mod.UUID(str_dim["id"]): "region",
            },
            table_alias="t",
        )
        assert " AND " in frag
        assert "org_node_id" in frag
        assert "region" in frag
        assert "east" in frag
    finally:
        session.close()


def test_rls_invalid_column_raises_config_error_rls10(client, auth_headers):
    """T-AUTH-RLS10: 非法列名 org-node → RlsConfigError。"""
    from app.auth.rls.hooks import prepare_query_rls
    from app.auth.rls.predicate import RlsConfigError

    user = client.post("/api/v1/users", json={"username": "rls_u10", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_d10", "name": "D", "value_type": "string"},
        headers=auth_headers,
    ).json()
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=[])
        with pytest.raises(RlsConfigError):
            prepare_query_rls(
                session,
                ctx,
                column_by_dimension_id={uuid_mod.UUID(dim["id"]): "org-node"},
            )
    finally:
        session.close()


def test_rls_empty_string_dimension_returns_false_predicate_rls11(client, auth_headers):
    """T-AUTH-RLS11: string 维度空有效集 → 1=0。"""
    from app.auth.rls.hooks import prepare_query_rls

    user = client.post("/api/v1/users", json={"username": "rls_u11", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "rls_d11", "name": "D", "value_type": "string"},
        headers=auth_headers,
    ).json()
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=[])
        frag = prepare_query_rls(
            session,
            ctx,
            column_by_dimension_id={uuid_mod.UUID(dim["id"]): "region"},
        )
        assert frag.strip() == "1=0"
    finally:
        session.close()


def test_apply_rls_to_sql_merge_where_rls12(client, auth_headers):
    """T-AUTH-RLS12: apply_rls_to_sql 合并 WHERE。"""
    from app.query.rls.guard import apply_rls_to_sql

    org, dim = _ensure_org_dim(client, auth_headers)
    role = client.post("/api/v1/roles", json={"code": "rls_r12", "name": "R"}, headers=auth_headers).json()
    user = client.post("/api/v1/users", json={"username": "rls_u12", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], [org["id"]])
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=["viewer"])
        out = apply_rls_to_sql(
            session,
            ctx,
            "SELECT * FROM facts t",
            rls_config={"org_column": "org_node_id", "table_alias": "t"},
        )
        assert "WHERE" in out.upper()
        assert "org_node_id" in out
    finally:
        session.close()


def test_rls_hook_internal_error_degrades_to_empty_rls13(monkeypatch, client, auth_headers):
    """T-AUTH-RLS13: hook 内部异常降级 → 1=0 片段，非 500。"""
    import app.auth.rls.hooks as hooks_mod
    from app.query.rls.guard import apply_rls_to_sql

    user = client.post("/api/v1/users", json={"username": "rls_u13", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()

    def _boom(*_a, **_k):
        raise RuntimeError("rls internal")

    monkeypatch.setattr(hooks_mod, "prepare_query_rls", _boom)
    session = get_meta_session()
    try:
        ctx = UserContext(id=user["id"], username=user["username"], roles=[])
        out = apply_rls_to_sql(session, ctx, "SELECT 1", rls_config={})
        assert "1=0" in out
    finally:
        session.close()


def test_group_list_negative_offset_422_gp13(client, auth_headers):
    """T-AUTH-GP13: GET /rls/groups?offset=-1 → 422。"""
    resp = client.get("/api/v1/rls/groups?offset=-1", headers=auth_headers)
    assert resp.status_code == 422


def test_replace_role_groups_dedupe_idempotent_gp14(client, auth_headers):
    """T-AUTH-GP14: 重复 groupIds → 200；no-op 不递增 version；有效集正确。"""
    _, org_dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": org_dim["id"], "code": "gp_g14", "name": "G"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "gp_r14", "name": "R"}, headers=auth_headers).json()
    r1 = _put_dimension_groups(
        client, auth_headers, role["id"], [group["id"], group["id"]]
    )
    assert r1["groupIds"] == [group["id"]]
    assert r1["version"] == 1
    r2 = _put_dimension_groups(
        client, auth_headers, role["id"], [group["id"], group["id"]], version=r1["version"]
    )
    assert r2["version"] == 1
    eff = client.get(
        f"/api/v1/roles/{role['id']}/effective-dimensions?dimension_type_id={org_dim['id']}",
        headers=auth_headers,
    )
    assert eff.status_code == 200


def test_bind_groups_to_disabled_role_409_gp15(client, auth_headers):
    """T-AUTH-GP15: 绑定到 is_active=false 角色 → 409 ROLE_DISABLED。"""
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "gp_dim15", "name": "S", "value_type": "string"},
        headers=auth_headers,
    ).json()
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "gp_g15", "name": "G"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "gp_r15", "name": "R"}, headers=auth_headers).json()
    client.put(
        f"/api/v1/roles/{role['id']}",
        json={"name": "R", "description": None, "is_active": False},
        headers=auth_headers,
    )
    resp = client.put(
        f"/api/v1/roles/{role['id']}/dimension-groups",
        json={
            "groupIds": [group["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ROLE_DISABLED"


def test_group_list_pagination_perf_gp_perf(client, auth_headers):
    """AUTH-006 性能 smoke: 50 分组 limit=20 P95 < 500ms。"""
    import time

    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "gp_perf", "name": "P", "value_type": "string"},
        headers=auth_headers,
    ).json()
    for i in range(50):
        client.post(
            "/api/v1/rls/groups",
            json={"dimension_type_id": dim["id"], "code": f"gp_pf_{i:02d}", "name": f"G{i}"},
            headers=auth_headers,
        )
    start = time.perf_counter()
    resp = client.get("/api/v1/rls/groups?limit=20", headers=auth_headers)
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 20
    assert elapsed < 0.5


from datetime import datetime, timedelta, timezone


def test_audit_created_range_filter_au11(client, auth_headers):
    """T-AUTH-AU11: created_after/before 时间窗过滤。"""
    from urllib.parse import quote

    role = client.post("/api/v1/roles", json={"code": "au_r11", "name": "R"}, headers=auth_headers)
    assert role.status_code == 201
    now = datetime.now(timezone.utc)
    after = quote((now - timedelta(hours=1)).isoformat())
    before = quote((now + timedelta(hours=1)).isoformat())
    resp = client.get(
        f"/api/v1/audit/events?created_after={after}&created_before={before}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    window_start = now - timedelta(hours=1)
    window_end = now + timedelta(hours=1)
    for item in resp.json()["items"]:
        created = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        assert created >= window_start
        assert created <= window_end


def test_audit_detail_password_masked_au12(client, auth_headers):
    """T-AUTH-AU12: detail 含 password 键 → 响应 ***。"""
    from app.auth.audit.service import record_event

    session = get_meta_session()
    try:
        record_event(
            session,
            actor_id="dev",
            actor_username="dev",
            target_type="user",
            target_id=uuid_mod.uuid4(),
            action="user.update",
            detail={"password": "secret123", "note": "ok"},
            trace_id="t-au12",
        )
        session.commit()
    finally:
        session.close()
    resp = client.get("/api/v1/audit/events?action=user.update", headers=auth_headers)
    assert resp.status_code == 200
    found = [i for i in resp.json()["items"] if i.get("detail") and "password" in i["detail"]]
    assert found
    assert '"***"' in found[0]["detail"] or "***" in found[0]["detail"]


def test_audit_bulk_query_pagination_perf_au13(client, auth_headers):
    """T-AUTH-AU13: 200 条审计分页 P95 < 500ms；total 正确。"""
    import time
    from app.auth.audit.service import record_event

    session = get_meta_session()
    try:
        for i in range(200):
            record_event(
                session,
                actor_id="dev",
                actor_username="dev",
                target_type="role",
                target_id=uuid_mod.uuid4(),
                action="role.perf",
                detail={"i": i},
                trace_id=f"perf-{i}",
            )
        session.commit()
    finally:
        session.close()
    start = time.perf_counter()
    resp = client.get("/api/v1/audit/events?action=role.perf&limit=50&offset=0", headers=auth_headers)
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 200
    assert len(body["items"]) == 50
    assert elapsed < 0.5


def test_dimension_create_non_admin_forbidden_d13(operator_client, auth_headers):
    """T-AUTH-D13: 无功能权限 POST /rls/dimensions → 403 PERMISSION_DENIED。"""
    resp = operator_client.post(
        "/api/v1/rls/dimensions",
        json={"code": "d13_op", "name": "X", "value_type": "string"},
        headers=auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_dimension_delete_role_direct_ref_d14(client, auth_headers):
    """T-AUTH-D14: auth_role_dimension_values 引用 → 409 DIMENSION_IN_USE。"""
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": "d14_dim", "name": "D", "value_type": "string"},
        headers=auth_headers,
    ).json()
    role = client.post("/api/v1/roles", json={"code": "d14_role", "name": "R"}, headers=auth_headers).json()
    _put_dimension_values(client, auth_headers, role["id"], dim["id"], ["v1"])
    resp = client.delete(f"/api/v1/rls/dimensions/{dim['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "DIMENSION_IN_USE"


def test_bind_user_to_disabled_role_409_r10(client, auth_headers):
    """T-AUTH-R10: PUT is_active=false 后 bind 用户 → 409 ROLE_DISABLED。"""
    role = client.post("/api/v1/roles", json={"code": "r10_dis", "name": "R"}, headers=auth_headers).json()
    client.put(
        f"/api/v1/roles/{role['id']}",
        json={"name": "R", "description": None, "is_active": False},
        headers=auth_headers,
    )
    user = client.post("/api/v1/users", json={"username": "r10_u", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    resp = client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ROLE_DISABLED"


def test_role_list_offset_total_r11(client, auth_headers):
    """T-AUTH-R11: limit=2&offset=2 → items≤2；total≥5。"""
    for i in range(5):
        client.post(
            "/api/v1/roles",
            json={"code": f"r11_{i:02d}", "name": f"R{i}"},
            headers=auth_headers,
        )
    resp = client.get("/api/v1/roles?limit=2&offset=2", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) <= 2
    assert body["total"] >= 5


def test_inactive_role_excluded_from_me_r12(client, auth_headers):
    """T-AUTH-R12: 停用角色不出现在 resolve_user_roles / GET /me。"""
    role = client.post("/api/v1/roles", json={"code": "r12_dis", "name": "R"}, headers=auth_headers).json()
    dev_user = client.post("/api/v1/users", json={"username": "dev", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers).json()
    client.post(f"/api/v1/users/{dev_user['id']}/roles/{role['id']}", headers=auth_headers)
    client.put(
        f"/api/v1/roles/{role['id']}",
        json={"name": "R", "description": None, "is_active": False},
        headers=auth_headers,
    )
    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.status_code == 200
    codes = me.json().get("roles", [])
    assert "r12_dis" not in codes


def test_list_users_paginated(client, auth_headers):
    client.post("/api/v1/users", json={"username": "u_list_a", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers)
    client.post("/api/v1/users", json={"username": "u_list_b", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers)
    resp = client.get("/api/v1/users?limit=10&offset=0", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 2
    usernames = {u["username"] for u in body["items"]}
    assert "u_list_a" in usernames
    assert "u_list_b" in usernames


def test_list_users_embeds_roles(client, auth_headers):
    """T-AUTH-U-EMBED: 用户列表嵌入角色摘要，避免 N+1。"""
    role = client.post(
        "/api/v1/roles", json={"code": "list_embed_r", "name": "列表嵌入"}, headers=auth_headers
    ).json()
    user = client.post(
        "/api/v1/users",
        json={"username": "u_list_roles", "initialPassword": "Init-Pass-1234567"},
        headers=auth_headers,
    ).json()
    client.post(f"/api/v1/users/{user['id']}/roles/{role['id']}", headers=auth_headers)
    resp = client.get("/api/v1/users?q=u_list_roles", headers=auth_headers)
    assert resp.status_code == 200
    row = next(u for u in resp.json()["items"] if u["username"] == "u_list_roles")
    assert "roles" in row
    assert any(r["code"] == "list_embed_r" for r in row["roles"])
