"""跨域远期薄弱项 L1 kickoff r59 — META/CAT/DASH/CONN/DESIGN."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R59_SQLITE_URL = "sqlite+pysqlite:///file:meta_cat_dash_conn_design_r59?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r59_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R59_SQLITE_URL
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
        return UserContext(id="viewer-r59", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R59 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r59 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_workflow_instance(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES


def test_r59_fixture_bootstraps(client):
    """T-R59-000-01: r59 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r59_config_types_include_new_kinds():
    """T-R59-000-02: config_store 允许 entity_overview/designer_workflow_link。"""
    assert {"entity_overview", "designer_workflow_link"}.issubset(ALLOWED_CONFIG_TYPES)


def _dataset_payload(dataset_id: str = "demo-orders") -> dict:
    return {
        "datasetId": dataset_id,
        "displayName": "Demo Orders",
        "tables": [{"name": "orders", "alias": "o"}],
        "computedFields": [{"name": "total", "expression": "amount * qty"}],
        "allowedRoles": ["analyst"],
    }


def test_meta_r59_004_list_empty(client):
    """T-META-R59-004-01: GET /datasets 空列表 200。"""
    resp = client.get("/api/v1/datasets", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_meta_r59_004_create_and_get(client):
    """T-META-R59-004-02: POST create 201 + GET 详情。"""
    payload = _dataset_payload(f"ds-{uuid.uuid4().hex[:8]}")
    create = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert create.status_code == 201, create.text
    got = client.get(f"/api/v1/datasets/{payload['datasetId']}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["displayName"] == "Demo Orders"


def test_meta_r59_004_create_conflict(client):
    """T-META-R59-004-03: 重复 datasetId 409 META_DATASET_CONFLICT。"""
    ds_id = f"dup-{uuid.uuid4().hex[:6]}"
    payload = _dataset_payload(ds_id)
    assert client.post("/api/v1/datasets", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DATASET_CONFLICT"


def test_meta_r59_004_get_not_found(client):
    """T-META-R59-004-04: 未知 id 404 META_DATASET_NOT_FOUND。"""
    resp = client.get("/api/v1/datasets/missing-dataset", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_DATASET_NOT_FOUND"


def test_meta_r59_004_validate_ok(client):
    """T-META-R59-004-05: POST /validate 合法 payload valid=true。"""
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=_dataset_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["tableCount"] == 1
    assert body["computedFieldCount"] == 1


def test_meta_r59_004_validate_empty_tables(client):
    """T-META-R59-004-06: 空 tables 422 META_DATASET_EMPTY_TABLES。"""
    payload = _dataset_payload()
    payload["tables"] = []
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_EMPTY_TABLES"


def test_meta_r59_004_invalid_computed_field(client):
    """T-META-R59-004-07: 非法 computedFields 名 422 META_DATASET_INVALID_FIELD。"""
    payload = _dataset_payload(f"bad-{uuid.uuid4().hex[:6]}")
    payload["computedFields"] = [{"name": "Bad-Name", "expression": "1"}]
    resp = client.post("/api/v1/datasets", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_INVALID_FIELD"


def _class_node(code: str | None = None, parent_id: str | None = None) -> dict:
    return {
        "code": code or f"CAT_{uuid.uuid4().hex[:6].upper()}",
        "name": "Category Node",
        "parentId": parent_id,
        "kind": "folder",
        "sortOrder": 0,
    }


def test_cat_r59_004_create_root_and_child(client):
    """T-CAT-R59-004-01: 创建根节点 + 子节点。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node())
    assert root.status_code == 201, root.text
    root_id = root.json()["nodeId"]
    child = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root_id),
    )
    assert child.status_code == 201
    listed = client.get(f"/api/v1/gov/catalog/classification/nodes?parentId={root_id}", headers=AUTH)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1


def test_cat_r59_004_move_cycle(client):
    """T-CAT-R59-004-02: move 成环 422 CAT_CLASS_CYCLE。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    child = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root["nodeId"]),
    ).json()
    resp = client.post(
        f"/api/v1/gov/catalog/classification/nodes/{root['nodeId']}/move",
        headers=AUTH,
        json={"parentId": child["nodeId"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT_CLASS_CYCLE"


def test_cat_r59_004_parent_not_found(client):
    """T-CAT-R59-004-03: 未知 parent 404 CAT_CLASS_PARENT_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=missing),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT_CLASS_PARENT_NOT_FOUND"


def test_cat_r59_004_code_conflict(client):
    """T-CAT-R59-004-04: 重复 code 409 CAT_CLASS_CODE_CONFLICT。"""
    code = f"DUP_{uuid.uuid4().hex[:4].upper()}"
    assert client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node(code)).status_code == 201
    dup = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node(code))
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT_CLASS_CODE_CONFLICT"


def test_cat_r59_004_delete_with_children(client):
    """T-CAT-R59-004-05: 删除含子节点 409 CAT_CLASS_HAS_CHILDREN。"""
    root = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    client.post(
        "/api/v1/gov/catalog/classification/nodes",
        headers=AUTH,
        json=_class_node(parent_id=root["nodeId"]),
    )
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{root['nodeId']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "CAT_CLASS_HAS_CHILDREN"


def test_cat_r59_004_delete_leaf(client):
    """T-CAT-R59-004-06: 删除叶节点 204。"""
    leaf = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=_class_node()).json()
    resp = client.delete(f"/api/v1/gov/catalog/classification/nodes/{leaf['nodeId']}", headers=AUTH)
    assert resp.status_code == 204


def test_cat_r59_004_max_depth(client):
    """T-CAT-R59-004-07: 超深 422 CAT_CLASS_MAX_DEPTH。"""
    parent_id = None
    for _ in range(9):
        payload = _class_node(parent_id=parent_id)
        resp = client.post("/api/v1/gov/catalog/classification/nodes", headers=AUTH, json=payload)
        if resp.status_code != 201:
            assert resp.status_code == 422
            assert resp.json()["code"] == "CAT_CLASS_MAX_DEPTH"
            return
        parent_id = resp.json()["nodeId"]
    pytest.fail("expected depth guard before 10 levels")


def _overview_payload(dashboard_id: str, catalog_entry_id: str | None = None) -> dict:
    body = {
        "dashboardId": dashboard_id,
        "entityTypeRef": "customer",
        "statCards": [{"metricKey": "total_orders", "label": "Orders"}],
        "filters": [{"dimensionId": "region"}],
        "drillTargets": [{"widgetId": "w1"}],
    }
    if catalog_entry_id:
        body["catalogEntryId"] = catalog_entry_id
    return body


def test_dash_r59_005_validate_empty_cards(client):
    """T-DASH-R59-005-01: validate 空 statCards 422。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["statCards"] = []
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_EMPTY_CARDS"


def test_dash_r59_005_unknown_dashboard(client):
    """T-DASH-R59-005-02: 未知 dashboard 404。"""
    payload = _overview_payload(str(uuid.uuid4()))
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_OVERVIEW_DASHBOARD_NOT_FOUND"


def test_dash_r59_005_save_and_get(client):
    """T-DASH-R59-005-03: save/get 往返。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    save = client.put(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH, json=payload)
    assert save.status_code == 200, save.text
    got = client.get(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["entityTypeRef"] == "customer"
    assert got.json()["publishStatus"] is None


def test_dash_r59_005_forbidden_viewer(client, viewer_user):
    """T-DASH-R59-005-04: 非 owner viewer 403。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    client.put(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH, json=payload)
    resp = client.get(f"/api/v1/dashboards/{dash_id}/entity-overview", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_OVERVIEW_FORBIDDEN"


def test_dash_r59_005_duplicate_metric(client):
    """T-DASH-R59-005-05: 重复 metricKey 422。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["statCards"] = [
        {"metricKey": "dup", "label": "A"},
        {"metricKey": "dup", "label": "B"},
    ]
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_DUPLICATE_METRIC"


def test_dash_r59_005_theme_route_unchanged(client):
    """T-DASH-R59-005-06: theme-analysis validate 仍 422（边界不交叉）。"""
    resp = client.post("/api/v1/dashboards/theme-analysis/validate", headers=AUTH, json={})
    assert resp.status_code == 422


from app.datasources.registry import export_type_catalog
from app.datasources.dialects.kingbase.connector import KINGBASE_MAX_COLUMNS, KingbaseConnector
from jwt_auth import AUTH, jwt_auth_headers


def test_conn_r59_018_catalog_has_kingbase():
    """T-CONN-R59-018-01: export_type_catalog 含 kingbase relational。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert "kingbase" in types
    assert types["kingbase"]["category"] == "relational"


def test_conn_r59_018_test_connection_ok_mock():
    """T-CONN-R59-018-02: test-connection mock 成功 ok=true。"""
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    with patch.object(connector._inner, "open_connection", return_value=mock_conn):
        result = connector.test_connection(host="h", port=54321, username="u", password="p", database="d")
    assert result.ok is True
    mock_conn.close.assert_called_once()


def test_conn_r59_018_test_connection_auth_failed_mock():
    """T-CONN-R59-018-03: auth 失败 KINGBASE_AUTH_FAILED。"""
    import psycopg

    connector = KingbaseConnector()
    err = psycopg.OperationalError("password authentication failed")
    err.sqlstate = "28P01"
    with patch.object(connector._inner, "open_connection", side_effect=err):
        result = connector.test_connection(host="h", port=54321, username="u", password="p", database="d")
    assert result.ok is False
    assert result.code == "KINGBASE_AUTH_FAILED"


def test_conn_r59_018_http_test_connection_draft(client):
    """T-CONN-R59-018-04: HTTP test-connection draft kingbase 200。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-test",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "test",
                "username": "u",
                "password": "secret",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r59_018_http_no_password_leak(client):
    """T-CONN-R59-018-05: 响应不得含 password。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-test",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "test",
                "username": "u",
                "password": "secret",
            },
        )
    assert "password" not in resp.text.lower()


def test_conn_r59_018_list_columns_limit():
    """T-CONN-R59-018-06: list_columns 截断 KINGBASE_MAX_COLUMNS。"""
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    cols = [type("C", (), {"name": f"c{i}"})() for i in range(KINGBASE_MAX_COLUMNS + 10)]
    with patch.object(connector._inner, "list_columns", return_value=cols):
        out = connector.list_columns(mock_conn, "public", "t")
    assert len(out) == KINGBASE_MAX_COLUMNS


def test_design_r59_004_validate_unknown_instance(client):
    """T-DESIGN-R59-004-01: 未知 workflow instance 404。"""
    payload = {
        "designerItemId": str(uuid.uuid4()),
        "workflowInstanceId": str(uuid.uuid4()),
        "designType": "chart",
    }
    resp = client.post("/api/v1/designer/workflow-link/validate", headers=AUTH, json=payload)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DESIGN_WORKFLOW_INSTANCE_NOT_FOUND"


def test_design_r59_004_save_and_get(client):
    """T-DESIGN-R59-004-02: save/get 幂等覆盖。"""
    wf_id = _create_workflow_instance(client)
    item_id = str(uuid.uuid4())
    payload = {"designerItemId": item_id, "workflowInstanceId": wf_id, "designType": "chart"}
    save1 = client.put("/api/v1/designer/workflow-link", headers=AUTH, json=payload)
    assert save1.status_code == 200, save1.text
    save2 = client.put("/api/v1/designer/workflow-link", headers=AUTH, json=payload)
    assert save2.status_code == 200
    got = client.get(f"/api/v1/designer/workflow-link?designerItemId={item_id}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["workflowInstanceId"] == wf_id


def test_design_r59_004_validate_publish_ready_false(client):
    """T-DESIGN-R59-004-03: draft workflow publishReady=false。"""
    wf_id = _create_workflow_instance(client)
    payload = {"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"}
    resp = client.post("/api/v1/designer/workflow-link/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is False


def test_design_r59_004_invalid_item(client):
    """T-DESIGN-R59-004-04: 空 designerItemId 422。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": "", "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_WORKFLOW_INVALID_ITEM"


def test_design_r59_004_sql_mode_route_unchanged(client):
    """T-DESIGN-R59-004-05: sql-mode capabilities 仍 200（不重复 DESIGN-003/005）。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200


def test_design_r59_004_get_missing(client):
    """T-DESIGN-R59-004-06: 未 save 的 item GET 404。"""
    resp = client.get(f"/api/v1/designer/workflow-link?designerItemId={uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
