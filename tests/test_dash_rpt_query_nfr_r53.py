"""M9 主题分析 + M10/M12 报表 + M13 Dataset/NFR L1 kickoff r53."""
from __future__ import annotations

import os
import sys
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R53_SQLITE_URL = "sqlite+pysqlite:///file:dash_rpt_query_nfr_r53?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r53_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R53_SQLITE_URL
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
def analyst_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="analyst-1", username="analyst", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R53 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r53 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _theme_config_payload(ref_id: str) -> dict:
    return {
        "entityType": "store",
        "timeGranularity": "month",
        "dimensions": [{"dimensionId": "region", "label": "Region", "sortOrder": 0}],
        "refType": "dashboard",
        "refId": ref_id,
    }


from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES
from jwt_auth import AUTH, jwt_auth_headers


def test_r53_fixture_bootstraps(client):
    """T-R53-000-01: r53 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r53_config_types_include_entity_theme():
    """T-R53-000-02: config_store 允许 entity_theme。"""
    assert "entity_theme" in ALLOWED_CONFIG_TYPES


def test_rpt004_create_root_folder(client):
    """T-RPT-R53-004-01: POST 根 folder → 201 + id。"""
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Templates", "nodeType": "folder"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["nodeType"] == "folder"
    assert resp.json()["parentId"] is None


def test_rpt004_create_child_node(client):
    """T-RPT-R53-004-02: POST 子节点 parentId 有效 → 201。"""
    parent = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Parent", "nodeType": "folder"},
    ).json()
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Child", "nodeType": "template", "parentId": parent["id"], "templateKind": "pdf"},
    )
    assert resp.status_code == 201
    assert resp.json()["parentId"] == parent["id"]


def test_rpt004_move_cycle_rejected(client):
    """T-RPT-R53-004-03: move 至子孙 → 422 RPT_CATALOG_CYCLE。"""
    root = client.post("/api/v1/reports/catalog/nodes", headers=AUTH, json={"name": "R", "nodeType": "folder"}).json()
    child = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "C", "nodeType": "folder", "parentId": root["id"]},
    ).json()
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{root['id']}/move",
        headers=AUTH,
        json={"parentId": child["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_CYCLE"


def test_rpt004_delete_with_children_rejected(client):
    """T-RPT-R53-004-04: delete 有子节点 → 409 RPT_CATALOG_HAS_CHILDREN。"""
    parent = client.post("/api/v1/reports/catalog/nodes", headers=AUTH, json={"name": "P", "nodeType": "folder"}).json()
    client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "C", "nodeType": "folder", "parentId": parent["id"]},
    )
    resp = client.delete(f"/api/v1/reports/catalog/nodes/{parent['id']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "RPT_CATALOG_HAS_CHILDREN"


def test_rpt004_parent_not_found(client):
    """T-RPT-R53-004-05: parentId 不存在 → 404 RPT_CATALOG_PARENT_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Orphan", "nodeType": "folder", "parentId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_CATALOG_PARENT_NOT_FOUND"


def test_rpt004_max_depth_rejected(client):
    """T-RPT-R53-004-06: 深度 > MAX_CATALOG_DEPTH → 422 RPT_CATALOG_MAX_DEPTH。"""
    from app.reports.catalog.service import MAX_CATALOG_DEPTH

    parent_id = None
    for i in range(MAX_CATALOG_DEPTH + 1):
        payload = {"name": f"L{i}", "nodeType": "folder"}
        if parent_id:
            payload["parentId"] = parent_id
        resp = client.post("/api/v1/reports/catalog/nodes", headers=AUTH, json=payload)
        if i == MAX_CATALOG_DEPTH:
            assert resp.status_code == 422
            assert resp.json()["code"] == "RPT_CATALOG_MAX_DEPTH"
            break
        assert resp.status_code == 201, resp.text
        parent_id = resp.json()["id"]


