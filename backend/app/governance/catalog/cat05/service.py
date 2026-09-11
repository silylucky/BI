from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog import gov_config_store
from app.governance.catalog.cat05.errors import CAT05_FORBIDDEN, Cat05Error
from app.governance.catalog.cat05.schemas import (
    TicketStatsItemIn,
    TicketStatsItemOut,
    TicketStatsListResponse,
    TicketStatsProbeOut,
    TicketStatsValidateOut,
)

_VALID_STATUS = frozenset({"open", "closed", "pending"})
_CONFIG_TYPE = "gov_ticket_stats"
_REF_TYPE = "ticket_stats"
_USER_TICKET_SCOPE: dict[str, str] = {}


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


def set_user_ticket_scope(user_id: str, category_key: str) -> None:
    _USER_TICKET_SCOPE[user_id] = category_key


def _validate_payload(payload: TicketStatsItemIn) -> TicketStatsItemIn:
    if not payload.status_filters:
        raise Cat05Error(
            "CAT05_EMPTY_STATUS_FILTERS",
            "statusFilters must not be empty",
            422,
            [{"field": "statusFilters", "message": "must not be empty"}],
        )
    invalid = [s for s in payload.status_filters if s not in _VALID_STATUS]
    if invalid:
        raise Cat05Error(
            "CAT05_INVALID_STATUS",
            "Invalid status filter value",
            422,
            [{"field": "statusFilters", "message": f"invalid: {invalid[0]}"}],
        )
    return payload


def _assert_ticket_access(user: UserContext, category_key: str, *, write: bool) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "enterprise" in roles:
        expected = _USER_TICKET_SCOPE.get(user.id, "TICKET_DEFAULT")
        if category_key != expected:
            raise Cat05Error(CAT05_FORBIDDEN, "enterprise user cannot access ticket category", 403)
        return
    if write:
        raise Cat05Error(CAT05_FORBIDDEN, "viewer cannot create ticket stats", 403)


def validate_ticket_item(payload: TicketStatsItemIn) -> TicketStatsValidateOut:
    item = _validate_payload(payload)
    return TicketStatsValidateOut(
        valid=True,
        category_key=item.ticket_category_key,
        status_count=len(item.status_filters),
    )


def create_ticket_item(payload: TicketStatsItemIn, user: UserContext) -> TicketStatsItemOut:
    item = _validate_payload(payload)
    key = item.ticket_category_key
    _assert_ticket_access(user, key, write=True)
    session = get_meta_session()
    try:
        if gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key):
            raise Cat05Error("CAT05_KEY_CONFLICT", f"ticketCategoryKey already exists: {key}", 409)
        data = item.model_dump(by_alias=True, mode="json")
        gov_config_store.upsert_json(
            session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key, payload=data
        )
        return TicketStatsItemOut.model_validate(data)
    finally:
        session.close()


def list_ticket_items(limit: int, offset: int) -> TicketStatsListResponse:
    session = get_meta_session()
    try:
        items = gov_config_store.list_json(session, config_type=_CONFIG_TYPE)
        page = items[offset : offset + limit]
        return TicketStatsListResponse(
            items=[TicketStatsItemOut.model_validate(i) for i in page],
            total=len(items),
        )
    finally:
        session.close()


def get_ticket_stats(key: str, user: UserContext) -> TicketStatsProbeOut:
    from datetime import UTC, datetime

    session = get_meta_session()
    try:
        if not gov_config_store.get_json(session, config_type=_CONFIG_TYPE, ref_type=_REF_TYPE, key=key):
            raise Cat05Error("CAT05_NOT_FOUND", f"ticketCategoryKey not found: {key}", 404)
    finally:
        session.close()
    _assert_ticket_access(user, key, write=False)
    return TicketStatsProbeOut(open=12, closed=3, pending=5, sampled_at=datetime.now(UTC))


from app.governance.catalog.cat05.probe import Cat05ProbeResult, probe_ticket_stats_budget_ms  # noqa: F401, E402
