"""Integration: template crosstab block run + export."""

from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:rpt_crosstab_tpl?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.auth.models  # noqa: F401
    import app.reports.persistence.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset():
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    yield
    reset_metadata_for_tests()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_template_crosstab_run_and_export_pdf(client: TestClient) -> None:
    tpl_key = f"xtab-{uuid.uuid4().hex[:8]}"
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Crosstab Demo",
            "blocks": [{
                "blockType": "crosstab",
                "tableRef": "sales",
                "rowField": "region",
                "colField": "month",
                "valueField": "amount",
            }],
        },
    )
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": "Crosstab Node",
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": tpl_key,
        },
    ).json()["id"]
    ds_id = uuid.uuid4()
    bound_id = uuid.uuid4()
    with patch("app.metadata.dataset.service.get_dataset") as mock_dataset:
        mock_dataset.return_value = type("Ds", (), {"bound_config_id": bound_id})()
        ext = client.put(
            f"/api/v1/reports/catalog/nodes/{node_id}/extension",
            headers=AUTH,
            json={
                "catalogNodeId": node_id,
                "defaultDataSourceId": str(uuid.uuid4()),
                "metrics": [{
                    "key": "sales",
                    "label": "Sales",
                    "queryMode": "dataset",
                    "datasetId": str(ds_id),
                    "boundConfigId": str(bound_id),
                    "visible": True,
                }],
                "filters": [],
                "changeNote": "crosstab",
            },
        )
    assert ext.status_code == 200, ext.text
    with patch("app.reports.engine.service.engine_execute.build_sections_from_extension") as mock_ext:
        mock_ext.return_value = ([{
            "kind": "table",
            "metricKey": "sales",
            "columns": ["region", "month", "amount"],
            "rows": [["华东", "1月", 10], ["华东", "2月", 20], ["华北", "1月", 5]],
        }], 1.0, {})
        run = client.post(
            f"/api/v1/reports/templates/{node_id}/run",
            headers=AUTH,
            json={"format": "web"},
        )
    assert run.status_code == 200, run.text
    sections = run.json()["renderSpec"]["sections"]
    assert len(sections) == 1
    assert sections[0]["kind"] == "crosstab"
    assert sections[0]["matrix"] == [[10, 20], [5, 0]]

    with patch("app.reports.engine.service.engine_execute.build_sections_from_extension") as mock_ext:
        mock_ext.return_value = ([{
            "kind": "table",
            "metricKey": "sales",
            "columns": ["region", "month", "amount"],
            "rows": [["华东", "1月", 10], ["华东", "2月", 20], ["华北", "1月", 5]],
        }], 1.0, {})
        from app.auth.deps import UserContext
        from app.reports.engine.service import export_template_bytes

        pdf = export_template_bytes(
            uuid.UUID(node_id),
            "pdf",
            UserContext(id="admin", username="admin", roles=["editor"]),
        )
    assert pdf.startswith(b"%PDF")
