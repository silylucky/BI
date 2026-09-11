from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import AuthUserDimensionOverride, AuthUserResourceGrant


def list_user_resource_grants(session: Session, user_id: uuid.UUID) -> list[AuthUserResourceGrant]:
    return list(
        session.scalars(
            select(AuthUserResourceGrant)
            .where(AuthUserResourceGrant.user_id == user_id)
            .order_by(AuthUserResourceGrant.created_at)
        )
    )


def list_user_dimension_overrides(
    session: Session, user_id: uuid.UUID
) -> list[AuthUserDimensionOverride]:
    return list(
        session.scalars(
            select(AuthUserDimensionOverride).where(AuthUserDimensionOverride.user_id == user_id)
        )
    )
