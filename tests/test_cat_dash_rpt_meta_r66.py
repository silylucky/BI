"""跨域 companion 质量推分 r66 — CAT/DASH/RPT/META."""
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

_R66_SQLITE_URL = "sqlite+pysqlite:///file:cat_dash_rpt_meta_r66?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r66_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R66_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    from app.governance.catalog.cat01 import service as cat01_service
    from app.governance.catalog.cat02 import service as cat02_service
    from app.metadata.dataset import service as dataset_service

    cat01_service._store.clear()
    cat02_service._store.clear()
    dataset_service._store.clear()
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
        return UserContext(id="viewer-r66", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat01 import service as cat01_service
    from app.governance.catalog.cat02 import service as cat02_service
    from app.metadata.dataset import service as dataset_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r66", username="enterprise", roles=["enterprise"])

    cat01_service.set_user_entity_scope("enterprise-r66", "ticket")
    cat02_service.set_user_aggregate_scope("enterprise-r66", "AGG")
    dataset_service.set_user_dataset_scope("enterprise-r66", "ds-")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_r66_fixture_bootstraps(client):
    """T-R66-000-01: r66 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def _lifecycle_payload(key: str = "LIFE_OPS") -> dict:
    return {
        "templateKey": key,
        "displayName": "Ops Lifecycle",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active", "closed"],
        "readOnlyOpenApi": True,
        "allowedRoles": ["analyst"],
    }


def _aggregate_payload(key: str = "AGG_SALES") -> dict:
    return {
        "aggregateKey": key,
        "displayName": "Sales Aggregate",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "poc-sales-v1",
        "tableRef": "stub.sales",
    }


def _dataset_payload(dataset_id: str = "ds-demo-orders") -> dict:
    return {
        "datasetId": dataset_id,
        "displayName": "Demo Orders",
        "tables": [{"name": "orders", "alias": "o"}],
        "computedFields": [],
        "allowedRoles": ["analyst"],
    }


def _create_dashboard(client: TestClient, name: str | None = None) -> str:
    dash_name = name or f"R66 Dash {uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": dash_name, "description": "r66 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_report_template(client: TestClient, *, template_kind: str | None = None) -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": f"Tpl-{uuid.uuid4().hex[:6]}",
            "nodeType": "template",
            "templateKind": template_kind,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _seed_report_template(*, template_kind: str | None = None) -> uuid.UUID:
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
    return node.id


def _overview_payload(dashboard_id: str, *, widget_id: str = "w1") -> dict:
    return {
        "dashboardId": dashboard_id,
        "entityTypeRef": "customer",
        "statCards": [{"metricKey": "total_orders", "label": "Orders"}],
        "filters": [],
        "drillTargets": [{"widgetId": widget_id}],
    }


def _chart_table_config() -> dict:
    return {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1 AS id",
    }


def _put_layout_widget(client: TestClient, dash_id: str, widget_id: str | None = None) -> str:
    wid = widget_id or str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "Orders",
                "colSpan": 12,
                "rowSpan": 1,
                "order": 0,
                "chartConfig": _chart_table_config(),
            }
        ],
        "globalFilters": [],
    }
    resp = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert resp.status_code == 200, resp.text
    return wid


# --- CAT-001 ---


def test_cat_r66_001_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R66-001-01: viewer POST create 403 CAT01_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT01_FORBIDDEN"


def test_cat_r66_001_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R66-001-02: enterprise scope 外 entityTypeCode 403 CAT01_FORBIDDEN。"""
    payload = _lifecycle_payload(f"LIFE_{uuid.uuid4().hex[:6].upper()}")
    payload["entityTypeCode"] = "invoice"
    resp = client.post("/api/v1/gov/catalog/lifecycle-templates", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT01_FORBIDDEN"


def test_cat_r66_001_get_unknown_not_found(client):
    """T-CAT-R66-001-03: GET 未知 templateKey 404 CAT01_NOT_FOUND。"""
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates/MISSING_KEY", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT01_NOT_FOUND"


def test_cat_r66_001_stage_move_unknown_stage(client):
    """T-CAT-R66-001-04: stage move 未知 stageName 404 CAT01_STAGE_NOT_FOUND。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    assert client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    ).status_code == 201
    resp = client.post(
        f"/api/v1/gov/catalog/lifecycle-templates/{key}/stages/move",
        headers=AUTH,
        json={"stageName": "missing", "toIndex": 0},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT01_STAGE_NOT_FOUND"


def test_cat_r66_001_probe_list_under_50ms(client):
    """T-CAT-R66-001-05: probe_list_lifecycle_templates_budget_ms < 50ms。"""
    from app.governance.catalog.cat01.probe import probe_list_lifecycle_templates_budget_ms

    result = probe_list_lifecycle_templates_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_001_probe_validate_under_50ms(client):
    """T-CAT-R66-001-06: probe_validate_lifecycle_budget_ms < 50ms。"""
    from app.governance.catalog.cat01.probe import probe_validate_lifecycle_budget_ms

    result = probe_validate_lifecycle_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_001_stage_move_ok(client):
    """T-CAT-R66-001-07: stage move 重排成功 200。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    assert client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    ).status_code == 201
    resp = client.post(
        f"/api/v1/gov/catalog/lifecycle-templates/{key}/stages/move",
        headers=AUTH,
        json={"stageName": "closed", "toIndex": 0},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["lifecycleStages"][0] == "closed"


# --- CAT-002 ---


def test_cat_r66_002_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R66-002-01: viewer POST create 403 CAT02_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates",
        headers=AUTH,
        json=_aggregate_payload(f"AGG_{uuid.uuid4().hex[:6].upper()}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT02_FORBIDDEN"


def test_cat_r66_002_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R66-002-02: enterprise scope 外 aggregateKey 403 CAT02_FORBIDDEN。"""
    payload = _aggregate_payload("OTHER_SCOPE")
    resp = client.post("/api/v1/gov/catalog/aggregate-templates", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT02_FORBIDDEN"


def test_cat_r66_002_duplicate_dimensions(client):
    """T-CAT-R66-002-03: duplicate dimensions 422 CAT02_DUPLICATE_DIMENSION。"""
    payload = _aggregate_payload(f"AGG_{uuid.uuid4().hex[:6].upper()}")
    payload["dimensions"] = ["region", "region"]
    resp = client.post("/api/v1/gov/catalog/aggregate-templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_DUPLICATE_DIMENSION"


def test_cat_r66_002_list_route(client):
    """T-CAT-R66-002-04: GET list aggregate-templates 200。"""
    resp = client.get("/api/v1/gov/catalog/aggregate-templates", headers=AUTH)
    assert resp.status_code == 200
    assert "items" in resp.json()


def test_cat_r66_002_probe_validate_under_50ms(client):
    """T-CAT-R66-002-05: probe_validate_aggregate_budget_ms < 50ms。"""
    from app.governance.catalog.cat02.probe import probe_validate_aggregate_budget_ms

    result = probe_validate_aggregate_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r66_002_probe_list_under_50ms(client):
    """T-CAT-R66-002-06: probe_list_aggregate_budget_ms < 50ms。"""
    from app.governance.catalog.cat02.probe import probe_list_aggregate_budget_ms

    result = probe_list_aggregate_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


# --- DASH-005 ---


def test_dash_r66_005_invalid_entity_type_ref(client):
    """T-DASH-R66-005-01: 非法 entityTypeRef 422 DASH_OVERVIEW_INVALID_ENTITY_TYPE。"""
    dash_id = _create_dashboard(client)
    payload = _overview_payload(dash_id)
    payload["entityTypeRef"] = "Bad-Type"
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_INVALID_ENTITY_TYPE"


def test_dash_r66_005_invalid_drill_widget(client):
    """T-DASH-R66-005-02: drill widget 不在 layout 422 DASH_OVERVIEW_INVALID_DRILL_WIDGET。"""
    dash_id = _create_dashboard(client)
    _put_layout_widget(client, dash_id, widget_id=str(uuid.uuid4()))
    payload = _overview_payload(dash_id)
    payload["drillTargets"] = [{"widgetId": "missing-widget"}]
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_INVALID_DRILL_WIDGET"


def test_dash_r66_005_probe_validate_under_50ms(client):
    """T-DASH-R66-005-03: probe_validate_overview_budget_ms < 50ms。"""
    from app.dashboard.entity_overview.probe import probe_validate_overview_budget_ms
    from app.dashboard.entity_overview.schemas import EntityOverviewItem
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    dash_id = _create_dashboard(client)
    wid = _put_layout_widget(client, dash_id)
    engine = get_meta_engine()
    with Session(engine) as session:
        item = EntityOverviewItem.model_validate(_overview_payload(dash_id, widget_id=wid))
        result = probe_validate_overview_budget_ms(session, item)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r66_005_probe_get_under_50ms(client):
    """T-DASH-R66-005-04: probe_get_overview_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.dashboard.entity_overview.probe import probe_get_overview_budget_ms
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    dash_id = _create_dashboard(client)
    wid = _put_layout_widget(client, dash_id)
    client.put(
        f"/api/v1/dashboards/{dash_id}/entity-overview",
        headers=AUTH,
        json=_overview_payload(dash_id, widget_id=wid),
    )
    engine = get_meta_engine()
    with Session(engine) as session:
        actor = UserContext(id="00000000-0000-0000-0000-000000000001", username="dev", roles=["admin"])
        result = probe_get_overview_budget_ms(session, uuid.UUID(dash_id), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r66_005_forbidden_viewer(client, viewer_user):
    """T-DASH-R66-005-05: 非 owner viewer save 403 DASH_OVERVIEW_FORBIDDEN。"""
    dash_id = _create_dashboard(client)
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/entity-overview",
        headers=AUTH,
        json=_overview_payload(dash_id),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_OVERVIEW_FORBIDDEN"


def test_dash_r66_005_valid_drill_with_layout(client):
    """T-DASH-R66-005-06: layout 含 widget 时 validate 200。"""
    dash_id = _create_dashboard(client)
    wid = _put_layout_widget(client, dash_id)
    resp = client.post(
        "/api/v1/dashboards/entity-overview/validate",
        headers=AUTH,
        json=_overview_payload(dash_id, widget_id=wid),
    )
    assert resp.status_code == 200, resp.text


# --- RPT-001 ---


def test_rpt_r66_001_viewer_run_foreign_forbidden(client, viewer_user):
    """T-RPT-R66-001-01: viewer run 非自有模板 403 RPT_ENGINE_FORBIDDEN。"""
    tid = _seed_report_template(template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ENGINE_FORBIDDEN"


def test_rpt_r66_001_enterprise_scope_forbidden(client, enterprise_user):
    """T-RPT-R66-001-02: enterprise run scope 外模板 403 RPT_ENGINE_FORBIDDEN。"""
    tid = _seed_report_template(template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ENGINE_FORBIDDEN"


def test_rpt_r66_001_invalid_parameter_proto(client):
    """T-RPT-R66-001-03: parameters __proto__ 422 RPT_ENGINE_INVALID_PARAMETER。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web", "parameters": {"__proto__": "x"}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_INVALID_PARAMETER"


def test_rpt_r66_001_probe_under_50ms(client):
    """T-RPT-R66-001-04: probe_run_template_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.reports.engine.probe import probe_run_template_budget_ms
    from app.reports.engine.schemas import RenderRunIn

    tid = uuid.UUID(_create_report_template(client, template_kind=None))
    actor = UserContext(id="00000000-0000-0000-0000-000000000001", username="dev", roles=["admin"])
    result = probe_run_template_budget_ms(tid, RenderRunIn(format="web"), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_rpt_r66_001_unknown_template_404(client):
    """T-RPT-R66-001-05: 未知 template 404 RPT_ENGINE_TEMPLATE_NOT_FOUND。"""
    resp = client.post(
        f"/api/v1/reports/templates/{uuid.uuid4()}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_ENGINE_TEMPLATE_NOT_FOUND"


def test_rpt_r66_001_pdf_not_supported_regression(client):
    """T-RPT-R66-001-06: format=pdf 422 RPT_ENGINE_FORMAT_NOT_SUPPORTED（回归）。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_FORMAT_NOT_SUPPORTED"


def test_rpt_r66_001_enterprise_scope_ok(client, enterprise_user):
    """T-RPT-R66-001-07: enterprise scope 内 run 200。"""
    from app.reports.engine import acl as engine_acl

    tid = _seed_report_template(template_kind=None)
    engine_acl.set_user_engine_scope("enterprise-r66", {tid})
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 200, resp.text


# --- META-004 ---


def test_meta_r66_004_viewer_create_forbidden(client, viewer_user):
    """T-META-R66-004-01: viewer POST create 403 META_DATASET_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json=_dataset_payload(f"ds-{uuid.uuid4().hex[:8]}"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DATASET_FORBIDDEN"


def test_meta_r66_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-META-R66-004-02: enterprise scope 外 datasetId 403 META_DATASET_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json=_dataset_payload("other-scope-dataset"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_DATASET_FORBIDDEN"


def test_meta_r66_004_duplicate_table_name(client):
    """T-META-R66-004-03: duplicate table name 422 META_DATASET_DUPLICATE_TABLE。"""
    payload = _dataset_payload(f"ds-{uuid.uuid4().hex[:8]}")
    payload["tables"] = [{"name": "orders", "alias": "a"}, {"name": "orders", "alias": "b"}]
    resp = client.post("/api/v1/datasets/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DATASET_DUPLICATE_TABLE"


def test_meta_r66_004_probe_validate_under_50ms(client):
    """T-META-R66-004-04: probe_validate_dataset_budget_ms < 50ms。"""
    from app.metadata.dataset import service as dataset_service

    result = dataset_service.probe_validate_dataset_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r66_004_probe_list_under_50ms(client):
    """T-META-R66-004-05: probe_list_datasets_budget_ms < 50ms。"""
    from app.metadata.dataset import service as dataset_service

    result = dataset_service.probe_list_datasets_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_meta_r66_004_enterprise_list_filtered(client, enterprise_user):
    """T-META-R66-004-06: enterprise list 仅返回 scope 前缀项。"""
    from app.auth.deps import UserContext
    from app.metadata.dataset import service as dataset_service
    from app.metadata.dataset.schemas import DatasetItemIn

    admin = UserContext(id="admin-seed", username="admin", roles=["admin"])
    in_scope = _dataset_payload("ds-in-scope")
    out_scope = _dataset_payload("other-out-scope")
    dataset_service.create_dataset(DatasetItemIn.model_validate(in_scope), admin)
    dataset_service.create_dataset(DatasetItemIn.model_validate(out_scope), admin)
    listed = client.get("/api/v1/datasets", headers=AUTH).json()
    ids = {item["datasetId"] for item in listed["items"]}
    assert "ds-in-scope" in ids
    assert "other-out-scope" not in ids
