from __future__ import annotations

from typing import Literal

from app.auth.deps import UserContext
from app.dashboard.theme.errors import ThemeAnalysisError


def assert_theme_action(actor: UserContext, action: Literal["read", "write"]) -> None:
    if action == "read":
        return
    if actor.is_root:
        return
    roles = set(actor.roles)
    if "owner" in roles or "editor" in roles:
        return
    raise ThemeAnalysisError("DASH_THEME_FORBIDDEN", "theme write requires editor, owner or admin", 403)
