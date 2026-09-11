from __future__ import annotations

import re
import time
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.schemas import DashboardCreate
from app.dashboard.preview_summary import sync_surface_kind_column
from app.dashboard.surface_kind import read_surface_kind_from_layout
from app.dashboard.templates.acl import (
    assert_template_manage,
    assert_template_read,
    assert_template_write,
)
from app.dashboard.templates.errors import DashboardTemplateError
from app.dashboard.templates.demo_datasource import (
    bind_template_demo_datasources,
    layout_requires_demo_datasource,
    repair_legacy_template_layout,
    resolve_sample_db_datasource_id,
)
from app.dashboard.templates.layout_utils import regenerate_widget_ids, sanitize_layout_for_template
from app.dashboard.templates.models import DashboardTemplate
from app.dashboard.templates.presets_exported import prepare_exported_layout
from app.dashboard.templates.schemas import (
    DashboardFromTemplateIn,
    DashboardTemplateCreateIn,
    DashboardTemplateListItem,
    DashboardTemplateListResponse,
    DashboardTemplateOut,
    DashboardTemplateUpdateIn,
    VizLayoutEnvelopeIn,
)

SurfaceKind = Literal["dashboard", "data-screen"]
TemplateStatus = Literal["draft", "published", "archived", None]
TemplateVisibility = Literal["builtin", "org", "private", None]


def _parse_user_id(actor: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(actor.id)
    except ValueError:
        return None


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.strip().lower())
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s or "dashboard")[:64]


def _unique_template_key(db: Session, base: str) -> str:
    candidate = base[:120]
    suffix = 0
    while True:
        key = candidate if suffix == 0 else f"{candidate[:110]}-{suffix}"
        exists = db.scalar(select(DashboardTemplate.id).where(DashboardTemplate.template_key == key))
        if exists is None:
            return key
        suffix += 1


def _layout_for_client(db: Session, layout: dict[str, Any]) -> dict[str, Any]:
    """Hub 预览/详情：修复 legacy 字段并绑定 sample_db 演示数据源。"""
    repaired = repair_legacy_template_layout(layout)
    demo_ds = resolve_sample_db_datasource_id(db)
    return bind_template_demo_datasources(repaired, demo_ds)


def _to_out(row: DashboardTemplate, db: Session | None = None) -> DashboardTemplateOut:
    layout = row.layout_json
    if db is not None:
        layout = _layout_for_client(db, layout)
    else:
        layout = repair_legacy_template_layout(layout)
    return DashboardTemplateOut(
        id=row.id,
        template_key=row.template_key,
        name=row.name,
        description=row.description,
        category_key=row.category_key,
        surface_kind=row.surface_kind,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        layout_json=layout,
        thumbnail_ref=row.thumbnail_ref,
        source_dashboard_id=row.source_dashboard_id,
        visibility=row.visibility,  # type: ignore[arg-type]
        owner_user_id=row.owner_user_id,
        org_scope=row.org_scope,
        content_revision=row.content_revision,
        created_at=row.created_at,
        updated_at=row.updated_at,
        published_at=row.published_at,
    )


def _to_list_item(row: DashboardTemplate) -> DashboardTemplateListItem:
    return DashboardTemplateListItem(
        id=row.id,
        template_key=row.template_key,
        name=row.name,
        description=row.description,
        category_key=row.category_key,
        surface_kind=row.surface_kind,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        thumbnail_ref=row.thumbnail_ref,
        visibility=row.visibility,  # type: ignore[arg-type]
        content_revision=row.content_revision,
        updated_at=row.updated_at,
        published_at=row.published_at,
    )


def _visible_to_actor(actor: UserContext, row: DashboardTemplate) -> bool:
    try:
        assert_template_read(actor, row)
        return True
    except DashboardTemplateError:
        return False


def _filter_list_row(
    actor: UserContext,
    row: DashboardTemplate,
    *,
    status: TemplateStatus,
    visibility: TemplateVisibility,
    include_drafts: bool,
) -> bool:
    if not _visible_to_actor(actor, row):
        return False
    if status is not None and row.status != status:
        return False
    if visibility is not None and row.visibility != visibility:
        return False
    # 模板市场默认不展示已下架（含内置模板）
    if status is None and row.status == "archived":
        return False
    if not include_drafts and row.status == "draft":
        return False
    return True


