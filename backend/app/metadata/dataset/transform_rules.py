"""Dataset query-time transform rules (PR-3)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.metadata.service import list_columns
from app.datasources.models import get_meta_session
from app.datasources.service import DataSourceError
from app.ingestion.etl_suggest import EtlColumnMeta, suggest_etl_rules_from_columns
from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.models import DatasetRecord
from app.metadata.dataset.service import (
    _assert_dataset_read_access,
    _assert_dataset_write_access,
    _row_to_out,
    _with_session,
)
from app.metadata.dataset.schemas import DatasetItemOut, DatasetTransformRulesOut

META_DATASET_TRANSFORM_SYNC_LOCKED = "META_DATASET_TRANSFORM_SYNC_LOCKED"


def _load_row(session: Session, dataset_id: str, user: UserContext) -> DatasetRecord:
    row = session.get(DatasetRecord, dataset_id)
    if row is None:
        raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
    _assert_dataset_read_access(user, row)
    return row


def _assert_transform_editable(row: DatasetRecord) -> None:
    if row.origin == "sync_job":
        raise DatasetError(
            META_DATASET_TRANSFORM_SYNC_LOCKED,
            "同步产物 Dataset 的清洗规则在同步任务中配置，此处不可编辑",
            422,
        )


def _validate_rules(rules: list[dict[str, Any]]) -> None:
    if not isinstance(rules, list):
        raise DatasetError("META_DATASET_TRANSFORM_INVALID", "规则须为 JSON 列表", 422)
    allowed_types = {"rename_column", "cast_type", "fill_null", "filter_rows"}
    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise DatasetError(
                "META_DATASET_TRANSFORM_INVALID",
                f"规则 #{index + 1} 须为对象",
                422,
            )
        rtype = rule.get("type")
        if rtype not in allowed_types:
            raise DatasetError(
                "META_DATASET_TRANSFORM_INVALID",
                f"规则 #{index + 1} 类型无效",
                422,
                fields=[{"field": f"rules[{index}].type", "message": str(rtype)}],
            )


def get_transform_rules(dataset_id: str, user: UserContext) -> DatasetTransformRulesOut:
    session = get_meta_session()
    try:
        row = _load_row(session, dataset_id, user)
        return DatasetTransformRulesOut(
            dataset_id=row.dataset_id,
            rules=list(row.transform_rules or []),
            query_pandas_applies=_query_pandas_applies(session, row),
        )
    finally:
        session.close()


def put_transform_rules(
    dataset_id: str,
    rules: list[dict[str, Any]],
    user: UserContext,
) -> DatasetTransformRulesOut:
    _validate_rules(rules)

    def _op(session: Session) -> DatasetTransformRulesOut:
        row = session.get(DatasetRecord, dataset_id)
        if row is None:
            raise DatasetError("META_DATASET_NOT_FOUND", "Dataset not found", 404)
        _assert_dataset_write_access(user, dataset_id)
        _assert_transform_editable(row)
        row.transform_rules = rules
        session.flush()
        return DatasetTransformRulesOut(
            dataset_id=row.dataset_id,
            rules=list(row.transform_rules or []),
            query_pandas_applies=_query_pandas_applies(session, row),
        )

    return _with_session(_op)


def auto_align_transform_rules(dataset_id: str, user: UserContext) -> DatasetTransformRulesOut:
    session = get_meta_session()
    try:
        row = _load_row(session, dataset_id, user)
        _assert_dataset_write_access(user, dataset_id)
        _assert_transform_editable(row)
        if not row.table_source_datasource_id or not row.tables:
            raise DatasetError(
                "META_DATASET_TRANSFORM_NO_SOURCE",
                "请先绑定外部数据源与物理表",
                422,
            )
        first = row.tables[0]
        table_name = first.get("name") if isinstance(first, dict) else getattr(first, "name", None)
        if not table_name:
            raise DatasetError(
                "META_DATASET_TRANSFORM_NO_SOURCE",
                "请先绑定物理表",
                422,
            )
        from app.datasources.models import DataSource
        from app.query.capabilities import resolve_sql_dialect_type

        if "." in table_name:
            schema, _, table = table_name.partition(".")
        else:
            table = table_name
            schema = "public"
            ds = session.get(DataSource, row.table_source_datasource_id)
            if ds is not None:
                dialect = resolve_sql_dialect_type(ds.type)
                if dialect in {"mysql", "sqlite", "sqlserver"}:
                    schema = ds.database or schema
                elif dialect == "postgresql":
                    opts = ds.connection_options if isinstance(ds.connection_options, dict) else {}
                    schema = str(opts.get("schema") or "public")
        try:
            resp = list_columns(
                session,
                list(user.roles),
                row.table_source_datasource_id,
                schema,
                table,
            )
        except DataSourceError as exc:
            raise DatasetError(exc.code, exc.message, exc.status) from exc
        columns: list[EtlColumnMeta] = [
            {"name": col.name, "dataType": col.data_type} for col in resp.items
        ]
        aligned = suggest_etl_rules_from_columns(columns)
        row.transform_rules = aligned
        session.commit()
        return DatasetTransformRulesOut(
            dataset_id=row.dataset_id,
            rules=list(aligned),
            query_pandas_applies=_query_pandas_applies(session, row),
        )
    finally:
        session.close()


def resolve_transform_rules_for_dataset(
    session: Session,
    dataset: DatasetItemOut | None,
) -> list[dict[str, Any]]:
    if dataset is None:
        return []
    row = session.get(DatasetRecord, dataset.dataset_id)
    if row is None:
        return []
    return list(row.transform_rules or [])


def _query_pandas_applies(_session: Session, row: DatasetRecord) -> bool:
    return row.origin != "sync_job"


def row_to_dataset_out(row: DatasetRecord) -> DatasetItemOut:
    return _row_to_out(row)
