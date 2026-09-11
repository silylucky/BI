from __future__ import annotations

from app.auth.deps import UserContext
from app.viz.components.errors import VizComponentError
from app.viz.components.models import VizComponent

_USER_ORG_SCOPE: dict[str, str] = {}


def set_user_component_org_scope(user_id: str, prefix: str) -> None:
    _USER_ORG_SCOPE[user_id] = prefix


def _actor_uuid(actor: UserContext) -> str | None:
    try:
        return actor.id
    except (ValueError, AttributeError):
        return None


def can_manage_components(actor: UserContext) -> bool:
    if actor.is_root:
        return True
    perms = set(getattr(actor, "permissions", ()) or ())
    return "viz:component.manage" in perms or "dashboard:*" in perms or "*" in perms


def assert_component_manage(actor: UserContext) -> None:
    if not can_manage_components(actor):
        raise VizComponentError(
            "VIZ_COMPONENT_FORBIDDEN",
            "Component management requires viz:component.manage",
            403,
        )


def assert_component_read(actor: UserContext, row: VizComponent) -> None:
    if row.status == "published" and row.visibility == "org":
        if "enterprise" in actor.roles:
            prefix = _USER_ORG_SCOPE.get(actor.id, "org-")
            if row.org_scope and not row.org_scope.startswith(prefix):
                raise VizComponentError("VIZ_COMPONENT_FORBIDDEN", "Out of org scope", 403)
        return
    if row.status == "published" and row.visibility == "private":
        actor_id = _actor_uuid(actor)
        if row.owner_user_id and str(row.owner_user_id) == actor_id:
            return
        if can_manage_components(actor):
            return
        raise VizComponentError("VIZ_COMPONENT_FORBIDDEN", "Private component access denied", 403)
    if row.status in {"draft", "archived"}:
        actor_id = _actor_uuid(actor)
        if row.owner_user_id and str(row.owner_user_id) == actor_id:
            return
        if can_manage_components(actor):
            return
        raise VizComponentError("VIZ_COMPONENT_FORBIDDEN", "Draft/archived component access denied", 403)


def assert_component_write(actor: UserContext, row: VizComponent) -> None:
    actor_id = _actor_uuid(actor)
    if row.owner_user_id and str(row.owner_user_id) == actor_id:
        return
    if can_manage_components(actor):
        return
    raise VizComponentError("VIZ_COMPONENT_FORBIDDEN", "Component write access denied", 403)
