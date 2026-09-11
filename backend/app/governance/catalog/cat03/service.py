from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog.cat03.errors import CAT03_FORBIDDEN, Cat03Error
from app.governance.catalog.cat03.schemas import (
    MAX_GEO_DEPTH,
    GeoRegionCreate,
    GeoRegionListResponse,
    GeoRegionMove,
    GeoRegionOut,
)
from app.governance.persistence import gov_repo

_USER_REGION_SCOPE: dict[str, str] = {}


class _NodesCompat:
    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_repo.clear_geo(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_nodes = _NodesCompat()
_codes = _nodes


def set_user_region_scope(user_id: str, region_code_prefix: str) -> None:
    _USER_REGION_SCOPE[user_id] = region_code_prefix


def get_user_region_scope_prefix(user_id: str) -> str:
    return _USER_REGION_SCOPE.get(user_id, "CN")


def _session():
    return get_meta_session()


def _assert_geo_write_access(user: UserContext, region_code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise Cat03Error(CAT03_FORBIDDEN, "viewer cannot modify geo regions", 403)
    if "enterprise" in roles:
        prefix = _USER_REGION_SCOPE.get(user.id, "CN")
        if not region_code.startswith(prefix):
            raise Cat03Error(CAT03_FORBIDDEN, "enterprise user out of region scope", 403)


def _to_out(record: dict) -> GeoRegionOut:
    return GeoRegionOut.model_validate(record)


def _children(session, parent_id: uuid.UUID | None) -> list[dict]:
    return gov_repo.list_geo_children(session, parent_id)


def _node_depth(session, node_id: uuid.UUID | None) -> int:
    depth = 0
    current = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_GEO_DEPTH:
            break
        record = gov_repo.get_geo(session, current)
        if record is None:
            break
        current = record.get("parentId")
    return depth


def _subtree_height(session, root_id: uuid.UUID) -> int:
    max_h = 0
    level = [root_id]
    while level:
        max_h += 1
        if max_h > MAX_GEO_DEPTH:
            break
        next_level = []
        for nid in level:
            next_level.extend(c["regionId"] for c in _children(session, nid))
        level = next_level
    return max_h


def _collect_descendants(session, node_id: uuid.UUID) -> set[uuid.UUID]:
    out: set[uuid.UUID] = set()
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        for child in _children(session, current):
            cid = child["regionId"]
            if cid not in out:
                out.add(cid)
                frontier.append(cid)
    return out


def _assert_depth(session, parent_id: uuid.UUID | None, subtree_root: uuid.UUID | None = None) -> None:
    parent_depth = _node_depth(session, parent_id)
    extra = _subtree_height(session, subtree_root) if subtree_root else 1
    if parent_depth + extra > MAX_GEO_DEPTH:
        raise Cat03Error(
            "CAT03_MAX_DEPTH",
            f"Geo tree depth cannot exceed {MAX_GEO_DEPTH}",
            422,
            [{"field": "parentId", "message": f"max depth is {MAX_GEO_DEPTH}"}],
        )


def list_geo_nodes(parent_id: uuid.UUID | None, limit: int, offset: int) -> GeoRegionListResponse:
    session = _session()
    try:
        items = _children(session, parent_id)
        page = items[offset : offset + limit]
        return GeoRegionListResponse(items=[_to_out(i) for i in page], total=len(items))
    finally:
        session.close()


def create_geo_node(payload: GeoRegionCreate, user: UserContext) -> GeoRegionOut:
    session = _session()
    try:
        _assert_geo_write_access(user, payload.region_code)
        if gov_repo.geo_code_exists(session, payload.region_code):
            raise Cat03Error("CAT03_CODE_CONFLICT", f"regionCode already exists: {payload.region_code}", 409)
        if payload.parent_id is not None and gov_repo.get_geo(session, payload.parent_id) is None:
            raise Cat03Error("CAT03_PARENT_NOT_FOUND", "parentId not found", 404)
        _assert_depth(session, payload.parent_id)
        region_id = uuid.uuid4()
        record = {
            "regionId": region_id,
            "regionCode": payload.region_code,
            "name": payload.name,
            "parentId": payload.parent_id,
            "level": payload.level,
            "sortOrder": payload.sort_order,
        }
        gov_repo.create_geo(session, record)
        return _to_out(record)
    finally:
        session.close()


def move_geo_node(region_id: uuid.UUID, payload: GeoRegionMove, user: UserContext) -> GeoRegionOut:
    session = _session()
    try:
        record = gov_repo.get_geo(session, region_id)
        if record is None:
            raise Cat03Error("CAT03_NOT_FOUND", "regionId not found", 404)
        _assert_geo_write_access(user, record["regionCode"])
        new_parent = payload.parent_id
        if new_parent == region_id:
            raise Cat03Error("CAT03_CYCLE", "cannot move node under itself", 422)
        if new_parent is not None:
            if gov_repo.get_geo(session, new_parent) is None:
                raise Cat03Error("CAT03_PARENT_NOT_FOUND", "parentId not found", 404)
            if new_parent in _collect_descendants(session, region_id):
                raise Cat03Error("CAT03_CYCLE", "cannot move node under its descendant", 422)
            parent_rec = gov_repo.get_geo(session, new_parent)
            if parent_rec:
                _assert_geo_write_access(user, parent_rec["regionCode"])
        _assert_depth(session, new_parent, subtree_root=region_id)
        patch = {"parentId": new_parent}
        if payload.sort_order is not None:
            patch["sortOrder"] = payload.sort_order
        updated = gov_repo.update_geo(session, region_id, patch)
        return _to_out(updated)
    finally:
        session.close()


def delete_geo_node(region_id: uuid.UUID, user: UserContext) -> None:
    session = _session()
    try:
        record = gov_repo.get_geo(session, region_id)
        if record is None:
            raise Cat03Error("CAT03_NOT_FOUND", "regionId not found", 404)
        _assert_geo_write_access(user, record["regionCode"])
        if _children(session, region_id):
            raise Cat03Error("CAT03_HAS_CHILDREN", "cannot delete node with children", 409)
        gov_repo.delete_geo(session, region_id)
    finally:
        session.close()
