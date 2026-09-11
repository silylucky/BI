"""Purge auth metadata when platform resources are removed."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.models import (
    AuthColumnMask,
    AuthDimensionType,
    AuthResourceGrant,
    AuthRlsColumnBinding,
    AuthRoleDimensionValue,
    AuthUserDimensionOverride,
    AuthUserResourceGrant,
)


def purge_grants_for_resource(
    session: Session,
    *,
    resource_type: str,
    resource_id: uuid.UUID,
) -> int:
    role_count = session.execute(
        delete(AuthResourceGrant).where(
            AuthResourceGrant.resource_type == resource_type,
            AuthResourceGrant.resource_id == resource_id,
        )
    ).rowcount
    user_count = session.execute(
        delete(AuthUserResourceGrant).where(
            AuthUserResourceGrant.resource_type == resource_type,
            AuthUserResourceGrant.resource_id == resource_id,
        )
    ).rowcount
    return int(role_count or 0) + int(user_count or 0)


def purge_datasource_scope_metadata(session: Session, datasource_id: uuid.UUID) -> int:
    mask_count = session.execute(
        delete(AuthColumnMask).where(AuthColumnMask.datasource_id == datasource_id)
    ).rowcount
    binding_count = session.execute(
        delete(AuthRlsColumnBinding).where(AuthRlsColumnBinding.datasource_id == datasource_id)
    ).rowcount
    return int(mask_count or 0) + int(binding_count or 0)


def purge_org_dimension_references(session: Session, org_node_id: uuid.UUID) -> int:
    node_str = str(org_node_id)
    org_type_ids = select(AuthDimensionType.id).where(AuthDimensionType.org_dimension.is_(True))
    role_count = session.execute(
        delete(AuthRoleDimensionValue).where(
            AuthRoleDimensionValue.dimension_type_id.in_(org_type_ids),
            AuthRoleDimensionValue.value == node_str,
        )
    ).rowcount
    user_count = session.execute(
        delete(AuthUserDimensionOverride).where(
            AuthUserDimensionOverride.dimension_type_id.in_(org_type_ids),
            AuthUserDimensionOverride.value == node_str,
        )
    ).rowcount
    return int(role_count or 0) + int(user_count or 0)
