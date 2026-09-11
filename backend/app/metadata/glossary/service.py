from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.metadata._acl import _assert_meta_write
from app.metadata.glossary.models import GlossaryTerm
from app.metadata.glossary.schemas import (
    GlossaryError,
    META_TERM_FORBIDDEN,
    TERM_STATUS_VALUES,
    TermCreate,
    TermUpdate,
)

probe_list_terms_budget_ms_limit = 50


@dataclass(frozen=True)
class TermProbeResult:
    elapsed_ms: float
    ok: bool


def _forbidden() -> GlossaryError:
    return GlossaryError(META_TERM_FORBIDDEN, "insufficient role to modify glossary terms", 403)


def _validate_status(status: str | None) -> str:
    if status is not None and status not in TERM_STATUS_VALUES:
        raise GlossaryError(
            "META_TERM_INVALID_STATUS",
            "Invalid term status",
            422,
            fields=[{"field": "status", "message": f"Must be one of {sorted(TERM_STATUS_VALUES)}"}],
        )
    return status or "active"


def list_terms(
    session: Session,
    code_prefix: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[GlossaryTerm], int]:
    capped = min(max(limit, 1), 500)
    base = select(GlossaryTerm).order_by(GlossaryTerm.code)
    count_stmt = select(func.count()).select_from(GlossaryTerm)
    if code_prefix:
        base = base.where(GlossaryTerm.code.startswith(code_prefix))
        count_stmt = count_stmt.where(GlossaryTerm.code.startswith(code_prefix))
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def create_term(session: Session, payload: TermCreate, user: UserContext) -> GlossaryTerm:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    if not payload.name.strip():
        raise GlossaryError(
            "META_TERM_INVALID_NAME",
            "Term name must not be blank",
            422,
            fields=[{"field": "name", "message": "must not be blank"}],
        )
    status = _validate_status(payload.status)
    term = GlossaryTerm(
        code=payload.code,
        name=payload.name,
        definition=payload.definition,
        description=payload.description,
        status=status,
    )
    session.add(term)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise GlossaryError("META_TERM_CODE_CONFLICT", "Term code already exists", 409) from exc
    session.refresh(term)
    return term


def get_term(session: Session, term_id: uuid.UUID) -> GlossaryTerm:
    term = session.get(GlossaryTerm, term_id)
    if term is None:
        raise GlossaryError("META_TERM_NOT_FOUND", "Term not found", 404)
    return term


def update_term(
    session: Session, term_id: uuid.UUID, payload: TermUpdate, user: UserContext,
) -> GlossaryTerm:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    if not payload.name.strip():
        raise GlossaryError(
            "META_TERM_INVALID_NAME",
            "Term name must not be blank",
            422,
            fields=[{"field": "name", "message": "must not be blank"}],
        )
    term = get_term(session, term_id)
    term.name = payload.name
    term.definition = payload.definition
    term.description = payload.description
    if payload.status is not None:
        term.status = _validate_status(payload.status)
    session.commit()
    session.refresh(term)
    return term


def delete_term(session: Session, term_id: uuid.UUID, user: UserContext) -> None:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    from app.metadata.themes.models import ThemeNode

    term = get_term(session, term_id)
    in_use = session.scalar(
        select(func.count()).select_from(ThemeNode).where(ThemeNode.term_id == term_id)
    )
    if in_use:
        raise GlossaryError("META_TERM_IN_USE", "Term is referenced by theme nodes", 409)
    session.delete(term)
    session.commit()


def probe_list_terms_budget_ms(session: Session) -> TermProbeResult:
    started = time.perf_counter()
    list_terms(session, limit=50, offset=0)
    elapsed = (time.perf_counter() - started) * 1000
    return TermProbeResult(elapsed_ms=elapsed, ok=elapsed <= probe_list_terms_budget_ms_limit)
