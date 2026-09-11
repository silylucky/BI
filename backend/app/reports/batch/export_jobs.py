"""Batch export jobs — delegates to persistent report job queue."""

from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.reports.batch.schemas import BatchExportJobIn, BatchExportJobOut
from app.reports.catalog.errors import ReportCatalogError
from app.reports.catalog import service as catalog_service
from app.reports.errors import ReportBatchError
from app.reports.jobs import service as job_service

_JOB_LIMIT = 20


def _validate_nodes(node_ids: list[uuid.UUID]) -> None:
    for node_id in node_ids:
        try:
            node = catalog_service.get_node(node_id)
        except ReportCatalogError as exc:
            raise ReportBatchError("RPT_BATCH_EXPORT_NODE_NOT_FOUND", exc.message, 404) from exc
        if node.node_type != "template":
            raise ReportBatchError(
                "RPT_BATCH_EXPORT_INVALID_NODE",
                "Batch export requires template nodes",
                422,
            )


def submit_batch_export(payload: BatchExportJobIn, actor: UserContext) -> BatchExportJobOut:
    if not payload.node_ids:
        raise ReportBatchError("RPT_BATCH_EXPORT_EMPTY", "nodeIds must not be empty", 422)
    if len(payload.node_ids) > _JOB_LIMIT:
        raise ReportBatchError(
            "RPT_BATCH_EXPORT_ITEM_LIMIT",
            f"Batch export cannot exceed {_JOB_LIMIT} nodes",
            422,
        )
    if payload.format not in {"pdf", "excel"}:
        raise ReportBatchError("RPT_BATCH_EXPORT_INVALID_FORMAT", "Invalid export format", 422)
    _validate_nodes(payload.node_ids)
    result = job_service.submit_batch_export_job(
        owner_id=actor.id,
        node_ids=payload.node_ids,
        fmt=payload.format,
    )
    return BatchExportJobOut(
        job_id=result["jobId"],
        status=result["status"],
        download_url=result.get("downloadUrl"),
    )


def get_batch_export_job(job_id: uuid.UUID, actor: UserContext) -> BatchExportJobOut:
    result = job_service.get_job_status(job_id, actor)
    return BatchExportJobOut(
        job_id=result["jobId"],
        status=result["status"],
        download_url=result.get("downloadUrl"),
    )


def get_batch_export_download(job_id: uuid.UUID, actor: UserContext) -> tuple[bytes, str, str]:
    return job_service.read_job_download(job_id, actor)
