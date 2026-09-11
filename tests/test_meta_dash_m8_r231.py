"""M8 r231 — META-005/006 + DASH-004 BE companion + DASH-005 数据链 pytest."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.auth.resources.service import VisibilityError
from app.core.config import get_settings
from app.datasources.schemas import ColumnItemOut, ColumnListResponse
from app.datasources.service import DataSourceError
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.physical import service as physical_service
from app.query.schemas import ExecuteResponse, QueryError
from app.query.sql_parameters import build_widget_filter_params, inject_sql_parameters
from jwt_auth import AUTH, jwt_auth_headers

_R231_SQLITE_URL = "sqlite+pysqlite:///file:meta_dash_m8_r231?mode=memory&cache=shared&uri=true"
_R231_WIDGET_ID = "33333333-3333-4333-8333-333333333333"


@pytest.fixture(scope="module", autouse=True)
def r231_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R231_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    physical_service._store.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_meta_stores():
    physical_service._store.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    yield
    physical_service._store.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000099", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="enterprise-r231", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _register_schema_payload(ds_id: str | None = None) -> dict:
    return {
        "dataSourceId": ds_id or str(uuid.uuid4()),
        "schema": "sales",
        "table": "orders",
        "displayName": "订单表",
        "entityTypeCode": "order",
    }


def _physical_direct(fqn: str, entity_type: str | None = None) -> dict:
    return {
        "tableFqn": fqn,
        "dataSourceId": str(uuid.uuid4()),
        "displayName": f"Table {fqn}",
        "entityTypeCode": entity_type,
        "columns": [{"name": "id", "dataType": "bigint", "nullable": False}],
    }


def _create_dashboard_with_widget(client: TestClient, sql: str | None = None, widget_id: str = _R231_WIDGET_ID) -> str:
    create = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"R231-{uuid.uuid4().hex[:6]}", "description": "r231 fixture"},
    )
    assert create.status_code == 201, create.text
    dash_id = create.json()["id"]
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": widget_id,
                "type": "chart",
                "title": "w1",
                "colSpan": 12,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": sql or "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }
    put = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text
    return dash_id


def _filter_linkage_payload(dashboard_id: str, widget_id: str = _R231_WIDGET_ID) -> dict:
    return {
        "dashboardId": dashboard_id,
        "filters": [{"filterId": "f1", "dimensionRef": "region", "defaultValue": "CN"}],
        "linkageRules": [{"sourceFilterId": "f1", "targetWidgetIds": [widget_id], "parameterKey": "region"}],
        "refreshMode": "eager",
    }


# --- META-005 ---


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r231_005_01_register_from_schema_201(mock_list_columns, client):
    """T-META-R231-005-01: register-from-schema 201 + columns。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[
            ColumnItemOut(name="id", data_type="bigint", nullable=False),
            ColumnItemOut(name="amount", data_type="decimal", nullable=True),
            ColumnItemOut(name="region", data_type="string", nullable=True),
        ]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    resp = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["tableFqn"] == "sales.orders"
    assert len(body["columns"]) == 3


def test_meta_r231_005_02_unknown_datasource_404(client):
    """T-META-R231-005-02: DATASOURCE_NOT_FOUND → 404。"""
    payload = {
        "dataSourceId": str(uuid.uuid4()),
        "schema": "sales",
        "table": "orders",
        "displayName": "订单表",
    }
    with patch(
        "app.datasources.metadata.service.list_columns",
        side_effect=DataSourceError("DATASOURCE_NOT_FOUND", "missing", 404),
    ):
        resp = client.post(
            "/api/v1/metadata/physical-tables/register-from-schema",
            headers=AUTH,
            json=payload,
        )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DATASOURCE_NOT_FOUND"


def test_meta_r231_005_03_viewer_forbidden(client, viewer_user):
    """T-META-R231-005-03: viewer POST → 403 META_PHYSICAL_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "META_PHYSICAL_FORBIDDEN"


def test_meta_r231_005_04_list_filter_entity_type_code(client):
    """T-META-R231-005-04: GET ?entityTypeCode=order 过滤。"""
    client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_direct("sales.orders", "order"))
    client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_direct("sales.customers", "customer"))
    resp = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"entityTypeCode": "order"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["tableFqn"] == "sales.orders"


# --- META-006 ---


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r231_006_01_chain_register_type_bindings(mock_list_columns, client):
    """T-META-R231-006-01: 登记→类型配置→query-bindings 主链。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "order",
            "displayName": "订单",
            "attributes": [{"name": "amount", "dataType": "number"}],
        },
    )
    reg = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert reg.status_code == 201
    put = client.put(
        "/api/v1/metadata/entity-types/order",
        headers=AUTH,
        json={
            "displayName": "订单实体",
            "attributes": [{"name": "amount", "dataType": "number", "required": True}],
            "physicalTableFqn": "sales.orders",
        },
    )
    assert put.status_code == 200
    bindings = client.get("/api/v1/metadata/entity-types/order/query-bindings", headers=AUTH)
    assert bindings.status_code == 200
    names = {b["name"] for b in bindings.json()["bindings"]}
    assert "amount" in names


def test_meta_r231_006_02_unknown_physical_fqn_422(client):
    """T-META-R231-006-02: unknown physicalTableFqn → 422。"""
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "ghost",
            "displayName": "Ghost",
            "attributes": [],
            "physicalTableFqn": "missing.table",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_PHYSICAL_NOT_FOUND"


