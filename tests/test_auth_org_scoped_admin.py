from __future__ import annotations

import os

import pytest
from sqlalchemy import text

from app.auth.models import (
    AuthOrgNode,
    AuthResourceGrant,
    AuthRole,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
    get_meta_session,
)
from app.auth.org_scope import get_subtree_org_ids
from app.auth.schemas import ResourceGrantCreate, UserCreate
from app.auth.resources import service as grant_service
from app.auth.users import service as user_service

_AUTH_PHASE_C_SQLITE = "sqlite+pysqlite:///file:auth_phase_c?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def phase_c_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _AUTH_PHASE_C_SQLITE
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
            "auth_column_masks",
            "auth_resource_grants",
            "auth_user_roles",
            "auth_audit_events",
            "auth_users",
            "auth_org_nodes",
            "auth_roles",
        ):
            conn.execute(text(f"DELETE FROM {table}"))


def _org_tree(session):
    root = AuthOrgNode(id=__import__("uuid").uuid4(), name="总部", parent_id=None, path="/x", level=0)
    root.path = f"/{root.id}"
    child = AuthOrgNode(
        id=__import__("uuid").uuid4(),
        name="分部",
        parent_id=root.id,
        path="",
        level=1,
    )
    child.path = f"{root.path}/{child.id}"
    session.add_all([root, child])
    session.flush()
    return root, child


def test_org_scoped_list_filters_subtree():
    session = get_meta_session()
    try:
        root, child = _org_tree(session)
        admin = AuthUser(username="orgadmin", password_hash="x", org_node_id=root.id, is_active=True)
        outsider = AuthUser(username="outsider", password_hash="x", org_node_id=None, is_active=True)
        insider = AuthUser(username="insider", password_hash="x", org_node_id=child.id, is_active=True)
        session.add_all([admin, outsider, insider])
        session.commit()
        subtree = get_subtree_org_ids(session, root.id)
        items, total = user_service.list_users(session, org_node_ids=sorted(subtree))
        names = {u.username for u in items}
        assert total == 2
        assert "insider" in names
        assert "orgadmin" in names
        assert "outsider" not in names
    finally:
        session.close()


def test_org_scoped_create_rejects_out_of_scope_org():
    session = get_meta_session()
    try:
        root, _child = _org_tree(session)
        other = AuthOrgNode(
            id=__import__("uuid").uuid4(),
            name="外部",
            parent_id=None,
            path=f"/{__import__('uuid').uuid4()}",
            level=0,
        )
        session.add(other)
        admin = AuthUser(username="scoped", password_hash="x", org_node_id=root.id, is_active=True)
        session.add(admin)
        session.commit()
        with pytest.raises(user_service.UserError) as exc:
            user_service.create_user(
                session,
                UserCreate(username="newbie", initial_password="ValidPass1!", org_id=other.id),
                actor_id=str(admin.id),
                actor_username="scoped",
                trace_id="t",
                actor_permissions={"system:org_scoped.manage"},
                actor_is_root=False,
            )
        assert exc.value.code == "ORG_SCOPE_FORBIDDEN"
    finally:
        session.close()


def test_org_scoped_grant_requires_role_in_subtree():
    session = get_meta_session()
    try:
        root, child = _org_tree(session)
        role = AuthRole(code="local", name="Local")
        session.add(role)
        session.flush()
        admin = AuthUser(username="ga", password_hash="x", org_node_id=root.id, is_active=True)
        member = AuthUser(username="mb", password_hash="x", org_node_id=child.id, is_active=True)
        session.add_all([admin, member])
        session.flush()
        session.add(AuthUserRole(user_id=member.id, role_id=role.id))
        session.commit()
        grant_service.create_grant(
            session,
            ResourceGrantCreate(
                role_id=role.id,
                resource_type="dashboard",
                resource_id=__import__("uuid").uuid4(),
            ),
            actor_id=str(admin.id),
            actor_username="ga",
            trace_id="t",
            actor_permissions={"system:org_scoped.manage"},
            actor_is_root=False,
        )
        orphan_role = AuthRole(code="orphan", name="Orphan")
        session.add(orphan_role)
        session.commit()
        with pytest.raises(grant_service.GrantError) as exc:
            grant_service.create_grant(
                session,
                ResourceGrantCreate(
                    role_id=orphan_role.id,
                    resource_type="dashboard",
                    resource_id=__import__("uuid").uuid4(),
                ),
                actor_id=str(admin.id),
                actor_username="ga",
                trace_id="t2",
                actor_permissions={"system:org_scoped.manage"},
                actor_is_root=False,
            )
        assert exc.value.code == "ORG_SCOPE_FORBIDDEN"
    finally:
        session.close()
