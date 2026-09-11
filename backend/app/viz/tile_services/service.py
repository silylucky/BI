from __future__ import annotations

import uuid
from urllib.parse import urljoin

from sqlalchemy.orm import Session

from app.viz.tile_services.models import TileService
from app.viz.tile_services.schemas import (
    TileServiceCreate,
    TileServiceListItem,
    TileServiceListResponse,
    TileServiceOut,
    TileServicePatch,
    TileServiceResolveOut,
)

TILE_SERVICE_ASSETS_PREFIX = "basemaps-assets"


def _offline_or_colocated(stored: str | None, colocated: str) -> str:
    value = (stored or "").strip()
    if not value:
        return colocated
    lowered = value.lower()
    if "jsdelivr.net" in lowered or "protomaps.github.io" in lowered:
        return colocated
    return value


def colocated_glyphs_url(base_url: str) -> str:
    return _join_url(base_url, f"{TILE_SERVICE_ASSETS_PREFIX}/fonts/{{fontstack}}/{{range}}.pbf")


def colocated_sprite_url(base_url: str) -> str:
    return _join_url(base_url, f"{TILE_SERVICE_ASSETS_PREFIX}/sprites/v4/light")


class TileServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _join_url(base: str, path: str) -> str:
    base_clean = base.rstrip("/") + "/"
    path_clean = path.lstrip("/")
    return urljoin(base_clean, path_clean)


def _to_out(row: TileService) -> TileServiceOut:
    return TileServiceOut(
        id=row.id,
        name=row.name,
        baseUrl=row.base_url,
        pmtilesPath=row.pmtiles_path,
        glyphsUrlTemplate=row.glyphs_url_template,
        spriteUrl=row.sprite_url,
        enabled=row.enabled,
        description=row.description,
    )


def list_tile_services(db: Session, *, include_disabled: bool = False) -> TileServiceListResponse:
    query = db.query(TileService)
    if not include_disabled:
        query = query.filter(TileService.enabled.is_(True))
    rows = query.order_by(TileService.name.asc()).all()
    return TileServiceListResponse(
        items=[TileServiceListItem(id=row.id, name=row.name, enabled=row.enabled) for row in rows],
    )


def get_tile_service(db: Session, service_id: str) -> TileServiceOut:
    row = db.get(TileService, service_id)
    if row is None:
        raise TileServiceError("TILE_SERVICE_NOT_FOUND", "瓦片服务不存在", 404)
    return _to_out(row)


def resolve_tile_service(db: Session, service_id: str) -> TileServiceResolveOut:
    row = db.get(TileService, service_id)
    if row is None or not row.enabled:
        raise TileServiceError("TILE_SERVICE_NOT_FOUND", "瓦片服务不存在或未启用", 404)
    pmtiles_url = _join_url(row.base_url, row.pmtiles_path)
    glyphs_url = _offline_or_colocated(row.glyphs_url_template, colocated_glyphs_url(row.base_url))
    sprite_url = _offline_or_colocated(row.sprite_url, colocated_sprite_url(row.base_url))
    return TileServiceResolveOut(
        id=row.id,
        name=row.name,
        pmtilesUrl=pmtiles_url,
        glyphsUrl=glyphs_url,
        spriteUrl=sprite_url,
    )


def create_tile_service(
    db: Session,
    payload: TileServiceCreate,
    *,
    updated_by: uuid.UUID | None,
) -> TileServiceOut:
    if db.get(TileService, payload.id) is not None:
        raise TileServiceError("TILE_SERVICE_EXISTS", "瓦片服务 ID 已存在", 409)
    row = TileService(
        id=payload.id,
        name=payload.name,
        base_url=payload.base_url.rstrip("/"),
        pmtiles_path=payload.pmtiles_path,
        glyphs_url_template=payload.glyphs_url_template,
        sprite_url=payload.sprite_url,
        enabled=payload.enabled,
        description=payload.description,
        updated_by=updated_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def patch_tile_service(
    db: Session,
    service_id: str,
    payload: TileServicePatch,
    *,
    updated_by: uuid.UUID | None,
) -> TileServiceOut:
    row = db.get(TileService, service_id)
    if row is None:
        raise TileServiceError("TILE_SERVICE_NOT_FOUND", "瓦片服务不存在", 404)
    if payload.name is not None:
        row.name = payload.name
    if payload.base_url is not None:
        row.base_url = payload.base_url.rstrip("/")
    if payload.pmtiles_path is not None:
        row.pmtiles_path = payload.pmtiles_path
    if payload.glyphs_url_template is not None:
        row.glyphs_url_template = payload.glyphs_url_template
    if payload.sprite_url is not None:
        row.sprite_url = payload.sprite_url
    if payload.enabled is not None:
        row.enabled = payload.enabled
    if payload.description is not None:
        row.description = payload.description
    row.updated_by = updated_by
    db.commit()
    db.refresh(row)
    return _to_out(row)
