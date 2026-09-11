"""User override enforcement in ACL execution chain."""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text

from app.auth.deps import UserContext
from app.auth.models import (
    AuthDimensionType,
    AuthResourceGrant,
    AuthRole,
    AuthRoleDimensionValue,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
    get_meta_session,
)
from app.auth.resources.service import ensure_resource_visible, list_visible_resource_ids
from app.auth.rls.predicate import build_multi_dimension_rls_fragment
from app.auth.user_overrides import service as override_service
from app.dashboard import acl as dashboard_acl

_AUTH_OVERRIDE_ENFORCE_SQLITE = (
    "sqlite+pysqlite:///file:auth_override_enforce_test?mode=memory&cache=shared&uri=true"
)


@pytest.fixture(scope="module", autouse=True)
def override_enforce_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _AUTH_OVERRIDE_ENFORCE_SQLITE
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
            "auth_user_dimension_overrides",
            "auth_role_dimension_values",
            "auth_dimension_types",
            "auth_user_resource_grants",
            "auth_resource_grants",
            "auth_user_roles",
            "auth_users",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


def _seed_viewer(session) -> tuple[AuthUser, AuthRole]:
    role = AuthRole(code="viewer", name="Viewer")
    session.add(role)
    session.flush()
    user = AuthUser(username="viewer1", password_hash="x", is_active=True)
    session.add(user)
    session.flush()
    session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    session.commit()
    return user, role


def test_user_override_add_visible_in_acl_chain():
    session = get_meta_session()
    try:
        user, role = _seed_viewer(session)
        granted_id = uuid.uuid4()
        extra_id = uuid.uuid4()
        session.add(
            AuthResourceGrant(
                role_id=role.id, resource_type="dashboard", resource_id=granted_id
            )
        )
        session.commit()
        override_service.upsert_user_resource_grant(
            session,
            user_id=user.id,
            resource_type="dashboard",
            resource_id=extra_id,
            effect="add",
            actor_id="root",
            actor_username="root",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        visible = list_visible_resource_ids(
            session, ["viewer"], "dashboard", user_id=user.id
        )
        assert granted_id in visible
        assert extra_id in visible
        ensure_resource_visible(
            session, ["viewer"], "dashboard", extra_id, user_id=user.id
        )
        actor = UserContext(
            id=str(user.id),
            username=user.username,
            roles=["viewer"],
            permissions=set(),
            is_root=False,
        )
        assert dashboard_acl.can_access(
            session, actor, extra_id, created_by=None, official_slugs=set()
        )
    finally:
        session.close()


def test_user_override_deny_blocks_acl_chain():
    session = get_meta_session()
    try:
        user, role = _seed_viewer(session)
        denied_id = uuid.uuid4()
        session.add(
            AuthResourceGrant(
                role_id=role.id, resource_type="dashboard", resource_id=denied_id
            )
        )
        session.commit()
        override_service.upsert_user_resource_grant(
            session,
            user_id=user.id,
            resource_type="dashboard",
            resource_id=denied_id,
            effect="deny",
            actor_id="root",
            actor_username="root",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        visible = list_visible_resource_ids(
            session, ["viewer"], "dashboard", user_id=user.id
        )
        assert denied_id not in visible
        actor = UserContext(
            id=str(user.id),
            username=user.username,
            roles=["viewer"],
            permissions=set(),
            is_root=False,
        )
        assert not dashboard_acl.can_access(
            session, actor, denied_id, created_by=None, official_slugs=set()
        )
    finally:
        session.close()


def test_dimension_override_deny_yields_rls_deny_fragment():
    session = get_meta_session()
    try:
        user, role = _seed_viewer(session)
        dim = AuthDimensionType(
            code="region",
            name="Region",
            value_type="string",
            org_dimension=False,
        )
        session.add(dim)
        session.flush()
        session.add(
            AuthRoleDimensionValue(
                role_id=role.id,
                dimension_type_id=dim.id,
                value="east",
            )
        )
        session.commit()
        override_service.upsert_user_dimension_override(
            session,
            user_id=user.id,
            dimension_type_id=dim.id,
            value="east",
            effect="deny",
            actor_id="root",
            actor_username="root",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        fragment = build_multi_dimension_rls_fragment(
            session,
            user.id,
            column_by_dimension_id={dim.id: "region_code"},
        )
        assert fragment == "1=0"
    finally:
        session.close()


def test_dimension_override_deny_filters_rls_values():
    session = get_meta_session()
    try:
        user, role = _seed_viewer(session)
        dim = AuthDimensionType(
            code="region",
            name="Region",
            value_type="string",
            org_dimension=False,
        )
        session.add(dim)
        session.flush()
        for value in ("east", "west"):
            session.add(
                AuthRoleDimensionValue(
                    role_id=role.id,
                    dimension_type_id=dim.id,
                    value=value,
                )
            )
        session.commit()
        override_service.upsert_user_dimension_override(
            session,
            user_id=user.id,
            dimension_type_id=dim.id,
            value="east",
            effect="deny",
            actor_id="root",
            actor_username="root",
            actor_permissions={"system:user.manage"},
            actor_is_root=True,
            trace_id="t",
        )
        fragment = build_multi_dimension_rls_fragment(
            session,
            user.id,
            column_by_dimension_id={dim.id: "region_code"},
        )
        assert "t.region_code IN ('west')" == fragment
    finally:
        session.close()
