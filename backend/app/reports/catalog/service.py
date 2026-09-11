from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.models import get_meta_engine
from app.reports.catalog import acl
from app.reports.catalog import grant_acl
from app.reports.catalog.errors import ReportCatalogError
from app.reports.catalog.schemas import CatalogNodeCreate, CatalogNodeMove, CatalogNodeOut, CatalogNodeUpdate
from app.reports.persistence import catalog_repo, memory_stores

MAX_CATALOG_DEPTH = 8
_nodes = memory_stores.catalog_nodes  # test compat alias


@dataclass
class _Node:
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    node_type: str
    template_kind: str | None
    template_key: str | None
    sort_order: int


def _all_nodes() -> dict[uuid.UUID, dict]:
    return catalog_repo.all_nodes()


def _to_out(node: _Node) -> CatalogNodeOut:
    return CatalogNodeOut(
        id=node.id,
        name=node.name,
        parentId=node.parent_id,
        nodeType=node.node_type,
        templateKind=node.template_kind,
        templateKey=node.template_key,
        sortOrder=node.sort_order,
    )


def _get(node_id: uuid.UUID) -> _Node:
    raw = catalog_repo.get_node(node_id)
    if raw is None:
        raise ReportCatalogError("RPT_CATALOG_NODE_NOT_FOUND", "Catalog node not found", 404)
    return _Node(**raw)


def _depth(node_id: uuid.UUID | None) -> int:
    nodes = _all_nodes()
    depth = 0
    current = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_CATALOG_DEPTH:
            break
        raw = nodes.get(current)
        if raw is None:
            break
        current = raw["parent_id"]
    return depth


def _subtree_height(node_id: uuid.UUID) -> int:
    nodes = _all_nodes()
    height = 0
    frontier = [node_id]
    while frontier:
        height += 1
        if height > MAX_CATALOG_DEPTH:
            break
        next_level: list[uuid.UUID] = []
        for nid in frontier:
            next_level.extend(child_id for child_id, raw in nodes.items() if raw["parent_id"] == nid)
        frontier = next_level
    return height


def _collect_descendants(node_id: uuid.UUID) -> set[uuid.UUID]:
    nodes = _all_nodes()
    out: set[uuid.UUID] = set()
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        for child_id, raw in nodes.items():
            if raw["parent_id"] == current and child_id not in out:
                out.add(child_id)
                frontier.append(child_id)
    return out


def _assert_depth(parent_id: uuid.UUID | None, subtree_root: uuid.UUID | None = None) -> None:
    extra = _subtree_height(subtree_root) if subtree_root else 1
    if _depth(parent_id) + extra > MAX_CATALOG_DEPTH:
        raise ReportCatalogError(
            "RPT_CATALOG_MAX_DEPTH",
            f"Catalog tree depth cannot exceed {MAX_CATALOG_DEPTH}",
            422,
        )


def _validate_template_key(
    payload: CatalogNodeCreate, actor: UserContext, *, exclude_id: uuid.UUID | None = None,
) -> None:
    if payload.node_type == "folder":
        if payload.template_key:
            raise ReportCatalogError("RPT_CATALOG_INVALID_TEMPLATE_KEY", "folder cannot have templateKey", 422)
        return
    if not payload.template_key:
        return
    from app.reports.templates import service as template_service
    from app.reports.templates.errors import TemplateDefError

    try:
        tpl = template_service.get_template_definition(payload.template_key, actor)
    except TemplateDefError as exc:
        if exc.status == 404:
            raise ReportCatalogError("RPT_CATALOG_TEMPLATE_NOT_FOUND", "templateKey not found", 422) from exc
        raise
    if payload.template_kind and tpl.format != payload.template_kind:
        raise ReportCatalogError(
            "RPT_CATALOG_TEMPLATE_KIND_MISMATCH",
            "templateKind does not match template format",
            422,
        )
    for nid, raw in _all_nodes().items():
        if exclude_id and nid == exclude_id:
            continue
        if raw.get("template_key") == payload.template_key:
            raise ReportCatalogError(
                "RPT_CATALOG_DUPLICATE_TEMPLATE_KEY",
                "templateKey already linked to another catalog node",
                422,
            )


