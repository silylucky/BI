from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import (
    AuthDimensionGroup,
    AuthDimensionGroupValue,
    AuthDimensionType,
    AuthDimensionTypeRef,
    AuthOrgNode,
    AuthRoleDimensionGroup,
)
from app.auth.schemas import DimensionGroupCreate, DimensionGroupUpdate


class GroupError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def ensure_dimension_type_ref(session: Session, dimension_type_id: uuid.UUID) -> None:
    existing = session.get(AuthDimensionTypeRef, dimension_type_id)
    if existing is None:
        session.add(AuthDimensionTypeRef(dimension_type_id=dimension_type_id, ref_source="group"))
        session.flush()


def maybe_remove_dimension_type_ref(session: Session, dimension_type_id: uuid.UUID) -> None:
    count = session.scalar(
        select(func.count())
        .select_from(AuthDimensionGroup)
        .where(AuthDimensionGroup.dimension_type_id == dimension_type_id)
    )
    if not count:
        ref = session.get(AuthDimensionTypeRef, dimension_type_id)
        if ref is not None:
            session.delete(ref)


def _would_create_cycle(session: Session, group_id: uuid.UUID, new_parent_id: uuid.UUID) -> bool:
    if new_parent_id == group_id:
        return True
    parent = session.get(AuthDimensionGroup, new_parent_id)
    if parent is None:
        return False
    current_id: uuid.UUID | None = new_parent_id
    seen: set[uuid.UUID] = set()
    while current_id is not None:
        if current_id == group_id:
            return True
        if current_id in seen:
            return False
        seen.add(current_id)
        node = session.get(AuthDimensionGroup, current_id)
        if node is None:
            break
        current_id = node.parent_id
    return False


def validate_dimension_value(session: Session, dim: AuthDimensionType, value: str) -> None:
    if not value or len(value) > 256:
        raise GroupError("DIMENSION_VALUE_INVALID", "Invalid dimension value", 422)
    if dim.value_type == "org_ref":
        try:
            org_id = uuid.UUID(value)
        except ValueError as exc:
            raise GroupError("DIMENSION_VALUE_INVALID", "org_ref value must be UUID", 422) from exc
        if session.get(AuthOrgNode, org_id) is None:
            raise GroupError("DIMENSION_VALUE_INVALID", "org node not found", 422)
    elif dim.value_type == "number":
        try:
            float(value)
        except ValueError as exc:
            raise GroupError("DIMENSION_VALUE_INVALID", "number value invalid", 422) from exc
    elif dim.value_type == "boolean" and value not in ("true", "false"):
        raise GroupError("DIMENSION_VALUE_INVALID", "boolean value must be true/false", 422)


def list_groups(
    session: Session,
    *,
    dimension_type_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuthDimensionGroup], int]:
    base = select(AuthDimensionGroup)
    count_stmt = select(func.count()).select_from(AuthDimensionGroup)
    if dimension_type_id is not None:
        base = base.where(AuthDimensionGroup.dimension_type_id == dimension_type_id)
        count_stmt = count_stmt.where(AuthDimensionGroup.dimension_type_id == dimension_type_id)
    total = session.scalar(count_stmt) or 0
    items = list(
        session.scalars(
            base.order_by(AuthDimensionGroup.code).limit(min(limit, 500)).offset(offset)
        )
    )
    return items, total


def get_group(session: Session, group_id: uuid.UUID) -> AuthDimensionGroup:
    group = session.get(AuthDimensionGroup, group_id)
    if group is None:
        raise GroupError("GROUP_NOT_FOUND", "Group not found", 404)
    return group


