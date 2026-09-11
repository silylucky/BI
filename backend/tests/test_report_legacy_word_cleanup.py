"""Tests for legacy report catalog cleanup."""

from __future__ import annotations

import pytest

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.reports.catalog import service as catalog_service
from app.reports.catalog.legacy_cleanup import purge_legacy_word_template_nodes
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.extension.schemas import ExtensionConfigUpsert, MetricAdjustment
from app.reports.extension import service as extension_service
from app.reports.persistence import catalog_repo, extension_repo, memory_stores
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleRecipientIn
from app.reports.scheduler.store import get_schedule_store

_EDITOR = UserContext(id="test-editor", username="editor", roles=["editor"])


@pytest.fixture(autouse=True)
def memory_report_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RPT_METADATA_STORE", "memory")
    monkeypatch.setenv("RPT_SCHEDULE_STORE", "memory")
    get_settings.cache_clear()
    memory_stores.clear_all()
    get_schedule_store().clear()


def test_purge_legacy_word_template_nodes_removes_catalog_and_extension() -> None:
    node = catalog_service.create_node(
        CatalogNodeCreate(
            name="Legacy Word",
            nodeType="template",
            templateKind="pdf",
        ),
        _EDITOR,
    )
    raw = catalog_repo.get_node(node.id)
    assert raw is not None
    raw["template_kind"] = "word"
    catalog_repo.save_node(raw)

    extension_service.upsert(
        node.id,
        ExtensionConfigUpsert(
            catalogNodeId=node.id,
            metrics=[MetricAdjustment(key="m1", label="指标", visible=True)],
            filters=[],
            changeNote="legacy word",
        ),
        _EDITOR,
    )
    schedule = scheduler_service.create_schedule(
        ScheduleCreate(
            catalogNodeId=node.id,
            sourceId=node.id,
            cron="0 8 * * *",
            recipients=[ScheduleRecipientIn(type="role", value="admin")],
        ),
        _EDITOR,
    )

    removed = purge_legacy_word_template_nodes()

    assert removed == 1
    assert catalog_repo.get_node(node.id) is None
    assert extension_repo.get_config(node.id) is None
    assert get_schedule_store().get(schedule.id) is None


def test_purge_legacy_word_template_nodes_is_idempotent() -> None:
    assert purge_legacy_word_template_nodes() == 0