def count_nodes_by_template_key(template_key: str) -> int:
    return catalog_repo.count_by_template_key(template_key)


def list_nodes(parent_id: uuid.UUID | None, actor: UserContext) -> list[CatalogNodeOut]:
    acl.assert_catalog_action(actor, "read")
    nodes = _all_nodes()
    items = [_Node(**raw) for raw in nodes.values()]
    if parent_id is not None:
        items = [n for n in items if n.parent_id == parent_id]
    else:
        items = [n for n in items if n.parent_id is None]
    with Session(bind=get_meta_engine()) as session:
        readable = grant_acl.list_readable_node_ids(session, actor)
        if readable is not None:
            items = [n for n in items if n.id in readable]
    return [_to_out(n) for n in sorted(items, key=lambda x: (x.sort_order, x.name))]


def create_node(payload: CatalogNodeCreate, actor: UserContext) -> CatalogNodeOut:
    acl.assert_catalog_action(actor, "create")
    nodes = _all_nodes()
    if payload.parent_id is not None and payload.parent_id not in nodes:
        raise ReportCatalogError("RPT_CATALOG_PARENT_NOT_FOUND", "Parent node not found", 404)
    _assert_depth(payload.parent_id)
    _validate_template_key(payload, actor)
    node_id = uuid.uuid4()
    row = {
        "id": node_id,
        "name": payload.name,
        "parent_id": payload.parent_id,
        "node_type": payload.node_type,
        "template_kind": payload.template_kind,
        "template_key": payload.template_key,
        "sort_order": payload.sort_order,
    }
    catalog_repo.save_node(row)
    acl.register_node_owner(node_id, actor.id)
    return _to_out(_get(node_id))


def get_node(node_id: uuid.UUID, actor: UserContext | None = None) -> CatalogNodeOut:
    node = _get(node_id)
    if actor is not None:
        with Session(bind=get_meta_engine()) as session:
            grant_acl.assert_node_readable(session, actor, node_id)
    return _to_out(node)


def update_node(node_id: uuid.UUID, payload: CatalogNodeUpdate, actor: UserContext) -> CatalogNodeOut:
    acl.assert_catalog_action(actor, "update", node_id)
    raw = catalog_repo.get_node(node_id)
    if raw is None:
        raise ReportCatalogError("RPT_CATALOG_NODE_NOT_FOUND", "Catalog node not found", 404)
    if payload.name is not None:
        raw["name"] = payload.name
    if payload.sort_order is not None:
        raw["sort_order"] = payload.sort_order
    catalog_repo.save_node(raw)
    return _to_out(_get(node_id))


def delete_node(node_id: uuid.UUID, actor: UserContext) -> None:
    acl.assert_catalog_action(actor, "delete", node_id)
    _get(node_id)
    nodes = _all_nodes()
    if any(raw["parent_id"] == node_id for raw in nodes.values()):
        raise ReportCatalogError("RPT_CATALOG_HAS_CHILDREN", "Cannot delete node with children", 409)
    catalog_repo.delete_node(node_id)


def move_node(node_id: uuid.UUID, payload: CatalogNodeMove, actor: UserContext) -> CatalogNodeOut:
    acl.assert_catalog_action(actor, "move", node_id)
    raw = catalog_repo.get_node(node_id)
    if raw is None:
        raise ReportCatalogError("RPT_CATALOG_NODE_NOT_FOUND", "Catalog node not found", 404)
    parent_id = payload.parent_id
    if parent_id == node_id:
        raise ReportCatalogError("RPT_CATALOG_CYCLE", "Cannot move node under itself", 422)
    nodes = _all_nodes()
    if parent_id is not None:
        if parent_id in _collect_descendants(node_id):
            raise ReportCatalogError("RPT_CATALOG_CYCLE", "Cannot move node under its descendant", 422)
        if parent_id not in nodes:
            raise ReportCatalogError("RPT_CATALOG_PARENT_NOT_FOUND", "Parent node not found", 404)
    _assert_depth(parent_id, node_id)
    raw["parent_id"] = parent_id
    catalog_repo.save_node(raw)
    return _to_out(_get(node_id))


def node_exists(node_id: uuid.UUID) -> bool:
    return catalog_repo.get_node(node_id) is not None
