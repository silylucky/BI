"""Per-user dismiss of schedule failure feed entries (execution history retained)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.reports.models import ReportDismissedFailure

_MEMORY: dict[str, set[str]] = {}


def _memory_ids(user_id: str) -> set[str]:
    return _MEMORY.setdefault(user_id, set())


def _read_dismissed_from_db(user: UserContext) -> set[str]:
    with Session(bind=get_meta_engine()) as db:
        rows = db.scalars(
            select(ReportDismissedFailure.execution_id).where(
                ReportDismissedFailure.user_id == user.id,
            ),
        ).all()
        return {str(row) for row in rows}


def list_dismissed_execution_ids(user: UserContext) -> set[str]:
    try:
        persisted = _read_dismissed_from_db(user)
        return persisted | _MEMORY.get(user.id, set())
    except Exception:
        return set(_MEMORY.get(user.id, ()))


def dismiss_execution(user: UserContext, execution_id: uuid.UUID) -> None:
    try:
        with Session(bind=get_meta_engine()) as db:
            existing = db.get(ReportDismissedFailure, (user.id, execution_id))
            if existing is not None:
                return
            db.add(ReportDismissedFailure(user_id=user.id, execution_id=execution_id))
            db.commit()
            _MEMORY.get(user.id, set()).discard(str(execution_id))
            return
    except Exception:
        pass
    _memory_ids(user.id).add(str(execution_id))


def dismiss_executions(user: UserContext, execution_ids: list[uuid.UUID]) -> None:
    for execution_id in execution_ids:
        dismiss_execution(user, execution_id)


def reset_failure_dismiss_for_tests() -> None:
    _MEMORY.clear()
    try:
        with Session(bind=get_meta_engine()) as db:
            db.query(ReportDismissedFailure).delete()
            db.commit()
    except Exception:
        pass
