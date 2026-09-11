from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.metadata._acl import _assert_meta_write
from app.metadata.dimensions.models import DimensionDict, DimensionValue
from app.metadata.dimensions.schemas import (
    DIM_STATUS_VALUES,
    META_DIM_FORBIDDEN,
    DimensionCreate,
    DimensionError,
    DimensionUpdate,
    DimensionValueItem,
)
from app.metadata.themes import service as themes_service
from app.metadata.themes.schemas import ThemeError

probe_list_dimensions_budget_ms_limit = 50


@dataclass(frozen=True)
class DimensionProbeResult:
    elapsed_ms: float
    ok: bool


def _forbidden() -> DimensionError:
    return DimensionError(META_DIM_FORBIDDEN, "insufficient role to modify dimensions", 403)


def _validate_status(status: str | None) -> str:
    if status is not None and status not in DIM_STATUS_VALUES:
        raise DimensionError(
            "META_DIM_INVALID_STATUS",
            "Invalid dimension status",
            422,
            fields=[{"field": "status", "message": f"Must be one of {sorted(DIM_STATUS_VALUES)}"}],
        )
    return status or "active"


def _validate_theme_node(session: Session, theme_node_id: uuid.UUID | None) -> None:
    if theme_node_id is not None:
        try:
            themes_service.get_theme_node(session, theme_node_id)
        except ThemeError as exc:
            raise DimensionError(exc.code, exc.message, exc.status) from exc


def list_dimensions(
    session: Session,
    code_prefix: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[DimensionDict], int]:
    capped = min(max(limit, 1), 500)
    base = select(DimensionDict).order_by(DimensionDict.code)
    count_stmt = select(func.count()).select_from(DimensionDict)
    if code_prefix:
        base = base.where(DimensionDict.code.startswith(code_prefix))
        count_stmt = count_stmt.where(DimensionDict.code.startswith(code_prefix))
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def create_dimension(session: Session, payload: DimensionCreate, user: UserContext) -> DimensionDict:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    if not payload.code.strip():
        raise DimensionError(
            "META_DIM_INVALID_CODE",
            "Dimension code must not be blank",
            422,
            fields=[{"field": "code", "message": "must not be blank"}],
        )
    if not payload.name.strip():
        raise DimensionError(
            "META_DIM_INVALID_NAME",
            "Dimension name must not be blank",
            422,
            fields=[{"field": "name", "message": "must not be blank"}],
        )
    _validate_theme_node(session, payload.theme_node_id)
    status = _validate_status(payload.status)
    dimension = DimensionDict(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        status=status,
        theme_node_id=payload.theme_node_id,
    )
    session.add(dimension)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DimensionError("META_DIM_CODE_CONFLICT", "Dimension code already exists", 409) from exc
    session.refresh(dimension)
    return dimension


def get_dimension(session: Session, dimension_id: uuid.UUID) -> DimensionDict:
    dimension = session.get(DimensionDict, dimension_id)
    if dimension is None:
        raise DimensionError("META_DIM_NOT_FOUND", "Dimension not found", 404)
    return dimension


def resolve_dimension_by_code(session: Session, code: str) -> DimensionDict:
    if not code.strip():
        raise DimensionError(
            "META_DIM_INVALID_CODE",
            "Dimension code must not be blank",
            422,
            fields=[{"field": "code", "message": "must not be blank"}],
        )
    dimension = session.scalar(select(DimensionDict).where(DimensionDict.code == code.strip()))
    if dimension is None:
        raise DimensionError("META_DIM_NOT_FOUND", f"Dimension not found: {code}", 404)
    return dimension


def ensure_legacy_probe_dimensions(session: Session) -> None:
    """Idempotent seed for prefab/filters/theme companion legacy probe codes."""
    from app.auth.deps import UserContext

    labels = {"region": "区域", "status": "状态", "dim_sales": "销售额"}
    actor = UserContext(id="probe-dim", username="probe", roles=["admin"])
    for code in ("region", "status", "dim_sales"):
        try:
            resolve_dimension_by_code(session, code)
        except DimensionError as exc:
            if exc.code != "META_DIM_NOT_FOUND":
                raise
            create_dimension(
                session,
                DimensionCreate(code=code, name=labels[code]),
                actor,
            )


