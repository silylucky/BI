from __future__ import annotations

import uuid

from sqlalchemy import false
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.auth.bypass import bypasses_resource_acl
from app.auth.deps import UserContext
from app.auth.resources.service import (
    VisibilityError,
    ensure_resource_visible,
    list_visible_resource_ids,
)
from app.datasources.models import DataSource

RESOURCE_TYPE = "datasource"


def list_visible_ids(session: Session, actor: UserContext) -> list[uuid.UUID] | None:
    if bypasses_resource_acl(actor):
        return None
    return list_visible_resource_ids(session, actor.roles, RESOURCE_TYPE, user_id=actor.id)


def list_visible_ids_for_roles(
    session: Session,
    role_codes: list[str],
    *,
    is_root: bool = False,
) -> list[uuid.UUID] | None:
    if is_root:
        return None
    return list_visible_resource_ids(session, role_codes, RESOURCE_TYPE)


def assert_visible(
    session: Session,
    role_codes: list[str],
    data_source_id: uuid.UUID,
    *,
    is_root: bool = False,
    user_id: str | uuid.UUID | None = None,
) -> None:
    if is_root:
        return
    ensure_resource_visible(
        session, role_codes, RESOURCE_TYPE, data_source_id, user_id=user_id
    )


def assert_visible_actor(session: Session, actor: UserContext, data_source_id: uuid.UUID) -> None:
    if bypasses_resource_acl(actor):
        return
    ensure_resource_visible(
        session, actor.roles, RESOURCE_TYPE, data_source_id, user_id=actor.id
    )


def apply_list_filter(stmt: Select, session: Session, actor: UserContext) -> Select:
    visible = list_visible_ids(session, actor)
    if visible is None:
        return stmt
    if not visible:
        return stmt.where(false())
    return stmt.where(DataSource.id.in_(visible))


def apply_list_filter_for_roles(
    stmt: Select,
    session: Session,
    role_codes: list[str],
    *,
    is_root: bool = False,
) -> Select:
    visible = list_visible_ids_for_roles(session, role_codes, is_root=is_root)
    if visible is None:
        return stmt
    if not visible:
        return stmt.where(false())
    return stmt.where(DataSource.id.in_(visible))


__all__ = [
    "RESOURCE_TYPE",
    "VisibilityError",
    "apply_list_filter",
    "apply_list_filter_for_roles",
    "assert_visible",
    "assert_visible_actor",
    "list_visible_ids",
    "list_visible_ids_for_roles",
]
