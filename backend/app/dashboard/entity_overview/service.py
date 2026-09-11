from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.entity_overview.errors import (
    DASH_OVERVIEW_INVALID_DRILL_WIDGET,
    DASH_OVERVIEW_INVALID_ENTITY_TYPE,
    DASH_OVERVIEW_INVALID_METRIC_SOURCE,
    DASH_OVERVIEW_METRIC_KEY_MISMATCH,
    EntityOverviewError,
)
from app.dashboard.entity_overview.schemas import EntityOverviewItem, EntityOverviewOut
from app.governance.publish import service as publish_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert

_REF_TYPE = "entity_overview"
_ENTITY_TYPE_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


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
            raise EntityOverviewError("DASH_OVERVIEW_FORBIDDEN", exc.message, 403) from exc
        raise


def _validate_item(session: Session, item: EntityOverviewItem) -> EntityOverviewItem:
    if not item.stat_cards:
        raise EntityOverviewError(
            "DASH_OVERVIEW_EMPTY_CARDS",
            "At least one stat card is required",
            422,
            fields=[{"field": "statCards", "message": "must not be empty"}],
        )
    keys = [c.metric_key for c in item.stat_cards]
    if len(keys) != len(set(keys)):
        raise EntityOverviewError("DASH_OVERVIEW_DUPLICATE_METRIC", "Duplicate metricKey", 422)
    if not _ENTITY_TYPE_RE.match(item.entity_type_ref):
        raise EntityOverviewError(
            DASH_OVERVIEW_INVALID_ENTITY_TYPE,
            "Invalid entityTypeRef",
            422,
            fields=[{"field": "entityTypeRef", "message": "must match ^[a-z][a-z0-9_]{1,63}$"}],
        )
    try:
        dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    except dash_service.DashboardError as exc:
        if exc.code == "DASH_NOT_FOUND":
            raise EntityOverviewError("DASH_OVERVIEW_DASHBOARD_NOT_FOUND", "Dashboard not found", 404) from exc
        raise
    widget_ids = {
        str(w.get("id"))
        for w in (dashboard.layout_json or {}).get("widgets", [])
        if isinstance(w, dict) and w.get("id") is not None
    }
    widget_map = {
        str(w.get("id")): w
        for w in (dashboard.layout_json or {}).get("widgets", [])
        if isinstance(w, dict) and w.get("id") is not None
    }
    if widget_ids:
        for drill in item.drill_targets:
            if drill.widget_id not in widget_ids:
                raise EntityOverviewError(
                    DASH_OVERVIEW_INVALID_DRILL_WIDGET,
                    f"drill widget not in layout: {drill.widget_id}",
                    422,
                    fields=[{"field": "drillTargets.widgetId", "message": drill.widget_id}],
                )
    elif item.drill_targets:
        raise EntityOverviewError(
            DASH_OVERVIEW_INVALID_DRILL_WIDGET,
            "drill targets require layout widgets",
            422,
            fields=[{"field": "drillTargets", "message": "layout has no widgets"}],
        )
    for card in item.stat_cards:
        if card.metric_source is None:
            continue
        widget = widget_map.get(card.metric_source.widget_id)
        if widget is None:
            raise EntityOverviewError(
                DASH_OVERVIEW_INVALID_METRIC_SOURCE,
                f"metricSource widget not in layout: {card.metric_source.widget_id}",
                422,
                fields=[{"field": "statCards.metricSource.widgetId", "message": card.metric_source.widget_id}],
            )
        if card.metric_key == "count":
            continue
        chart = widget.get("chartConfig") or {}
        metric_fields = {
            str(m.get("field"))
            for m in chart.get("metrics") or []
            if isinstance(m, dict) and m.get("field")
        }
        if card.metric_key not in metric_fields:
            raise EntityOverviewError(
                DASH_OVERVIEW_METRIC_KEY_MISMATCH,
                f"metricKey {card.metric_key} not found in widget metrics",
                422,
                fields=[{"field": "statCards.metricKey", "message": card.metric_key}],
            )
    return item


def validate_overview(session: Session, item: EntityOverviewItem) -> EntityOverviewItem:
    return _validate_item(session, item)


def save_overview(session: Session, item: EntityOverviewItem, actor: UserContext) -> EntityOverviewOut:
    _validate_item(session, item)
    dashboard = dash_service.get_dashboard(session, item.dashboard_id)
    _assert_dashboard_access(session, actor, item.dashboard_id, dashboard.created_by, slug=dashboard.slug)
    try:
        owner_id = uuid.UUID(actor.id)
    except ValueError:
        owner_id = None
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="entity_overview",
            schema_version="1.0",
            ref_type=_REF_TYPE,
            ref_id=item.dashboard_id,
            payload=item.model_dump(by_alias=True, mode="json"),
        ),
        owner_id=owner_id,
    )
    return get_overview(session, item.dashboard_id, actor)


def get_overview(session: Session, dashboard_id: uuid.UUID, actor: UserContext) -> EntityOverviewOut:
    dashboard = dash_service.get_dashboard(session, dashboard_id)
    _assert_dashboard_access(session, actor, dashboard_id, dashboard.created_by, slug=dashboard.slug)
    try:
        record = config_store.get_config_by_ref(session, "entity_overview", _REF_TYPE, dashboard_id)
    except ConfigError as exc:
        raise EntityOverviewError("DASH_OVERVIEW_NOT_FOUND", "Entity overview not configured", 404) from exc
    item = EntityOverviewItem.model_validate(record.payload)
    publish_status = None
    if item.catalog_entry_id:
        try:
            publish_status = publish_service.get_publish_status(session, item.catalog_entry_id).status
        except Exception:
            publish_status = None
    return EntityOverviewOut(**item.model_dump(), publishStatus=publish_status)