def test_meta_r231_006_03_mapping_conflict_409(client):
    """T-META-R231-006-03: physical 已映射其他类型 → 409。"""
    client.post("/api/v1/metadata/entity-types", headers=AUTH, json={"typeCode": "order", "displayName": "O", "attributes": []})
    client.post("/api/v1/metadata/entity-types", headers=AUTH, json={"typeCode": "customer", "displayName": "C", "attributes": []})
    client.post(
        "/api/v1/metadata/physical-tables",
        headers=AUTH,
        json=_physical_direct("sales.orders", "order"),
    )
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "other",
            "displayName": "Other",
            "attributes": [],
            "physicalTableFqn": "sales.orders",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_MAPPING_CONFLICT"


def test_meta_r231_006_04_create_with_physical_binds(client):
    """T-META-R231-006-04: create entity + physicalTableFqn 回写 physical。"""
    client.post("/api/v1/metadata/physical-tables", headers=AUTH, json=_physical_direct("sales.orders"))
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "order",
            "displayName": "订单",
            "attributes": [],
            "physicalTableFqn": "sales.orders",
        },
    )
    assert resp.status_code == 201
    got = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "sales.orders"})
    assert got.status_code == 200
    assert got.json()["entityTypeCode"] == "order"


# --- DASH-004 ---


def test_dash_r231_004_sql_parameters_mirror_fe():
    """T-DASH-R231-004-01: inject_sql_parameters 与 FE 对称。"""
    sql = inject_sql_parameters("SELECT * FROM t WHERE region = '{{region}}'", {"region": "east"})
    assert "east" in sql
    with pytest.raises(QueryError) as exc:
        inject_sql_parameters("{{x}}", {"x": "a;drop"})
    assert exc.value.code == "QUERY_FILTER_UNSAFE"


def test_dash_r231_004_build_params_linked_widget():
    """T-DASH-R231-004-02: build_widget_filter_params linkage。"""
    params = build_widget_filter_params(
        "w1",
        {
            "linkageRules": [
                {"sourceFilterId": "f1", "targetWidgetIds": ["w1"], "parameterKey": "region"},
            ],
        },
        {"f1": "east"},
    )
    assert params == {"region": "east"}


@patch("app.query.service.execute_query")
def test_dash_r231_004_execute_merges_linkage(mock_execute, client):
    """T-DASH-R231-004-03: execute 合并 linkage 注入 SQL。"""
    dash_id = _create_dashboard_with_widget(client, sql="SELECT * FROM t WHERE region = '{{region}}'")
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    mock_execute.return_value = ExecuteResponse(
        columns=["c"], rows=[[1]], rowCount=1, truncated=False, traceId="t"
    )
    resp = client.post(
        f"/api/v1/dashboards/{dash_id}/widgets/{_R231_WIDGET_ID}/execute",
        headers=AUTH,
        json={"filterValues": {"f1": "east"}},
    )
    assert resp.status_code == 200
    called_sql = mock_execute.call_args[0][2].sql
    assert "east" in called_sql


def test_dash_r231_004_unsafe_filter_422(client):
    """T-DASH-R231-004-04: 非法 filterValues → 422 QUERY_FILTER_UNSAFE。"""
    dash_id = _create_dashboard_with_widget(client, sql="SELECT * FROM t WHERE region = '{{region}}'")
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    resp = client.post(
        f"/api/v1/dashboards/{dash_id}/widgets/{_R231_WIDGET_ID}/execute",
        headers=AUTH,
        json={"filterValues": {"f1": "bad;drop"}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_FILTER_UNSAFE"


@patch("app.query.service.assert_visible")
def test_dash_r231_004_acl_forbidden_403(mock_visible, client):
    """T-DASH-R231-004-05: assert_visible 拒绝 → 403。"""
    mock_visible.side_effect = VisibilityError("DATASOURCE_FORBIDDEN", "out of scope", 403)
    dash_id = _create_dashboard_with_widget(client, sql="SELECT * FROM t WHERE region = '{{region}}'")
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    resp = client.post(
        f"/api/v1/dashboards/{dash_id}/widgets/{_R231_WIDGET_ID}/execute",
        headers=AUTH,
        json={"filterValues": {"f1": "east"}},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DATASOURCE_FORBIDDEN"


def test_dash_r231_004_widget_not_found_404(client):
    """T-DASH-R231-004-06: 未知 widgetId → 404。"""
    dash_id = _create_dashboard_with_widget(client)
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    resp = client.post(
        f"/api/v1/dashboards/{dash_id}/widgets/missing-widget/execute",
        headers=AUTH,
        json={"filterValues": {}},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_FILTER_WIDGET_NOT_FOUND"


@patch("app.query.service.execute_query")
def test_dash_r231_004_viewer_execute_200(mock_execute, client, viewer_user):
    """T-DASH-R231-004-07: viewer 只读 execute 200。"""
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    dash_id = _create_dashboard_with_widget(client, sql="SELECT 1")
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000099", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    mock_execute.return_value = ExecuteResponse(
        columns=["c"], rows=[[1]], rowCount=1, truncated=False, traceId="t"
    )
    resp = client.post(
        f"/api/v1/dashboards/{dash_id}/widgets/{_R231_WIDGET_ID}/execute",
        headers=AUTH,
        json={"filterValues": {}},
    )
    assert resp.status_code == 200
    fastapi_app.dependency_overrides.pop(get_current_user, None)