def list_templates(
    db: Session,
    actor: UserContext,
    *,
    surface_kind: SurfaceKind | None = None,
    status: TemplateStatus = None,
    category_key: str | None = None,
    visibility: TemplateVisibility = None,
    q: str | None = None,
    include_drafts: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> DashboardTemplateListResponse:
    rows = db.scalars(
        select(DashboardTemplate).order_by(
            DashboardTemplate.visibility.asc(),
            DashboardTemplate.updated_at.desc(),
        ),
    ).all()
    filtered: list[DashboardTemplate] = []
    for row in rows:
        if surface_kind is not None and row.surface_kind != surface_kind:
            continue
        if category_key is not None and row.category_key != category_key:
            continue
        if q:
            needle = q.strip().lower()
            hay = f"{row.name} {row.description or ''} {row.template_key}".lower()
            if needle not in hay:
                continue
        if _filter_list_row(actor, row, status=status, visibility=visibility, include_drafts=include_drafts):
            filtered.append(row)
    page = filtered[offset : offset + limit]
    return DashboardTemplateListResponse(
        items=[_to_list_item(r) for r in page],
        total=len(filtered),
        limit=limit,
        offset=offset,
    )


def get_template(db: Session, template_id: uuid.UUID, actor: UserContext) -> DashboardTemplateOut:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    assert_template_read(actor, row)
    return _to_out(row, db)


def _resolve_layout_from_create(
    db: Session,
    payload: DashboardTemplateCreateIn,
    actor: UserContext,
) -> dict[str, Any]:
    if payload.layout_json is not None:
        layout = sanitize_layout_for_template(payload.layout_json)
        dash_service.validate_layout(layout)
        return layout
    if payload.source_dashboard_id is not None:
        dash = dash_service.get_dashboard(db, payload.source_dashboard_id)
        dash_service.assert_dashboard_access(
            db,
            actor,
            dash.id,
            dash.created_by,
            slug=dash.slug,
        )
        layout = sanitize_layout_for_template(dash.layout_json.model_dump(by_alias=True, mode="json"))
        dash_service.validate_layout(layout)
        return layout
    raise DashboardTemplateError(
        "DASH_TEMPLATE_INVALID",
        "layoutJson or sourceDashboardId is required",
        422,
    )


def create_template(
    db: Session,
    payload: DashboardTemplateCreateIn,
    actor: UserContext,
) -> DashboardTemplateOut:
    layout = _resolve_layout_from_create(db, payload, actor)
    surface = read_surface_kind_from_layout(layout)
    if surface != payload.surface_kind:
        raise DashboardTemplateError(
            "DASH_TEMPLATE_SURFACE_MISMATCH",
            "surfaceKind does not match layout",
            422,
        )
    if payload.visibility == "builtin":
        assert_template_manage(actor)
    key_base = _slugify(payload.name)
    row = DashboardTemplate(
        template_key=_unique_template_key(db, f"tmpl-{key_base}"),
        name=payload.name,
        description=payload.description,
        category_key=payload.category_key,
        surface_kind=payload.surface_kind,
        status="draft",
        layout_json=layout,
        thumbnail_ref=payload.thumbnail_ref,
        source_dashboard_id=payload.source_dashboard_id,
        visibility=payload.visibility,
        owner_user_id=_parse_user_id(actor),
        org_scope=payload.org_scope,
        content_revision=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def update_template(
    db: Session,
    template_id: uuid.UUID,
    payload: DashboardTemplateUpdateIn,
    actor: UserContext,
) -> DashboardTemplateOut:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    assert_template_write(actor, row)
    if payload.content_revision is not None and payload.content_revision != row.content_revision:
        raise DashboardTemplateError(
            "DASH_TEMPLATE_REVISION_CONFLICT",
            "contentRevision conflict",
            409,
        )
    if payload.name is not None:
        row.name = payload.name
    if payload.description is not None:
        row.description = payload.description
    if payload.category_key is not None:
        row.category_key = payload.category_key
    if payload.layout_json is not None:
        layout = sanitize_layout_for_template(payload.layout_json)
        dash_service.validate_layout(layout)
        row.layout_json = layout
        row.surface_kind = sync_surface_kind_column(layout)
    if payload.visibility is not None:
        row.visibility = payload.visibility
    if payload.org_scope is not None:
        row.org_scope = payload.org_scope
    if payload.thumbnail_ref is not None:
        row.thumbnail_ref = payload.thumbnail_ref
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def publish_template(db: Session, template_id: uuid.UUID, actor: UserContext) -> DashboardTemplateOut:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    assert_template_write(actor, row)
    row.status = "published"
    row.published_at = datetime.now(UTC)
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def archive_template(db: Session, template_id: uuid.UUID, actor: UserContext) -> DashboardTemplateOut:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    assert_template_write(actor, row)
    row.status = "archived"
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def delete_template(db: Session, template_id: uuid.UUID, actor: UserContext) -> None:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    if row.visibility == "builtin":
        raise DashboardTemplateError("DASH_TEMPLATE_BUILTIN_READONLY", "Builtin templates are read-only", 403)
    assert_template_write(actor, row)
    db.delete(row)
    db.commit()


def _parse_envelope(payload: VizLayoutEnvelopeIn) -> tuple[dict[str, Any], SurfaceKind, str]:
    if payload.template_version != 1:
        raise DashboardTemplateError("DASH_TEMPLATE_INVALID_ENVELOPE", "Unsupported templateVersion", 422)
    kind = payload.kind
    if kind not in {"viz-layout", "data-screen"}:
        raise DashboardTemplateError("DASH_TEMPLATE_INVALID_ENVELOPE", "Invalid kind", 422)
    layout = payload.layout
    surface = payload.surface_kind or read_surface_kind_from_layout(layout)
    if surface not in {"dashboard", "data-screen"}:
        if kind == "data-screen":
            surface = "data-screen"
        else:
            raise DashboardTemplateError("DASH_TEMPLATE_INVALID_ENVELOPE", "surfaceKind required", 422)
    dash_service.validate_layout(layout)
    return sanitize_layout_for_template(layout), surface, payload.name


def import_envelope(
    db: Session,
    payload: VizLayoutEnvelopeIn,
    actor: UserContext,
) -> DashboardTemplateOut:
    layout, surface, name = _parse_envelope(payload)
    layout = prepare_exported_layout(layout)
    create_in = DashboardTemplateCreateIn(
        name=name,
        description=payload.description,
        category_key=payload.category_key or "general",
        surface_kind=surface,
        layout_json=layout,
        visibility="private",
    )
    return create_template(db, create_in, actor)


def export_envelope(db: Session, template_id: uuid.UUID, actor: UserContext) -> dict[str, Any]:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    assert_template_read(actor, row)
    return {
        "templateVersion": 1,
        "kind": "viz-layout",
        "surfaceKind": row.surface_kind,
        "name": row.name,
        "description": row.description,
        "categoryKey": row.category_key,
        "layout": prepare_exported_layout(row.layout_json),
    }


def create_dashboard_from_template(
    db: Session,
    payload: DashboardFromTemplateIn,
    actor: UserContext,
) -> dash_service.DashboardOut:
    row = db.scalar(select(DashboardTemplate).where(DashboardTemplate.id == payload.template_id))
    if row is None:
        raise DashboardTemplateError("DASH_TEMPLATE_NOT_FOUND", "Template not found", 404)
    if row.status not in {"published", "draft"} and row.visibility != "builtin":
        if row.status == "archived":
            raise DashboardTemplateError("DASH_TEMPLATE_FORBIDDEN", "Archived template cannot instantiate", 403)
    assert_template_read(actor, row)
    layout = regenerate_widget_ids(
        repair_legacy_template_layout(sanitize_layout_for_template(row.layout_json)),
    )
    demo_ds = resolve_sample_db_datasource_id(db)
    if demo_ds is None and layout_requires_demo_datasource(layout):
        raise DashboardTemplateError(
            "DASH_TEMPLATE_DEMO_DS_MISSING",
            "请先在数据连接中配置 sample_db 演示数据源",
            422,
        )
    layout = bind_template_demo_datasources(layout, demo_ds)
    dash_service.validate_layout(layout)
    name = (payload.name or row.name or "未命名").strip() or "未命名"
    slug = payload.slug or f"{_slugify(name)}-{int(time.time() * 1000)}"
    created = dash_service.create_dashboard(
        db,
        DashboardCreate(name=name, slug=slug[:64]),
        created_by=_parse_user_id(actor),
    )
    try:
        return dash_service.update_layout(db, created.id, layout)
    except Exception:
        dash_service.delete_dashboard(db, created.id)
        raise


def probe_list_templates_budget_ms(db: Session, actor: UserContext) -> float:
    start = time.perf_counter()
    list_templates(db, actor, limit=50, offset=0)
    return (time.perf_counter() - start) * 1000
