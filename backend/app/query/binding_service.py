from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.resources.service import VisibilityError
from app.core.config import get_settings
from app.datasources.acl import assert_visible, list_visible_ids_for_roles
from app.query.models import ChartQueryBinding
from app.query.rls.guard import validate_identifier
from app.query.readonly import assert_readonly_sql
from app.query.schemas import BindingCreate, BindingListResponse, BindingOut, BindingUpdate, QueryError


def _assert_chart_id_available(
    session: Session, chart_id: uuid.UUID | None, *, exclude_id: uuid.UUID | None = None,
) -> None:
    if chart_id is None:
        return
    stmt = select(ChartQueryBinding).where(ChartQueryBinding.chart_id == chart_id)
    if exclude_id is not None:
        stmt = stmt.where(ChartQueryBinding.id != exclude_id)
    if session.scalar(stmt) is not None:
        raise QueryError("BINDING_CHART_CONFLICT", "chartId already bound", 409)


def _validate_binding_payload(payload: BindingCreate) -> None:
    cap = get_settings().query_default_limit
    if payload.default_limit > cap:
        raise QueryError("QUERY_INVALID_REQUEST", f"defaultLimit must be <= {cap}", 400)
    if payload.mode == "sql":
        if not payload.sql:
            raise QueryError("QUERY_INVALID_REQUEST", "sql is required for sql mode", 400)
        try:
            assert_readonly_sql(payload.sql)
        except QueryError as exc:
            raise QueryError(exc.code, exc.message, exc.status) from exc
    else:
        if not payload.schema_name or not payload.table_name:
            raise QueryError("QUERY_INVALID_REQUEST", "schema and table are required for table mode", 400)
        validate_identifier(payload.schema_name)
        validate_identifier(payload.table_name)


def create_binding(
    session: Session, role_codes: list[str], payload: BindingCreate, created_by: uuid.UUID | None,
    is_root: bool = False,
) -> BindingOut:
    assert_visible(session, role_codes, payload.data_source_id, is_root=is_root)
    _validate_binding_payload(payload)
    _assert_chart_id_available(session, payload.chart_id)
    row = ChartQueryBinding(
        name=payload.name,
        data_source_id=payload.data_source_id,
        mode=payload.mode,
        sql=payload.sql,
        schema_name=payload.schema_name,
        table_name=payload.table_name,
        default_limit=payload.default_limit,
        chart_id=payload.chart_id,
        created_by=created_by,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return BindingOut.model_validate(row)


def _visible_binding_stmt(session: Session, role_codes: list[str], *, is_root: bool = False):
    visible = list_visible_ids_for_roles(session, role_codes, is_root=is_root)
    stmt = select(ChartQueryBinding)
    if visible is not None:
        if not visible:
            return stmt.where(False)
        stmt = stmt.where(ChartQueryBinding.data_source_id.in_(visible))
    return stmt


def list_bindings(
    session: Session,
    role_codes: list[str],
    *,
    is_root: bool = False,
    limit: int = 50,
    offset: int = 0,
    data_source_id: uuid.UUID | None = None,
) -> BindingListResponse:
    stmt = _visible_binding_stmt(session, role_codes, is_root=is_root)
    if data_source_id is not None:
        assert_visible(session, role_codes, data_source_id, is_root=is_root)
        stmt = stmt.where(ChartQueryBinding.data_source_id == data_source_id)
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.order_by(ChartQueryBinding.created_at.desc()).limit(limit).offset(offset)).all()
    return BindingListResponse(items=[BindingOut.model_validate(r) for r in rows], total=total)


def get_binding(
    session: Session,
    role_codes: list[str],
    binding_id: uuid.UUID,
    *,
    is_root: bool = False,
) -> BindingOut:
    row = session.get(ChartQueryBinding, binding_id)
    if row is None:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
    try:
        assert_visible(session, role_codes, row.data_source_id, is_root=is_root)
    except VisibilityError:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
    return BindingOut.model_validate(row)


def update_binding(
    session: Session,
    role_codes: list[str],
    binding_id: uuid.UUID,
    payload: BindingUpdate,
    *,
    is_root: bool = False,
) -> BindingOut:
    row = session.get(ChartQueryBinding, binding_id)
    if row is None:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
    try:
        assert_visible(session, role_codes, row.data_source_id, is_root=is_root)
    except VisibilityError:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
    assert_visible(session, role_codes, payload.data_source_id, is_root=is_root)
    _validate_binding_payload(payload)
    _assert_chart_id_available(session, payload.chart_id, exclude_id=binding_id)
    row.name = payload.name
    row.data_source_id = payload.data_source_id
    row.mode = payload.mode
    row.sql = payload.sql
    row.schema_name = payload.schema_name
    row.table_name = payload.table_name
    row.default_limit = payload.default_limit
    row.chart_id = payload.chart_id
    session.commit()
    session.refresh(row)
    return BindingOut.model_validate(row)


def delete_binding(
    session: Session,
    role_codes: list[str],
    binding_id: uuid.UUID,
    *,
    is_root: bool = False,
) -> None:
    row = session.get(ChartQueryBinding, binding_id)
    if row is None:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
    try:
        assert_visible(session, role_codes, row.data_source_id, is_root=is_root)
    except VisibilityError:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
    session.delete(row)
    session.commit()


def resolve_binding_execute(
    session: Session,
    role_codes: list[str],
    binding_id: uuid.UUID,
    *,
    is_root: bool = False,
) -> dict:
    row = session.get(ChartQueryBinding, binding_id)
    if row is None:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404)
    try:
        assert_visible(session, role_codes, row.data_source_id, is_root=is_root)
    except VisibilityError:
        raise QueryError("BINDING_NOT_FOUND", "Binding not found", 404) from None
    return {
        "data_source_id": row.data_source_id,
        "mode": row.mode,
        "sql": row.sql,
        "schema_name": row.schema_name,
        "table_name": row.table_name,
        "default_limit": row.default_limit,
    }
