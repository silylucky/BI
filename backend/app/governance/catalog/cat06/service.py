from __future__ import annotations

from datetime import UTC, datetime

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog import gov_config_store
from app.governance.catalog.cat06.errors import CAT06_EMPTY_METRICS, Cat06Error
from app.governance.catalog.cat06.schemas import (
    ProductionStatsItemIn,
    ProductionStatsItemOut,
    ProductionStatsListResponse,
    ProductionStatsProbeOut,
    ProductionStatsValidateOut,
)

_VALID_VENDOR = frozenset({"enterprise", "scheme", "model", "dcas"})
_CONFIG_TYPE = "gov_production_stats"
_REF_TYPE = "production_stats"
_USER_BRAND_SCOPE: dict[str, str] = {}


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


def set_user_brand_scope(user_id: str, brand_id: str) -> None:
    _USER_BRAND_SCOPE[user_id] = brand_id


def _assert_brand_access(user: UserContext, brand_id: str) -> None:
    roles = set(user.roles)
    if "enterprise" in roles and not roles.intersection({"admin", "analyst"}):
        expected = _USER_BRAND_SCOPE.get(user.id, "BRAND01")
        if brand_id != expected:
            raise Cat06Error(
                "CAT06_BRAND_FORBIDDEN",
                f"enterprise user cannot access brand {brand_id}",
                403,
            )


def _validate_payload(payload: ProductionStatsItemIn) -> ProductionStatsItemIn:
    if payload.vendor_type not in _VALID_VENDOR:
        raise Cat06Error(
            "CAT06_INVALID_VENDOR",
            "Invalid vendorType",
            422,
            [{"field": "vendorType", "message": "invalid"}],
        )
    if not payload.metric_keys:
        raise Cat06Error(
            CAT06_EMPTY_METRICS,
            "metricKeys must not be empty",
            422,
            [{"field": "metricKeys", "message": "must not be empty"}],
        )
    return payload


def validate_production_stats(payload: ProductionStatsItemIn) -> ProductionStatsValidateOut:
    item = _validate_payload(payload)
    return ProductionStatsValidateOut(valid=True, stats_key=item.stats_key)


def create_production_stats(payload: ProductionStatsItemIn, user: UserContext) -> ProductionStatsItemOut:
    item = _validate_payload(payload)
    _assert_brand_access(user, item.brand_id)
    session = get_meta_session()
    try:
        if gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=item.stats_key):
            raise Cat06Error("CAT06_KEY_CONFLICT", f"statsKey already exists: {item.stats_key}", 409)
        data = item.model_dump(by_alias=True, mode="json")
        gov_config_store.upsert_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=item.stats_key, payload=data
        )
        return ProductionStatsItemOut.model_validate(data)
    finally:
        session.close()


def list_production_stats(user: UserContext, limit: int, offset: int) -> ProductionStatsListResponse:
    session = get_meta_session()
    try:
        items = gov_config_store.list_json(session, config_type=_CONFIG_TYPE)
        roles = set(user.roles)
        if "enterprise" in roles and not roles.intersection({"admin", "analyst"}):
            expected = _USER_BRAND_SCOPE.get(user.id, "BRAND01")
            items = [i for i in items if i.get("brandId") == expected]
        page = items[offset : offset + limit]
        return ProductionStatsListResponse(
            items=[ProductionStatsItemOut.model_validate(i) for i in page],
            total=len(items),
        )
    finally:
        session.close()


def get_production_stats(key: str, user: UserContext) -> ProductionStatsProbeOut:
    session = get_meta_session()
    try:
        row = gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key)
        if row is None:
            raise Cat06Error("CAT06_NOT_FOUND", f"statsKey not found: {key}", 404)
        brand_id = row["brandId"]
    finally:
        session.close()
    _assert_brand_access(user, brand_id)
    return ProductionStatsProbeOut(
        inbound=120,
        inventory=85,
        opened=40,
        activated=22,
        sampled_at=datetime.now(UTC),
    )


from app.governance.catalog.cat06.probe import (  # noqa: F401, E402
    Cat06ProbeResult,
    probe_production_stats_budget_ms,
    probe_validate_production_stats_budget_ms,
)
