"""Template readiness + default datasource on extension."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.reports.catalog import service as catalog_service
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.extension import service as extension_service
from app.reports.extension.schemas import ExtensionConfigUpsert, MetricAdjustment
from app.reports.engine.schemas import RenderRunIn
from app.reports.engine import service as engine_service
from app.reports.templates.schemas import TemplateBlock, TemplateDefinitionIn
from app.reports.templates import service as template_service
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:report_readiness?mode=memory&cache=shared&uri=true"
_ADMIN = UserContext(id="admin", username="admin", roles=["admin"], is_root=False)


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.datasources.models import Base, get_meta_engine
    import app.auth.models  # noqa: F401

    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_stores():
    from app.reports.templates import service as template_service

    catalog_service._nodes.clear()
    extension_service._store.clear()
    extension_service._audit_log.clear()
    template_service._store.clear()
    yield
    catalog_service._nodes.clear()
    extension_service._store.clear()
    extension_service._audit_log.clear()
    template_service._store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _create_template_node() -> uuid.UUID:
    key = f"readiness_tpl_{uuid.uuid4().hex[:8]}"
    template_service.upsert_template_definition(
        key,
        TemplateDefinitionIn(
            templateKey=key,
            format="pdf",
            displayName="Readiness Tpl",
            blocks=[TemplateBlock(blockType="table", tableRef="sales")],
        ),
        _ADMIN,
    )
    node = catalog_service.create_node(
        CatalogNodeCreate(name="Readiness Tpl", nodeType="template", templateKind="pdf", templateKey=key),
        _ADMIN,
    )
    return node.id


def test_template_readiness_live_with_default_datasource(client: TestClient):
    node_id = _create_template_node()
    ds_id = uuid.uuid4()
    extension_service.upsert(
        node_id,
        ExtensionConfigUpsert(
            catalogNodeId=node_id,
            metrics=[MetricAdjustment(key="amount", label="Amount", expression="SELECT 1 AS amount")],
            defaultDataSourceId=ds_id,
        ),
        _ADMIN,
    )
    resp = client.post(
        "/api/v1/reports/catalog/templates/readiness",
        headers=AUTH,
        json={"nodeIds": [str(node_id)]},
    )
    assert resp.status_code == 200
    assert resp.json()["items"][0]["readiness"] == "live"


def test_template_readiness_demo_without_extension(client: TestClient):
    node_id = _create_template_node()
    resp = client.post(
        "/api/v1/reports/catalog/templates/readiness",
        headers=AUTH,
        json={"nodeIds": [str(node_id)]},
    )
    assert resp.json()["items"][0]["readiness"] == "demo"


def test_run_without_datasource_returns_placeholder_not_error(client: TestClient):
    node_id = _create_template_node()
    extension_service.upsert(
        node_id,
        ExtensionConfigUpsert(
            catalogNodeId=node_id,
            metrics=[MetricAdjustment(key="amount", label="Amount", expression="SELECT 1 AS amount")],
        ),
        _ADMIN,
    )
    out = engine_service.run_template(
        node_id,
        RenderRunIn(format="web", parameters={}),
        _ADMIN,
    )
    assert out.status == "ready"
    assert out.render_spec.sections[0]["placeholder"] is True
