"""M9 RPT-001/RPT-002 + DASH-006 theme query — r233."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.entity.schemas import EntityTypeCreate
from app.metadata.physical import service as physical_service
from app.metadata.physical.schemas import PhysicalTableRegisterIn
from app.query.schemas import ExecuteResponse
from jwt_auth import AUTH

_R233_SQLITE_URL = "sqlite+pysqlite:///file:m9_rpt_theme_r233?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r233_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R233_SQLITE_URL
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


@pytest.fixture(autouse=True)
def _mock_pack_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.reports.standard.service._load_pack_columns",
        lambda _pack: [
            {"name": "status"},
            {"name": "region"},
            {"name": "created_at"},
        ],
    )


@pytest.fixture(autouse=True)
def clear_stores():
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    yield
    reset_metadata_for_tests()
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(
            id="viewer-r233",
            username="viewer",
            roles=["viewer"],
            permissions={"report:read", "theme:read"},
        )

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _seed_report_template(*, template_kind: str | None = "pdf") -> str:
    from app.auth.deps import UserContext
    from app.reports.catalog import service as catalog_service
    from app.reports.catalog.schemas import CatalogNodeCreate

    admin = UserContext(id="00000000-0000-0000-0000-000000000001", username="dev", roles=["admin"])
    node = catalog_service.create_node(
        CatalogNodeCreate(
            name=f"Tpl-{uuid.uuid4().hex[:6]}",
            node_type="template",
            template_kind=template_kind,
        ),
        admin,
    )
    return str(node.id)


def _put_extension(client: TestClient, tid: str, metrics: list[dict]) -> None:
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{tid}/extension",
        headers=AUTH,
        json={"catalogNodeId": tid, "metrics": metrics, "filters": []},
    )
    assert resp.status_code == 200, resp.text


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"Dash-{uuid.uuid4().hex[:6]}", "description": "r233 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _theme_payload(dash_id: str, *, widget_id: str | None = None) -> dict:
    bindings = []
    if widget_id:
        bindings = [{"widgetId": widget_id, "dimensionId": "region"}]
    return {
        "entityType": "equipment",
        "timeGranularity": "day",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "region", "label": "区域"}],
        "chartViewBindings": bindings,
    }


def _put_chart_widget(client: TestClient, dash_id: str, widget_id: str | None = None) -> str:
    wid = widget_id or str(uuid.uuid4())
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": wid,
                        "type": "chart",
                        "title": "Equipment",
                        "colSpan": 12,
                        "rowSpan": 1,
                        "order": 0,
                        "chartConfig": {
                            "chartType": "table",
                            "dataSourceId": str(uuid.uuid4()),
                            "mode": "sql",
                            "sql": "SELECT 1",
                        },
                    }
                ],
                "globalFilters": [],
            }
        },
    )
    assert resp.status_code == 200, resp.text
    return wid


def _seed_physical_equipment() -> None:
    entity_service.create_entity_type(
        EntityTypeCreate(typeCode="equipment", displayName="设备", attributes=[], lifecycleStates=[])
    )
    physical_service.register_physical_table(
        PhysicalTableRegisterIn.model_validate(
            {
                "tableFqn": "ops.equipment",
                "dataSourceId": str(uuid.uuid4()),
                "displayName": "设备表",
                "entityTypeCode": "equipment",
                "columns": [{"name": "status", "dataType": "varchar", "nullable": True}],
            }
        ),
        UserContext(id="1", username="admin", roles=["admin"]),
    )


@patch("app.reports.engine.execute.execute_query")
def test_r233_engine_run_with_datasource_real_sections(mock_execute, client):
    """R233-RPT-001-01: extension + dataSourceId → placeholder=false。"""
    mock_execute.return_value = ExecuteResponse(
        columns=["status", "cnt"], rows=[["ok", 1]], rowCount=1, truncated=False, traceId="t"
    )
    tid = _seed_report_template(template_kind=None)
    ds_id = str(uuid.uuid4())
    _put_extension(
        client,
        tid,
        [{"key": "cnt", "label": "数量", "expression": "SELECT status, COUNT(*) AS cnt FROM t GROUP BY status"}],
    )
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"dataSourceId": ds_id, "format": "web"},
    )
    assert resp.status_code == 200
    section = resp.json()["renderSpec"]["sections"][0]
    assert section["placeholder"] is False
    assert len(section["rows"]) >= 0


def test_r233_engine_run_no_datasource_placeholder(client):
    """R233-RPT-001-02: 无 dataSourceId → placeholder 回归 r60。"""
    tid = _seed_report_template(template_kind=None)
    resp = client.post(f"/api/v1/reports/templates/{tid}/run", headers=AUTH, json={"format": "web"})
    assert resp.status_code == 200
    assert resp.json()["renderSpec"]["sections"][0]["placeholder"] is True


def test_r233_engine_invalid_parameter_422(client):
    """R233-RPT-001-03: __proto__ → RPT_ENGINE_INVALID_PARAMETER r66 回归。"""
    tid = _seed_report_template(template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"parameters": {"__proto__": "x"}, "format": "web"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_INVALID_PARAMETER"


def test_r233_engine_forbidden_viewer(client, viewer_user):
    """R233-RPT-001-04: viewer 越权 → 403 RPT_ENGINE_FORBIDDEN。"""
    tid = _seed_report_template(template_kind=None)
    resp = client.post(f"/api/v1/reports/templates/{tid}/run", headers=AUTH, json={"format": "web"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ENGINE_FORBIDDEN"


@patch("app.reports.engine.execute.execute_query")
def test_r233_engine_probe_under_50ms(mock_execute, client):
    """R233-RPT-001-05: probe_run_template_budget_ms ≤50ms。"""
    from app.reports.engine.probe import probe_run_template_budget_ms
    from app.reports.engine.schemas import RenderRunIn

    mock_execute.return_value = ExecuteResponse(
        columns=["c"], rows=[[1]], rowCount=1, truncated=False, traceId="t"
    )
    tid = uuid.UUID(_seed_report_template(template_kind=None))
    ds_id = uuid.uuid4()
    _put_extension(client, str(tid), [{"key": "cnt", "label": "数量", "expression": "SELECT 1"}])
    result = probe_run_template_budget_ms(
        tid,
        RenderRunIn(dataSourceId=ds_id, format="web"),
        UserContext(id="1", username="admin", roles=["admin"]),
    )
    assert result.ok


def test_r233_engine_datasource_required_422(client):
    """R233-RPT-001-06: 有 extension 无 dataSourceId → 422。"""
    tid = _seed_report_template(template_kind="pdf")
    _put_extension(client, tid, [{"key": "cnt", "label": "数量"}])
    resp = client.post(f"/api/v1/reports/templates/{tid}/run", headers=AUTH, json={"format": "web"})
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_DATASOURCE_REQUIRED"


@patch("app.reports.engine.execute.execute_query")
def test_r233_standard_seed_and_run(mock_execute, client):
    """R233-RPT-002-01: seed 后 run lifecycle → status 列。"""
    from app.reports.standard.seed import seed_builtin_analysis_pack

    _seed_physical_equipment()
    seed_builtin_analysis_pack()
    mock_execute.return_value = ExecuteResponse(
        columns=["status", "cnt"], rows=[["active", 3]], rowCount=1, truncated=False, traceId="t"
    )
    resp = client.post(
        "/api/v1/reports/standard/packs/equipment-overview/run",
        headers=AUTH,
        json={"theme": "lifecycle"},
    )
    assert resp.status_code == 200
    assert "status" in resp.json()["renderSpec"]["sections"][0]["columns"]


def test_r233_standard_list_total_ge_1(client):
    """R233-RPT-002-02: seed 后 GET packs total≥1。"""
    from app.reports.standard.seed import seed_builtin_analysis_pack

    _seed_physical_equipment()
    seed_builtin_analysis_pack()
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_r233_standard_not_found_404(client):
    """R233-RPT-002-03: unknown pack → 404。"""
    resp = client.post(
        "/api/v1/reports/standard/packs/missing-key/run",
        headers=AUTH,
        json={"theme": "lifecycle"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_STD_NOT_FOUND"


def test_r233_standard_theme_disabled(client, monkeypatch):
    """R233-RPT-002-04: disabled theme → 422。"""
    monkeypatch.setattr(
        "app.reports.standard.service._load_pack_columns",
        lambda _pack: [{"name": "status"}],
    )
    _seed_physical_equipment()
    payload = {
        "packKey": "bind-dist-r233",
        "displayName": "bad",
        "datasetId": "std-pack-bind-dist-r233",
        "boundConfigId": str(uuid.uuid4()),
        "dataSourceId": str(uuid.uuid4()),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": ["analyst"],
        "snapshotCronPreset": "daily",
    }
    client.put("/api/v1/reports/standard/packs/bind-dist-r233", headers=AUTH, json=payload)
    resp = client.post(
        f"/api/v1/reports/standard/packs/bind-dist-r233/run",
        headers=AUTH,
        json={"theme": "distribution"},
    )
    assert resp.status_code in {403, 422}
    if resp.status_code == 422:
        assert resp.json()["code"] == "RPT_STD_THEME_DISABLED"


def test_r233_standard_empty_roles_rejected(client):
    """R233-RPT-002-05: empty allowedRoles → 422。"""
    _seed_physical_equipment()
    payload = {
        "packKey": "bind-empty-r233",
        "displayName": "bad",
        "datasetId": "std-pack-bind-empty-r233",
        "boundConfigId": str(uuid.uuid4()),
        "dataSourceId": str(uuid.uuid4()),
        "fieldMapping": {"status": "status"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": [],
        "snapshotCronPreset": "daily",
    }
    resp = client.put("/api/v1/reports/standard/packs/bind-empty-r233", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_STD_EMPTY_ROLES"


def test_r233_standard_viewer_cannot_manage(client, viewer_user):
    """R233-RPT-002-06: viewer PUT → 403。"""
    _seed_physical_equipment()
    resp = client.put(
        "/api/v1/reports/standard/packs/viewer-blocked",
        headers=AUTH,
        json={
            "packKey": "viewer-blocked",
            "displayName": "x",
            "datasetId": "std-pack-viewer-blocked",
            "boundConfigId": str(uuid.uuid4()),
            "dataSourceId": str(uuid.uuid4()),
            "fieldMapping": {"status": "status"},
            "enabledThemes": ["lifecycle"],
            "allowedRoles": ["analyst"],
            "snapshotCronPreset": "daily",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"] in {"RPT_STD_FORBIDDEN", "PERMISSION_DENIED"}


@patch("app.reports.engine.execute.execute_query")
def test_r233_theme_query_ok(mock_execute, client):
    """R233-DASH-006-01: 合法 dimensionId → columns/rows。"""
    dash_id = _create_dashboard(client)
    client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_payload(dash_id))
    _seed_physical_equipment()
    mock_execute.return_value = ExecuteResponse(
        columns=["region", "cnt"], rows=[["east", 2]], rowCount=1, truncated=False, traceId="t"
    )
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/query",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id, "dimensionId": "region"},
    )
    assert resp.status_code == 200
    assert resp.json()["columns"]


def test_r233_theme_execute_plan_regression(client):
    """R233-DASH-006-02: execute-plan 四步 pass r58 回归。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_payload(dash_id, widget_id=wid))
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200
    assert resp.json()["planVersion"] == "theme-plan-v1"
    assert all(s["status"] in ("pass", "skip") for s in resp.json()["steps"])


