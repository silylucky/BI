from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.global_filters.errors import (
    DASH_FILTER_DUPLICATE_PARAMETER_KEY,
    DASH_FILTER_INVALID_DIMENSION_REF,
    GlobalFilterError,
)
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem, GlobalFilterLinkageOut
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert

_REF_TYPE = "global_filter_linkage"
_CONFIG_TYPE = "global_filter_linkage"
_DIMENSION_REF_RE = re.compile(r"^[a-z][a-z0-9_.]{0,127}$")
_USER_FILTER_DASHBOARD_SCOPE: dict[str, set[uuid.UUID]] = {}


def set_user_filter_dashboard_scope(user_id: str, allowed_dashboard_ids: set[uuid.UUID]) -> None:
    _USER_FILTER_DASHBOARD_SCOPE[user_id] = set(allowed_dashboard_ids)


def _assert_dashboard_access(
    session: Session,
    actor: UserContext,
    dashboard_id: uuid.UUID,
    dashboard_created_by: uuid.UUID | None,
    *,
    slug: str | None = None,
) -> None:
    try:
        dash_service.assert_dashboard_access(
            session, actor, dashboard_id, dashboard_created_by, slug=slug,
        )
    except dash_service.DashboardError as exc:
        if exc.code == "DASH_FORBIDDEN":
            raise GlobalFilterError("DASH_FILTER_FORBIDDEN", exc.message, 403) from exc
        raise


def _assert_write_access(actor: UserContext) -> None:
    if set(actor.roles) <= {"viewer"}:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "viewer cannot modify global filter linkage", 403)


def _assert_enterprise_scope(actor: UserContext, dashboard_id: uuid.UUID) -> None:
    if "enterprise" not in actor.roles:
        return
    allowed = _USER_FILTER_DASHBOARD_SCOPE.get(actor.id)
    if allowed is None:
        return
    if dashboard_id not in allowed:
        raise GlobalFilterError("DASH_FILTER_FORBIDDEN", "enterprise user out of dashboard scope", 403)


def _validate_filter_bindings(filters: list, session: Session | None = None) -> None:
    from app.datasources.models import get_meta_session
    from app.metadata.dimensions import service as dimension_service
    from app.metadata.dimensions.schemas import DimensionError

    owns_session = session is None
    if session is None:
        session = get_meta_session()
    try:
        dimension_service.ensure_legacy_probe_dimensions(session)
        for f in filters:
            if not _DIMENSION_REF_RE.match(f.dimension_ref):
                raise GlobalFilterError(
                    DASH_FILTER_INVALID_DIMENSION_REF,
                    "Invalid dimensionRef",
                    422,
                    [{"field": "dimensionRef", "message": "invalid pattern"}],
                )
            try:
                dimension_service.resolve_dimension_by_code(session, f.dimension_ref)
            except DimensionError as exc:
                status = 422 if exc.code == "META_DIM_NOT_FOUND" else exc.status
                raise GlobalFilterError(
                    DASH_FILTER_INVALID_DIMENSION_REF,
                    exc.message,
                    status,
                    [{"field": "dimensionRef", "message": f"unknown: {f.dimension_ref}"}],
                ) from exc
    finally:
        if owns_session:
            session.close()


def _validate_linkage_rules(rules: list) -> None:
    keys = [r.parameter_key for r in rules]
    if len(keys) != len(set(keys)):
        raise GlobalFilterError(
            DASH_FILTER_DUPLICATE_PARAMETER_KEY,
            "Duplicate parameterKey in linkageRules",
            422,
            [{"field": "parameterKey", "message": "duplicate"}],
        )


def _load_linkage_payload(session: Session, dashboard_id: uuid.UUID) -> GlobalFilterLinkageItem:
    try:
        record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, dashboard_id)
    except ConfigError as exc:
        raise GlobalFilterError("DASH_FILTER_NOT_FOUND", "Global filter linkage not configured", 404) from exc
    return GlobalFilterLinkageItem.model_validate(record.payload)


