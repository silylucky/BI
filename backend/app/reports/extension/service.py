from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Literal

from app.auth.deps import UserContext
from app.reports.catalog import service as catalog_service
from app.reports.catalog.errors import ReportCatalogError
from app.reports.errors import ReportExtensionError
from app.reports.extension.acl import assert_extension_action
from app.reports.extension.compare import build_compare_slots
from app.reports.extension.render import build_extension_render_spec
from app.reports.extension.schemas import ExtensionConfigOut, ExtensionConfigUpsert

from app.reports.persistence import extension_repo, memory_stores
from app.reports.persistence.store import persistence_store_label

_MAX_METRICS = 32
_MAX_FILTERS = 32
_VALID_OPERATORS = frozenset({"eq", "ne", "in", "between", "like"})
_VALID_COMPARE = frozenset({"none", "yoy", "mom"})
_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_store = memory_stores.extension_configs  # test compat
_audit_log = memory_stores.extension_audit


def _assert_template_node(node_id: uuid.UUID) -> None:
    if not catalog_service.node_exists(node_id):
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Catalog node not found", 404)
    try:
        node = catalog_service.get_node(node_id)
    except ReportCatalogError as exc:
        raise ReportExtensionError(exc.code, exc.message, exc.status) from exc
    if node.node_type != "template":
        raise ReportExtensionError(
            "RPT_EXT_INVALID_NODE_TYPE",
            "Extension config only allowed on template nodes",
            422,
        )


def _validate_metric_datasets(metrics: list) -> None:
    from app.metadata.dataset.errors import DatasetError
    from app.metadata.dataset import service as dataset_service

    for metric in metrics:
        if not metric.dataset_id:
            continue
        try:
            ds_row = dataset_service.get_dataset(metric.dataset_id)
        except DatasetError:
            raise ReportExtensionError(
                "RPT_EXT_DATASET_NOT_FOUND",
                f"数据集不存在或已删除：{metric.dataset_id}",
                422,
                fields={"fields": ["datasetId"]},
            )
        if not ds_row.bound_config_id:
            raise ReportExtensionError(
                "RPT_EXT_DATASET_UNBOUND",
                f"数据集尚未绑定出图字段：{metric.dataset_id}",
                422,
            )


def _sync_metric_bindings(metrics: list) -> list:
    from app.metadata.dataset import service as dataset_service

    synced = []
    for metric in metrics:
        if metric.dataset_id:
            ds_row = dataset_service.get_dataset(metric.dataset_id)
            if ds_row.bound_config_id and ds_row.bound_config_id != metric.bound_config_id:
                metric = metric.model_copy(update={"bound_config_id": ds_row.bound_config_id})
        synced.append(metric)
    return synced


def _validate_compare_metrics(metrics: list) -> None:
    for m in metrics:
        mode = m.compare_mode
        if mode not in _VALID_COMPARE:
            raise ReportExtensionError(
                "RPT_EXT_INVALID_COMPARE",
                "Invalid compareMode",
                422,
                fields={"fields": ["compareMode"]},
            )
        if mode in {"yoy", "mom"} and not m.bound_config_id and not _KEY_RE.match(m.key):
            raise ReportExtensionError(
                "RPT_EXT_INVALID_COMPARE",
                "compare metric requires expression or valid key",
                422,
            )


def _validate_payload(payload: ExtensionConfigUpsert) -> None:
    if len(payload.metrics) > _MAX_METRICS:
        raise ReportExtensionError("RPT_EXT_METRICS_LIMIT", "Metrics limit exceeded", 422)
    if len(payload.filters) > _MAX_FILTERS:
        raise ReportExtensionError("RPT_EXT_FILTERS_LIMIT", "Filters limit exceeded", 422)
    metric_keys = [m.key for m in payload.metrics]
    if len(metric_keys) != len(set(metric_keys)):
        raise ReportExtensionError("RPT_EXT_DUPLICATE_KEY", "Duplicate metric key", 422)
    filter_keys = [f.key for f in payload.filters]
    if len(filter_keys) != len(set(filter_keys)):
        raise ReportExtensionError("RPT_EXT_DUPLICATE_KEY", "Duplicate filter key", 422)
    for filt in payload.filters:
        if filt.operator not in _VALID_OPERATORS:
            raise ReportExtensionError("RPT_EXT_INVALID_OPERATOR", "Invalid filter operator", 422)
    _validate_compare_metrics(payload.metrics)
    _validate_metric_datasets(payload.metrics)


