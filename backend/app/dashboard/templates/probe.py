from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.templates import service as template_service

PROBE_LIST_BUDGET_MS = 50.0


def probe_list_templates_budget_ms(db: Session, actor: UserContext) -> float:
    return template_service.probe_list_templates_budget_ms(db, actor)
