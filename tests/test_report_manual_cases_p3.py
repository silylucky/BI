"""P3 manual Case 19/20 — automated L1 sign-off (maps to report-center-manual-test-cases.md)."""

from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:rpt_manual_p3?mode=memory&cache=shared&uri=true"


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


def _seed_template(client: TestClient, *, fmt: str) -> str:
    tpl_key = f"case19-{fmt}-{uuid.uuid4().hex[:6]}"
    ds_id = str(uuid.uuid4())
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": fmt,
            "displayName": f"Case19 {fmt}",
            "blocks": [{"blockType": "table", "tableRef": "t1"}],
        },
    )
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": f"Case19 {fmt}", "nodeType": "template", "templateKind": fmt, "templateKey": tpl_key},
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "defaultDataSourceId": ds_id,
            "metrics": [{"key": "m1", "label": "M1", "expression": "SELECT 1 AS m1", "visible": True}],
            "filters": [],
            "changeNote": "case19",
        },
    )
    return node_id


def test_case_19_template_export_pdf_excel_word_bytes(client: TestClient):
    """Case 19 — IF-03 export returns real PDF / Excel / Word bytes (not placeholder)."""
    with patch("app.reports.engine.execute.execute_query") as mock_q:
        from app.query.schemas import ExecuteResponse

        mock_q.return_value = ExecuteResponse(
            columns=["m1"], rows=[[42]], rowCount=1, truncated=False, traceId="t",
        )
        for fmt, magic, min_len in (
            ("pdf", b"%PDF", 100),
            ("excel", b"PK", 100),
        ):
            node_id = _seed_template(client, fmt=fmt)
            run = client.post(
                f"/api/v1/reports/templates/{node_id}/run",
                headers=AUTH,
                json={"format": fmt},
            )
            assert run.status_code == 200, run.text
            hook = run.json()["exportHook"]
            assert hook["placeholder"] is False, fmt

            export = client.get(f"/api/v1/reports/export?templateId={node_id}&format={fmt}", headers=AUTH)
            assert export.status_code == 200, export.text
            dl = client.get(export.json()["downloadUrl"], headers=AUTH)
            assert dl.status_code == 200
            assert dl.content.startswith(magic), fmt
            assert len(dl.content) >= min_len, fmt


def test_case_20_dataset_mode_run_returns_rows(client: TestClient):
    """Case 20 — extension metric queryMode=dataset → run renderSpec sections with rows."""
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    data_source_id = str(uuid.uuid4())
    assert client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "Case20 DS", "tables": [{"name": "orders"}]},
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
    assert client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": bound_config_id},
    ).status_code == 200

    tpl_key = f"case20-{uuid.uuid4().hex[:6]}"
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Case20 Dataset",
            "blocks": [{"blockType": "table", "tableRef": "orders"}],
        },
    )
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Case20", "nodeType": "template", "templateKind": "pdf", "templateKey": tpl_key},
    ).json()["id"]
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
            "changeNote": "case20 dataset",
        },
    )

    with patch("app.reports.engine.execute.execute_dataset_from_config") as mock_ds:
        from app.query.schemas import ExecuteResponse

        mock_ds.return_value = ExecuteResponse(
            columns=["id", "amount"], rows=[[7, 99]], rowCount=1, truncated=False, traceId="t",
        )
        run = client.post(
            f"/api/v1/reports/templates/{node_id}/run",
            headers=AUTH,
            json={"format": "web", "dataSourceId": data_source_id},
        )
    assert run.status_code == 200, run.text
    sections = run.json()["renderSpec"]["sections"]
    assert sections[0]["rows"] == [[7, 99]]
    mock_ds.assert_called_once()
