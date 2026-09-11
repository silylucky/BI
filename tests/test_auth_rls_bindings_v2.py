"""Task 8: RLS binding GET/PUT with version protection and empty-binding confirmation."""
from __future__ import annotations

import json
import uuid as uuid_mod

from app.auth.models import get_meta_session
from app.auth.rls.predicate import build_org_rls_fragment, resolve_user_org_node_ids


def _ensure_org_dim(client, auth_headers):
    org = client.post("/api/v1/orgs", json={"name": "RLS Bind Org"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": f"rls_bind_{uuid_mod.uuid4().hex[:8]}", "name": "O", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    return org, dim


def _create_role(client, auth_headers, code: str | None = None):
    suffix = uuid_mod.uuid4().hex[:8]
    return client.post(
        "/api/v1/roles",
        json={"code": code or f"rls_bind_{suffix}", "name": "R"},
        headers=auth_headers,
    ).json()


def test_get_dimension_groups_returns_bindings_and_version(client, auth_headers):
    """T-RLS-BIND-01: GET dimension-groups 返回已有绑定与 version。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "bind_g01", "name": "G"},
        headers=auth_headers,
    ).json()
    role = _create_role(client, auth_headers)
    put = client.put(
        f"/api/v1/roles/{role['id']}/dimension-groups",
        json={"groupIds": [group["id"]], "expectedVersion": 0, "confirmEmpty": False},
        headers=auth_headers,
    )
    assert put.status_code == 200
    assert put.json()["version"] == 1

    got = client.get(f"/api/v1/roles/{role['id']}/dimension-groups", headers=auth_headers)
    assert got.status_code == 200
    body = got.json()
    assert body["roleId"] == role["id"]
    assert body["groupIds"] == [group["id"]]
    assert body["version"] == 1


def test_get_dimension_values_returns_bindings_and_version(client, auth_headers):
    """T-RLS-BIND-02: GET dimension-values 返回已有绑定与 version。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    put = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert put.status_code == 200
    assert put.json()["version"] == 1

    got = client.get(
        f"/api/v1/roles/{role['id']}/dimension-values?dimensionTypeId={dim['id']}",
        headers=auth_headers,
    )
    assert got.status_code == 200
    body = got.json()
    assert body["roleId"] == role["id"]
    assert body["dimensionTypeId"] == dim["id"]
    assert body["values"] == [org["id"]]
    assert body["version"] == 1


def test_get_dimension_values_missing_query_param_422(client, auth_headers):
    """T-RLS-BIND-03: dimensionTypeId 缺失 → 422。"""
    role = _create_role(client, auth_headers)
    resp = client.get(f"/api/v1/roles/{role['id']}/dimension-values", headers=auth_headers)
    assert resp.status_code == 422


def test_get_dimension_values_unknown_type_404(client, auth_headers):
    """T-RLS-BIND-04: 不存在的 dimensionTypeId → 404 RLS_DIMENSION_TYPE_NOT_FOUND。"""
    role = _create_role(client, auth_headers)
    fake = str(uuid_mod.uuid4())
    resp = client.get(
        f"/api/v1/roles/{role['id']}/dimension-values?dimensionTypeId={fake}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RLS_DIMENSION_TYPE_NOT_FOUND"


def test_put_version_conflict_409(client, auth_headers):
    """T-RLS-BIND-05: expectedVersion 冲突 → 409 RLS_BINDING_VERSION_CONFLICT。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    first = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert first.status_code == 200
    conflict = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "RLS_BINDING_VERSION_CONFLICT"


def test_empty_binding_without_confirm_422(client, auth_headers):
    """T-RLS-BIND-06: 空列表且 confirmEmpty=false → 422 RLS_EMPTY_CONFIRM_REQUIRED。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    resp = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RLS_EMPTY_CONFIRM_REQUIRED"

    resp_g = client.put(
        f"/api/v1/roles/{role['id']}/dimension-groups",
        json={"groupIds": [], "expectedVersion": 0, "confirmEmpty": False},
        headers=auth_headers,
    )
    assert resp_g.status_code == 422
    assert resp_g.json()["code"] == "RLS_EMPTY_CONFIRM_REQUIRED"


def test_replace_increments_rls_version(client, auth_headers):
    """T-RLS-BIND-07: 真实替换递增 role.rls_version。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    r1 = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert r1.json()["version"] == 1

    org2 = client.post("/api/v1/orgs", json={"name": "RLS Bind Org2"}, headers=auth_headers).json()
    r2 = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org2["id"]],
            "expectedVersion": 1,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["version"] == 2


def test_noop_put_returns_200_without_version_bump(client, auth_headers):
    """T-RLS-BIND-08: no-op 不递增 version，PUT 仍返回 200 与当前状态。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    body = {
        "dimensionTypeId": dim["id"],
        "values": [org["id"]],
        "expectedVersion": 0,
        "confirmEmpty": False,
    }
    first = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json=body,
        headers=auth_headers,
    )
    assert first.status_code == 200
    version = first.json()["version"]

    noop = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={**body, "expectedVersion": version},
        headers=auth_headers,
    )
    assert noop.status_code == 200
    assert noop.json()["version"] == version
    assert noop.json()["values"] == [org["id"]]


def test_audit_records_before_after(client, auth_headers):
    """T-RLS-BIND-09: 审计 detail 含 before/after。"""
    org, dim = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)
    client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    audit = client.get(
        f"/api/v1/audit/events?target_id={role['id']}&action=role.dimension.replace",
        headers=auth_headers,
    ).json()
    assert audit["total"] >= 1
    detail = json.loads(audit["items"][0]["detail"])
    assert "before" in detail
    assert "after" in detail
    assert detail["after"] == [org["id"]]

    _, dim2 = _ensure_org_dim(client, auth_headers)
    group = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim2["id"], "code": "bind_au_g", "name": "G"},
        headers=auth_headers,
    ).json()
    role2 = _create_role(client, auth_headers)
    client.put(
        f"/api/v1/roles/{role2['id']}/dimension-groups",
        json={"groupIds": [group["id"]], "expectedVersion": 0, "confirmEmpty": False},
        headers=auth_headers,
    )
    audit_g = client.get(
        f"/api/v1/audit/events?target_id={role2['id']}&action=role.group.replace",
        headers=auth_headers,
    ).json()
    assert audit_g["total"] >= 1
    detail_g = json.loads(audit_g["items"][0]["detail"])
    assert detail_g["before"] == []
    assert detail_g["after"] == [group["id"]]


