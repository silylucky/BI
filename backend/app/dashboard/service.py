from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.db.sql_compat import ilike
from app.dashboard.models import Dashboard
from app.dashboard.surface_kind import SurfaceKindFilter
from app.dashboard.preview_summary import extract_preview_summary, sync_surface_kind_column
from app.dashboard.schemas import (
    DashboardCreate,
    DashboardLayout,
    DashboardListItemOut,
    DashboardListResponse,
    DashboardOut,
    DashboardPreviewSummary,
    DashboardUpdate,
)
from app.schemas.chart_view import ChartViewError

DEFAULT_LAYOUT_JSON: dict[str, Any] = {"version": 1, "widgets": [], "globalFilters": []}


class DashboardError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def assert_dashboard_access(
    db: Session,
    actor: UserContext,
    dashboard_id: uuid.UUID,
    created_by: uuid.UUID | None,
    *,
    slug: str | None = None,
) -> None:
    """ACL: admin bypass; owner, official demo slug, or resource grant."""
    from app.dashboard import acl

    if not acl.can_access(
        db,
        actor,
        dashboard_id,
        created_by,
        official_slugs=_official_demo_slugs(),
        slug=slug,
    ):
        raise DashboardError("DASH_FORBIDDEN", "Access denied", 403)


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.strip().lower())
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s or "dashboard")[:64]


def _active(stmt):
    return stmt.where(Dashboard.deleted_at.is_(None))


def _thumbnail_url(row: Dashboard) -> str | None:
    if not row.thumbnail_ref:
        return None
    from app.dashboard.thumbnails import thumbnail_path_for_ref

    try:
        if not thumbnail_path_for_ref(row.thumbnail_ref).is_file():
            return None
    except ValueError:
        return None
    version = int(row.updated_at.timestamp()) if row.updated_at else 0
    return f"/api/v1/dashboards/{row.id}/thumbnail?v={version}"


