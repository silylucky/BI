"""demo-package status 组装逻辑。"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.dashboard.demo_package.status import build_demo_package_status
from app.dashboard.templates.official_demo_bootstrap import SchemaBootstrapResult
from app.metadata.dataset.demo_seed import DEMO_DATASET_IDS


def test_build_demo_package_status_ready() -> None:
    db = MagicMock()
    ds_id = uuid.uuid4()
    dash_id = uuid.uuid4()

    from app.dashboard import demo_package

    original_probe = demo_package.status.probe_sample_db_schema
    original_resolve_ds = demo_package.status.resolve_sample_db_datasource_id
    original_resolve_ids = demo_package.status.resolve_demo_instance_ids
    original_resolve_datasets = demo_package.status.resolve_demo_dataset_ids

    try:
        demo_package.status.probe_sample_db_schema = lambda: SchemaBootstrapResult(
            mysql_reachable=True,
            schema_version=4,
            applied_count=0,
        )
        demo_package.status.resolve_sample_db_datasource_id = lambda _db: ds_id
        demo_package.status.resolve_demo_instance_ids = lambda _db: [dash_id, dash_id, dash_id]
        demo_package.status.resolve_demo_dataset_ids = lambda _db: list(DEMO_DATASET_IDS)

        status = build_demo_package_status(db)
        assert status.ready is True
        assert status.datasource_id == ds_id
        assert status.schema_version == 4
        assert len(status.demo_dataset_ids) == len(DEMO_DATASET_IDS)
        assert status.message is None
    finally:
        demo_package.status.probe_sample_db_schema = original_probe
        demo_package.status.resolve_sample_db_datasource_id = original_resolve_ds
        demo_package.status.resolve_demo_instance_ids = original_resolve_ids
        demo_package.status.resolve_demo_dataset_ids = original_resolve_datasets


def test_build_demo_package_status_not_ready_when_mysql_down() -> None:
    db = MagicMock()
    from app.dashboard import demo_package

    original_probe = demo_package.status.probe_sample_db_schema
    try:
        demo_package.status.probe_sample_db_schema = lambda: SchemaBootstrapResult(
            mysql_reachable=False,
            schema_version=0,
            applied_count=0,
            message="down",
        )
        status = build_demo_package_status(db)
        assert status.ready is False
        assert status.mysql_reachable is False
        assert status.message == "down"
    finally:
        demo_package.status.probe_sample_db_schema = original_probe
