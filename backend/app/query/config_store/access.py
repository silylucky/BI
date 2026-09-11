from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import ConfigError


def assert_config_readable(actor: UserContext, record: QueryConfigRecord) -> None:
    if actor.is_root:
        return
    owner = record.owner_id
    if owner is None:
        return
    try:
        actor_uuid = uuid.UUID(actor.id)
    except ValueError as exc:
        raise ConfigError("CONFIG_ACCESS_FORBIDDEN", "Config access denied", 403) from exc
    if owner != actor_uuid:
        raise ConfigError("CONFIG_ACCESS_FORBIDDEN", "Config access denied", 403)