def _widget_ids(session: Session, dashboard_id: uuid.UUID) -> set[str]:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    layout = dashboard.layout_json
    if layout is None:
        return set()
    return {str(widget.id) for widget in layout.widgets if widget.id}


def _validate_linkage(session: Session, item: GlobalFilterLinkageItem) -> GlobalFilterLinkageItem:
    _validate_filter_bindings(item.filters, session)
    _validate_linkage_rules(item.linkage_rules)
    try:
        dash_service.get_dashboard(session, item.dashboard_id)
    except dash_service.DashboardError as exc:
        if exc.code == "DASH_NOT_FOUND":
            raise GlobalFilterError("DASH_FILTER_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from exc
        raise
    filter_ids = [f.filter_id for f in item.filters]
    if item.filters and len(filter_ids) != len(set(filter_ids)):
        raise GlobalFilterError("DASH_FILTER_DUPLICATE_ID", "Duplicate filterId", 422)
    known_filters = set(filter_ids)
    widget_ids = _widget_ids(session, item.dashboard_id)
    for rule in item.linkage_rules:
        if rule.source_filter_id not in known_filters:
            raise GlobalFilterError(
                "DASH_FILTER_UNKNOWN_SOURCE",
                f"Unknown sourceFilterId: {rule.source_filter_id}",
                422,
            )
        missing = [wid for wid in rule.target_widget_ids if wid not in widget_ids]
        if missing:
            raise GlobalFilterError(
                "DASH_FILTER_WIDGET_NOT_FOUND",
                f"Widget not in layout: {missing[0]}",
                422,
                [{"field": "targetWidgetIds", "message": f"unknown widget: {missing[0]}"}],
            )
    return item


def validate_linkage(
    session: Session, item: GlobalFilterLinkageItem, actor: UserContext,
) -> GlobalFilterLinkageItem:
    item = _validate_linkage(session, item)
    dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    _assert_dashboard_access(session, actor, item.dashboard_id, dashboard.created_by, slug=dashboard.slug)
    return item


def save_linkage(
    session: Session,
    item: GlobalFilterLinkageItem,
    actor: UserContext,
    *,
    auto_commit: bool = True,
) -> GlobalFilterLinkageOut:
    _assert_write_access(actor)
    _validate_linkage(session, item)
    dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    _assert_enterprise_scope(actor, item.dashboard_id)
    _assert_dashboard_access(session, actor, item.dashboard_id, dashboard.created_by, slug=dashboard.slug)
    try:
        owner_id = uuid.UUID(actor.id)
    except ValueError:
        owner_id = None
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_CONFIG_TYPE,
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=item.dashboard_id,
            payload=item.model_dump(by_alias=True, mode="json"),
        ),
        owner_id=owner_id,
        auto_commit=auto_commit,
    )
    if auto_commit:
        return get_linkage(session, item.dashboard_id, actor)
    affected = sum(len(r.target_widget_ids) for r in item.linkage_rules)
    return GlobalFilterLinkageOut(**item.model_dump(), affected_widget_count=affected)


def get_linkage(session: Session, dashboard_id: uuid.UUID, actor: UserContext) -> GlobalFilterLinkageOut:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    _assert_enterprise_scope(actor, dashboard_id)
    _assert_dashboard_access(session, actor, dashboard_id, dashboard.created_by, slug=dashboard.slug)
    try:
        record = config_store.get_config_by_ref(session, _CONFIG_TYPE, _REF_TYPE, dashboard_id)
    except ConfigError as exc:
        raise GlobalFilterError("DASH_FILTER_NOT_FOUND", "Global filter linkage not configured", 404) from exc
    item = GlobalFilterLinkageItem.model_validate(record.payload)
    affected = sum(len(r.target_widget_ids) for r in item.linkage_rules)
    return GlobalFilterLinkageOut(**item.model_dump(), affected_widget_count=affected)
