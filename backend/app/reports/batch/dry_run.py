from __future__ import annotations

import uuid

from app.reports.batch.schemas import BatchCreateReportsIn, BatchDryRunItemOut, BatchDryRunOut, BatchReportItem
from app.reports.catalog import service as catalog_service
from app.reports.errors import ReportBatchError
from app.reports.persistence import catalog_repo

_ITEM_LIMIT = 50


def _sibling_name_exists(parent_id: uuid.UUID | None, name: str) -> bool:
    for raw in catalog_repo.all_nodes().values():
        if raw["parent_id"] == parent_id and raw["name"] == name:
            return True
    return False


def _classify_item(idx: int, item: BatchReportItem, dup_indexes: set[int]) -> BatchDryRunItemOut:
    if idx in dup_indexes:
        return BatchDryRunItemOut(
            index=idx,
            name=item.name,
            status="duplicate_in_batch",
            message="本批次内名称重复",
            parent_id=item.parent_id,
        )
    if item.parent_id is not None and not catalog_service.node_exists(item.parent_id):
        return BatchDryRunItemOut(
            index=idx,
            name=item.name,
            status="invalid",
            message="父节点不存在",
            parent_id=item.parent_id,
        )
    if _sibling_name_exists(item.parent_id, item.name):
        return BatchDryRunItemOut(
            index=idx,
            name=item.name,
            status="conflict",
            message="同目录下已存在同名节点",
            parent_id=item.parent_id,
        )
    return BatchDryRunItemOut(
        index=idx,
        name=item.name,
        status="create",
        message=None,
        parent_id=item.parent_id,
    )


def batch_dry_run(payload: BatchCreateReportsIn) -> BatchDryRunOut:
    if not payload.items:
        raise ReportBatchError("RPT_BATCH_EMPTY", "Batch items must not be empty", 422)
    if len(payload.items) > _ITEM_LIMIT:
        raise ReportBatchError("RPT_BATCH_ITEM_LIMIT", f"Batch cannot exceed {_ITEM_LIMIT} items", 422)
    names = [item.name for item in payload.items]
    dup_indexes = {i for i, n in enumerate(names) if names.count(n) > 1}
    rows = [_classify_item(idx, item, dup_indexes) for idx, item in enumerate(payload.items)]
    create_count = sum(1 for row in rows if row.status == "create")
    conflict_count = sum(1 for row in rows if row.status == "conflict")
    invalid_count = sum(1 for row in rows if row.status != "create" and row.status != "conflict")
    return BatchDryRunOut(
        items=rows,
        create_count=create_count,
        conflict_count=conflict_count,
        invalid_count=invalid_count,
        can_import=create_count > 0 and conflict_count == 0 and invalid_count == 0,
    )