def upsert(node_id: uuid.UUID, payload: ExtensionConfigUpsert, actor: UserContext) -> ExtensionConfigOut:
    assert_extension_action(actor, "write")
    _assert_template_node(node_id)
    if payload.catalog_node_id != node_id:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "catalogNodeId mismatch", 404)
    _validate_payload(payload)
    synced_metrics = _sync_metric_bindings(payload.metrics)
    prev = extension_repo.get_config(node_id)
    revision = (prev["revision"] + 1) if prev else 1
    record = {
        "catalog_node_id": node_id,
        "metrics": [m.model_dump(by_alias=True, mode="json") for m in synced_metrics],
        "filters": [f.model_dump(by_alias=True, mode="json") for f in payload.filters],
        "change_note": payload.change_note,
        "default_data_source_id": payload.default_data_source_id,
        "revision": revision,
    }
    extension_repo.save_config(node_id, record)
    if payload.change_note:
        extension_repo.append_audit(node_id, payload.change_note, revision)
    return ExtensionConfigOut(
        revision=revision,
        **payload.model_copy(update={"metrics": synced_metrics}).model_dump(),
    )


def get_extension(node_id: uuid.UUID) -> ExtensionConfigOut:
    _assert_template_node(node_id)
    record = extension_repo.get_config(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    return ExtensionConfigOut(
        catalog_node_id=node_id,
        metrics=record["metrics"],
        filters=record["filters"],
        change_note=record.get("change_note"),
        default_data_source_id=record.get("default_data_source_id"),
        revision=record["revision"],
    )


def delete_extension(node_id: uuid.UUID, actor: UserContext) -> None:
    assert_extension_action(actor, "delete")
    _assert_template_node(node_id)
    if extension_repo.get_config(node_id) is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    extension_repo.delete_config(node_id)


def compare_preview(node_id: uuid.UUID, compare_mode: str, metric_keys: list[str] | None) -> dict:
    _assert_template_node(node_id)
    record = extension_repo.get_config(node_id) or {"metrics": []}
    slots = build_compare_slots(compare_mode, record.get("metrics", []), metric_keys)
    return {"slots": slots}


def list_revision_history(node_id: uuid.UUID) -> list[dict]:
    _assert_template_node(node_id)
    record = extension_repo.get_config(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    entries = extension_repo.list_audit(node_id)
    if not entries:
        return [{
            "revision": record["revision"],
            "changeNote": None,
            "updatedAt": datetime.now(UTC).isoformat(),
        }]
    return entries


def export_persistence_snapshot(node_id: uuid.UUID) -> dict:
    record = extension_repo.get_config(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    return {
        "store": persistence_store_label(),
        "revision": record["revision"],
        "metrics": record["metrics"],
        "filters": record["filters"],
        "auditEntryCount": len(extension_repo.list_audit(node_id)),
    }


def get_render_spec(node_id: uuid.UUID) -> dict:
    _assert_template_node(node_id)
    record = extension_repo.get_config(node_id)
    if record is None:
        raise ReportExtensionError("RPT_EXT_NODE_NOT_FOUND", "Extension config not found", 404)
    node = catalog_service.get_node(node_id)
    return build_extension_render_spec(record, node.template_kind)


def resolve_template_readiness(node_id: uuid.UUID) -> Literal["live", "demo"]:
    try:
        ext = get_extension(node_id)
    except ReportExtensionError:
        return "demo"
    if not ext.metrics:
        return "demo"
    if ext.default_data_source_id is not None:
        return "live"
    for metric in ext.metrics:
        if metric.query_mode == "dataset" and metric.bound_config_id:
            return "live"
    return "demo"


def list_templates_readiness(node_ids: list[uuid.UUID]) -> dict:
    items = [{"nodeId": str(nid), "readiness": resolve_template_readiness(nid)} for nid in node_ids]
    return {"items": items}
