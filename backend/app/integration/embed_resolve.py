from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dashboard.models import Dashboard
from app.dashboard.templates.demo_datasource import prepare_layout_for_embed
from app.integration import embed_token as et
from app.integration.errors import IntegrationError
from app.metadata.dataset.demo_bindings import prepare_chart_config_for_embed
from app.schemas.chart_view import ChartViewError, validate_chart_view_config


def _is_chart_widget(widget: dict) -> bool:
    widget_type = widget.get("type")
    if widget_type == "chart":
        return True
    if widget_type in (None, "") and isinstance(widget.get("chartConfig"), dict):
        return True
    return False


def _find_chart_config(session: Session, chart_id: uuid.UUID) -> dict:
    chart_id_str = str(chart_id)
    for row in session.scalars(select(Dashboard).where(Dashboard.deleted_at.is_(None))):
        layout = row.layout_json if isinstance(row.layout_json, dict) else {}
        for widget in layout.get("widgets") or []:
            if not isinstance(widget, dict) or not _is_chart_widget(widget):
                continue
            chart_config = widget.get("chartConfig") or {}
            widget_id = str(widget.get("id", ""))
            resolved_id = str(chart_config.get("chartId") or widget_id)
            if resolved_id == chart_id_str or widget_id == chart_id_str:
                return dict(chart_config)
    raise IntegrationError("EMBED_CHART_NOT_FOUND", "Chart config not found for embed", 404)


def resolve_embed_chart_view(
    session: Session,
    token: str,
    chart_id: uuid.UUID | None,
) -> dict:
    meta = et.require_token_meta(token)
    token_chart_id = meta.get("chart_id")
    target_id = chart_id or token_chart_id
    if target_id is None:
        raise IntegrationError(
            "EMBED_MISSING_TARGET",
            "chartId is required",
            422,
            fields=[{"field": "chartId", "message": "required"}],
        )
    if not isinstance(target_id, uuid.UUID):
        target_id = uuid.UUID(str(target_id))
    if token_chart_id is not None and uuid.UUID(str(token_chart_id)) != target_id:
        raise IntegrationError(
            "EMBED_CHART_MISMATCH",
            "chartId does not match embed token",
            403,
        )
    raw = _find_chart_config(session, target_id)
    raw = prepare_chart_config_for_embed(session, raw)
    merged = {**raw, "chartId": str(target_id)}
    try:
        cfg = validate_chart_view_config(merged)
    except ChartViewError as exc:
        raise IntegrationError(exc.code, exc.message, exc.status, fields=exc.fields) from exc
    return cfg.model_dump(by_alias=True, mode="json")


def resolve_embed_dashboard_layout(
    session: Session,
    token: str,
    dashboard_id: uuid.UUID,
) -> dict:
    meta = et.require_token_meta(token)
    token_dashboard_id = meta.get("dashboard_id")
    if token_dashboard_id is None:
        raise IntegrationError(
            "EMBED_MISSING_TARGET",
            "dashboardId is required for screen embed",
            422,
            fields=[{"field": "dashboardId", "message": "required"}],
        )
    if uuid.UUID(str(token_dashboard_id)) != dashboard_id:
        raise IntegrationError(
            "EMBED_DASHBOARD_MISMATCH",
            "dashboardId does not match embed token",
            403,
        )
    row = session.get(Dashboard, dashboard_id)
    if row is None or row.deleted_at is not None:
        raise IntegrationError("EMBED_DASHBOARD_NOT_FOUND", "Dashboard not found for embed", 404)
    layout = row.layout_json if isinstance(row.layout_json, dict) else {}
    layout = prepare_layout_for_embed(session, layout)
    return {
        "id": str(row.id),
        "name": row.name,
        "layoutJson": layout,
    }