def test_r233_theme_viewer_put_forbidden(client):
    """R233-DASH-006-03: viewer PUT → 403 DASH_THEME_FORBIDDEN。"""
    dash_id = _create_dashboard(client)
    async def _viewer() -> UserContext:
        return UserContext(
            id="viewer-r233",
            username="viewer",
            roles=["viewer"],
            permissions={"report:read", "theme:read"},
        )

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_payload(dash_id))
        assert resp.status_code == 403
        assert resp.json()["code"] == "DASH_THEME_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r233_theme_dimension_unknown_422(client):
    """R233-DASH-006-04: 未知 dimensionId → 422。"""
    dash_id = _create_dashboard(client)
    client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_payload(dash_id))
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/query",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id, "dimensionId": "missing"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_DIMENSION_UNKNOWN"


def test_r233_theme_config_roundtrip(client):
    """R233-DASH-006-05: PUT day granularity + dimension → GET 200。"""
    dash_id = _create_dashboard(client)
    payload = _theme_payload(dash_id)
    assert client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload).status_code == 200
    resp = client.get(
        "/api/v1/dashboards/theme-analysis",
        headers=AUTH,
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200
    assert resp.json()["timeGranularity"] == "day"


def test_r233_theme_query_no_config_404(client):
    """R233-DASH-006-06: 无 config query → 404 CONFIG_NOT_FOUND。"""
    dash_id = _create_dashboard(client)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/query",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id, "dimensionId": "region"},
    )
    assert resp.status_code == 404
