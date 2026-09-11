from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import select, text

from app.auth import cleanup as auth_cleanup
from app.auth.audit.retention import purge_audit_events_before
from app.auth.resources import service as grant_service
from app.auth.schemas import ResourceGrantCreate
from app.auth.models import (
    AuthAuditEvent,
    AuthColumnMask,
    AuthDimensionType,
    AuthOrgNode,
    AuthResourceGrant,
    AuthRlsColumnBinding,
    AuthRole,
    AuthRoleDimensionValue,
    AuthUser,
    AuthUserDimensionOverride,
    AuthUserResourceGrant,
    Base,
    get_meta_engine,
    get_meta_session,
)
from app.core.config import get_settings

_CLEANUP_SQLITE = "sqlite+pysqlite:///file:auth_cleanup_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def cleanup_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _CLEANUP_SQLITE
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
def clean_auth_tables_between_tests():
    yield
    tables = (
        "auth_user_resource_grants",
        "auth_resource_grants",
        "auth_column_masks",
        "auth_rls_column_bindings",
        "auth_role_dimension_values",
        "auth_user_dimension_overrides",
        "auth_audit_events",
        "auth_user_roles",
        "auth_users",
        "auth_roles",
        "auth_dimension_types",
        "auth_org_nodes",
    )
    with get_meta_engine().begin() as conn:
        for table in tables:
            conn.execute(text(f"DELETE FROM {table}"))


def test_purge_grants_for_resource_removes_role_and_user_rows():
    session = get_meta_session()
    try:
        role = AuthRole(code="cleanup_role", name="Cleanup")
        session.add(role)
        session.flush()
        resource_id = uuid.uuid4()
        session.add(
            AuthResourceGrant(
                role_id=role.id,
                resource_type="dashboard",
                resource_id=resource_id,
            )
        )
        user_id = uuid.uuid4()
        session.add(
            AuthUserResourceGrant(
                user_id=user_id,
                resource_type="dashboard",
                resource_id=resource_id,
                effect="add",
            )
        )
        session.commit()

        deleted = auth_cleanup.purge_grants_for_resource(
            session,
            resource_type="dashboard",
            resource_id=resource_id,
        )
        session.commit()
        assert deleted == 2
        assert (
            session.scalar(
                select(AuthResourceGrant).where(AuthResourceGrant.resource_id == resource_id)
            )
            is None
        )
        assert (
            session.scalar(
                select(AuthUserResourceGrant).where(
                    AuthUserResourceGrant.resource_id == resource_id
                )
            )
            is None
        )
    finally:
        session.close()


def test_purge_datasource_scope_metadata():
    session = get_meta_session()
    try:
        ds_id = uuid.uuid4()
        dim = AuthDimensionType(
            code="org_cleanup",
            name="Org",
            value_type="org_ref",
            org_dimension=True,
        )
        session.add(dim)
        session.flush()
        session.add(
            AuthColumnMask(
                datasource_id=ds_id,
                dataset_id=None,
                table_name="t",
                column_name="c",
                mask_strategy="hide",
            )
        )
        session.add(
            AuthRlsColumnBinding(
                datasource_id=ds_id,
                dataset_id=None,
                table_name="t",
                dimension_type_id=dim.id,
                column_name="org_id",
            )
        )
        session.commit()

        deleted = auth_cleanup.purge_datasource_scope_metadata(session, ds_id)
        session.commit()
        assert deleted == 2
        assert (
            session.scalar(select(AuthColumnMask).where(AuthColumnMask.datasource_id == ds_id))
            is None
        )
        assert (
            session.scalar(
                select(AuthRlsColumnBinding).where(
                    AuthRlsColumnBinding.datasource_id == ds_id
                )
            )
            is None
        )
    finally:
        session.close()


def test_purge_audit_events_before():
    session = get_meta_session()
    try:
        from datetime import UTC, datetime, timedelta

        old = AuthAuditEvent(
            actor_id="a",
            target_type="user",
            target_id=uuid.uuid4(),
            action="test.old",
            trace_id="t1",
            created_at=datetime.now(UTC) - timedelta(days=400),
        )
        recent = AuthAuditEvent(
            actor_id="a",
            target_type="user",
            target_id=uuid.uuid4(),
            action="test.recent",
            trace_id="t2",
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
        session.add_all([old, recent])
        session.commit()

        deleted = purge_audit_events_before(session, retention_days=365)
        session.commit()
        assert deleted == 1
        remaining = session.scalars(select(AuthAuditEvent)).all()
        assert len(remaining) == 1
        assert remaining[0].action == "test.recent"
    finally:
        session.close()


def test_purge_org_dimension_references():
    session = get_meta_session()
    try:
        dim = AuthDimensionType(
            code="org_purge",
            name="Org Purge",
            value_type="org_ref",
            org_dimension=True,
        )
        other_dim = AuthDimensionType(
            code="region_purge",
            name="Region",
            value_type="string",
            org_dimension=False,
        )
        session.add_all([dim, other_dim])
        session.flush()
        org = AuthOrgNode(name="Leaf", path="/leaf", level=1)
        session.add(org)
        session.flush()
        node_str = str(org.id)
        role = AuthRole(code="org_purge_role", name="Org Purge Role")
        session.add(role)
        session.flush()
        session.add(
            AuthRoleDimensionValue(
                role_id=role.id,
                dimension_type_id=dim.id,
                value=node_str,
            )
        )
        session.add(
            AuthRoleDimensionValue(
                role_id=role.id,
                dimension_type_id=other_dim.id,
                value=node_str,
            )
        )
        user = AuthUser(username="org_purge_user", password_hash="x")
        session.add(user)
        session.flush()
        session.add(
            AuthUserDimensionOverride(
                user_id=user.id,
                dimension_type_id=dim.id,
                value=node_str,
                effect="add",
            )
        )
        session.commit()

        deleted = auth_cleanup.purge_org_dimension_references(session, org.id)
        session.commit()
        assert deleted == 2
        assert (
            session.scalar(
                select(AuthRoleDimensionValue).where(
                    AuthRoleDimensionValue.dimension_type_id == dim.id,
                    AuthRoleDimensionValue.value == node_str,
                )
            )
            is None
        )
        assert (
            session.scalar(
                select(AuthRoleDimensionValue).where(
                    AuthRoleDimensionValue.dimension_type_id == other_dim.id,
                    AuthRoleDimensionValue.value == node_str,
                )
            )
            is not None
        )
    finally:
        session.close()


def test_create_grant_rejects_invalid_resource_type():
    session = get_meta_session()
    try:
        role = AuthRole(code="grant_type_guard", name="Guard")
        session.add(role)
        session.commit()
        payload = ResourceGrantCreate.model_construct(
            role_id=role.id,
            resource_type="bogus",
            resource_id=uuid.uuid4(),
        )
        with pytest.raises(grant_service.GrantError) as exc:
            grant_service.create_grant(
                session,
                payload,
                actor_id="admin",
                actor_username="admin",
                trace_id="t",
            )
        assert exc.value.code == "INVALID_RESOURCE_TYPE"
    finally:
        session.close()
