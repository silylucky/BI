from __future__ import annotations

from app.auth.deps import UserContext
from app.dashboard.templates.errors import DashboardTemplateError
from app.dashboard.templates.models import DashboardTemplate

_USER_ORG_SCOPE: dict[str, str] = {}


def set_user_template_org_scope(user_id: str, prefix: str) -> None:
    _USER_ORG_SCOPE[user_id] = prefix


def _actor_uuid(actor: UserContext) -> str | None:
    try:
        return actor.id
    except (ValueError, AttributeError):
        return None


def can_manage_templates(actor: UserContext) -> bool:
    if actor.is_root:
        return True
    perms = set(getattr(actor, "permissions", ()) or ())
    return "dashboard:template.manage" in perms or "dashboard:*" in perms or "*" in perms


def assert_template_manage(actor: UserContext) -> None:
    if not can_manage_templates(actor):
        raise DashboardTemplateError(
            "DASH_TEMPLATE_FORBIDDEN", "Template management requires dashboard:template.manage", 403,
        )


def assert_template_read(actor: UserContext, row: DashboardTemplate) -> None:
    if row.visibility == "builtin":
        return
    if row.status == "published" and row.visibility == "org":
        if "enterprise" in actor.roles:
            prefix = _USER_ORG_SCOPE.get(actor.id, "org-")
            if row.org_scope and not row.org_scope.startswith(prefix):
                raise DashboardTemplateError("DASH_TEMPLATE_FORBIDDEN", "Out of org scope", 403)
        return
    if row.status == "published" and row.visibility == "private":
        actor_id = _actor_uuid(actor)
        if row.owner_user_id and str(row.owner_user_id) == actor_id:
            return
        if can_manage_templates(actor):
            return
        raise DashboardTemplateError("DASH_TEMPLATE_FORBIDDEN", "Private template access denied", 403)
    if row.status in {"draft", "archived"}:
        actor_id = _actor_uuid(actor)
        if row.owner_user_id and str(row.owner_user_id) == actor_id:
            return
        if can_manage_templates(actor):
            return
        raise DashboardTemplateError("DASH_TEMPLATE_FORBIDDEN", "Draft/archived template access denied", 403)


def assert_template_write(actor: UserContext, row: DashboardTemplate) -> None:
    if row.visibility == "builtin":
        if can_manage_templates(actor):
            return
        raise DashboardTemplateError("DASH_TEMPLATE_BUILTIN_READONLY", "Builtin templates are read-only", 403)
    actor_id = _actor_uuid(actor)
    if row.owner_user_id and str(row.owner_user_id) == actor_id:
        return
    if can_manage_templates(actor):
        return
    raise DashboardTemplateError("DASH_TEMPLATE_FORBIDDEN", "Template write access denied", 403)
