from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.rls.column_bindings.service import resolve_column_map


def enrich_rls_config(
    session: Session,
    rls_config: dict,
    *,
    datasource_id: uuid.UUID | None,
    dataset_id: str | None,
    table_name: str | None,
) -> dict:
    if rls_config.get("column_by_dimension_id"):
        return rls_config
    if not table_name:
        return rls_config
    column_map = resolve_column_map(
        session,
        datasource_id=datasource_id,
        dataset_id=dataset_id,
        table_name=table_name,
    )
    if not column_map:
        return rls_config
    merged = dict(rls_config)
    merged["column_by_dimension_id"] = column_map
    merged["datasource_id"] = datasource_id
    merged["dataset_id"] = dataset_id
    merged["table_name"] = table_name
    return merged
