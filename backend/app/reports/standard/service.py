from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.reports.engine import execute as engine_execute
from app.reports.standard.errors import (
    RPT_STD_DATASET_NOT_FOUND,
    RPT_STD_DATASET_UNBOUND,
    RPT_STD_EMPTY_ROLES,
    RPT_STD_FORBIDDEN,
    RPT_STD_KEY_MISMATCH,
    RPT_STD_NOT_FOUND,
    RPT_STD_THEME_DISABLED,
    StandardAnalysisError,
)
from app.reports.standard.schemas import (
    AnalysisPackIn,
    AnalysisPackListResponse,
    AnalysisPackOut,
    CapabilitiesOut,
    RunIn,
    RunOut,
)
from app.reports.standard.capabilities import evaluate_capabilities
from app.reports.persistence import standard_repo
from app.reports import label_translation


def _assert_read_access(user: UserContext, allowed_roles: list[str]) -> None:
    if not set(user.roles).intersection(set(allowed_roles)):
        raise StandardAnalysisError(RPT_STD_FORBIDDEN, "role not allowed to access analysis pack", 403)


def _assert_write_access(user: UserContext) -> None:
    if set(user.roles) <= {"viewer"}:
        raise StandardAnalysisError(RPT_STD_FORBIDDEN, "viewer cannot manage analysis packs", 403)


def _load_columns_from_dataset(dataset_id: str, bound_config_id: uuid.UUID | None) -> list[dict]:
    from app.datasources.models import get_meta_session
    from app.metadata.dataset.errors import DatasetError
    from app.metadata.dataset.service import get_dataset
    from app.query.config_store.service import get_config_by_id

    try:
        dataset = get_dataset(dataset_id)
    except DatasetError as exc:
        raise StandardAnalysisError(RPT_STD_DATASET_NOT_FOUND, exc.message, exc.status) from exc
    config_id = bound_config_id or dataset.bound_config_id
    if config_id is None:
        raise StandardAnalysisError(RPT_STD_DATASET_UNBOUND, "Dataset has no bound query config", 422)
    session = get_meta_session()
    try:
        record = get_config_by_id(session, config_id)
    finally:
        session.close()
    payload = record.payload or {}
    raw_columns = payload.get("columns") or []
    return [{"name": col} for col in raw_columns if isinstance(col, str) and col.strip()]


def _load_pack_columns(pack: AnalysisPackIn) -> list[dict]:
    return _load_columns_from_dataset(pack.dataset_id or "", pack.bound_config_id)


def _validate_pack(payload: AnalysisPackIn) -> AnalysisPackIn:
    if not payload.allowed_roles:
        raise StandardAnalysisError(RPT_STD_EMPTY_ROLES, "allowedRoles must not be empty", 422)
    columns = _load_pack_columns(payload)
    caps = evaluate_capabilities(payload.field_mapping, columns)
    for theme in payload.enabled_themes:
        cap = next((c for c in caps if c.theme == theme), None)
        if cap is None or not cap.available:
            raise StandardAnalysisError(
                RPT_STD_THEME_DISABLED,
                f"theme {theme} not available for field mapping",
                422,
            )
    return payload


def list_packs(user: UserContext) -> AnalysisPackListResponse:
    items = []
    for raw in standard_repo.all_packs().values():
        pack = AnalysisPackOut.model_validate(raw)
        if set(user.roles).intersection(set(pack.allowed_roles)):
            items.append(pack)
    return AnalysisPackListResponse(items=items, total=len(items))


def get_pack(key: str, user: UserContext, *, skip_acl: bool = False) -> AnalysisPackOut:
    raw = standard_repo.get_pack(key)
    if raw is None:
        raise StandardAnalysisError(RPT_STD_NOT_FOUND, "Analysis pack not found", 404)
    pack = AnalysisPackOut.model_validate(raw)
    if not skip_acl:
        _assert_read_access(user, pack.allowed_roles)
    return pack


def upsert_pack(key: str, payload: AnalysisPackIn, user: UserContext) -> AnalysisPackOut:
    _assert_write_access(user)
    if key != payload.pack_key:
        raise StandardAnalysisError(RPT_STD_KEY_MISMATCH, "path packKey mismatch", 422)
    item = _validate_pack(payload)
    standard_repo.save_pack(key, item.model_dump(by_alias=True, mode="json"))
    from app.reports.standard.jobs import refresh_standard_snapshot_jobs

    refresh_standard_snapshot_jobs()
    return AnalysisPackOut.model_validate(standard_repo.get_pack(key))


