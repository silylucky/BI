"""Report engine dataset bridge — extension metric queryMode=dataset."""
from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:rpt_dataset_bridge?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    prev_meta = os.environ.get("RPT_METADATA_STORE")
    os.environ["DATABASE_URL"] = _SQLITE
    os.environ["RPT_METADATA_STORE"] = "memory"
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.reports.persistence.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    if prev_meta is None:
        os.environ.pop("RPT_METADATA_STORE", None)
    else:
        os.environ["RPT_METADATA_STORE"] = prev_meta
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset():
    from app.metadata.dataset import service as dataset_service
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    dataset_service._store.clear()
    yield
    reset_metadata_for_tests()
    dataset_service._store.clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_extension_metric_dataset_mode_returns_rows(client: TestClient):
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    data_source_id = str(uuid.uuid4())
    assert client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "Report DS", "tables": [{"name": "orders"}]},
    ).status_code == 201

    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": data_source_id,
                "connectorType": "mysql",
                "schema": "demo",
                "table": "orders",
                "columns": ["id", "amount"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 10,
                "offset": 0,
            },
        },
    ).json()
    bound_config_id = cfg["id"]
    bind = client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": bound_config_id},
    )
    assert bind.status_code == 200

    tpl_key = f"tpl-{uuid.uuid4().hex[:8]}"
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Dataset Report",
            "blocks": [{"blockType": "table", "tableRef": "orders"}],
        },
    )
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": "Dataset Node",
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": tpl_key,
        },
    )
    node_id = node.json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "defaultDataSourceId": data_source_id,
            "metrics": [
                {
                    "key": "orders",
                    "label": "Orders",
                    "queryMode": "dataset",
                    "datasetId": ds_id,
                    "boundConfigId": bound_config_id,
                    "visible": True,
                },
            ],
            "filters": [],
            "changeNote": "dataset bridge",
        },
    )

    with patch("app.reports.engine.execute.execute_dataset_from_config") as mock_ds:
        from app.query.schemas import ExecuteResponse

        mock_ds.return_value = ExecuteResponse(
            columns=["id", "amount"],
            rows=[[1, 100]],
            rowCount=1,
            truncated=False,
            traceId="t",
        )
        run = client.post(
            f"/api/v1/reports/templates/{node_id}/run",
            headers=AUTH,
            json={"format": "web", "dataSourceId": data_source_id},
        )
    assert run.status_code == 200, run.text
    sections = run.json()["renderSpec"]["sections"]
    assert len(sections) == 1
    assert sections[0]["rows"] == [[1, 100]]
    mock_ds.assert_called_once()