def create_group(
    session: Session,
    payload: DimensionGroupCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthDimensionGroup:
    dim = session.get(AuthDimensionType, payload.dimension_type_id)
    if dim is None:
        raise GroupError("DIMENSION_NOT_FOUND", "Dimension type not found", 404)
    if payload.parent_id is not None:
        parent = session.get(AuthDimensionGroup, payload.parent_id)
        if parent is None:
            raise GroupError("GROUP_PARENT_NOT_FOUND", "Parent group not found", 404)
        if parent.dimension_type_id != payload.dimension_type_id:
            raise GroupError("GROUP_PARENT_MISMATCH", "Parent dimension type mismatch", 422)
    group = AuthDimensionGroup(
        dimension_type_id=payload.dimension_type_id,
        code=payload.code,
        name=payload.name,
        parent_id=payload.parent_id,
    )
    session.add(group)
    try:
        session.flush()
        ensure_dimension_type_ref(session, payload.dimension_type_id)
        record_platform_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_type="group",
            target_id=group.id,
            action="group.create",
            detail={"code": group.code},
            trace_id=trace_id,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise GroupError("GROUP_CODE_CONFLICT", "Group code already exists for type", 409) from exc
    session.refresh(group)
    return group


def update_group(
    session: Session,
    group_id: uuid.UUID,
    payload: DimensionGroupUpdate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthDimensionGroup:
    group = get_group(session, group_id)
    if payload.parent_id is not None:
        if payload.parent_id == group_id:
            raise GroupError("GROUP_CYCLE", "Cannot set parent to self", 409)
        parent = session.get(AuthDimensionGroup, payload.parent_id)
        if parent is None:
            raise GroupError("GROUP_PARENT_NOT_FOUND", "Parent group not found", 404)
        if parent.dimension_type_id != group.dimension_type_id:
            raise GroupError("GROUP_PARENT_MISMATCH", "Parent dimension type mismatch", 422)
        if _would_create_cycle(session, group_id, payload.parent_id):
            raise GroupError("GROUP_CYCLE", "Update would create cycle", 409)
        group.parent_id = payload.parent_id
    if payload.name is not None:
        group.name = payload.name
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="group",
        target_id=group.id,
        action="group.update",
        detail={"code": group.code},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(group)
    return group


def delete_group(
    session: Session,
    group_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    group = get_group(session, group_id)
    child_count = session.scalar(
        select(func.count())
        .select_from(AuthDimensionGroup)
        .where(AuthDimensionGroup.parent_id == group_id)
    )
    if child_count and child_count > 0:
        raise GroupError("GROUP_IN_USE", "Group has child groups", 409)
    role_ref = session.scalar(
        select(AuthRoleDimensionGroup)
        .where(AuthRoleDimensionGroup.group_id == group_id)
        .limit(1)
    )
    if role_ref is not None:
        raise GroupError("GROUP_IN_USE", "Group is bound to a role", 409)
    dim_type_id = group.dimension_type_id
    group_uuid = group.id
    group_code = group.code
    session.delete(group)
    session.flush()
    maybe_remove_dimension_type_ref(session, dim_type_id)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="group",
        target_id=group_uuid,
        action="group.delete",
        detail={"code": group_code},
        trace_id=trace_id,
    )
    session.commit()


def list_group_values(session: Session, group_id: uuid.UUID) -> list[str]:
    get_group(session, group_id)
    return list(
        session.scalars(
            select(AuthDimensionGroupValue.value)
            .where(AuthDimensionGroupValue.group_id == group_id)
            .order_by(AuthDimensionGroupValue.value)
        )
    )


def add_group_values(
    session: Session,
    group_id: uuid.UUID,
    values: list[str],
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> list[str]:
    group = get_group(session, group_id)
    dim = session.get(AuthDimensionType, group.dimension_type_id)
    assert dim is not None
    for value in values:
        validate_dimension_value(session, dim, value)
        existing = session.scalar(
            select(AuthDimensionGroupValue).where(
                AuthDimensionGroupValue.group_id == group_id,
                AuthDimensionGroupValue.value == value,
            )
        )
        if existing is None:
            session.add(AuthDimensionGroupValue(group_id=group_id, value=value))
    try:
        session.flush()
        record_platform_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_type="group",
            target_id=group_id,
            action="group.values.add",
            detail={"values": values},
            trace_id=trace_id,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise GroupError("GROUP_VALUE_CONFLICT", "Duplicate group value", 409) from exc
    return list_group_values(session, group_id)


def replace_group_values(
    session: Session,
    group_id: uuid.UUID,
    values: list[str],
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> list[str]:
    group = get_group(session, group_id)
    dim = session.get(AuthDimensionType, group.dimension_type_id)
    assert dim is not None
    for value in values:
        validate_dimension_value(session, dim, value)
    session.query(AuthDimensionGroupValue).filter_by(group_id=group_id).delete()
    for value in values:
        session.add(AuthDimensionGroupValue(group_id=group_id, value=value))
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="group",
        target_id=group_id,
        action="group.values.replace",
        detail={"values": values},
        trace_id=trace_id,
    )
    session.commit()
    return list_group_values(session, group_id)


def remove_group_value(
    session: Session,
    group_id: uuid.UUID,
    value: str,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    get_group(session, group_id)
    row = session.scalar(
        select(AuthDimensionGroupValue).where(
            AuthDimensionGroupValue.group_id == group_id,
            AuthDimensionGroupValue.value == value,
        )
    )
    if row is None:
        raise GroupError("GROUP_VALUE_NOT_FOUND", "Group value not found", 404)
    session.delete(row)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="group",
        target_id=group_id,
        action="group.values.remove",
        detail={"value": value},
        trace_id=trace_id,
    )
    session.commit()