def _to_list_item(row: Dashboard) -> DashboardListItemOut:
    layout = row.layout_json if isinstance(row.layout_json, dict) else {}
    summary = extract_preview_summary(layout)
    widgets = layout.get("widgets") or []
    kind = getattr(row, "surface_kind", None) or sync_surface_kind_column(layout)
    return DashboardListItemOut(
        id=row.id,
        name=row.name,
        slug=row.slug,
        description=row.description,
        surface_kind=kind if kind == "data-screen" else "dashboard",
        widget_count=len(widgets) if isinstance(widgets, list) else 0,
        layout_json=DashboardLayout.model_validate(layout),
        preview_summary=DashboardPreviewSummary.model_validate(summary),
        thumbnail_url=_thumbnail_url(row),
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_out(row: Dashboard) -> DashboardOut:
    from pydantic import ValidationError

    try:
        layout = DashboardLayout.model_validate(row.layout_json)
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        hint = str(first.get("msg", "Invalid layout JSON"))
        message = f"{hint} ({loc})" if loc else hint
        raise DashboardError("DASH_INVALID_LAYOUT", message, 422) from exc
    return DashboardOut(
        id=row.id,
        name=row.name,
        slug=row.slug,
        description=row.description,
        layout_json=layout,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _validate_layout_business(parsed: DashboardLayout) -> None:
    seen: set[str] = set()
    for widget in parsed.widgets:
        wid = str(widget.id)
        if wid in seen:
            raise DashboardError("DASH_DUPLICATE_WIDGET", "组件 ID 重复", 422)
        seen.add(wid)
        # ADR-14：已链接组件库引用时 layout 只存 componentRef，配置在 viz-components
        if widget._is_linked_component():
            continue
        if widget.type == "chart":
            if widget.chart_config is None:
                raise DashboardError("DASH_MISSING_CHART_CONFIG", "图表组件缺少 chartConfig", 422)
            cfg = widget.chart_config
            if cfg.chart_id is not None and str(cfg.chart_id) != wid:
                raise DashboardError("DASH_CHART_ID_MISMATCH", "chartId 与组件 ID 不一致", 422)
        elif widget.type == "filter":
            if widget.filter_config is None:
                raise DashboardError("DASH_MISSING_FILTER_CONFIG", "筛选器组件缺少 filterConfig", 422)
        elif widget.type == "text":
            if widget.text_config is None:
                raise DashboardError("DASH_MISSING_TEXT_CONFIG", "富文本组件缺少 textConfig", 422)
        elif widget.type == "media":
            if widget.media_config is None:
                raise DashboardError("DASH_MISSING_MEDIA_CONFIG", "媒体组件缺少 mediaConfig", 422)
        elif widget.type == "tabs":
            if widget.tabs_config is None:
                raise DashboardError("DASH_MISSING_TABS_CONFIG", "Tab 组件缺少 tabsConfig", 422)


def _normalize_widget_orders(widgets: list) -> list:
    ordered = sorted(widgets, key=lambda w: w.order)
    for i, w in enumerate(ordered):
        w.order = i
    return ordered


def validate_layout(layout: dict[str, Any]) -> dict[str, Any]:
    from pydantic import ValidationError

    from app.views.validate import validate_layout_dict

    try:
        parsed = DashboardLayout.model_validate(layout)
        _validate_layout_business(parsed)
    except ValidationError as exc:
        from app.schemas.chart_view import _map_validation_error

        chart_exc = _map_validation_error(exc)
        raise DashboardError("DASH_INVALID_LAYOUT", chart_exc.message, 422) from exc
    return validate_layout_dict(layout)


def _official_demo_slugs() -> set[str]:
    from app.dashboard.demo_instances.seed import DEMO_INSTANCE_SLUGS, LEGACY_DEMO_INSTANCE_SLUGS

    return set(DEMO_INSTANCE_SLUGS) | set(LEGACY_DEMO_INSTANCE_SLUGS.keys())


def _apply_dashboard_list_search(base, q: str | None):
    needle = (q or "").strip()
    if not needle:
        return base
    pattern = f"%{needle}%"
    return base.where(
        or_(
            ilike(Dashboard.name, pattern),
            ilike(Dashboard.slug, pattern),
            ilike(Dashboard.description, pattern),
        ),
    )


def list_dashboards(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    actor: UserContext | None = None,
    surface_kind: SurfaceKindFilter | None = None,
    q: str | None = None,
) -> DashboardListResponse:
    base = select(Dashboard).where(Dashboard.deleted_at.is_(None))
    if actor is not None and not actor.is_root:
        from app.dashboard import acl

        try:
            actor_uuid = uuid.UUID(actor.id)
        except ValueError:
            return DashboardListResponse(items=[], total=0, limit=limit, offset=offset)
        official_slugs = _official_demo_slugs()
        clauses = [
            Dashboard.created_by == actor_uuid,
            Dashboard.slug.in_(official_slugs),
        ]
        granted_ids = acl.list_granted_ids(db, actor)
        if granted_ids:
            clauses.append(Dashboard.id.in_(granted_ids))
        base = base.where(or_(*clauses))
    if surface_kind == "data-screen":
        base = base.where(Dashboard.surface_kind == "data-screen")
    elif surface_kind == "dashboard":
        base = base.where(Dashboard.surface_kind != "data-screen")
    base = _apply_dashboard_list_search(base, q)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        base.order_by(Dashboard.updated_at.desc()).limit(limit).offset(offset),
    ).all()
    return DashboardListResponse(
        items=[_to_list_item(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _release_soft_deleted_slug(db: Session, slug: str) -> None:
    deleted = db.scalar(
        select(Dashboard).where(
            Dashboard.slug == slug,
            Dashboard.deleted_at.is_not(None),
        ),
    )
    if deleted is not None:
        deleted.slug = f"{slug}--deleted-{deleted.id.hex[:8]}"
        db.flush()


def create_dashboard(
    db: Session,
    payload: DashboardCreate | None = None,
    *,
    name: str | None = None,
    slug: str | None = None,
    description: str | None = None,
    created_by: uuid.UUID | None = None,
) -> DashboardOut:
    if payload is not None:
        name = payload.name
        slug = payload.slug or _slugify(payload.name)
        description = payload.description
    if name is None:
        raise DashboardError("DASH_INVALID", "name is required", 422)
    resolved_slug = slug or _slugify(name)
    _release_soft_deleted_slug(db, resolved_slug)
    row = Dashboard(
        name=name,
        slug=resolved_slug,
        description=description,
        layout_json=dict(DEFAULT_LAYOUT_JSON),
        created_by=created_by,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DashboardError("DASH_SLUG_CONFLICT", f"Slug already exists: {resolved_slug}", 409) from exc
    db.refresh(row)
    return _to_out(row)


def get_dashboard(db: Session, dashboard_id: uuid.UUID) -> DashboardOut:
    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    return _to_out(row)


def update_dashboard(db: Session, dashboard_id: uuid.UUID, payload: DashboardUpdate) -> DashboardOut:
    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    if payload.name is not None:
        row.name = payload.name
    if payload.description is not None:
        row.description = payload.description
    db.commit()
    db.refresh(row)
    return _to_out(row)


def delete_dashboard(db: Session, dashboard_id: uuid.UUID) -> None:
    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    from app.auth.cleanup import purge_grants_for_resource

    purge_grants_for_resource(
        db,
        resource_type="dashboard",
        resource_id=dashboard_id,
    )
    row.deleted_at = datetime.now(UTC)
    db.commit()


def update_layout(
    db: Session,
    dashboard_id: uuid.UUID,
    layout_json: dict[str, Any] | DashboardLayout,
    *,
    auto_commit: bool = True,
) -> DashboardOut:
    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    from app.views.validate import validate_layout_dict
    from pydantic import ValidationError

    payload = (
        layout_json.model_dump(by_alias=True, mode="json")
        if isinstance(layout_json, DashboardLayout)
        else layout_json
    )

    try:
        validated = validate_layout_dict(payload)
    except ValidationError as exc:
        fields = [
            {"field": ".".join(str(p) for p in err.get("loc", ())), "message": str(err.get("msg", ""))}
            for err in exc.errors()
        ]
        bounds_fields = (
            "colSpan", "rowSpan", "gridX", "gridY", "col_span", "row_span",
            "grid_x", "grid_y", "x", "y", "width", "height", "canvas",
        )
        cross_bound_messages = (
            "gridX + colSpan",
            "x + width",
            "y + height",
            "canvas width",
            "canvas height",
        )
        if any(
            any(f["field"] == token or f["field"].endswith(f".{token}") for token in bounds_fields)
            or any(token in f["message"] for token in cross_bound_messages)
            for f in fields
        ):
            raise DashboardError("VIEW_LAYOUT_BOUNDS", "Layout bounds violation", 422) from exc
        from app.schemas.chart_view import _map_validation_error

        chart_exc = _map_validation_error(exc)
        raise DashboardError("DASH_INVALID_LAYOUT", chart_exc.message, 422) from exc
    except DashboardError:
        raise
    except ChartViewError as exc:
        raise DashboardError("DASH_INVALID_LAYOUT", exc.message, 422) from exc
    except Exception as exc:
        raise DashboardError("DASH_INVALID_LAYOUT", "Invalid layout JSON", 422) from exc
    row.layout_json = validated
    row.surface_kind = sync_surface_kind_column(validated)
    if auto_commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return _to_out(row)


def save_editor_state(
    db: Session,
    dashboard_id: uuid.UUID,
    *,
    name: str | None,
    layout_json: dict[str, Any] | DashboardLayout,
    global_filters,
    actor: UserContext,
):
    from app.dashboard.editor_save_schemas import DashboardEditorSaveOut
    from app.dashboard.global_filters import service as global_filter_service

    existing = get_dashboard(db, dashboard_id)
    assert_dashboard_access(db, actor, dashboard_id, existing.created_by, slug=existing.slug)
    try:
        dash_out = update_layout(db, dashboard_id, layout_json, auto_commit=False)
        if name is not None:
            trimmed = name.strip()
            if trimmed and trimmed != existing.name:
                row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
                if row is not None:
                    row.name = trimmed
                    dash_out = _to_out(row)
        linkage_out = None
        if global_filters is not None:
            if global_filters.dashboard_id != dashboard_id:
                raise DashboardError(
                    "DASH_FILTER_ID_MISMATCH",
                    "dashboardId mismatch",
                    422,
                )
            linkage_out = global_filter_service.save_linkage(
                db,
                global_filters,
                actor,
                auto_commit=False,
            )
        db.commit()
        dash_out = get_dashboard(db, dashboard_id)
        if global_filters is not None:
            linkage_out = global_filter_service.get_linkage(db, dashboard_id, actor)
        return DashboardEditorSaveOut(dashboard=dash_out, global_filters=linkage_out)
    except Exception:
        db.rollback()
        raise


def save_dashboard_thumbnail(
    db: Session,
    dashboard_id: uuid.UUID,
    content: bytes,
    content_type: str,
) -> DashboardListItemOut:
    from app.dashboard.thumbnails import write_thumbnail

    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    try:
        row.thumbnail_ref = write_thumbnail(dashboard_id, content, content_type)
    except ValueError as exc:
        raise DashboardError("DASH_INVALID_THUMBNAIL", str(exc), 422) from exc
    row.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return _to_list_item(row)


def get_dashboard_thumbnail(
    db: Session,
    dashboard_id: uuid.UUID,
    actor: UserContext,
) -> tuple[bytes, str]:
    from app.dashboard.thumbnails import read_thumbnail_bytes

    row = db.scalar(_active(select(Dashboard).where(Dashboard.id == dashboard_id)))
    if row is None:
        raise DashboardError("DASH_NOT_FOUND", "Dashboard not found", 404)
    assert_dashboard_access(db, actor, dashboard_id, row.created_by, slug=row.slug)
    if not row.thumbnail_ref:
        raise DashboardError("DASH_THUMBNAIL_NOT_FOUND", "Thumbnail not found", 404)
    try:
        return read_thumbnail_bytes(row.thumbnail_ref)
    except FileNotFoundError as exc:
        raise DashboardError("DASH_THUMBNAIL_NOT_FOUND", "Thumbnail not found", 404) from exc
