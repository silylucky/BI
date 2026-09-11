from __future__ import annotations

import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.views.role_template import resolve_defaults_for_roles
from app.views.schemas import ViewError
from app.views.user_override import create_override

probe_resolve_defaults_budget_ms_limit = 50
probe_create_override_budget_ms_limit = 50


@dataclass(frozen=True)
class ViewProbeResult:
    elapsed_ms: float
    ok: bool


def probe_resolve_defaults_budget_ms(role_codes: list[str]) -> ViewProbeResult:
    started = time.perf_counter()
    resolve_defaults_for_roles(role_codes)
    return ViewProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=True)


def probe_create_override_budget_ms(
    db: Session, actor: UserContext, payload: dict
) -> ViewProbeResult:
    started = time.perf_counter()
    try:
        create_override(db, actor, payload)
        ok = True
    except ViewError:
        ok = False
    return ViewProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)


def probe_put_role_defaults_budget_ms(
    db: Session, actor: UserContext, role_id: str, payload: dict,
) -> ViewProbeResult:
    from app.views.role_template import put_defaults

    started = time.perf_counter()
    try:
        put_defaults(db, role_id, payload, actor)
    except ViewError:
        pass
    elapsed = (time.perf_counter() - started) * 1000
    return ViewProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_resolve_defaults_budget_ms_limit)
