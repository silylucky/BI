from __future__ import annotations

import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthColumnMask
from app.auth.rls.scope import datasource_or_dataset_scope_ok

MASK_STRATEGIES = frozenset({"hide", "partial", "hash"})


class MaskError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def list_masks(
    session: Session,
    *,
    datasource_id: uuid.UUID | None = None,
    dataset_id: str | None = None,
    table_name: str | None = None,
) -> list[AuthColumnMask]:
    stmt = select(AuthColumnMask).order_by(AuthColumnMask.table_name, AuthColumnMask.column_name)
    if datasource_id is not None:
        stmt = stmt.where(AuthColumnMask.datasource_id == datasource_id)
    if dataset_id is not None:
        stmt = stmt.where(AuthColumnMask.dataset_id == dataset_id)
    if table_name is not None:
        stmt = stmt.where(AuthColumnMask.table_name == table_name)
    return list(session.scalars(stmt))


def create_mask(
    session: Session,
    *,
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
    table_name: str,
    column_name: str,
    mask_strategy: str,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthColumnMask:
    if mask_strategy not in MASK_STRATEGIES:
        raise MaskError("MASK_STRATEGY_INVALID", "mask_strategy must be hide, partial, or hash", 422)
    if not datasource_or_dataset_scope_ok(datasource_id, dataset_id):
        raise MaskError(
            "MASK_SCOPE_REQUIRED",
            "datasourceId or datasetId is required",
            422,
        )
    row = AuthColumnMask(
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name,
        column_name=column_name,
        mask_strategy=mask_strategy,
    )
    session.add(row)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise MaskError("MASK_ALREADY_EXISTS", "Column mask already exists for scope", 409) from exc
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="column_mask",
        target_id=row.id,
        action="column_mask.create",
        detail={
            "table_name": table_name,
            "column_name": column_name,
            "mask_strategy": mask_strategy,
        },
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(row)
    return row


def delete_mask(
    session: Session,
    mask_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    row = session.get(AuthColumnMask, mask_id)
    if row is None:
        raise MaskError("MASK_NOT_FOUND", "Column mask not found", 404)
    target_id = row.id
    detail = {"table_name": row.table_name, "column_name": row.column_name}
    session.delete(row)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="column_mask",
        target_id=target_id,
        action="column_mask.delete",
        detail=detail,
        trace_id=trace_id,
    )
    session.commit()


def _mask_value(strategy: str, value: object) -> object:
    if value is None:
        return None
    text = str(value)
    if strategy == "hide":
        return None
    if strategy == "partial":
        if len(text) <= 2:
            return "*" * len(text)
        return f"{text[0]}***{text[-1]}"
    digest = hashlib.sha256(text.encode()).hexdigest()[:12]
    return f"#{digest}"


def apply_masks_to_result(
    session: Session,
    *,
    columns: list[str],
    rows: list[list[object]],
    datasource_id: uuid.UUID | None = None,
    dataset_id: str | None = None,
    table_name: str | None = None,
) -> tuple[list[str], list[list[object]]]:
    if not columns or not rows:
        return columns, rows
    masks = list_masks(session, datasource_id=datasource_id, dataset_id=dataset_id, table_name=table_name)
    if not masks:
        return columns, rows
    by_column = {m.column_name.lower(): m.mask_strategy for m in masks}
    out_cols = list(columns)
    out_rows: list[list[object]] = []
    for row in rows:
        new_row: list[object] = []
        for idx, col in enumerate(columns):
            val = row[idx] if idx < len(row) else None
            strategy = by_column.get(col.lower())
            new_row.append(_mask_value(strategy, val) if strategy else val)
        out_rows.append(new_row)
    return out_cols, out_rows
