"""Phase B: RLS column bindings and preview API."""
from __future__ import annotations

import uuid as uuid_mod

from app.auth.models import get_meta_session
from app.auth.rls.column_bindings.service import resolve_column_map


def _ensure_org_dim(client, auth_headers):
    org = client.post("/api/v1/orgs", json={"name": "ColBind Org"}, headers=auth_headers).json()
    dim = client.post(
        "/api/v1/rls/dimensions",
        json={"code": f"col_bind_{uuid_mod.uuid4().hex[:8]}", "name": "Org", "value_type": "org_ref"},
        headers=auth_headers,
    ).json()
    return org, dim


def test_create_list_delete_column_binding(client, auth_headers):
    """T-RLS-COL-01: column-bindings CRUD."""
    _, dim = _ensure_org_dim(client, auth_headers)
    created = client.post(
        "/api/v1/rls/column-bindings",
        json={
            "datasetId": "ds-col-bind-test",
            "tableName": "orders",
            "dimensionTypeId": dim["id"],
            "columnName": "org_node_id",
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["tableName"] == "orders"
    assert body["columnName"] == "org_node_id"
    binding_id = body["id"]

    listed = client.get(
        "/api/v1/rls/column-bindings?datasetId=ds-col-bind-test",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1
    assert any(i["id"] == binding_id for i in listed.json()["items"])

    deleted = client.delete(f"/api/v1/rls/column-bindings/{binding_id}", headers=auth_headers)
    assert deleted.status_code == 204


def test_column_binding_requires_scope(client, auth_headers):
    """T-RLS-COL-02: datasourceId or datasetId required."""
    _, dim = _ensure_org_dim(client, auth_headers)
    resp = client.post(
        "/api/v1/rls/column-bindings",
        json={
            "tableName": "orders",
            "dimensionTypeId": dim["id"],
            "columnName": "region_code",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RLS_BINDING_SCOPE_REQUIRED"


def test_rls_preview_returns_fragment(client, auth_headers):
    """T-RLS-COL-03: POST /rls/preview returns SQL fragment."""
    org, dim = _ensure_org_dim(client, auth_headers)
    roles = client.get("/api/v1/roles?limit=100", headers=auth_headers).json()
    admin_role = next(r for r in roles["items"] if r["code"] == "admin")
    current = client.get(
        f"/api/v1/roles/{admin_role['id']}/dimension-values?dimensionTypeId={dim['id']}",
        headers=auth_headers,
    ).json()
    client.put(
        f"/api/v1/roles/{admin_role['id']}/dimension-values",
        json={
            "dimensionTypeId": dim["id"],
            "values": [org["id"]],
            "expectedVersion": current.get("version", 0),
            "confirmEmpty": False,
        },
        headers=auth_headers,
    )
    client.post(
        "/api/v1/rls/column-bindings",
        json={
            "datasetId": "ds-preview",
            "tableName": "sales",
            "dimensionTypeId": dim["id"],
            "columnName": "org_id",
        },
        headers=auth_headers,
    )
    preview = client.post(
        "/api/v1/rls/preview",
        json={"datasetId": "ds-preview", "tableName": "sales", "tableAlias": "t"},
        headers=auth_headers,
    )
    assert preview.status_code == 200
    fragment = preview.json()["fragment"]
    assert "t.org_id" in fragment
    assert org["id"] in fragment


def test_resolve_column_map_from_db(client, auth_headers):
    """T-RLS-COL-04: resolve_column_map loads bindings for query path."""
    _, dim = _ensure_org_dim(client, auth_headers)
    client.post(
        "/api/v1/rls/column-bindings",
        json={
            "datasetId": "ds-resolve",
            "tableName": "facts",
            "dimensionTypeId": dim["id"],
            "columnName": "dept_code",
        },
        headers=auth_headers,
    )
    session = get_meta_session()
    try:
        col_map = resolve_column_map(
            session,
            datasource_id=None,
            dataset_id="ds-resolve",
            table_name="facts",
        )
    finally:
        session.close()
    assert col_map[uuid_mod.UUID(dim["id"])] == "dept_code"
