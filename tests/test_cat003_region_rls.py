"""CAT-003 — regionScope RLS injection in query executor."""
from __future__ import annotations

import uuid

import pytest

from app.auth.deps import UserContext
from app.governance.catalog.cat03 import service as cat03_service
from app.query.rls.guard import apply_rls_to_sql
from app.query.rls.region_scope import build_region_scope_fragment, resolve_region_scope_prefix


@pytest.fixture(autouse=True)
def clear_region_scope():
    cat03_service._USER_REGION_SCOPE.clear()
    yield
    cat03_service._USER_REGION_SCOPE.clear()


def test_cat003_rls_01_build_region_fragment():
    """T-CAT-003-RLS-01: region prefix builds LIKE fragment."""
    fragment = build_region_scope_fragment("CN", column="region_code", alias="t")
    assert fragment == "t.region_code LIKE 'CN%'"


def test_cat003_rls_02_admin_bypasses_region_scope():
    """T-CAT-003-RLS-02: admin has no region prefix."""
    user = UserContext(id="admin", username="admin", roles=["admin"])
    assert resolve_region_scope_prefix(user) is None


def test_cat003_rls_03_enterprise_region_prefix():
    """T-CAT-003-RLS-03: enterprise user gets scoped prefix."""
    user = UserContext(id="ent-1", username="ent", roles=["enterprise"])
    cat03_service.set_user_region_scope("ent-1", "CN-GD")
    assert resolve_region_scope_prefix(user) == "CN-GD"


def test_cat003_rls_04_apply_rls_injects_region_column(meta_session):
    """T-CAT-003-RLS-04: apply_rls_to_sql merges regionScope when regionColumn set."""
    user = UserContext(id="ent-rls", username="ent", roles=["enterprise"])
    cat03_service.set_user_region_scope("ent-rls", "CN")
    sql = "SELECT region_code, cnt FROM sales"
    out = apply_rls_to_sql(
        meta_session,
        user,
        sql,
        rls_config={"region_column": "region_code", "table_alias": "t"},
    )
    assert "region_code LIKE 'CN%'" in out
    assert "WHERE" in out.upper()


def test_cat003_rls_05_admin_no_region_injection(meta_session):
    """T-CAT-003-RLS-05: admin SQL has no region LIKE fragment."""
    user = UserContext(id="admin", username="admin", roles=["admin"])
    sql = "SELECT region_code, cnt FROM sales"
    out = apply_rls_to_sql(
        meta_session,
        user,
        sql,
        rls_config={"region_column": "region_code", "table_alias": "t"},
    )
    assert "LIKE 'CN%'" not in out


@pytest.fixture
def meta_session():
    from app.auth.models import get_meta_session

    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()
