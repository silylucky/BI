"""Three-role security chain: root, custom role with grants, analyst without grants."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from jwt_auth import AUTH

from app.auth.deps import UserContext, get_current_user
from app.auth.models import (
    AuthPermission,
    AuthResourceGrant,
    AuthRole,
    AuthRolePermission,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
)
from app.auth.permissions.constants import permission_id_for_code
from app.core.config import get_settings
from app.main import app as fastapi_app

_SQLITE_URL = "sqlite+pysqlite:///file:auth_security_e2e?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def security_e2e_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    from app.datasources.models import Base as DsBase

    DsBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_auth():
    yield
    engine = get_meta_engine()
    with engine.begin() as conn:
        for table in (
            "auth_role_permissions",
            "auth_user_resource_grants",
            "auth_resource_grants",
            "auth_user_roles",
            "auth_users",
            "auth_roles",
            "auth_permissions",
            "data_sources",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


def _bind_perm(session, role: AuthRole, code: str) -> None:
    perm_id = permission_id_for_code(code)
    if session.get(AuthPermission, perm_id) is None:
        domain = code.split(":", 1)[0]
        session.add(AuthPermission(id=perm_id, code=code, name=code, domain=domain))
    session.add(AuthRolePermission(role_id=role.id, permission_id=perm_id))


def _actor(user: AuthUser, role: AuthRole, *, is_root: bool = False, perms: set[str] | None = None):
    return UserContext(
        id=str(user.id),
        username=user.username,
        roles=[role.code],
        permissions=perms or set(),
        is_root=is_root,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_root_bypasses_resource_acl(client: TestClient):
    from app.auth.models import get_meta_session
    from app.dashboard import acl as dashboard_acl

    session = get_meta_session()
    try:
        actor = UserContext(
            id=str(uuid.uuid4()),
            username="rootu",
            roles=["admin"],
            permissions=set(),
            is_root=True,
        )
        unknown = uuid.uuid4()
        assert dashboard_acl.can_access(
            session, actor, unknown, created_by=None, official_slugs=set()
        )
    finally:
        session.close()


def test_custom_role_grant_visibility(client: TestClient):
    from app.auth.models import get_meta_session
    from app.datasources.acl import assert_visible_actor
    from app.datasources.models import DataSource

    session = get_meta_session()
    try:
        role = AuthRole(code=f"ds_reader_{uuid.uuid4().hex[:8]}", name="DS Reader")
        session.add(role)
        session.flush()
        _bind_perm(session, role, "datasource:read")
        user = AuthUser(username="dsu", password_hash="x", is_active=True)
        session.add(user)
        session.flush()
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
        ds_id = uuid.uuid4()
        session.add(
            DataSource(
                id=ds_id,
                name="private-ds",
                code="private-ds",
                type="mysql",
                host="127.0.0.1",
                port=3306,
                database="demo",
                username="root",
                password_encrypted="enc",
            )
        )
        session.add(
            AuthResourceGrant(role_id=role.id, resource_type="datasource", resource_id=ds_id)
        )
        session.commit()
        actor = _actor(user, role, perms={"datasource:read"})
        assert_visible_actor(session, actor, ds_id)
        other = uuid.uuid4()
        from app.auth.resources.service import VisibilityError

        with pytest.raises(VisibilityError):
            assert_visible_actor(session, actor, other)
    finally:
        session.close()


def test_analyst_without_grant_forbidden_on_users_api(client: TestClient):
    from app.auth.models import get_meta_session

    session = get_meta_session()
    try:
        role = AuthRole(code=f"analyst_{uuid.uuid4().hex[:8]}", name="Analyst")
        session.add(role)
        session.flush()
        user = AuthUser(username="ana", password_hash="x", is_active=True)
        session.add(user)
        session.flush()
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
        session.commit()
        actor = _actor(user, role)

        async def _override():
            return actor

        fastapi_app.dependency_overrides[get_current_user] = _override
        resp = client.get("/api/v1/users", headers=AUTH)
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.clear()
        session.close()
