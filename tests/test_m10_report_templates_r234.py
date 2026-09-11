"""M10 RPT-003/004/006 + VIEW-002 backend integration — r234."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.reports.catalog import probe as catalog_probe
from app.reports.catalog import service as catalog_service
from app.reports.templates import probe as template_probe
from app.reports.templates import service as template_service
from jwt_auth import AUTH, jwt_auth_headers

_SQLITE = "sqlite+pysqlite:///file:m10_r234?mode=memory&cache=shared&uri=true"
_TEMPLATE_BODY = {
    "templateKey": "sales_summary",
    "format": "pdf",
    "displayName": "销售汇总",
    "blocks": [{"blockType": "sql", "queryRef": "SELECT 1"}],
}


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


_VIEWER_USER_ID = "00000000-0000-0000-0000-000000000099"


@pytest.fixture(autouse=True)
def _reset_report_stores():
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    yield
    reset_metadata_for_tests()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _put_template(client: TestClient, key: str = "sales_summary") -> None:
    body = {**_TEMPLATE_BODY, "templateKey": key}
    resp = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text


def test_rpt003_01_put_get_list_storage_ref(client: TestClient):
    _put_template(client)
    got = client.get("/api/v1/reports/templates/sales_summary", headers=AUTH)
    assert got.status_code == 200
    body = got.json()
    assert body["storageRef"] == "storage://templates/sales_summary.pdf"
    assert body["exportHook"]["integrationPath"].startswith("/api/v1/reports/export")
    listed = client.get("/api/v1/reports/templates?prefix=sales", headers=AUTH)
    assert listed.status_code == 200
    assert any(i["templateKey"] == "sales_summary" for i in listed.json()["items"])


def test_rpt003_02_delete_in_use_409(client: TestClient):
    _put_template(client)
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Linked", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    )
    assert node.status_code == 201
    resp = client.delete("/api/v1/reports/templates/sales_summary", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "RPT_TEMPLATE_IN_USE"


def test_rpt003_03_delete_ok_after_unlink(client: TestClient):
    _put_template(client, "tmp_del")
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "T", "nodeType": "template", "templateKind": "pdf", "templateKey": "tmp_del"},
    ).json()["id"]
    client.delete(f"/api/v1/reports/catalog/nodes/{node_id}", headers=AUTH)
    assert client.delete("/api/v1/reports/templates/tmp_del", headers=AUTH).status_code == 204


def test_rpt003_04_run_pdf_export_hook(client: TestClient):
    _put_template(client)
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Run", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{nid}/extension",
        headers=AUTH,
        json={"catalogNodeId": nid, "metrics": [], "filters": [], "changeNote": "init"},
    )
    run = client.post(
        f"/api/v1/reports/templates/{nid}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert run.status_code == 200, run.text
    assert run.json()["exportHook"]["format"] == "pdf"
    assert run.json()["exportHook"]["placeholder"] is False


def test_rpt003_04b_extension_get_returns_camel_case(client: TestClient):
    """FE 依赖 catalogNodeId / queryMode 等 camelCase 字段。"""
    _put_template(client)
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Ext", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    ).json()["id"]
    ds_id = str(uuid.uuid4())
    put = client.put(
        f"/api/v1/reports/catalog/nodes/{nid}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": nid,
            "defaultDataSourceId": ds_id,
            "metrics": [
                {
                    "key": "revenue",
                    "label": "营收",
                    "expression": "SELECT 1 AS revenue",
                    "visible": True,
                }
            ],
            "filters": [],
            "changeNote": "init",
        },
    )
    assert put.status_code == 200, put.text
    body = put.json()
    assert "catalogNodeId" in body
    assert "catalog_node_id" not in body
    assert body["defaultDataSourceId"] == ds_id
    assert body["metrics"][0]["key"] == "revenue"

    got = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension", headers=AUTH)
    assert got.status_code == 200, got.text
    payload = got.json()
    assert payload["catalogNodeId"] == nid
    assert payload["metrics"][0]["key"] == "revenue"


def test_rpt003_05_viewer_delete_forbidden(client: TestClient):
    _put_template(client, "v_only")

    async def _viewer() -> UserContext:
        return UserContext(id=_VIEWER_USER_ID, username="v", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.delete(
            "/api/v1/reports/templates/v_only",
            headers=jwt_auth_headers(user_id=_VIEWER_USER_ID, username="viewer"),
        )
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.clear()


def test_rpt003_06_duplicate_block_422(client: TestClient):
    body = {
        **_TEMPLATE_BODY,
        "templateKey": "dup_blocks",
        "blocks": [
            {"blockType": "table", "tableRef": "t1"},
            {"blockType": "table", "tableRef": "t1"},
        ],
    }
    resp = client.put("/api/v1/reports/templates/dup_blocks", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_DUPLICATE_BLOCK"


def test_rpt003_07_custom_storage_ref(client: TestClient):
    body = {
        **_TEMPLATE_BODY,
        "templateKey": "custom_ref",
        "storageRef": "storage://templates/custom_ref.pdf",
    }
    resp = client.put("/api/v1/reports/templates/custom_ref", headers=AUTH, json=body)
    assert resp.status_code == 200
    assert resp.json()["storageRef"] == "storage://templates/custom_ref.pdf"


def test_rpt004_01_duplicate_template_key_422(client: TestClient):
    _put_template(client)
    for _ in range(2):
        resp = client.post(
            "/api/v1/reports/catalog/nodes",
            headers=AUTH,
            json={
                "name": f"N-{uuid.uuid4().hex[:4]}",
                "nodeType": "template",
                "templateKind": "pdf",
                "templateKey": "sales_summary",
            },
        )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_DUPLICATE_TEMPLATE_KEY"


def test_rpt004_02_kind_mismatch_422(client: TestClient):
    _put_template(client)
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Bad", "nodeType": "template", "templateKind": "excel", "templateKey": "sales_summary"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_TEMPLATE_KIND_MISMATCH"


def test_rpt004_03_folder_with_template_key_422(client: TestClient):
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "F", "nodeType": "folder", "templateKey": "sales_summary"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_INVALID_TEMPLATE_KEY"


def test_rpt004_04_template_key_not_found_422(client: TestClient):
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "X", "nodeType": "template", "templateKind": "pdf", "templateKey": "missing_key"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_TEMPLATE_NOT_FOUND"


def test_rpt004_05_catalog_list_probe_budget(client: TestClient):
    from app.reports.catalog import service as catalog_service

    snapshot = dict(catalog_service._nodes)
    try:
        catalog_probe._seed_probe_tree(50)  # noqa: SLF001
        actor = UserContext(id="probe", username="probe", roles=["admin"])
        result = catalog_probe.probe_list_catalog_budget_ms(actor)
        assert result.ok, f"list catalog took {result.elapsed_ms}ms"
    finally:
        catalog_service._nodes.clear()
        catalog_service._nodes.update(snapshot)


def test_rpt003_08_list_templates_probe_budget(client: TestClient):
    _put_template(client)
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = template_probe.probe_list_templates_budget_ms(actor)
    assert result.ok, f"list templates took {result.elapsed_ms}ms"


def test_rpt006_01_extension_on_folder_422(client: TestClient):
    fid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "F", "nodeType": "folder"},
    ).json()["id"]
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{fid}/extension",
        headers=AUTH,
        json={"catalogNodeId": fid, "metrics": [], "filters": [], "changeNote": "x"},
    )
    assert resp.status_code == 422


def test_rpt006_02_extension_invalid_operator_422(client: TestClient):
    _put_template(client)
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Ext", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    ).json()["id"]
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{nid}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": nid,
            "metrics": [],
            "filters": [{"key": "region", "operator": "bogus", "required": False}],
            "changeNote": "bad op",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_OPERATOR"


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"Dash-{uuid.uuid4().hex[:6]}", "layoutJson": {"version": 1, "widgets": []}},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_view002_01_role_report_template_bind(client: TestClient):
    _put_template(client)
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "RoleTpl", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    ).json()["id"]
    dash = _create_dashboard(client)
    put = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash, "reportTemplateNodeId": nid},
    )
    assert put.status_code == 200
    assert put.json()["reportTemplateNodeId"] == nid


def test_view002_02_non_template_node_404(client: TestClient):
    fid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "FolderOnly", "nodeType": "folder"},
    ).json()["id"]
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"reportTemplateNodeId": fid},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_DEFAULT_REPORT_NOT_FOUND"


def test_rpt004_06_catalog_cycle_regression(client: TestClient):
    parent = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "P", "nodeType": "folder"},
    ).json()["id"]
    child = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "C", "nodeType": "folder", "parentId": parent},
    ).json()["id"]
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{parent}/move",
        headers=AUTH,
        json={"parentId": child},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_CYCLE"


def test_rpt003_09_run_pdf_non_export_kind_422(client: TestClient):
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "WebTpl", "nodeType": "template"},
    ).json()["id"]
    resp = client.post(
        f"/api/v1/reports/templates/{nid}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_FORMAT_NOT_SUPPORTED"
