"""M-FINAL F-F META-001~006 companion pytest (track B)."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.governance.catalog.schemas import CatalogEntryCreate
from app.governance.openapi.schemas import OpenApiMappingCreate
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.physical import gov_refs as physical_gov_refs
from app.metadata.physical import service as physical_service
from app.query.executor import QueryExecutor, QueryResult
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:meta_ff_companion?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ff_meta_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.governance.catalog.models import Base as GovBase
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    GovBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_stores():
    physical_service._store.clear()
    physical_service._ds_table_index.clear()
    entity_service._store.clear()
    entity_service._ref_counts.clear()
    physical_gov_refs.clear_all()
    from app.governance.openapi import service as openapi_service

    openapi_service._store.clear()
    openapi_service._operation_ids.clear()
    from app.metadata.dataset import service as dataset_service

    dataset_service._store.clear()
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def admin_actor() -> Generator[None, None, None]:
    fastapi_app.dependency_overrides[get_current_user] = lambda: UserContext(
        id=str(uuid.uuid4()), username="admin", roles=["admin"]
    )
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_meta_ff_001_field_mapping_crud(client, admin_actor):
    """T-META-FF-001: term field mapping PUT/GET。"""
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "revenue", "name": "营收"},
    ).json()
    put = client.put(
        f"/api/v1/metadata/glossary/{term['id']}/field-mappings",
        headers=AUTH,
        json={"items": [{"tableFqn": "sales.orders", "columnName": "amount"}]},
    )
    assert put.status_code == 200, put.text
    assert put.json()["items"][0]["tableFqn"] == "sales.orders"
    got = client.get(f"/api/v1/metadata/glossary/{term['id']}/field-mappings", headers=AUTH)
    assert got.status_code == 200
    assert len(got.json()["items"]) == 1


def test_meta_ff_002_theme_move_sort_order(client, admin_actor):
    """T-META-FF-002: move API 支持 sortOrder 重排。"""
    a = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "A", "sortOrder": 0}).json()
    b = client.post("/api/v1/metadata/themes", headers=AUTH, json={"name": "B", "sortOrder": 1}).json()
    move = client.post(
        f"/api/v1/metadata/themes/{b['id']}/move",
        headers=AUTH,
        json={"parentId": None, "sortOrder": 0},
    )
    assert move.status_code == 200
    assert move.json()["sortOrder"] == 0


def test_meta_ff_003_dimension_resolve(client, admin_actor):
    """T-META-FF-003: GET /dimensions/resolve?code=。"""
    client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": "region", "name": "区域"},
    )
    ok = client.get("/api/v1/metadata/dimensions/resolve", headers=AUTH, params={"code": "region"})
    assert ok.status_code == 200
    assert ok.json()["code"] == "region"
    missing = client.get("/api/v1/metadata/dimensions/resolve", headers=AUTH, params={"code": "missing"})
    assert missing.status_code == 404


def test_meta_ff_004_computed_fields_in_execute(client, admin_actor):
    """T-META-FF-004: computedFields 注入 SELECT 别名。"""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={
            "datasetId": ds_id,
            "displayName": "Calc",
            "tables": [{"name": "orders"}],
            "computedFields": [{"name": "total_amt", "expression": "amount + tax"}],
        },
    )
    ds_src = str(uuid.uuid4())
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": ds_src,
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["amount", "tax"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": cfg["id"]},
    )

    captured: dict = {}

    def _capture_sql(*args, **kwargs):
        captured["sql"] = kwargs.get("sql") or args[3]
        return QueryResult(columns=["amount", "tax", "total_amt"], rows=[[1, 2, 3]], row_count=1, truncated=False)

    with patch.object(QueryExecutor, "execute_sql", side_effect=_capture_sql):
        resp = client.post(
            "/api/v1/query/dataset/execute",
            headers=AUTH,
            json={"dataSourceId": ds_src, "configId": cfg["id"]},
        )
    assert resp.status_code == 200, resp.text
    assert "total_amt" in captured["sql"]
    assert "amount + tax" in captured["sql"]


def test_meta_ff_005_delete_blocked_by_gov_ref(client, admin_actor):
    """T-META-FF-005: GOV catalog 引用时 DELETE physical 409 + lineage stub。"""
    from app.datasources.models import get_meta_session
    from app.governance.catalog import service as catalog_service

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
    session = get_meta_session()
    try:
        entry = catalog_service.create_entry(
            session,
            CatalogEntryCreate(
                name="Entity API",
                path="/api/v1/services/entity_orders",
                httpMethod="POST",
                categoryCodes=["CAT-01"],
            ),
        )
        entry_id = entry.id
    finally:
        session.close()
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    link = client.post(
        f"/api/v1/gov/publish/entries/{entry_id}/link-physical",
        headers=AUTH,
        json={"tableFqn": "sales.orders"},
    )
    assert link.status_code == 200, link.text
    lineage = client.get("/api/v1/metadata/physical-tables/sales.orders/lineage", headers=AUTH)
    assert lineage.status_code == 200
    assert lineage.json()["stub"] is True
    assert str(entry_id) in lineage.json()["catalogEntryIds"]
    delete = client.delete("/api/v1/metadata/physical-tables/sales.orders", headers=AUTH)
    assert delete.status_code == 409
    assert delete.json()["code"] == "META_PHYSICAL_GOV_IN_USE"


def test_meta_ff_006_unpublish_decrements_entity_ref(client, admin_actor):
    """T-META-FF-006: unpublish 释放 entityTypeRef 引用计数。"""
    from app.datasources.models import get_meta_session
    from app.governance.catalog import service as catalog_service
    from app.governance.openapi import service as openapi_service

    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "equipment", "displayName": "设备", "attributes": []},
    )
    session = get_meta_session()
    try:
        entry = catalog_service.create_entry(
            session,
            CatalogEntryCreate(
                name="Equip API",
                path="/api/v1/services/equip",
                httpMethod="POST",
                categoryCodes=["CAT-01"],
            ),
        )
        entry_id = entry.id
    finally:
        session.close()
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    session = get_meta_session()
    try:
        openapi_service.register_mapping(
            session,
            OpenApiMappingCreate(
                catalogEntryId=entry_id,
                httpMethod="POST",
                path="/api/v1/services/equip",
                operationId="query_equip",
                entityTypeRef="equipment",
                apiVersion="v1",
            ),
        )
    finally:
        session.close()
    assert entity_service._ref_counts.get("equipment") == 1
    unpublish = client.post(f"/api/v1/gov/publish/entries/{entry_id}/unpublish", headers=AUTH)
    assert unpublish.status_code == 200, unpublish.text
    assert entity_service._ref_counts.get("equipment", 0) == 0