def test_query_no_binding_stays_fail_closed(client, auth_headers):
    """T-RLS-BIND-10: 无绑定用户查询仍 fail-closed 为 1=0。"""
    user = client.post(
        "/api/v1/users",
        json={"username": f"rls_nc_{uuid_mod.uuid4().hex[:8]}", "initialPassword": "Init-Pass-1234567"},
        headers=auth_headers,
    ).json()
    session = get_meta_session()
    try:
        allowed = resolve_user_org_node_ids(session, uuid_mod.UUID(user["id"]))
        frag = build_org_rls_fragment(allowed, column="org_node_id", alias="t")
        assert frag.strip() == "1=0" or "1=0" in frag
    finally:
        session.close()


def test_shared_version_across_dimension_types(client, auth_headers):
    """T-RLS-BIND-11: 不同 dimension type 写操作共享 rls_version。"""
    org1, dim1 = _ensure_org_dim(client, auth_headers)
    org2, dim2 = _ensure_org_dim(client, auth_headers)
    role = _create_role(client, auth_headers)

    v1 = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim1["id"],
            "values": [org1["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    ).json()["version"]

    stale = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim2["id"],
            "values": [org2["id"]],
            "expectedVersion": 0,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "RLS_BINDING_VERSION_CONFLICT"

    ok = client.put(
        f"/api/v1/roles/{role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim2["id"],
            "values": [org2["id"]],
            "expectedVersion": v1,
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["version"] == v1 + 1


def test_group_ids_sorted_in_response(client, auth_headers):
    """T-RLS-BIND-12: groupIds 按 UUID 字符串稳定排序。"""
    _, dim = _ensure_org_dim(client, auth_headers)
    g1 = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "bind_sort1", "name": "G1"},
        headers=auth_headers,
    ).json()
    g2 = client.post(
        "/api/v1/rls/groups",
        json={"dimension_type_id": dim["id"], "code": "bind_sort2", "name": "G2"},
        headers=auth_headers,
    ).json()
    role = _create_role(client, auth_headers)
    ids = [g2["id"], g1["id"]]
    put = client.put(
        f"/api/v1/roles/{role['id']}/dimension-groups",
        json={"groupIds": ids, "expectedVersion": 0, "confirmEmpty": False},
        headers=auth_headers,
    )
    assert put.status_code == 200
    assert put.json()["groupIds"] == sorted(ids, key=str)
