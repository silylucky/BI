from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.viz.components.acl import (
    assert_component_manage,
    assert_component_read,
    assert_component_write,
    can_manage_components,
)
from app.viz.components.chart_palette import chart_palette_category_from_payload
from app.viz.components.errors import VizComponentError
from app.viz.components.models import VizComponent
from app.viz.components.payload_utils import (
    extract_payload_from_widget,
    normalize_surface_kinds,
    validate_payload_for_widget_type,
)
from app.viz.components.reference_counts import (
    count_component_references,
    list_component_references,
)
from app.viz.components.schemas import (
    VizComponentBatchResolveResponse,
    VizComponentCreateIn,
    VizComponentListItem,
    VizComponentListResponse,
    VizComponentOut,
    VizComponentReferenceItem,
    VizComponentReferencesResponse,
    VizComponentUpdateIn,
)

SurfaceKind = Literal["dashboard", "data-screen"]
ComponentStatus = Literal["draft", "published", "archived", None]
ComponentVisibility = Literal["org", "private", None]
WidgetType = Literal["chart", "filter", "text", "media", "customViz", None]


def _parse_user_id(actor: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(actor.id)
    except ValueError:
        return None


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.strip().lower())
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s or "component")[:64]


def _unique_component_key(db: Session, base: str) -> str:
    candidate = base[:120]
    suffix = 0
    while True:
        key = candidate if suffix == 0 else f"{candidate[:110]}-{suffix}"
        exists = db.scalar(select(VizComponent.id).where(VizComponent.component_key == key))
        if exists is None:
            return key
        suffix += 1


def _thumbnail_url(row: VizComponent) -> str | None:
    if not row.thumbnail_ref:
        return None
    from app.dashboard.thumbnails import thumbnail_path_for_ref

    try:
        if not thumbnail_path_for_ref(row.thumbnail_ref).is_file():
            return None
    except ValueError:
        return None
    version = int(row.updated_at.timestamp()) if row.updated_at else 0
    return f"/api/v1/viz-components/{row.id}/thumbnail?v={version}"


def _to_out(row: VizComponent) -> VizComponentOut:
    return VizComponentOut(
        id=row.id,
        component_key=row.component_key,
        name=row.name,
        description=row.description,
        category_key=row.category_key,
        widget_type=row.widget_type,  # type: ignore[arg-type]
        surface_kinds=row.surface_kinds,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        payload_json=row.payload_json,
        thumbnail_ref=row.thumbnail_ref,
        thumbnail_url=_thumbnail_url(row),
        tags=row.tags or [],
        visibility=row.visibility,  # type: ignore[arg-type]
        owner_user_id=row.owner_user_id,
        org_scope=row.org_scope,
        content_revision=row.content_revision,
        created_at=row.created_at,
        updated_at=row.updated_at,
        published_at=row.published_at,
    )


def _to_list_item(row: VizComponent, reference_counts: dict[str, int] | None = None) -> VizComponentListItem:
    return VizComponentListItem(
        id=row.id,
        component_key=row.component_key,
        name=row.name,
        description=row.description,
        category_key=row.category_key,
        widget_type=row.widget_type,  # type: ignore[arg-type]
        surface_kinds=row.surface_kinds,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        thumbnail_ref=row.thumbnail_ref,
        thumbnail_url=_thumbnail_url(row),
        tags=row.tags or [],
        visibility=row.visibility,  # type: ignore[arg-type]
        content_revision=row.content_revision,
        reference_count=reference_counts.get(str(row.id), 0) if reference_counts else 0,
        updated_at=row.updated_at,
        published_at=row.published_at,
    )


def _visible_to_actor(actor: UserContext, row: VizComponent) -> bool:
    try:
        assert_component_read(actor, row)
        return True
    except VizComponentError:
        return False


def _filter_list_row(
    actor: UserContext,
    row: VizComponent,
    *,
    status: ComponentStatus,
    visibility: ComponentVisibility,
    include_drafts: bool,
) -> bool:
    if not _visible_to_actor(actor, row):
        return False
    if status is not None and row.status != status:
        return False
    if visibility is not None and row.visibility != visibility:
        return False
    if not include_drafts and row.status != "published":
        if not can_manage_components(actor):
            return False
    return True


