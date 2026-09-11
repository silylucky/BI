from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.governance.catalog.classification.errors import (
    CAT_CLASS_FORBIDDEN,
    CAT_CLASS_NOT_FOUND,
    ClassificationError,
)
from app.governance.catalog.classification.schemas import (
    MAX_CLASS_DEPTH,
    ClassificationNodeCreate,
    ClassificationNodeListResponse,
    ClassificationNodeMove,
    ClassificationNodeOut,
)
from app.governance.persistence import gov_repo

_USER_CLASS_SCOPE: dict[str, str] = {}


class _NodesCompat:
    def clear(self) -> None:
        session = get_meta_session()
        try:
            gov_repo.clear_classification(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


_nodes = _NodesCompat()
_codes = _nodes


def set_user_class_scope(user_id: str, code_prefix: str) -> None:
    _USER_CLASS_SCOPE[user_id] = code_prefix


def _session():
    return get_meta_session()


def _assert_classification_write_access(user: UserContext, code: str) -> None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return
    if "viewer" in roles and not roles.intersection({"editor", "analyst", "admin"}):
        raise ClassificationError(CAT_CLASS_FORBIDDEN, "viewer cannot modify classification nodes", 403)
    if "enterprise" in roles:
        prefix = _USER_CLASS_SCOPE.get(user.id, "CAT")
        if not code.startswith(prefix):
            raise ClassificationError(CAT_CLASS_FORBIDDEN, "enterprise user out of classification scope", 403)


def _to_out(record: dict) -> ClassificationNodeOut:
    return ClassificationNodeOut.model_validate(record)


def _children(session, parent_id: uuid.UUID | None) -> list[dict]:
    return gov_repo.list_class_children(session, parent_id)


def _node_depth(session, node_id: uuid.UUID | None) -> int:
    depth = 0
    current = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_CLASS_DEPTH:
            break
        record = gov_repo.get_class(session, current)
        if record is None:
            break
        current = record.get("parentId")
    return depth


def _subtree_height(session, root_id: uuid.UUID) -> int:
    max_h = 0
    level = [root_id]
    while level:
        max_h += 1
        if max_h > MAX_CLASS_DEPTH:
            break
        next_level = []
        for nid in level:
            next_level.extend(c["nodeId"] for c in _children(session, nid))
        level = next_level
    return max_h


def _collect_descendants(session, node_id: uuid.UUID) -> set[uuid.UUID]:
    out: set[uuid.UUID] = set()
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        for child in _children(session, current):
            cid = child["nodeId"]
            if cid not in out:
                out.add(cid)
                frontier.append(cid)
    return out


def _assert_depth(session, parent_id: uuid.UUID | None, subtree_root: uuid.UUID | None = None) -> None:
    parent_depth = _node_depth(session, parent_id)
    extra = _subtree_height(session, subtree_root) if subtree_root else 1
    if parent_depth + extra > MAX_CLASS_DEPTH:
        raise ClassificationError(
            "CAT_CLASS_MAX_DEPTH",
            f"Classification tree depth cannot exceed {MAX_CLASS_DEPTH}",
            422,
            fields=[{"field": "parentId", "message": f"max depth is {MAX_CLASS_DEPTH}"}],
        )


def list_nodes(parent_id: uuid.UUID | None = None, limit: int = 100, offset: int = 0) -> ClassificationNodeListResponse:
    session = _session()
    try:
        items = sorted(_children(session, parent_id), key=lambda n: (n["sortOrder"], n["name"]))
        capped = min(max(limit, 1), 500)
        sliced = items[max(offset, 0) : max(offset, 0) + capped]
        return ClassificationNodeListResponse(items=[_to_out(n) for n in sliced], total=len(items))
    finally:
        session.close()


def create_node(payload: ClassificationNodeCreate, user: UserContext) -> ClassificationNodeOut:
    session = _session()
    try:
        _assert_classification_write_access(user, payload.code)
        if gov_repo.class_code_exists(session, payload.code):
            raise ClassificationError("CAT_CLASS_CODE_CONFLICT", "Classification code already exists", 409)
        if payload.parent_id is not None and gov_repo.get_class(session, payload.parent_id) is None:
            raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Parent node not found", 404)
        _assert_depth(session, payload.parent_id)
        node_id = uuid.uuid4()
        record = {
            "nodeId": node_id,
            "code": payload.code,
            "name": payload.name,
            "parentId": payload.parent_id,
            "kind": payload.kind,
            "sortOrder": payload.sort_order,
        }
        gov_repo.create_class(session, record)
        return _to_out(record)
    finally:
        session.close()


def move_node(node_id: uuid.UUID, payload: ClassificationNodeMove, user: UserContext) -> ClassificationNodeOut:
    session = _session()
    try:
        record = gov_repo.get_class(session, node_id)
        if record is None:
            raise ClassificationError(CAT_CLASS_NOT_FOUND, "Node not found", 404)
        _assert_classification_write_access(user, record["code"])
        parent_id = payload.parent_id
        if parent_id == node_id:
            raise ClassificationError("CAT_CLASS_CYCLE", "Cannot move node under itself", 422)
        if parent_id is not None:
            if parent_id in _collect_descendants(session, node_id):
                raise ClassificationError("CAT_CLASS_CYCLE", "Cannot move node under its descendant", 422)
            if gov_repo.get_class(session, parent_id) is None:
                raise ClassificationError("CAT_CLASS_PARENT_NOT_FOUND", "Parent node not found", 404)
        _assert_depth(session, parent_id, node_id)
        patch: dict = {"parentId": parent_id}
        if payload.sort_order is not None:
            patch["sortOrder"] = payload.sort_order
        updated = gov_repo.update_class(session, node_id, patch)
        return _to_out(updated)
    finally:
        session.close()


def delete_node(node_id: uuid.UUID, user: UserContext) -> None:
    session = _session()
    try:
        record = gov_repo.get_class(session, node_id)
        if record is None:
            raise ClassificationError(CAT_CLASS_NOT_FOUND, "Node not found", 404)
        _assert_classification_write_access(user, record["code"])
        if _children(session, node_id):
            raise ClassificationError("CAT_CLASS_HAS_CHILDREN", "Cannot delete node with children", 409)
        gov_repo.delete_class(session, node_id)
    finally:
        session.close()
