from __future__ import annotations

import time
import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme.schemas import (
    CompareWindow,
    CompareWindowInterval,
    EntityThemeConfig,
    ThemeExecutePlanOut,
    ThemePlanStep,
)
from app.dashboard.theme import service as theme_service
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError

_ANCHOR = date(2026, 1, 1)


def _granularity_window(config: EntityThemeConfig) -> tuple[ThemePlanStep, CompareWindow | None]:
    gran = config.time_granularity
    if gran in {"day", "week", "month"}:
        return ThemePlanStep(step="granularity_window", status="pass", detail=gran), None
    if gran in {"yoy", "mom"}:
        current = CompareWindowInterval(
            start=_ANCHOR.isoformat(),
            end=(_ANCHOR + timedelta(days=30)).isoformat(),
        )
        baseline_start = _ANCHOR - timedelta(days=365 if gran == "yoy" else 30)
        baseline = CompareWindowInterval(
            start=baseline_start.isoformat(),
            end=(baseline_start + timedelta(days=30)).isoformat(),
        )
        return (
            ThemePlanStep(step="granularity_window", status="pass", detail=gran),
            CompareWindow(current=current, baseline=baseline),
        )
    raise ThemeAnalysisError("DASH_THEME_INVALID_GRANULARITY", "Invalid time granularity", 422)


def build_theme_execute_plan(
    db: Session,
    ref_type: str,
    ref_id: uuid.UUID,
    actor: UserContext,
) -> ThemeExecutePlanOut:
    steps: list[ThemePlanStep] = []
    try:
        record = config_store.get_config_by_ref(db, "entity_theme", ref_type, ref_id)
        config = theme_service.validate_theme_config(record.payload)
        theme_service.get_theme_config(db, ref_type, ref_id, actor)
        steps.append(ThemePlanStep(step="config_load", status="pass", detail="entity_theme loaded"))
    except ConfigError as exc:
        if exc.code == "CONFIG_NOT_FOUND":
            raise ThemeAnalysisError("CONFIG_NOT_FOUND", exc.message, 404) from exc
        raise
    resolved = theme_service.resolve_chart_bindings_for_execute(db, ref_type, ref_id)
    steps.append(ThemePlanStep(step="bindings_resolve", status="pass", detail=f"{len(resolved)} widgets"))
    gran_step, compare_window = _granularity_window(config)
    steps.append(gran_step)
    if config.geo_binding is None:
        steps.append(ThemePlanStep(step="geo_check", status="skip", detail="no geoBinding"))
    else:
        geo = config.geo_binding
        if not geo.lat_field or not geo.lng_field:
            raise ThemeAnalysisError("DASH_THEME_INVALID_GEO", "geoBinding requires latField and lngField", 422)
        steps.append(ThemePlanStep(step="geo_check", status="pass", detail="geo fields present"))
    return ThemeExecutePlanOut(
        refType=ref_type,
        refId=ref_id,
        steps=steps,
        compareWindow=compare_window,
        resolvedWidgets=resolved,
    )


def probe_theme_execute_plan_budget_ms(
    db: Session,
    ref_type: str,
    ref_id: uuid.UUID,
    actor: UserContext,
) -> float:
    start = time.perf_counter()
    build_theme_execute_plan(db, ref_type, ref_id, actor)
    return (time.perf_counter() - start) * 1000.0
