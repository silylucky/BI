from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.surface_kind import layout_to_dict
from app.dashboard.theme.acl import assert_theme_action
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme.schemas import EntityThemeConfig
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert

_LINK_CHART_VIEWS_BUDGET_MS = 50


def _link_chart_views(db: Session, config: EntityThemeConfig) -> None:
    if not config.chart_view_bindings:
        return
    if config.ref_type != "dashboard":
        return
    dashboard = dash_service.get_dashboard(db, config.ref_id)
    widgets = layout_to_dict(dashboard.layout_json).get("widgets", [])
    widget_map = {str(w.get("id")): w for w in widgets if isinstance(w, dict)}
    dim_ids = {d.dimension_id for d in config.dimensions}
    bad: list[str] = []
    for binding in config.chart_view_bindings:
        wid = binding.widget_id
        widget = widget_map.get(wid)
        if widget is None or widget.get("type") != "chart":
            bad.append(wid)
            continue
        if binding.dimension_id and binding.dimension_id not in dim_ids:
            bad.append(wid)
            continue
        chart_config = widget.get("chartConfig")
        if chart_config:
            from app.schemas.chart_view import ChartViewError, validate_chart_view_config

            try:
                validate_chart_view_config(chart_config)
            except ChartViewError:
                bad.append(wid)
    if bad:
        raise ThemeAnalysisError(
            "DASH_THEME_CHART_VIEW_MISMATCH",
            "chartViewBindings reference invalid widgets or dimensions",
            422,
            fields=bad,
        )


def probe_link_chart_views_budget_ms(db: Session, config: EntityThemeConfig) -> float:
    start = time.perf_counter()
    _link_chart_views(db, config)
    return (time.perf_counter() - start) * 1000.0


def _resolve_dimensions(db: Session, config: EntityThemeConfig) -> None:
    from app.metadata.dimensions import service as dimension_service
    from app.metadata.dimensions.schemas import DimensionError

    dimension_service.ensure_legacy_probe_dimensions(db)
    for dim in config.dimensions:
        try:
            resolved = dimension_service.resolve_dimension_by_code(db, dim.dimension_id)
        except DimensionError as exc:
            status = 422 if exc.code == "META_DIM_NOT_FOUND" else exc.status
            raise ThemeAnalysisError(
                "DASH_THEME_DIMENSION_UNKNOWN",
                exc.message,
                status,
            ) from exc
        dim.dimension_id = resolved.code


def _map_validation(exc: ValidationError) -> ThemeAnalysisError:
    for err in exc.errors():
        loc = ".".join(str(x) for x in err["loc"])
        if "geo_binding" in loc or "geoBinding" in loc:
            return ThemeAnalysisError("DASH_THEME_INVALID_GEO", "geoBinding requires latField and lngField", 422)
        if "time_granularity" in loc or "timeGranularity" in loc:
            return ThemeAnalysisError("DASH_THEME_INVALID_GRANULARITY", "Invalid time granularity", 422)
        if "dimensions" in loc:
            return ThemeAnalysisError("DASH_THEME_EMPTY_DIMENSIONS", "At least one dimension required", 422)
    return ThemeAnalysisError("DASH_THEME_INVALID", "Invalid theme config", 422)


def validate_theme_config(payload: dict, db: Session | None = None) -> EntityThemeConfig:
    try:
        config = EntityThemeConfig.model_validate(payload)
    except ValidationError as exc:
        raise _map_validation(exc) from exc
    if not config.dimensions:
        raise ThemeAnalysisError("DASH_THEME_EMPTY_DIMENSIONS", "At least one dimension required", 422)
    if db is not None:
        _resolve_dimensions(db, config)
    if config.geo_binding is not None:
        if not config.geo_binding.lat_field or not config.geo_binding.lng_field:
            raise ThemeAnalysisError("DASH_THEME_INVALID_GEO", "geoBinding requires latField and lngField", 422)
    return config


def _assert_dashboard_theme_access(
    db: Session,
    actor: UserContext,
    config: EntityThemeConfig,
) -> None:
    if config.ref_type != "dashboard":
        return
    dashboard = dash_service.get_dashboard(db, config.ref_id)
    dash_service.assert_dashboard_access(
        db, actor, config.ref_id, dashboard.created_by, slug=dashboard.slug,
    )


def _assert_ref_exists(db: Session, config: EntityThemeConfig) -> None:
    if config.ref_type == "dashboard":
        try:
            dash_service.get_dashboard(db, config.ref_id)
        except dash_service.DashboardError as exc:
            if exc.code == "DASH_NOT_FOUND":
                raise ThemeAnalysisError("DASH_NOT_FOUND", exc.message, 404) from exc
            raise


def save_theme_config(db: Session, payload: dict, actor: UserContext) -> EntityThemeConfig:
    assert_theme_action(actor, "write")
    config = validate_theme_config(payload, db)
    _assert_ref_exists(db, config)
    _assert_dashboard_theme_access(db, actor, config)
    _link_chart_views(db, config)
    owner_id: uuid.UUID | None = None
    try:
        owner_id = uuid.UUID(actor.id)
    except ValueError:
        pass
    config_store.upsert_config(
        db,
        ConfigUpsert(
            config_type="entity_theme",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=config.model_dump(mode="json", by_alias=True),
        ),
        owner_id=owner_id,
    )
    return config


def get_theme_config(db: Session, ref_type: str, ref_id: uuid.UUID, actor: UserContext | None = None) -> EntityThemeConfig:
    record = config_store.get_config_by_ref(db, "entity_theme", ref_type, ref_id)
    config = validate_theme_config(record.payload, db)
    if actor is not None:
        _assert_dashboard_theme_access(db, actor, config)
    return config


def resolve_chart_bindings_for_execute(db: Session, ref_type: str, ref_id: uuid.UUID) -> list[dict]:
    config = get_theme_config(db, ref_type, ref_id)
    if config.ref_type != "dashboard":
        return []
    dashboard = dash_service.get_dashboard(db, config.ref_id)
    widgets = layout_to_dict(dashboard.layout_json).get("widgets", [])
    widget_map = {str(w.get("id")): w for w in widgets if isinstance(w, dict)}
    resolved: list[dict] = []
    for binding in config.chart_view_bindings:
        widget = widget_map.get(binding.widget_id)
        if widget is None or widget.get("type") != "chart":
            raise ThemeAnalysisError(
                "DASH_THEME_CHART_VIEW_MISMATCH",
                "chartViewBindings reference invalid widgets",
                422,
                fields=[binding.widget_id],
            )
        chart_config = widget.get("chartConfig") or {}
        resolved.append({
            "widgetId": binding.widget_id,
            "chartType": chart_config.get("chartType", "unknown"),
            "dimensionId": binding.dimension_id,
        })
    return resolved


def get_chart_bindings(
    db: Session,
    ref_type: str,
    ref_id: uuid.UUID,
    actor: UserContext | None = None,
) -> dict:
    config = get_theme_config(db, ref_type, ref_id, actor)
    return {
        "bindings": [b.model_dump(mode="json", by_alias=True) for b in config.chart_view_bindings],
        "linkedWidgetCount": len(config.chart_view_bindings),
        "validatedAt": datetime.now(UTC).isoformat(),
    }
