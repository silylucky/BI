from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.rls.predicate import (
    build_multi_dimension_rls_fragment,
    build_org_rls_fragment,
    resolve_user_org_node_ids,
    validate_column_name,
)

logger = logging.getLogger(__name__)


def _resolve_bindings(
    session: Session,
    *,
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
    table_name: str | None,
) -> dict[uuid.UUID, str] | None:
    if not table_name:
        return None
    from app.auth.rls.column_bindings.service import resolve_column_map

    column_map = resolve_column_map(
        session,
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name,
    )
    return column_map or None


def prepare_query_rls(
    session: Session,
    user: UserContext,
    *,
    column_by_dimension_id: dict[uuid.UUID, str] | None = None,
    table_alias: str = "t",
    org_column: str = "org_node_id",
    datasource_id: uuid.UUID | None = None,
    dataset_id: str | None = None,
    table_name: str | None = None,
) -> str:
    validate_column_name(table_alias)
    validate_column_name(org_column)
    if column_by_dimension_id is None:
        column_by_dimension_id = _resolve_bindings(
            session,
            datasource_id=datasource_id,
            dataset_id=dataset_id,
            table_name=table_name,
        )
    if column_by_dimension_id is not None:
        for column in column_by_dimension_id.values():
            validate_column_name(column)
        return build_multi_dimension_rls_fragment(
            session,
            uuid.UUID(user.id),
            column_by_dimension_id=column_by_dimension_id,
            table_alias=table_alias,
        )
    org_ids = resolve_user_org_node_ids(session, uuid.UUID(user.id))
    return build_org_rls_fragment(org_ids, column=org_column, alias=table_alias)


def get_query_rls_fragment(
    session: Session,
    user: UserContext,
    *,
    table_alias: str = "t",
    org_column: str = "org_node_id",
    datasource_id: uuid.UUID | None = None,
    dataset_id: str | None = None,
    table_name: str | None = None,
) -> str:
    return prepare_query_rls(
        session,
        user,
        table_alias=table_alias,
        org_column=org_column,
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name,
    )
