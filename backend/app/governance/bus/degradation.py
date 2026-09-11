from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.deps import UserContext
from app.governance.bus.auto import _set_fsm


@dataclass(frozen=True)
class BusRegisterOutcome:
    status: Literal["succeeded", "deferred", "failed"]
    error_code: str | None = None
    bus_id: str | None = None


def record_deferred_registration(
    db: Session,
    actor: UserContext,
    entry_id: uuid.UUID,
    trace_id: str,
    error_code: str,
) -> None:
    _set_fsm(entry_id, "deferred")
    record_platform_event(
        db,
        actor_id=actor.id,
        actor_username=actor.username,
        target_type="gov_catalog_entry",
        target_id=entry_id,
        action="bus_auto_register_deferred",
        detail={"traceId": trace_id, "errorCode": error_code, "source": "publish"},
        trace_id=trace_id,
    )
