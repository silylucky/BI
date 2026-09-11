"""Template real export via RenderSpec renderer."""
from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from app.reports.engine.service import export_template_bytes
from app.reports.render.render_from_spec import render_document
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:rpt_real_export?mode=memory&cache=shared&uri=true"


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


def test_render_pdf_from_sections():
    spec = {
        "sections": [{"kind": "table", "columns": ["a", "b"], "rows": [[1, 2]], "metricKey": "m1"}],
    }
    data = render_document(spec, "pdf", title="Test")
    assert data.startswith(b"%PDF")


def test_render_pdf_with_cjk_cells():
    spec = {
        "sections": [{
            "kind": "table",
            "columns": ["province", "amount"],
            "rows": [["上海市", 12197], ["广东省", 37657]],
            "metricKey": "demo",
        }],
    }
    data = render_document(spec, "pdf", title="模板1")
    assert data.startswith(b"%PDF")
    assert len(data) > 512


def test_render_excel_from_sections():
    spec = {
        "sections": [{"kind": "table", "columns": ["a"], "rows": [[1]], "metricKey": "m1"}],
    }
    data = render_document(spec, "excel", title="Test")
    assert data[:2] == b"PK"
    assert len(data) > 100

def test_export_template_bytes_with_mock_query(client: TestClient):
    tpl_key = f"tpl-{uuid.uuid4().hex[:8]}"
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Export Test",
            "blocks": [{"blockType": "sql", "queryRef": "SELECT 1"}],
        },
    )
    folder = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Export Folder", "nodeType": "folder"},
    )
    parent_id = folder.json()["id"]
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": "Export Node",
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": tpl_key,
            "parentId": parent_id,
        },
    )
    node_id = node.json()["id"]
    ds_id = uuid.uuid4()
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "defaultDataSourceId": str(ds_id),
            "metrics": [{"key": "total", "label": "Total", "expression": "SELECT 1 AS total", "visible": True}],
            "filters": [],
            "changeNote": "init",
        },
    )
    with patch("app.reports.engine.execute.execute_query") as mock_q:
        from app.query.schemas import ExecuteResponse

        mock_q.return_value = ExecuteResponse(columns=["total"], rows=[[42]], rowCount=1, truncated=False, traceId="t")
        from app.auth.deps import UserContext

        actor = UserContext(id="admin", username="admin", roles=["admin"])
        pdf = export_template_bytes(uuid.UUID(node_id), "pdf", actor)
    assert pdf.startswith(b"%PDF")
