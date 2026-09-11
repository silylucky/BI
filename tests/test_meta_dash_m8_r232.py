"""M8 r232 — META-005/006 收官 pytest。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.datasources.schemas import ColumnItemOut, ColumnListResponse
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.physical import service as physical_service
from jwt_auth import AUTH

_R232_SQLITE_URL = "sqlite+pysqlite:///file:meta_dash_m8_r232?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r232_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R232_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
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
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    yield
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r232", username="viewer", roles=["viewer"])

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


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_01_register_from_schema_has_source_fields(mock_list_columns, client):
    """T-META-R232-005-01: register-from-schema 含 sourceSchema/sourceTable。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
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
    assert body["sourceSchema"] == "sales"
    assert body["sourceTable"] == "orders"
    got = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "sales.orders"})
    assert got.status_code == 200
    assert got.json()["sourceSchema"] == "sales"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_02_ds_table_conflict_409(mock_list_columns, client):
    """T-META-R232-005-02: 同 dataSourceId+schema+table 二次登记 → 409。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    ds_id = str(uuid.uuid4())
    payload = _register_schema_payload(ds_id)
    first = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=payload,
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json={**payload, "tableFqn": "other.orders"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "META_PHYSICAL_DS_TABLE_CONFLICT"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_005_03_put_delete_crud(mock_list_columns, client):
    """T-META-R232-005-03: PUT displayName + DELETE 204 + GET 404。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    reg = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert reg.status_code == 201
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"displayName": "订单实体表"},
    )
    assert put.status_code == 200
    assert put.json()["displayName"] == "订单实体表"
    delete = client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH)
    assert delete.status_code == 204
    got = client.get("/api/v1/metadata/physical-tables", headers=AUTH, params={"fqn": "sales.orders"})
    assert got.status_code == 404
    assert got.json()["code"] == "META_PHYSICAL_NOT_FOUND"


def test_meta_r232_005_04_viewer_put_delete_forbidden(client, viewer_user):
    """T-META-R232-005-04: viewer PUT/DELETE → 403 META_PHYSICAL_FORBIDDEN。"""
    client.post(
        "/api/v1/metadata/physical-tables",
        headers=AUTH,
        json={
            "tableFqn": "sales.orders",
            "dataSourceId": str(uuid.uuid4()),
            "displayName": "订单",
            "columns": [{"name": "id", "dataType": "bigint", "nullable": False}],
        },
    )
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"displayName": "x"},
    )
    assert put.status_code == 403
    assert put.json()["code"] == "META_PHYSICAL_FORBIDDEN"
    delete = client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH)
    assert delete.status_code == 403


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_01_lifecycle_chain_delete_type(mock_list_columns, client):
    """T-META-R232-006-01: 登记→删 physical→删 type 全链 204。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    reg = client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    )
    assert reg.status_code == 201
    assert client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH).status_code == 204
    del_type = client.delete("/api/v1/metadata/entity-types/order", headers=AUTH)
    assert del_type.status_code == 204


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_02_delete_type_in_use_409(mock_list_columns, client):
    """T-META-R232-006-02: 有登记引用时删 type → 409 META_ENTITY_TYPE_IN_USE。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    assert client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json=_register_schema_payload(),
    ).status_code == 201
    resp = client.delete("/api/v1/metadata/entity-types/order", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_IN_USE"


@patch("app.datasources.metadata.service.list_columns")
def test_meta_r232_006_03_put_rebind_entity_type(mock_list_columns, client):
    """T-META-R232-006-03: PUT 改绑 entityTypeCode 后 list filter 正确。"""
    mock_list_columns.return_value = ColumnListResponse(
        items=[ColumnItemOut(name="id", data_type="bigint", nullable=False)]
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "order", "displayName": "订单", "attributes": []},
    )
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "customer", "displayName": "客户", "attributes": []},
    )
    client.post(
        "/api/v1/metadata/physical-tables/register-from-schema",
        headers=AUTH,
        json={**_register_schema_payload(), "entityTypeCode": "order"},
    )
    put = client.put(
        "/api/v1/metadata/physical-tables/sales.orders",
        headers=AUTH,
        json={"entityTypeCode": "customer"},
    )
    assert put.status_code == 200
    listed = client.get(
        "/api/v1/metadata/physical-tables",
        headers=AUTH,
        params={"entityTypeCode": "customer"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["entityTypeCode"] == "customer"


def test_meta_r232_006_04_validate_invalid_attr_422(client):
    """T-META-R232-006-04: POST validate 非法 attribute → 422（r54 回归）。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "bad",
            "displayName": "Bad",
            "attributes": [{"name": "1invalid", "dataType": "string"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_ENTITY_TYPE_INVALID_ATTR"


def test_meta_r232_005_05_probe_budget_regression(client):
    """T-META-R232-005-05: probe_validate/list 预算回归（r65 锚点）。"""
    from app.metadata.physical.service import (
        probe_list_physical_tables_budget_ms,
        probe_validate_physical_budget_ms,
    )

    assert probe_validate_physical_budget_ms().ok is True
    assert probe_list_physical_tables_budget_ms().ok is True
