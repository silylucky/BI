from __future__ import annotations

import time
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.acl import assert_visible
from app.metadata.dataset.models import DatasetRecord
from app.query.config_store.access import assert_config_readable
from app.query.config_store.service import get_config_by_id
from app.query.config_store.schemas import ConfigError, DatasetQueryConfigPayload
from app.query.dataset.guard import validate_dataset_spec
from app.query.dataset.schemas import DatasetExecutePlanOut, DatasetQuerySpec, ExecutePlanStep
from app.query.schemas import QueryError
from app.query.translator.from_config import translate_from_config_record
from app.query.translator.schemas import TranslateError

_FORBIDDEN_PARAM_KEYS = frozenset({"__proto__", "_sql"})
_EXECUTE_PLAN_BUDGET_MS = 30


def _assert_safe_params(params: dict) -> None:
    for key in params:
        if key in _FORBIDDEN_PARAM_KEYS or key.startswith("__"):
            raise QueryError("QUERY_DATASET_PLAN_INVALID_PARAMS", "Forbidden parameter key", 422)


def build_dataset_execute_plan(
    session: Session,
    user: UserContext,
    raw: dict,
) -> DatasetExecutePlanOut:
    validated = validate_dataset_spec(raw, user.roles, session=session)
    spec = DatasetQuerySpec.model_validate(raw)
    _assert_safe_params(spec.parameters)
    steps: list[ExecutePlanStep] = [
        ExecutePlanStep(step="path_resolve", status="pass", detail="dataset path resolved"),
    ]

    row = session.get(DatasetRecord, validated.dataset_id)
    if row is None or row.bound_config_id is None:
        steps.append(
            ExecutePlanStep(step="acl_check", status="fail", detail="Dataset 未绑定查询配置"),
        )
        return DatasetExecutePlanOut(
            datasetId=validated.dataset_id,
            resolvedPath="dataset",
            readonly=True,
            steps=steps,
        )

    try:
        record = get_config_by_id(session, row.bound_config_id)
        assert_config_readable(user, record)
        payload = record.payload if isinstance(record.payload, dict) else {}
        ds_raw = payload.get("dataSourceId")
        if not ds_raw:
            raise QueryError("QUERY_DATASET_NOT_BOUND", "Dataset binding missing dataSourceId", 422)
        assert_visible(session, user.roles, uuid.UUID(str(ds_raw)), is_root=user.is_root)
        steps.append(ExecutePlanStep(step="acl_check", status="pass", detail="ACL passed"))
    except (ConfigError, QueryError) as exc:
        steps.append(ExecutePlanStep(step="acl_check", status="fail", detail=exc.message))
        return DatasetExecutePlanOut(
            datasetId=validated.dataset_id,
            resolvedPath="dataset",
            readonly=True,
            steps=steps,
        )
    except Exception as exc:
        from app.auth.resources.service import VisibilityError

        if isinstance(exc, VisibilityError):
            steps.append(ExecutePlanStep(step="acl_check", status="fail", detail=exc.message))
            return DatasetExecutePlanOut(
                datasetId=validated.dataset_id,
                resolvedPath="dataset",
                readonly=True,
                steps=steps,
            )
        raise

    payload = DatasetQueryConfigPayload.model_validate(record.payload)
    try:
        translate_from_config_record(record)
        steps.append(ExecutePlanStep(step="readonly_guard", status="pass", detail="SQL translated"))
    except TranslateError as exc:
        steps.append(
            ExecutePlanStep(step="readonly_guard", status="fail", detail=exc.message),
        )
        return DatasetExecutePlanOut(
            datasetId=validated.dataset_id,
            resolvedPath="dataset",
            readonly=True,
            steps=steps,
        )

    schema = payload.schema or "public"
    table = payload.table
    if table and payload.columns:
        from app.datasources.metadata.service import list_columns

        try:
            col_resp = list_columns(
                session, list(user.roles), uuid.UUID(str(ds_raw)), schema, table,
            )
            available = {col.name for col in col_resp.items}
            missing = [c for c in payload.columns if c not in available]
            if missing:
                detail = f"绑定列不存在于目标表：{', '.join(missing[:5])}"
                steps.append(ExecutePlanStep(step="plan_ready", status="fail", detail=detail))
                return DatasetExecutePlanOut(
                    datasetId=validated.dataset_id,
                    resolvedPath="dataset",
                    readonly=True,
                    steps=steps,
                )
        except Exception as exc:
            steps.append(
                ExecutePlanStep(step="plan_ready", status="fail", detail=str(exc)[:200]),
            )
            return DatasetExecutePlanOut(
                datasetId=validated.dataset_id,
                resolvedPath="dataset",
                readonly=True,
                steps=steps,
            )

    steps.append(
        ExecutePlanStep(
            step="plan_ready",
            status="pass",
            detail=f"binding {row.bound_config_id} revision {record.revision}",
        ),
    )
    return DatasetExecutePlanOut(
        datasetId=validated.dataset_id,
        resolvedPath="dataset",
        readonly=True,
        steps=steps,
    )


def probe_execute_plan_budget_ms(session: Session, user: UserContext, raw: dict) -> float:
    start = time.perf_counter()
    build_dataset_execute_plan(session, user, raw)
    return (time.perf_counter() - start) * 1000.0
