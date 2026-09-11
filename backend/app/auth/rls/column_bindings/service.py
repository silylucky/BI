from __future__ import annotations

import uuid

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthDimensionType, AuthRlsColumnBinding
from app.auth.rls.scope import datasource_or_dataset_scope_ok
from app.auth.rls.predicate import (
    build_multi_dimension_rls_fragment,
    build_org_rls_fragment,
    validate_column_name,
)


class ColumnBindingError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _validate_scope(datasource_id: uuid.UUID | None, dataset_id: str | None) -> None:
    if not datasource_or_dataset_scope_ok(datasource_id, dataset_id):
        raise ColumnBindingError(
            "RLS_BINDING_SCOPE_REQUIRED",
            "datasourceId or datasetId is required",
            422,
        )


def list_column_bindings(
    session: Session,
    *,
    datasource_id: uuid.UUID | None = None,
    dataset_id: str | None = None,
    table_name: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuthRlsColumnBinding], int]:
    filters = []
    if datasource_id is not None:
        filters.append(AuthRlsColumnBinding.datasource_id == datasource_id)
    if dataset_id is not None:
        filters.append(AuthRlsColumnBinding.dataset_id == dataset_id)
    if table_name is not None:
        filters.append(AuthRlsColumnBinding.table_name == table_name)
    count_stmt = select(func.count()).select_from(AuthRlsColumnBinding)
    stmt = select(AuthRlsColumnBinding)
    if filters:
        count_stmt = count_stmt.where(*filters)
        stmt = stmt.where(*filters)
    total = session.scalar(count_stmt) or 0
    items = list(
        session.scalars(
            stmt.order_by(AuthRlsColumnBinding.created_at.desc())
            .limit(min(limit, 500))
            .offset(offset)
        )
    )
    return items, total


def create_column_binding(
    session: Session,
    *,
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
    table_name: str,
    dimension_type_id: uuid.UUID,
    column_name: str,
    commit: bool = True,
) -> AuthRlsColumnBinding:
    _validate_scope(datasource_id, dataset_id)
    validate_column_name(column_name)
    if not table_name.strip():
        raise ColumnBindingError("RLS_BINDING_INVALID", "tableName is required", 422)
    dim = session.get(AuthDimensionType, dimension_type_id)
    if dim is None:
        raise ColumnBindingError("DIMENSION_NOT_FOUND", "Dimension type not found", 404)
    row = AuthRlsColumnBinding(
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name.strip(),
        dimension_type_id=dimension_type_id,
        column_name=column_name.strip(),
    )
    session.add(row)
    try:
        if commit:
            session.commit()
            session.refresh(row)
    except IntegrityError as exc:
        session.rollback()
        raise ColumnBindingError(
            "RLS_BINDING_CONFLICT",
            "Column binding already exists for this scope",
            409,
        ) from exc
    return row


def delete_column_binding(session: Session, binding_id: uuid.UUID) -> None:
    row = session.get(AuthRlsColumnBinding, binding_id)
    if row is None:
        raise ColumnBindingError("RLS_BINDING_NOT_FOUND", "Column binding not found", 404)
    session.delete(row)
    session.commit()


def replace_dataset_bindings(
    session: Session,
    dataset_id: str,
    *,
    datasource_id: uuid.UUID | None,
    bindings: list[dict[str, object]],
    commit: bool = True,
) -> None:
    session.execute(
        delete(AuthRlsColumnBinding).where(AuthRlsColumnBinding.dataset_id == dataset_id)
    )
    for item in bindings:
        create_column_binding(
            session,
            datasource_id=datasource_id,
            dataset_id=dataset_id,
            table_name=str(item["table_name"]),
            dimension_type_id=uuid.UUID(str(item["dimension_type_id"])),
            column_name=str(item["column_name"]),
            commit=False,
        )
    try:
        if commit:
            session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ColumnBindingError(
            "RLS_BINDING_CONFLICT",
            "Column binding already exists for this scope",
            409,
        ) from exc


def resolve_column_map(
    session: Session,
    *,
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
    table_name: str,
) -> dict[uuid.UUID, str]:
    if not table_name.strip():
        return {}
    clauses = [AuthRlsColumnBinding.table_name == table_name.strip()]
    scope_filters = []
    if dataset_id:
        scope_filters.append(AuthRlsColumnBinding.dataset_id == dataset_id)
    if datasource_id is not None:
        scope_filters.append(AuthRlsColumnBinding.datasource_id == datasource_id)
    if not scope_filters:
        return {}
    stmt = select(AuthRlsColumnBinding).where(clauses[0], or_(*scope_filters))
    rows = list(session.scalars(stmt))
    result: dict[uuid.UUID, str] = {}
    for row in rows:
        result[row.dimension_type_id] = row.column_name
    return result


def preview_rls_fragment(
    session: Session,
    user_id: uuid.UUID,
    *,
    column_by_dimension_id: dict[uuid.UUID, str] | None,
    table_alias: str,
    org_column: str,
) -> str:
    validate_column_name(table_alias)
    validate_column_name(org_column)
    if column_by_dimension_id:
        return build_multi_dimension_rls_fragment(
            session,
            user_id,
            column_by_dimension_id=column_by_dimension_id,
            table_alias=table_alias,
        )
    from app.auth.rls.predicate import resolve_user_org_node_ids

    org_ids = resolve_user_org_node_ids(session, user_id)
    return build_org_rls_fragment(org_ids, column=org_column, alias=table_alias)