def _resolve_payload(payload: VizComponentCreateIn) -> dict:
    if payload.payload_json is not None:
        validate_payload_for_widget_type(payload.widget_type, payload.payload_json)
        return payload.payload_json
    if payload.source_widget is not None:
        widget_type = payload.source_widget.get("type")
        if widget_type != payload.widget_type:
            raise VizComponentError(
                "VIZ_COMPONENT_TYPE_MISMATCH",
                "widgetType does not match sourceWidget.type",
                422,
            )
        return extract_payload_from_widget(payload.source_widget)
    raise VizComponentError(
        "VIZ_COMPONENT_INVALID",
        "payloadJson or sourceWidget is required",
        422,
    )


def list_components(
    db: Session,
    actor: UserContext,
    *,
    surface_kind: SurfaceKind | None = None,
    widget_type: WidgetType = None,
    chart_palette_category: str | None = None,
    status: ComponentStatus = None,
    category_key: str | None = None,
    visibility: ComponentVisibility = None,
    q: str | None = None,
    include_drafts: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> VizComponentListResponse:
    stmt = select(VizComponent).order_by(VizComponent.updated_at.desc())
    if widget_type is not None:
        stmt = stmt.where(VizComponent.widget_type == widget_type)
    if category_key is not None:
        stmt = stmt.where(VizComponent.category_key == category_key)
    rows = db.scalars(stmt).all()
    filtered: list[VizComponent] = []
    for row in rows:
        if surface_kind is not None and surface_kind not in (row.surface_kinds or []):
            continue
        if widget_type is not None and row.widget_type != widget_type:
            continue
        if chart_palette_category is not None:
            if row.widget_type != "chart":
                continue
            palette = chart_palette_category_from_payload(row.payload_json)
            if palette != chart_palette_category:
                continue
        if category_key is not None and row.category_key != category_key:
            continue
        if q:
            needle = q.strip().lower()
            tags = " ".join(row.tags or [])
            hay = f"{row.name} {row.description or ''} {row.component_key} {tags}".lower()
            if needle not in hay:
                continue
        if _filter_list_row(actor, row, status=status, visibility=visibility, include_drafts=include_drafts):
            filtered.append(row)
    page = filtered[offset : offset + limit]
    reference_counts = count_component_references(db)
    return VizComponentListResponse(
        items=[_to_list_item(r, reference_counts) for r in page],
        total=len(filtered),
        limit=limit,
        offset=offset,
    )


def get_component(db: Session, component_id: uuid.UUID, actor: UserContext) -> VizComponentOut:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_read(actor, row)
    return _to_out(row)


def get_component_references(
    db: Session,
    component_id: uuid.UUID,
    actor: UserContext,
) -> VizComponentReferencesResponse:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_read(actor, row)
    raw = list_component_references(db, str(component_id))
    items: list[VizComponentReferenceItem] = []
    for item in raw:
        surface_kind = item["dashboard_surface_kind"]
        if surface_kind not in ("dashboard", "data-screen"):
            surface_kind = "dashboard"
        items.append(
            VizComponentReferenceItem(
                dashboard_id=uuid.UUID(item["dashboard_id"]),
                dashboard_name=item["dashboard_name"],
                dashboard_surface_kind=surface_kind,  # type: ignore[arg-type]
                widget_id=item["widget_id"],
                widget_title=item["widget_title"],
            ),
        )
    return VizComponentReferencesResponse(items=items, total=len(items))


def batch_resolve(
    db: Session,
    ids: list[uuid.UUID],
    actor: UserContext,
) -> VizComponentBatchResolveResponse:
    items: list[VizComponentOut] = []
    for component_id in ids:
        row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
        if row is None:
            continue
        if not _visible_to_actor(actor, row):
            continue
        items.append(_to_out(row))
    return VizComponentBatchResolveResponse(items=items)


def create_component(
    db: Session,
    payload: VizComponentCreateIn,
    actor: UserContext,
) -> VizComponentOut:
    payload_json = _resolve_payload(payload)
    surface_kinds = normalize_surface_kinds(payload.surface_kinds)
    key_base = _slugify(payload.name)
    row = VizComponent(
        component_key=_unique_component_key(db, f"vc-{key_base}"),
        name=payload.name,
        description=payload.description,
        category_key=payload.category_key,
        widget_type=payload.widget_type,
        surface_kinds=surface_kinds,
        status="draft",
        payload_json=payload_json,
        thumbnail_ref=payload.thumbnail_ref,
        tags=payload.tags[:16],
        visibility=payload.visibility,
        owner_user_id=_parse_user_id(actor),
        org_scope=payload.org_scope,
        content_revision=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def update_component(
    db: Session,
    component_id: uuid.UUID,
    payload: VizComponentUpdateIn,
    actor: UserContext,
) -> VizComponentOut:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_write(actor, row)
    if payload.content_revision is not None and payload.content_revision != row.content_revision:
        raise VizComponentError(
            "VIZ_COMPONENT_REVISION_CONFLICT",
            "contentRevision conflict",
            409,
        )
    if payload.name is not None:
        row.name = payload.name
    if payload.description is not None:
        row.description = payload.description
    if payload.category_key is not None:
        row.category_key = payload.category_key
    if payload.surface_kinds is not None:
        row.surface_kinds = normalize_surface_kinds(payload.surface_kinds)
    if payload.payload_json is not None:
        validate_payload_for_widget_type(row.widget_type, payload.payload_json)
        row.payload_json = payload.payload_json
    if payload.visibility is not None:
        row.visibility = payload.visibility
    if payload.org_scope is not None:
        row.org_scope = payload.org_scope
    if payload.thumbnail_ref is not None:
        row.thumbnail_ref = payload.thumbnail_ref
    if payload.tags is not None:
        row.tags = payload.tags[:16]
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def publish_component(db: Session, component_id: uuid.UUID, actor: UserContext) -> VizComponentOut:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_write(actor, row)
    row.status = "published"
    row.published_at = datetime.now(UTC)
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def archive_component(db: Session, component_id: uuid.UUID, actor: UserContext) -> VizComponentOut:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_write(actor, row)
    row.status = "archived"
    row.content_revision += 1
    db.commit()
    db.refresh(row)
    return _to_out(row)


def delete_component(db: Session, component_id: uuid.UUID, actor: UserContext) -> None:
    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_write(actor, row)
    db.delete(row)
    db.commit()


def save_component_thumbnail(
    db: Session,
    component_id: uuid.UUID,
    content: bytes,
    content_type: str,
    actor: UserContext,
) -> VizComponentListItem:
    from app.dashboard.thumbnails import write_viz_component_thumbnail

    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_write(actor, row)
    try:
        row.thumbnail_ref = write_viz_component_thumbnail(component_id, content, content_type)
    except ValueError as exc:
        raise VizComponentError("VIZ_COMPONENT_INVALID_THUMBNAIL", str(exc), 422) from exc
    row.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    ref_counts = count_component_references(db)
    return _to_list_item(row, ref_counts)


def get_component_thumbnail(
    db: Session,
    component_id: uuid.UUID,
    actor: UserContext,
) -> tuple[bytes, str]:
    from app.dashboard.thumbnails import read_thumbnail_bytes

    row = db.scalar(select(VizComponent).where(VizComponent.id == component_id))
    if row is None:
        raise VizComponentError("VIZ_COMPONENT_NOT_FOUND", "Component not found", 404)
    assert_component_read(actor, row)
    if not row.thumbnail_ref:
        raise VizComponentError("VIZ_COMPONENT_THUMBNAIL_NOT_FOUND", "Thumbnail not found", 404)
    try:
        return read_thumbnail_bytes(row.thumbnail_ref)
    except FileNotFoundError as exc:
        raise VizComponentError("VIZ_COMPONENT_THUMBNAIL_NOT_FOUND", "Thumbnail not found", 404) from exc
