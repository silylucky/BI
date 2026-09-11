from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.reports.persistence import catalog_repo
from app.reports.engine.errors import RPT_ENGINE_FORBIDDEN, ReportEngineError

_USER_ENGINE_SCOPE: dict[str, set[uuid.UUID]] = {}


def set_user_engine_scope(user_id: str, allowed_template_ids: set[uuid.UUID]) -> None:
    _USER_ENGINE_SCOPE[user_id] = set(allowed_template_ids)


def assert_engine_run_access(actor: UserContext, template_id: uuid.UUID) -> None:
    roles = set(actor.roles)
    if actor.is_root:
        return
    if "enterprise" in roles:
        allowed = _USER_ENGINE_SCOPE.get(actor.id, set())
        if template_id not in allowed:
            raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "enterprise user out of engine scope", 403)
        return
    if "viewer" in roles:
        owner = catalog_repo.get_owner(template_id)
        if owner is not None and owner != actor.id:
            raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "viewer cannot run foreign template", 403)
        return
    if roles.intersection({"editor", "analyst", "owner"}):
        return
    raise ReportEngineError(RPT_ENGINE_FORBIDDEN, "insufficient role to run template", 403)