def update_dimension(
    session: Session, dimension_id: uuid.UUID, payload: DimensionUpdate, user: UserContext,
) -> DimensionDict:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    if not payload.name.strip():
        raise DimensionError(
            "META_DIM_INVALID_NAME",
            "Dimension name must not be blank",
            422,
            fields=[{"field": "name", "message": "must not be blank"}],
        )
    _validate_theme_node(session, payload.theme_node_id)
    dimension = get_dimension(session, dimension_id)
    dimension.name = payload.name
    dimension.description = payload.description
    if payload.status is not None:
        dimension.status = _validate_status(payload.status)
    if payload.theme_node_id is not None or "theme_node_id" in payload.model_fields_set:
        dimension.theme_node_id = payload.theme_node_id
    session.commit()
    session.refresh(dimension)
    return dimension


def delete_dimension(session: Session, dimension_id: uuid.UUID, user: UserContext) -> None:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    dimension = get_dimension(session, dimension_id)
    session.delete(dimension)
    session.commit()


def list_values(
    session: Session,
    dimension_id: uuid.UUID,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[DimensionValue], int]:
    get_dimension(session, dimension_id)
    capped = min(max(limit, 1), 500)
    base = (
        select(DimensionValue)
        .where(DimensionValue.dimension_id == dimension_id)
        .order_by(DimensionValue.sort_order, DimensionValue.code)
    )
    count_stmt = (
        select(func.count())
        .select_from(DimensionValue)
        .where(DimensionValue.dimension_id == dimension_id)
    )
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def _validate_value_item(item: DimensionValueItem) -> None:
    from app.metadata.dimensions.schemas import DIM_CODE_RE
    if not item.code or not DIM_CODE_RE.match(item.code):
        raise DimensionError(
            "META_DIM_VALUE_INVALID_CODE",
            "Invalid dimension value code",
            422,
            fields=[{"field": "code", "message": "must match ^[a-z][a-z0-9_]{1,63}$"}],
        )
    if not item.label:
        raise DimensionError(
            "META_DIM_VALUE_INVALID_LABEL",
            "Dimension value label must not be blank",
            422,
            fields=[{"field": "label", "message": "must not be blank"}],
        )


def register_values(
    session: Session,
    dimension_id: uuid.UUID,
    items: list[DimensionValueItem],
    user: UserContext,
) -> list[DimensionValue]:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    get_dimension(session, dimension_id)
    seen: set[str] = set()
    for item in items:
        _validate_value_item(item)
        if item.code in seen:
            raise DimensionError(
                "META_DIM_VALUE_DUPLICATE_BATCH",
                "Duplicate value code in batch",
                422,
                fields=[{"field": "code", "message": f"duplicate: {item.code}"}],
            )
        seen.add(item.code)
    created: list[DimensionValue] = []
    for item in items:
        value = DimensionValue(
            dimension_id=dimension_id,
            code=item.code,
            label=item.label,
            sort_order=item.sort_order,
        )
        session.add(value)
        created.append(value)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DimensionError(
            "META_DIM_VALUE_CODE_CONFLICT",
            "Dimension value code already exists",
            409,
        ) from exc
    for value in created:
        session.refresh(value)
    return created


def delete_value(
    session: Session, dimension_id: uuid.UUID, value_id: uuid.UUID, user: UserContext,
) -> None:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    get_dimension(session, dimension_id)
    value = session.get(DimensionValue, value_id)
    if value is None or value.dimension_id != dimension_id:
        raise DimensionError("META_DIM_VALUE_NOT_FOUND", "Dimension value not found", 404)
    session.delete(value)
    session.commit()


def probe_list_dimensions_budget_ms(session: Session) -> DimensionProbeResult:
    started = time.perf_counter()
    list_dimensions(session, limit=50, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return DimensionProbeResult(elapsed_ms=elapsed, ok=elapsed <= probe_list_dimensions_budget_ms_limit)
