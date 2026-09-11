from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text

from app.auth.models import (
    AuthPermission,
    AuthResourceGrant,
    AuthRole,
    AuthRoleDimensionValue,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
    get_meta_session,
)
from app.auth.permissions.constants import permission_id_for_code
from app.auth.user_overrides import service as override_service

_AUTH_OVERRIDES_SQLITE = (
    "sqlite+pysqlite:///file:auth_user_overrides_test?mode=memory&cache=shared&uri=true"
)


@pytest.fixture(scope="module", autouse=True)
def overrides_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _AUTH_OVERRIDES_SQLITE
    from app.core.config import get_settings

    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    Base.metadata.create_all(get_meta_engine())
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    engine = get_meta_engine()
    with engine.begin() as conn:
        for table in (
            "auth_user_resource_grants",
            "auth_user_dimension_overrides",
            "auth_resource_grants",
            "auth_role_dimension_values",
            "auth_user_roles",
            "auth_users",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


def _seed_user_with_role(session) -> tuple[AuthUser, AuthRole, uuid.UUID]:
    role = AuthRole(code="viewer", name="Viewer")
    session.add(role)
    session.flush()
    user = AuthUser(username="u1", password_hash="x", is_active=True)
    session.add(user)
    session.flush()
    session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    rid = uuid.uuid4()
    session.add(
        AuthResourceGrant(role_id=role.id, resource_type="dashboard", resource_id=rid)
    )
    session.commit()
    return user, role, rid


def test_effective_resource_merge_add_and_deny():
    session = get_meta_session()
    try:
        user, role, base_id = _seed_user_with_role(session)
        extra = uuid.uuid4()
        denied = uuid.uuid4()
        session.add(
            AuthResourceGrant(role_id=role.id, resource_type="dashboard", resource_id=denied)
        )
        session.commit()
        override_service.upsert_user_resource_grant(
            session,
            user_id=user.id,
            resource_type="dashboard",
            resource_id=extra,
            effect="add",
            actor_id="admin",
            actor_username="admin",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        override_service.upsert_user_resource_grant(
            session,
            user_id=user.id,
            resource_type="dashboard",
            resource_id=denied,
            effect="deny",
            actor_id="admin",
            actor_username="admin",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t2",
        )
        effective = override_service.effective_resource_ids(
            session, user_id=user.id, role_codes=["viewer"], resource_type="dashboard"
        )
        assert base_id in effective
        assert extra in effective
        assert denied not in effective
    finally:
        session.close()


def test_effective_dimension_deny_wins():
    session = get_meta_session()
    try:
        user, role, _ = _seed_user_with_role(session)
        dim_id = uuid.uuid4()
        session.add(
            AuthRoleDimensionValue(
                role_id=role.id, dimension_type_id=dim_id, value="east"
            )
        )
        session.commit()
        override_service.upsert_user_dimension_override(
            session,
            user_id=user.id,
            dimension_type_id=dim_id,
            value="east",
            effect="deny",
            actor_id="admin",
            actor_username="admin",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        values = override_service.effective_dimension_values(
            session, user_id=user.id, role_ids=[role.id], dimension_type_id=dim_id
        )
        assert "east" not in values
    finally:
        session.close()