def _create_template_node(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Tpl", "nodeType": "template", "templateKind": "excel"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_rpt005_create_schedule_draft(client):
    """T-RPT-R53-005-01: POST schedule catalogNodeId 有效 + cron → draft。"""
    node_id = _create_template_node(client)
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "draft"
    assert resp.json()["catalogNodeId"] == node_id


def test_rpt005_schedule_transition_flow(client):
    """T-RPT-R53-005-02~04: draft→scheduled→paused→scheduled→cancelled。"""
    node_id = _create_template_node(client)
    created = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    ).json()
    sid = created["id"]
    for action, expected in (
        ("schedule", "scheduled"),
        ("pause", "paused"),
        ("resume", "scheduled"),
        ("cancel", "cancelled"),
    ):
        resp = client.post(
            f"/api/v1/reports/schedules/{sid}/transition",
            headers=AUTH,
            json={"action": action},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == expected


def test_rpt005_invalid_transition_from_draft(client):
    """T-RPT-R53-005-05: draft + pause → 400 RPT_SCHEDULE_INVALID_TRANSITION。"""
    node_id = _create_template_node(client)
    sid = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    ).json()["id"]
    resp = client.post(
        f"/api/v1/reports/schedules/{sid}/transition",
        headers=AUTH,
        json={"action": "pause"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "RPT_SCHEDULE_INVALID_TRANSITION"


def test_rpt005_catalog_node_not_found(client):
    """T-RPT-R53-005-06: catalogNodeId 不存在 → 404。"""
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": str(uuid.uuid4()), "cron": "0 8 * * *"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_CATALOG_NODE_NOT_FOUND"


def test_rpt005_invalid_cron(client):
    """T-RPT-R53-005-07: cron invalid → 422 RPT_SCHEDULE_INVALID_CRON。"""
    node_id = _create_template_node(client)
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "invalid"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_SCHEDULE_INVALID_CRON"


def test_rpt005_get_allowed_actions(client):
    """T-RPT-R53-005-08: GET 含 allowedActions 与 catalogNodeId。"""
    node_id = _create_template_node(client)
    sid = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    ).json()["id"]
    resp = client.get(f"/api/v1/reports/schedules/{sid}", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["catalogNodeId"] == node_id
    assert "schedule" in body["allowedActions"]


def test_dash006_validate_ok(client):
    """T-DASH-R53-006-01: 合法 config validate → 200。"""
    dash_id = _create_dashboard(client)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/validate",
        headers=AUTH,
        json=_theme_config_payload(dash_id),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["entityType"] == "store"


def test_dash006_empty_dimensions(client):
    """T-DASH-R53-006-02: 空 dimensions → 422 DASH_THEME_EMPTY_DIMENSIONS。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id)
    payload["dimensions"] = []
    resp = client.post("/api/v1/dashboards/theme-analysis/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_EMPTY_DIMENSIONS"


def test_dash006_invalid_granularity(client):
    """T-DASH-R53-006-03: 非法 timeGranularity → 422 DASH_THEME_INVALID_GRANULARITY。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id)
    payload["timeGranularity"] = "quarter"
    resp = client.post("/api/v1/dashboards/theme-analysis/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_INVALID_GRANULARITY"


def test_dash006_invalid_geo(client):
    """T-DASH-R53-006-04: geoBinding 缺 latField → 422 DASH_THEME_INVALID_GEO。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id)
    payload["geoBinding"] = {"lngField": "lng"}
    resp = client.post("/api/v1/dashboards/theme-analysis/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_INVALID_GEO"


def test_dash006_put_get_roundtrip(client):
    """T-DASH-R53-006-05: PUT → GET 往返一致。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id)
    put = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    got = client.get(
        "/api/v1/dashboards/theme-analysis",
        headers=AUTH,
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert got.status_code == 200
    assert got.json()["entityType"] == payload["entityType"]
    assert got.json()["refId"] == dash_id


def test_dash006_ref_not_found(client):
    """T-DASH-R53-006-06: ref 指向不存在 dashboard → 404 DASH_NOT_FOUND。"""
    payload = _theme_config_payload(str(uuid.uuid4()))
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_NOT_FOUND"


def test_query009_analyst_demo_orders_ok(client, analyst_user):
    """T-QUERY-R53-009-01: analyst + demo-orders → 200 readonly=true。"""
    resp = client.post(
        "/api/v1/query/dataset/validate",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "select"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["readonly"] is True
    assert resp.json()["resolvedPath"] == "dataset"


def test_query009_analyst_restricted_forbidden(client, analyst_user):
    """T-QUERY-R53-009-02: analyst + restricted-ledger → 403 QUERY_DATASET_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/query/dataset/validate",
        headers=AUTH,
        json={"datasetId": "restricted-ledger", "operation": "select"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "QUERY_DATASET_FORBIDDEN"


def test_query009_unknown_dataset(client):
    """T-QUERY-R53-009-03: 未知 datasetId → 404 QUERY_DATASET_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/query/dataset/validate",
        headers=AUTH,
        json={"datasetId": "missing-ds", "operation": "select"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "QUERY_DATASET_NOT_FOUND"


def test_query009_non_readonly_operation(client):
    """T-QUERY-R53-009-04: operation != select → 422 QUERY_DATASET_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/dataset/validate",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "insert"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_NOT_READONLY"


def test_query009_routing_doc(client):
    """T-QUERY-R53-009-05: routing 文档含 sql/native/dataset 三路径说明。"""
    resp = client.get("/api/v1/query/dataset/routing", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["paths"]) == {"sql", "native", "dataset"}
    assert "sql" in body["boundaryNotes"]
    assert "native" in body["boundaryNotes"]
    assert "dataset" in body["boundaryNotes"]


def test_query009_path_ambiguous(client):
    """T-QUERY-R53-009-06: datasetId + dataSourceId 冲突 → 422 QUERY_PATH_AMBIGUOUS。"""
    resp = client.post(
        "/api/v1/query/dataset/validate",
        headers=AUTH,
        json={"datasetId": "demo-orders", "dataSourceId": str(uuid.uuid4()), "operation": "select"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_PATH_AMBIGUOUS"


def test_query009_native_validate_regression(client):
    """T-QUERY-R53-009-07: opensearch native validate 仍走 r49 QUERY-003 路由。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": {"match_all": {}}},
            "sql": "SELECT 1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


def test_nfr008_get_compliant(client):
    """T-NFR-R53-008-01: GET runtime-compliance overallStatus=compliant（默认环境）。"""
    resp = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["overallStatus"] == "compliant"
    assert resp.json()["zeroThirdPartyBiRuntime"] is True


def test_nfr008_pyproject_violation_detected(client):
    """T-NFR-R53-008-02: mock pyproject 含 apache-superset → item fail + remediation。"""
    fake = '[project]\ndependencies = ["apache-superset>=3.0"]\n'
    with patch("app.core.nfr.runtime_guard._read_pyproject_text", return_value=fake):
        resp = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["overallStatus"] == "non_compliant"
    deps = next(i for i in resp.json()["items"] if i["id"] == "pyproject-dependencies")
    assert deps["status"] == "fail"
    assert deps["remediation"]


def test_nfr008_loaded_modules_violation(client):
    """T-NFR-R53-008-03: mock superset in sys.modules → loaded-modules fail。"""
    with patch.dict(sys.modules, {"superset": object()}):
        resp = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH)
    assert resp.status_code == 200
    mod = next(i for i in resp.json()["items"] if i["id"] == "loaded-modules")
    assert mod["status"] == "fail"


def test_nfr008_strict_assert_503(client):
    """T-NFR-R53-008-04: 违规 → POST assert 503 NFR_RUNTIME_VIOLATION。"""
    fake = '[project]\ndependencies = ["dataease-client"]\n'
    with patch("app.core.nfr.runtime_guard._read_pyproject_text", return_value=fake):
        resp = client.post("/api/v1/nfr/runtime-compliance/assert", headers=AUTH)
    assert resp.status_code == 503
    assert resp.json()["code"] == "NFR_RUNTIME_VIOLATION"


def test_nfr008_violation_always_assert_503(client):
    """T-NFR-R53-008-05: 无 permissive；违规始终 POST assert 503。"""
    fake = '[project]\ndependencies = ["dataease-client"]\n'
    with patch("app.core.nfr.runtime_guard._read_pyproject_text", return_value=fake):
        resp = client.post("/api/v1/nfr/runtime-compliance/assert", headers=AUTH)
    assert resp.status_code == 503
    assert resp.json()["code"] == "NFR_RUNTIME_VIOLATION"


def test_nfr008_zero_runtime_field(client):
    """T-NFR-R53-008-06: 报告含 zeroThirdPartyBiRuntime 字段。"""
    resp = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH)
    assert "zeroThirdPartyBiRuntime" in resp.json()
    assert resp.json()["policyVersion"] == "nfr08-l1"


def test_r53_link_catalog_schedule(client):
    """T-R53-LINK-01: catalog template → schedule 绑定 catalogNodeId。"""
    node_id = _create_template_node(client)
    sid = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 9 * * *"},
    ).json()["id"]
    got = client.get(f"/api/v1/reports/schedules/{sid}", headers=AUTH)
    assert got.json()["catalogNodeId"] == node_id


def test_r53_link_theme_ref_dashboard(client):
    """T-R53-LINK-02: DASH theme config ref 已有 dashboard。"""
    dash_id = _create_dashboard(client)
    put = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_config_payload(dash_id))
    assert put.status_code == 200
    assert put.json()["refId"] == dash_id


def test_r53_link_three_path_routing(client):
    """T-R53-LINK-03: 三路径 routing 与 native/validate 不冲突。"""
    routing = client.get("/api/v1/query/dataset/routing", headers=AUTH).json()
    assert "dataset" in routing["paths"]
    native = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "elasticsearch", "body": {"query": {"match_all": {}}}},
    )
    assert native.status_code == 200


def test_r53_link_health(client):
    """T-R53-LINK-04: /health 200。"""
    assert client.get("/health").status_code == 200


def test_r53_link_nfr_endpoints_coexist(client):
    """T-R53-LINK-05: NFR runtime + xinchuang compliance 并存（不同 endpoint）。"""
    runtime = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH)
    xinchuang = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert runtime.status_code == 200
    assert xinchuang.status_code == 200
    assert "/runtime-compliance" != "/xinchuang/compliance"