def delete_pack(key: str, user: UserContext) -> None:
    _assert_write_access(user)
    if standard_repo.get_pack(key) is None:
        raise StandardAnalysisError(RPT_STD_NOT_FOUND, "Analysis pack not found", 404)
    standard_repo.delete_pack(key)
    from app.reports.standard.jobs import refresh_standard_snapshot_jobs

    refresh_standard_snapshot_jobs()


def get_capabilities(key: str, user: UserContext) -> CapabilitiesOut:
    pack = get_pack(key, user)
    columns = _load_pack_columns(pack)
    themes = evaluate_capabilities(pack.field_mapping, columns, pack.enabled_themes)
    return CapabilitiesOut(
        packKey=pack.pack_key,
        themes=themes,
        columns=[c.get("name", "") for c in columns],
    )


def run_pack(
    db: Session, key: str, payload: RunIn, user: UserContext, *, skip_acl: bool = False,
) -> RunOut:
    from app.reports.standard.dataset_binding import ensure_analysis_pack_dataset_binding
    from app.reports.standard.theme_aggregate import aggregate_pack_theme

    pack = get_pack(key, user, skip_acl=skip_acl)
    if payload.theme not in pack.enabled_themes:
        raise StandardAnalysisError(RPT_STD_THEME_DISABLED, "theme not enabled for pack", 422)
    bound_id = ensure_analysis_pack_dataset_binding(db, pack)
    section_payload = engine_execute.execute_dataset_section(
        db,
        user,
        pack.data_source_id,
        bound_id,
        payload.parameters,
        limit=payload.limit,
    )
    columns, rows, agg_meta = aggregate_pack_theme(
        payload.theme,
        section_payload["columns"],
        section_payload["rows"],
        pack.field_mapping,
        snapshot_preset=pack.snapshot_cron_preset,
        query_limit=payload.limit,
    )
    chart_type = (
        "bar"
        if payload.theme in {"distribution", "lifecycle"}
        else "line"
        if payload.theme in {"activity", "trend"}
        else None
    )
    section: dict = {
        "kind": "chart" if chart_type else "table",
        "columns": columns,
        "rows": rows,
        "placeholder": False,
    }
    if chart_type:
        section["chartType"] = chart_type
    render_spec = {
        "engineVersion": "1.0",
        "format": "web",
        "sections": [section],
        "parameters": payload.parameters,
        "meta": agg_meta,
    }
    render_spec = label_translation.translate_standard_render_spec(
        db, render_spec, payload.theme, pack.field_mapping,
    )
    return RunOut(
        packKey=pack.pack_key,
        theme=payload.theme,
        renderSpec=render_spec,
        dataSourceId=pack.data_source_id,
        status="ready",
    )


def period_key_for(preset: str, at: datetime | None = None) -> tuple[str, str]:
    now = at or datetime.now(UTC)
    if preset == "daily":
        return "daily", now.strftime("%Y-%m-%d")
    if preset == "weekly":
        iso = now.isocalendar()
        return "weekly", f"{iso.year}-W{iso.week:02d}"
    if preset == "monthly":
        return "monthly", now.strftime("%Y-%m")
    return "daily", now.strftime("%Y-%m-%d")


def previous_period_key(period_kind: str, period_key: str) -> str | None:
    if period_kind == "daily":
        dt = datetime.strptime(period_key, "%Y-%m-%d").replace(tzinfo=UTC)
        return (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    if period_kind == "weekly":
        year_str, week_str = period_key.split("-W")
        year, week = int(year_str), int(week_str)
        dt = datetime.fromisocalendar(year, week, 1).replace(tzinfo=UTC)
        prev = dt - timedelta(weeks=1)
        iso = prev.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if period_kind == "monthly":
        year_str, month_str = period_key.split("-")
        year, month = int(year_str), int(month_str)
        if month == 1:
            return f"{year - 1}-12"
        return f"{year}-{month - 1:02d}"
    return None
