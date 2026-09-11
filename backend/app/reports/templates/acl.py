from __future__ import annotations

from app.auth.deps import UserContext
from app.reports.templates.errors import RPT_TEMPLATE_FORBIDDEN, TemplateDefError

_USER_TEMPLATE_SCOPE: dict[str, str] = {}


def set_user_template_scope(user_id: str, key_prefix: str) -> None:
    _USER_TEMPLATE_SCOPE[user_id] = key_prefix


def assert_template_write_access(actor: UserContext, template_key: str) -> None:
    roles = set(actor.roles)
    if roles <= {"viewer"}:
        raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "viewer cannot upsert templates", 403)
    if "enterprise" in roles:
        prefix = _USER_TEMPLATE_SCOPE.get(actor.id, "tmpl-")
        if not template_key.startswith(prefix):
            raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "enterprise user out of template scope", 403)


def assert_template_read_access(actor: UserContext, template_key: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_TEMPLATE_SCOPE.get(actor.id, "tmpl-")
    if not template_key.startswith(prefix):
        raise TemplateDefError(RPT_TEMPLATE_FORBIDDEN, "enterprise user out of template scope", 403)
