from __future__ import annotations

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog import gov_config_store
from app.governance.catalog.cat02.errors import (
    CAT02_DUPLICATE_DIMENSION,
    CAT02_DUPLICATE_METRIC,
    CAT02_EMPTY_DIMENSIONS,
    CAT02_EMPTY_METRICS,
    CAT02_FORBIDDEN,
    CAT02_INVALID_AGGREGATION,
    CAT02_KEY_CONFLICT,
    CAT02_NOT_FOUND,
    Cat02Error,
)
from app.governance.catalog.cat02.schemas import (
    AggregateAttributionOut,
    AggregateTemplateIn,
    AggregateTemplateListResponse,
    AggregateTemplateOut,
    AggregateTemplateValidateOut,
)

_VALID_FN = frozenset({"sum", "avg", "count"})
_CONFIG_TYPE = "gov_aggregate_template"
_REF_TYPE = "aggregate_template"
_USER_AGGREGATE_SCOPE: dict[str, str] = {}


class _StoreCompat:
    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_config_store.clear_type(session, _CONFIG_TYPE)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_store = _StoreCompat()


def set_user_aggregate_scope(user_id: str, key_prefix: str) -> None:
    _USER_AGGREGATE_SCOPE[user_id] = key_prefix


def _assert_aggregate_write_access(user: UserContext, aggregate_key: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat02Error(CAT02_FORBIDDEN, "viewer cannot modify aggregate templates", 403)
    if "enterprise" in roles:
        prefix = _USER_AGGREGATE_SCOPE.get(user.id, "AGG")
        if not aggregate_key.startswith(prefix):
            raise Cat02Error(CAT02_FORBIDDEN, "enterprise user out of aggregate scope", 403)


def _assert_aggregate_read_access(user: UserContext, aggregate_key: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles:
        prefix = _USER_AGGREGATE_SCOPE.get(user.id, "AGG")
        if not aggregate_key.startswith(prefix):
            raise Cat02Error(CAT02_FORBIDDEN, "enterprise user out of aggregate scope", 403)
        return
    if "viewer" in roles:
        return
    raise Cat02Error(CAT02_FORBIDDEN, "aggregate read access denied", 403)


def _validate_payload(payload: AggregateTemplateIn) -> AggregateTemplateIn:
    if not payload.dimensions:
        raise Cat02Error(CAT02_EMPTY_DIMENSIONS, "dimensions must not be empty", 422)
    if not payload.metrics:
        raise Cat02Error(CAT02_EMPTY_METRICS, "metrics must not be empty", 422)
    if payload.aggregation_fn not in _VALID_FN:
        raise Cat02Error(CAT02_INVALID_AGGREGATION, "invalid aggregationFn", 422)
    if not payload.attribution_label or not payload.attribution_label.strip():
        raise Cat02Error("CAT02_ATTRIBUTION_REQUIRED", "attributionLabel is required", 422)
    if len(payload.dimensions) != len(set(payload.dimensions)):
        raise Cat02Error(CAT02_DUPLICATE_DIMENSION, "duplicate dimension", 422)
    if len(payload.metrics) != len(set(payload.metrics)):
        raise Cat02Error(CAT02_DUPLICATE_METRIC, "duplicate metric", 422)
    return payload


def validate_aggregate_template(payload: AggregateTemplateIn) -> AggregateTemplateValidateOut:
    item = _validate_payload(payload)
    return AggregateTemplateValidateOut(valid=True, aggregate_key=item.aggregate_key)


def create_aggregate_template(payload: AggregateTemplateIn, user: UserContext) -> AggregateTemplateOut:
    item = _validate_payload(payload)
    _assert_aggregate_write_access(user, item.aggregate_key)
    key = item.aggregate_key
    session = get_meta_session()
    try:
        if gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key):
            raise Cat02Error(CAT02_KEY_CONFLICT, f"aggregateKey already exists: {key}", 409)
        data = item.model_dump(by_alias=True, mode="json")
        gov_config_store.upsert_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key, payload=data
        )
        return AggregateTemplateOut.model_validate(data)
    finally:
        session.close()


def list_aggregate_templates(
    limit: int, offset: int, user: UserContext | None = None,
) -> AggregateTemplateListResponse:
    session = get_meta_session()
    try:
        items = gov_config_store.list_json(session, config_type=_CONFIG_TYPE)
        if user is not None and "enterprise" in set(user.roles) and "admin" not in set(user.roles):
            prefix = _USER_AGGREGATE_SCOPE.get(user.id, "AGG")
            items = [i for i in items if str(i.get("aggregateKey", "")).startswith(prefix)]
        page = items[offset : offset + limit]
        return AggregateTemplateListResponse(
            items=[AggregateTemplateOut.model_validate(i) for i in page],
            total=len(items),
        )
    finally:
        session.close()


def get_user_aggregate_scope_prefix(user_id: str) -> str:
    return _USER_AGGREGATE_SCOPE.get(user_id, "AGG")


def get_aggregate_template(aggregate_key: str) -> AggregateTemplateOut:
    session = get_meta_session()
    try:
        row = gov_config_store.get_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=aggregate_key
        )
        if row is None:
            raise Cat02Error(CAT02_NOT_FOUND, f"aggregateKey not found: {aggregate_key}", 404)
        return AggregateTemplateOut.model_validate(row)
    finally:
        session.close()


def get_aggregate_attribution(aggregate_key: str, user: UserContext) -> AggregateAttributionOut:
    _assert_aggregate_read_access(user, aggregate_key)
    session = get_meta_session()
    try:
        row = gov_config_store.get_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=aggregate_key
        )
        if row is None:
            raise Cat02Error(CAT02_NOT_FOUND, f"aggregateKey not found: {aggregate_key}", 404)
        return AggregateAttributionOut(
            aggregateKey=row["aggregateKey"],
            attributionLabel=row["attributionLabel"],
            dimensions=row["dimensions"],
            metrics=row["metrics"],
            aggregationFn=row["aggregationFn"],
            pocReady=True,
        )
    finally:
        session.close()
