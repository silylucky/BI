from __future__ import annotations

from typing import Literal

from app.auth.deps import UserContext
from app.reports.errors import ReportExtensionError


def assert_extension_action(actor: UserContext, action: Literal["read", "write", "delete"]) -> None:
    roles = set(actor.roles)
    if action == "read":
        return
    if actor.is_root:
        return
    if action == "delete":
        if "owner" in roles:
            return
        raise ReportExtensionError("RPT_EXT_FORBIDDEN", "delete requires owner or admin", 403)
    if "editor" in roles or "owner" in roles:
        return
    raise ReportExtensionError("RPT_EXT_FORBIDDEN", "extension write requires editor, owner or admin", 403)
