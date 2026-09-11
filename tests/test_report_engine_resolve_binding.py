"""Report engine resolves live dataset binding over stale metric snapshot."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.reports.engine.execute import _resolve_dataset_metric_binding
from app.reports.extension.schemas import MetricAdjustment


def test_resolve_prefers_live_dataset_bound_config(monkeypatch):
    data_source_id = uuid.uuid4()
    stale_config_id = uuid.uuid4()
    live_config_id = uuid.uuid4()
    dataset_id = "ds-resolve-live"

    class FakeDataset:
        bound_config_id = live_config_id

    monkeypatch.setattr(
        "app.metadata.dataset.service.get_dataset",
        lambda _dataset_id: FakeDataset(),
    )

    record = MagicMock()
    record.payload = {
        "dataSourceId": str(data_source_id),
        "connectorType": "postgresql",
        "schema": "public",
        "table": "t1",
        "columns": ["a", "b"],
        "conditions": {"logic": "AND", "conditions": []},
        "limit": 10,
        "offset": 0,
    }
    monkeypatch.setattr(
        "app.reports.engine.execute.get_config_by_id",
        lambda _db, config_id: record,
    )

    metric = MetricAdjustment(
        key="m1",
        label="M1",
        queryMode="dataset",
        datasetId=dataset_id,
        boundConfigId=stale_config_id,
        visible=True,
    )

    resolved_ds, resolved_cfg = _resolve_dataset_metric_binding(MagicMock(), metric)

    assert resolved_cfg == live_config_id
    assert resolved_ds == data_source_id
