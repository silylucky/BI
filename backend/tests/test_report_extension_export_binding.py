"""报表扩展绑定：失效数据集/配置时的查数与保存校验。"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.metadata.dataset.errors import DatasetError
from app.reports.catalog import service as catalog_service
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.engine.errors import ReportEngineError
from app.reports.engine.execute import _resolve_dataset_metric_binding
from app.reports.errors import ReportExtensionError
from app.reports.extension import service as extension_service
from app.reports.extension.schemas import ExtensionConfigUpsert, MetricAdjustment

_ADMIN = UserContext(id="admin", username="admin", roles=["admin"], is_root=False)
_SQLITE = "sqlite+pysqlite:///file:report_ext_export_bind?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.datasources.models import Base, get_meta_engine

    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


@pytest.fixture(autouse=True)
def _reset_stores():
    catalog_service._nodes.clear()
    extension_service._store.clear()
    extension_service._audit_log.clear()
    yield
    catalog_service._nodes.clear()
    extension_service._store.clear()
    extension_service._audit_log.clear()


@pytest.fixture()
def db_session() -> Session:
    from app.datasources.models import get_meta_engine

    session = Session(bind=get_meta_engine())
    yield session
    session.close()


@dataclass
class _FakeDataset:
    bound_config_id: uuid.UUID | None


def _template_node_id() -> uuid.UUID:
    node = catalog_service.create_node(
        CatalogNodeCreate(name="Export Tpl", nodeType="template", templateKind="pdf"),
        _ADMIN,
    )
    return node.id


def test_resolve_missing_dataset_does_not_use_stale_config(db_session: Session) -> None:
    stale_config = uuid.uuid4()
    metric = MetricAdjustment(
        key="sales",
        label="销售",
        datasetId="de_map_city_clean",
        boundConfigId=stale_config,
    )
    with patch(
        "app.metadata.dataset.service.get_dataset",
        side_effect=DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404),
    ):
        with pytest.raises(ReportEngineError) as exc:
            _resolve_dataset_metric_binding(db_session, metric)
    assert exc.value.code == "RPT_ENGINE_QUERY_FAILED"
    assert "de_map_city_clean" in exc.value.message
    assert "Config record not found" not in exc.value.message


def test_validate_extension_rejects_missing_dataset() -> None:
    node_id = _template_node_id()
    payload = ExtensionConfigUpsert(
        catalogNodeId=node_id,
        metrics=[
            MetricAdjustment(
                key="sales",
                label="销售",
                datasetId="missing-dataset",
                boundConfigId=uuid.uuid4(),
            ),
        ],
        changeNote="test",
    )
    with patch(
        "app.metadata.dataset.service.get_dataset",
        side_effect=DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404),
    ):
        with pytest.raises(ReportExtensionError) as exc:
            extension_service.upsert(node_id, payload, _ADMIN)
    assert exc.value.code == "RPT_EXT_DATASET_NOT_FOUND"


def test_sync_metric_bindings_refreshes_bound_config_on_save() -> None:
    node_id = _template_node_id()
    stale = uuid.uuid4()
    live = uuid.uuid4()
    payload = ExtensionConfigUpsert(
        catalogNodeId=node_id,
        metrics=[
            MetricAdjustment(
                key="sales",
                label="销售",
                datasetId="demo-v-sales-geo",
                boundConfigId=stale,
            ),
        ],
        changeNote="refresh binding",
    )
    with patch(
        "app.metadata.dataset.service.get_dataset",
        return_value=_FakeDataset(bound_config_id=live),
    ):
        saved = extension_service.upsert(node_id, payload, _ADMIN)
    assert saved.metrics[0].bound_config_id == live
