from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.metadata.dataset.models import DatasetRecord
from app.query.dataset.schemas import DatasetQuerySpec, DatasetRoutingOut, DatasetValidateOut
from app.query.schemas import QueryError

_BUILTIN_DATASETS: dict[str, dict] = {
    "demo-orders": {"allowedRoles": ["analyst"], "readonly": True},
    "restricted-ledger": {"allowedRoles": ["finance"], "readonly": True},
}


@dataclass(frozen=True)
class PathSignals:
    has_dataset: bool
    has_datasource: bool
    has_connector: bool
    has_sql: bool


def _signals(raw: dict) -> PathSignals:
    return PathSignals(
        has_dataset=bool(raw.get("datasetId")),
        has_datasource=bool(raw.get("dataSourceId")),
        has_connector=bool(raw.get("connectorType")),
        has_sql=bool(raw.get("sql")),
    )


def resolve_query_path(raw: dict) -> str:
    sig = _signals(raw)
    active = sum([sig.has_dataset, sig.has_datasource or sig.has_sql, sig.has_connector])
    if active > 1:
        raise QueryError("QUERY_PATH_AMBIGUOUS", "Conflicting query path fields", 422)
    if sig.has_dataset:
        return "dataset"
    if sig.has_connector:
        return "native"
    return "sql"


def dataset_routing_doc() -> DatasetRoutingOut:
    return DatasetRoutingOut(
        paths=["sql", "native", "dataset"],
        boundaryNotes={
            "sql": "dataSourceId + sql/table; must not include datasetId",
            "native": "connectorType + body; must not include datasetId or sql",
            "dataset": "datasetId + optional parameters; must not include dataSourceId/connectorType/sql",
        },
    )


def _assert_roles_allowed(roles: list[str], allowed_roles: list[str] | None) -> None:
    if "admin" in roles:
        return
    allowed = set(allowed_roles or [])
    if allowed and not set(roles).intersection(allowed):
        raise QueryError("QUERY_DATASET_FORBIDDEN", "Dataset access denied", 403)


def _resolve_dataset_row(session: Session, dataset_id: str) -> DatasetRecord:
    row = session.get(DatasetRecord, dataset_id)
    if row is None:
        raise QueryError("QUERY_DATASET_NOT_FOUND", "Dataset not found", 404)
    return row


def validate_dataset_spec(raw: dict, roles: list[str], *, session: Session | None = None) -> DatasetValidateOut:
    path = resolve_query_path(raw)
    if path != "dataset":
        raise QueryError("QUERY_PATH_AMBIGUOUS", "Expected dataset path", 422)
    spec = DatasetQuerySpec.model_validate(raw)
    if spec.operation != "select":
        raise QueryError("QUERY_DATASET_NOT_READONLY", "Dataset path allows select only", 422)

    meta = _BUILTIN_DATASETS.get(spec.dataset_id)
    if meta is not None:
        _assert_roles_allowed(roles, meta.get("allowedRoles"))
        if session is not None:
            row = session.get(DatasetRecord, spec.dataset_id)
            if row is None or row.bound_config_id is None:
                raise QueryError("QUERY_DATASET_NOT_BOUND", "Dataset has no query binding", 422)
        return DatasetValidateOut(datasetId=spec.dataset_id, resolvedPath="dataset", readonly=True)

    if session is None:
        raise QueryError("QUERY_DATASET_NOT_FOUND", "Dataset not found", 404)
    row = _resolve_dataset_row(session, spec.dataset_id)
    _assert_roles_allowed(roles, list(row.allowed_roles or []))
    if row.bound_config_id is None:
        raise QueryError("QUERY_DATASET_NOT_BOUND", "Dataset has no query binding", 422)
    return DatasetValidateOut(datasetId=spec.dataset_id, resolvedPath="dataset", readonly=True)
