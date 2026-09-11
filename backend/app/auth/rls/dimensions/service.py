from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthDimensionType, AuthDimensionTypeRef, AuthOrgNode, AuthRoleDimensionValue
from app.auth.schemas import DimensionTypeCreate, DimensionTypeUpdate


class DimensionError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _validate_org_ref(session: Session, value_type: str) -> bool:
    if value_type != "org_ref":
        return False
    count = session.scalar(select(func.count()).select_from(AuthOrgNode))
    if not count or count < 1:
        raise DimensionError("ORG_TREE_REQUIRED", "Org tree required for org_ref dimension", 422)
    return True


def list_dimension_types(
    session: Session,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuthDimensionType], int]:
    total = session.scalar(select(func.count()).select_from(AuthDimensionType)) or 0
    items = list(
        session.scalars(
            select(AuthDimensionType)
            .order_by(AuthDimensionType.code)
            .limit(min(limit, 500))
            .offset(offset)
        )
    )
    return items, total


def create_dimension_type(
    session: Session,
    payload: DimensionTypeCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthDimensionType:
    org_dimension = _validate_org_ref(session, payload.value_type)
    dim = AuthDimensionType(
        code=payload.code,
        name=payload.name,
        value_type=payload.value_type,
        org_dimension=org_dimension,
        description=payload.description,
    )
    session.add(dim)
    try:
        session.flush()
        record_platform_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_type="dimension",
            target_id=dim.id,
            action="dimension.create",
            detail={"code": dim.code},
            trace_id=trace_id,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise DimensionError("DIMENSION_CODE_CONFLICT", "Dimension code already exists", 409) from exc
    session.refresh(dim)
    return dim


def get_dimension_type(session: Session, dim_id: uuid.UUID) -> AuthDimensionType:
    dim = session.get(AuthDimensionType, dim_id)
    if dim is None:
        raise DimensionError("DIMENSION_NOT_FOUND", "Dimension type not found", 404)
    return dim


def update_dimension_type(
    session: Session,
    dim_id: uuid.UUID,
    payload: DimensionTypeUpdate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthDimensionType:
    dim = get_dimension_type(session, dim_id)
    dim.name = payload.name
    dim.description = payload.description
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="dimension",
        target_id=dim.id,
        action="dimension.update",
        detail={"code": dim.code},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(dim)
    return dim


def delete_dimension_type(
    session: Session,
    dim_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    dim = get_dimension_type(session, dim_id)
    rdv_count = session.scalar(
        select(func.count())
        .select_from(AuthRoleDimensionValue)
        .where(AuthRoleDimensionValue.dimension_type_id == dim_id)
    )
    if rdv_count and rdv_count > 0:
        raise DimensionError(
            "DIMENSION_IN_USE", "Dimension type is referenced and cannot be deleted", 409
        )
    ref_count = session.scalar(
        select(func.count())
        .select_from(AuthDimensionTypeRef)
        .where(AuthDimensionTypeRef.dimension_type_id == dim_id)
    )
    if ref_count and ref_count > 0:
        raise DimensionError("DIMENSION_IN_USE", "Dimension type is referenced and cannot be deleted", 409)
    if dim.org_dimension:
        org_count = session.scalar(select(func.count()).select_from(AuthOrgNode))
        if org_count and org_count > 0:
            raise DimensionError(
                "DIMENSION_IN_USE",
                "Cannot delete org dimension while org tree has nodes",
                409,
            )
    dim_id_copy = dim.id
    dim_code = dim.code
    session.delete(dim)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="dimension",
        target_id=dim_id_copy,
        action="dimension.delete",
        detail={"code": dim_code},
        trace_id=trace_id,
    )
    session.commit()
