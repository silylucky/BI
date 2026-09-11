from __future__ import annotations

import hashlib
import json
import uuid

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.integration import idempotency_repo
from app.reports.batch.schemas import BatchCreateReportsIn, BatchCreateReportsOut, BatchReportItem
from app.reports.catalog import service as catalog_service
from app.reports.catalog.errors import ReportCatalogError
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.errors import ReportBatchError, ReportExtensionError
from app.reports.extension import service as extension_service
from app.reports.extension.schemas import ExtensionConfigUpsert

_ITEM_LIMIT = 50
_idempotency_store: dict[str, dict] = {}  # test compat when metadata store is memory
_BATCH_BUDGET_MS = 200
probe_batch_create_budget_ms: int = _BATCH_BUDGET_MS
_BATCH_ACTOR = UserContext(id="batch-system", username="batch", roles=["admin"])


def _idempotency_cache_key(idempotency_key: str) -> str:
    return f"report-batch:{idempotency_key}"


def _get_idempotency_record(idempotency_key: str) -> dict | None:
    from app.core.config import get_settings

    if get_settings().rpt_metadata_store != "db":
        return _idempotency_store.get(idempotency_key)
    session = get_meta_session()
    try:
        return idempotency_repo.get_cached(session, _idempotency_cache_key(idempotency_key))
    finally:
        session.close()


def _put_idempotency_record(idempotency_key: str, record: dict) -> None:
    from app.core.config import get_settings

    if get_settings().rpt_metadata_store != "db":
        _idempotency_store[idempotency_key] = record
        return
    session = get_meta_session()
    try:
        idempotency_repo.put_cached(session, _idempotency_cache_key(idempotency_key), record)
    finally:
        session.close()


def _body_fingerprint(payload: BatchCreateReportsIn) -> str:
    raw = json.dumps(payload.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _create_single_item(item: BatchReportItem) -> uuid.UUID:
    if item.parent_id is not None and not catalog_service.node_exists(item.parent_id):
        raise ReportBatchError("RPT_BATCH_PARENT_NOT_FOUND", "Parent node not found", 404)
    try:
        node = catalog_service.create_node(
            CatalogNodeCreate(
                name=item.name,
                parent_id=item.parent_id,
                node_type="template",
                template_kind=item.template_kind or "excel",
            ),
            _BATCH_ACTOR,
        )
    except ReportCatalogError as exc:
        raise ReportBatchError(exc.code, exc.message, exc.status) from exc
    if item.extension is not None:
        ext_node_id = item.extension.catalog_node_id or node.id
        if ext_node_id != node.id:
            catalog_service.delete_node(node.id, _BATCH_ACTOR)
            raise ReportBatchError("RPT_BATCH_EXTENSION_INVALID", "catalogNodeId mismatch", 422)
        ext_body = item.extension.model_dump(exclude={"catalog_node_id"}, exclude_none=True)
        ext_payload = ExtensionConfigUpsert(catalog_node_id=node.id, **ext_body)
        try:
            extension_service.upsert(node.id, ext_payload, _BATCH_ACTOR)
        except ReportExtensionError as exc:
            catalog_service.delete_node(node.id, _BATCH_ACTOR)
            raise ReportBatchError("RPT_BATCH_EXTENSION_INVALID", exc.message, exc.status) from exc
    return node.id


def batch_create(payload: BatchCreateReportsIn, idempotency_key: str | None) -> BatchCreateReportsOut:
    if not payload.items:
        raise ReportBatchError("RPT_BATCH_EMPTY", "Batch items must not be empty", 422)
    if len(payload.items) > _ITEM_LIMIT:
        raise ReportBatchError("RPT_BATCH_ITEM_LIMIT", f"Batch cannot exceed {_ITEM_LIMIT} items", 422)
    names = [item.name for item in payload.items]
    dup_indexes = [i for i, n in enumerate(names) if names.count(n) > 1]
    if dup_indexes:
        unique_dup = sorted(set(dup_indexes))
        raise ReportBatchError(
            "RPT_BATCH_DUPLICATE_NAME",
            "Duplicate names in batch payload",
            422,
            fields={"indexes": unique_dup},
        )
    fingerprint = _body_fingerprint(payload)
    if idempotency_key:
        cached = _get_idempotency_record(idempotency_key)
        if cached is not None:
            if cached["fingerprint"] != fingerprint:
                raise ReportBatchError(
                    "RPT_BATCH_IDEMPOTENCY_CONFLICT",
                    "Idempotency key reused with different body",
                    409,
                )
            out = BatchCreateReportsOut.model_validate(cached["result"])
            return out.model_copy(update={"idempotent_replay": True})
    batch_id = uuid.uuid4()
    created: list[uuid.UUID] = []
    try:
        for idx, item in enumerate(payload.items):
            try:
                created.append(_create_single_item(item))
            except ReportBatchError as exc:
                rolled_back = len(created)
                for node_id in created:
                    if catalog_service.node_exists(node_id):
                        catalog_service.delete_node(node_id, _BATCH_ACTOR)
                if rolled_back == 0:
                    raise
                raise ReportBatchError(
                    "RPT_BATCH_PARTIAL_FAILURE",
                    exc.message,
                    422,
                    fields={
                        "failedIndex": idx,
                        "failedItemName": item.name,
                        "rolledBackCount": rolled_back,
                        "failures": [{"index": idx, "code": exc.code, "message": exc.message}],
                    },
                ) from exc
    except ReportBatchError:
        raise
    result = BatchCreateReportsOut(
        batch_id=batch_id,
        created_node_ids=created,
        idempotent_replay=False,
        rolled_back_count=0,
    )
    if idempotency_key:
        _put_idempotency_record(
            idempotency_key,
            {
                "fingerprint": fingerprint,
                "result": result.model_dump(mode="json"),
            },
        )
    return result


def timed_batch_create_budget_ms(payload: BatchCreateReportsIn, idempotency_key: str | None) -> float:
    import time

    start = time.perf_counter()
    batch_create(payload, idempotency_key)
    return (time.perf_counter() - start) * 1000.0
