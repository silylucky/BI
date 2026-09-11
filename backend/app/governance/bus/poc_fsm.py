from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.catalog.models import BusRegistration

SemiAutoFsmState = Literal["pending", "registered", "failed"]

_SEMI_AUTO_FSM: dict[uuid.UUID, SemiAutoFsmState] = {}
_USER_BUS_REGISTER_SCOPE: dict[str, str] = {}


def set_user_bus_register_scope(user_id: str, path_prefix: str) -> None:
    _USER_BUS_REGISTER_SCOPE[user_id] = path_prefix


def transition_semi_auto_fsm(entry_id: uuid.UUID, state: SemiAutoFsmState) -> None:
    _SEMI_AUTO_FSM[entry_id] = state


def get_semi_auto_fsm(db: Session, entry_id: uuid.UUID) -> SemiAutoFsmState:
    succeeded = db.scalar(
        select(BusRegistration).where(
            BusRegistration.catalog_entry_id == entry_id,
            BusRegistration.status == "succeeded",
        )
    )
    if succeeded is not None:
        return "registered"
    return _SEMI_AUTO_FSM.get(entry_id, "pending")


def assert_bus_register_path_scope(actor: UserContext, entry_path: str) -> None:
    roles = set(actor.roles)
    if actor.is_root:
        return
    if "enterprise" in roles:
        prefix = _USER_BUS_REGISTER_SCOPE.get(actor.id, "/api/v1/")
        if not entry_path.startswith(prefix):
            from app.governance.catalog.service import CatalogError

            raise CatalogError(
                "BUS_REGISTER_FORBIDDEN",
                "enterprise user out of bus register path scope",
                403,
            )
        return
    from app.governance.catalog.service import CatalogError

    raise CatalogError("BUS_REGISTER_FORBIDDEN", "Bus registration requires admin role", 403)
