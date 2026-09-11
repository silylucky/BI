from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import (
    AuthDimensionGroup,
    AuthDimensionGroupValue,
    AuthDimensionType,
    AuthRole,
    AuthRoleDimensionGroup,
    AuthRoleDimensionValue,
)
from app.auth.roles.service import RoleError, assert_role_active, get_role
from app.auth.rls.groups.service import validate_dimension_value
from app.auth.schemas import RoleDimensionGroupsOut, RoleDimensionValuesOut


class BindingError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def resolve_effective_values(
    session: Session,
    role_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
) -> list[str]:
    direct = session.scalars(
        select(AuthRoleDimensionValue.value).where(
            AuthRoleDimensionValue.role_id == role_id,
            AuthRoleDimensionValue.dimension_type_id == dimension_type_id,
        )
    )
    group_ids = list(
        session.scalars(
            select(AuthRoleDimensionGroup.group_id)
            .join(AuthDimensionGroup, AuthDimensionGroup.id == AuthRoleDimensionGroup.group_id)
            .where(
                AuthRoleDimensionGroup.role_id == role_id,
                AuthDimensionGroup.dimension_type_id == dimension_type_id,
            )
        )
    )
    from_groups: list[str] = []
    if group_ids:
        from_groups = list(
            session.scalars(
                select(AuthDimensionGroupValue.value).where(
                    AuthDimensionGroupValue.group_id.in_(group_ids)
                )
            )
        )
    merged = set(direct) | set(from_groups)
    return sorted(merged)


def _sorted_group_ids(group_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    seen: set[uuid.UUID] = set()
    unique: list[uuid.UUID] = []
    for group_id in group_ids:
        if group_id not in seen:
            seen.add(group_id)
            unique.append(group_id)
    return sorted(unique, key=lambda gid: str(gid))


def _read_group_ids(session: Session, role_id: uuid.UUID) -> list[uuid.UUID]:
    ids = list(
        session.scalars(
            select(AuthRoleDimensionGroup.group_id).where(AuthRoleDimensionGroup.role_id == role_id)
        )
    )
    return sorted(ids, key=lambda gid: str(gid))


def _read_dimension_values(
    session: Session,
    role_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
) -> list[str]:
    values = list(
        session.scalars(
            select(AuthRoleDimensionValue.value).where(
                AuthRoleDimensionValue.role_id == role_id,
                AuthRoleDimensionValue.dimension_type_id == dimension_type_id,
            )
        )
    )
    return sorted(values)


def _lock_role(session: Session, role_id: uuid.UUID) -> AuthRole:
    role = session.get(AuthRole, role_id, with_for_update=True)
    if role is None:
        raise RoleError("ROLE_NOT_FOUND", "角色不存在", 404)
    return role


def _assert_version(role: AuthRole, expected_version: int) -> None:
    if role.rls_version != expected_version:
        raise BindingError(
            "RLS_BINDING_VERSION_CONFLICT",
            "RLS binding version conflict, reload and retry",
            409,
        )


def _assert_empty_confirmed(values_or_ids: list[object], confirm_empty: bool) -> None:
    if values_or_ids:
        return
    if not confirm_empty:
        raise BindingError(
            "RLS_EMPTY_CONFIRM_REQUIRED",
            "Empty RLS binding requires confirmEmpty=true",
            422,
        )


def get_role_dimension_groups(session: Session, role_id: uuid.UUID) -> RoleDimensionGroupsOut:
    role = get_role(session, role_id)
    return RoleDimensionGroupsOut(
        role_id=role_id,
        group_ids=_read_group_ids(session, role_id),
        version=role.rls_version,
    )


def get_role_dimension_values(
    session: Session,
    role_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
) -> RoleDimensionValuesOut:
    role = get_role(session, role_id)
    dim = session.get(AuthDimensionType, dimension_type_id)
    if dim is None:
        raise BindingError(
            "RLS_DIMENSION_TYPE_NOT_FOUND",
            "Dimension type not found",
            404,
        )
    return RoleDimensionValuesOut(
        role_id=role_id,
        dimension_type_id=dimension_type_id,
        values=_read_dimension_values(session, role_id, dimension_type_id),
        version=role.rls_version,
    )


def replace_role_dimension_values(
    session: Session,
    role_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
    values: list[str],
    *,
    expected_version: int,
    confirm_empty: bool,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> RoleDimensionValuesOut:
    role = _lock_role(session, role_id)
    assert_role_active(role)
    _assert_version(role, expected_version)

    dim = session.get(AuthDimensionType, dimension_type_id)
    if dim is None:
        raise BindingError(
            "RLS_DIMENSION_TYPE_NOT_FOUND",
            "Dimension type not found",
            404,
        )

    unique_values = sorted(set(values))
    _assert_empty_confirmed(unique_values, confirm_empty)
    for value in unique_values:
        validate_dimension_value(session, dim, value)

    before_values = _read_dimension_values(session, role.id, dimension_type_id)
    if before_values == unique_values:
        session.rollback()
        return RoleDimensionValuesOut(
            role_id=role_id,
            dimension_type_id=dimension_type_id,
            values=before_values,
            version=role.rls_version,
        )

    session.query(AuthRoleDimensionValue).filter_by(
        role_id=role.id, dimension_type_id=dimension_type_id
    ).delete()
    for value in unique_values:
        session.add(
            AuthRoleDimensionValue(
                role_id=role.id, dimension_type_id=dimension_type_id, value=value
            )
        )

    role.rls_version = role.rls_version + 1
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="role",
        target_id=role.id,
        action="role.dimension.replace",
        detail={
            "dimension_type_id": str(dimension_type_id),
            "before": before_values,
            "after": unique_values,
        },
        trace_id=trace_id,
    )
    session.commit()
    return RoleDimensionValuesOut(
        role_id=role_id,
        dimension_type_id=dimension_type_id,
        values=unique_values,
        version=role.rls_version,
    )


def replace_role_dimension_groups(
    session: Session,
    role_id: uuid.UUID,
    group_ids: list[uuid.UUID],
    *,
    expected_version: int,
    confirm_empty: bool,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> RoleDimensionGroupsOut:
    role = _lock_role(session, role_id)
    assert_role_active(role)
    _assert_version(role, expected_version)

    unique_ids = _sorted_group_ids(group_ids)
    _assert_empty_confirmed(unique_ids, confirm_empty)
    for group_id in unique_ids:
        group = session.get(AuthDimensionGroup, group_id)
        if group is None:
            raise BindingError("GROUP_NOT_FOUND", "Group not found", 404)

    before_ids = _read_group_ids(session, role.id)
    if before_ids == unique_ids:
        session.rollback()
        return RoleDimensionGroupsOut(
            role_id=role_id,
            group_ids=before_ids,
            version=role.rls_version,
        )

    session.query(AuthRoleDimensionGroup).filter_by(role_id=role.id).delete()
    for group_id in unique_ids:
        session.add(AuthRoleDimensionGroup(role_id=role.id, group_id=group_id))

    role.rls_version = role.rls_version + 1
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="role",
        target_id=role.id,
        action="role.group.replace",
        detail={
            "before": [str(g) for g in before_ids],
            "after": [str(g) for g in unique_ids],
        },
        trace_id=trace_id,
    )
    session.commit()
    return RoleDimensionGroupsOut(
        role_id=role_id,
        group_ids=unique_ids,
        version=role.rls_version,
    )
