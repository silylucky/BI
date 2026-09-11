from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.bus.auto_schemas import AutoRegisterOut, FsmState
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import BusRegisterOut

_auto_states: dict[uuid.UUID, FsmState] = {}
_USER_AUTO_BUS_SCOPE: dict[str, str] = {}


def set_user_auto_bus_scope(user_id: str, path_prefix: str) -> None:
    _USER_AUTO_BUS_SCOPE[user_id] = path_prefix


def get_fsm_state(entry_id: uuid.UUID) -> FsmState:
    return _auto_states.get(entry_id, "idle")


def _set_fsm(entry_id: uuid.UUID, state: FsmState) -> None:
    _auto_states[entry_id] = state


def _assert_auto_role(actor: UserContext) -> None:
    if actor.is_root or "integration" in actor.roles:
        return
    raise catalog_service.CatalogError(
        "GOV_AUTO_BUS_FORBIDDEN",
        "Auto bus registration requires integration or admin role",
        403,
    )


def _assert_entry_path_scope(actor: UserContext, entry_path: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_AUTO_BUS_SCOPE.get(actor.id, "/api/v1/")
    if not entry_path.startswith(prefix):
        raise catalog_service.CatalogError(
            "GOV_AUTO_BUS_FORBIDDEN",
            "enterprise user out of auto bus entry path scope",
            403,
        )


def auto_register(db: Session, actor: UserContext, entry_id: uuid.UUID) -> tuple[AutoRegisterOut, int]:
    from app.governance.bus.pipeline import trigger_auto_bus_register

    return trigger_auto_bus_register(db, actor, entry_id, source="manual")


def _extract_bus_id(out: BusRegisterOut) -> str | None:
    payload = out.bus_response or {}
    return payload.get("busId") or payload.get("bus_id") or str(out.id)
