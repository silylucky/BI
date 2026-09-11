"""Dataset transform_rules API and query pandas integration tests."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.metadata.dataset import service as dataset_service
from app.metadata.dataset.models import DatasetRecord
from app.datasources.models import get_meta_session
from app.metadata.dataset.schemas import DatasetItemIn, DatasetItemOut, DatasetTableDef
from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.transform_rules import get_transform_rules, put_transform_rules
from app.query.dataset.pandas_transform import apply_query_transform, resolve_dataset_transform_rules
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:ds_transform_rules?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_transform_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_datasets():
    dataset_service._store.clear()
    yield
    dataset_service._store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def admin_actor():
    user = UserContext(
        id=str(uuid.uuid4()),
        username="admin",
        roles=["admin"],
        is_root=True,
    )
    fastapi_app.dependency_overrides[get_current_user] = lambda: user
    yield user
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_manual_dataset(admin_actor: UserContext, ds_id: str | None = None) -> str:
    dataset_id = ds_id or f"ds-{uuid.uuid4().hex[:8]}"
    dataset_service.create_dataset(
        DatasetItemIn(
            dataset_id=dataset_id,
            display_name="外部源测试集",
            tables=[DatasetTableDef(name="public.orders")],
        ),
        admin_actor,
    )
    return dataset_id


def test_put_and_get_transform_rules(admin_actor):
    ds_id = _create_manual_dataset(admin_actor)
    rules = [{"type": "rename_column", "from": "product_name", "to": "product"}]
    saved = put_transform_rules(ds_id, rules, admin_actor)
    assert saved.rules == rules
    loaded = get_transform_rules(ds_id, admin_actor)
    assert loaded.rules == rules
    assert loaded.query_pandas_applies is True


def test_resolve_transform_rules_used_in_query_pandas(admin_actor):
    from unittest.mock import MagicMock

    ds_id = _create_manual_dataset(admin_actor)
    rules = [{"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"}]
    put_transform_rules(ds_id, rules, admin_actor)
    session = MagicMock()
    row = MagicMock()
    row.transform_rules = rules
    session.get.return_value = row
    dataset = DatasetItemOut(
        datasetId=ds_id,
        displayName="t",
        tables=[DatasetTableDef(name="public.orders")],
        computedFields=[],
        allowedRoles=["analyst"],
        transformRules=rules,
    )
    resolved = resolve_dataset_transform_rules(session, dataset)
    assert resolved == rules


def test_apply_query_transform_with_custom_rename_rule():
    records = [{"product_name": "A", "status": "active"}]
    rules = [{"type": "rename_column", "from": "product_name", "to": "product"}]
    cleaned = apply_query_transform(records, rules)
    assert cleaned[0]["product"] == "A"


def test_sync_job_put_transform_rules_locked(admin_actor):
    ds_id = "ds-sync-test"
    session = get_meta_session()
    try:
        session.add(
            DatasetRecord(
                dataset_id=ds_id,
                display_name="sync ds",
                tables=[{"name": "public.orders_clean"}],
                computed_fields=[],
                allowed_roles=["analyst"],
                origin="sync_job",
                transform_rules=[],
            ),
        )
        session.commit()
    finally:
        session.close()

    rules = [{"type": "rename_column", "from": "a", "to": "b"}]
    with pytest.raises(DatasetError) as exc:
        put_transform_rules(ds_id, rules, admin_actor)
    assert exc.value.code == "META_DATASET_TRANSFORM_SYNC_LOCKED"


def test_sync_job_get_transform_rules_query_pandas_false(admin_actor):
    ds_id = "ds-sync-get"
    session = get_meta_session()
    try:
        session.add(
            DatasetRecord(
                dataset_id=ds_id,
                display_name="sync ds",
                tables=[{"name": "public.orders_clean"}],
                computed_fields=[],
                allowed_roles=["analyst"],
                origin="sync_job",
                transform_rules=[],
            ),
        )
        session.commit()
    finally:
        session.close()

    loaded = get_transform_rules(ds_id, admin_actor)
    assert loaded.rules == []
    assert loaded.query_pandas_applies is False


def test_transform_rules_api_routes(client, admin_actor):
    ds_id = _create_manual_dataset(admin_actor)
    get_resp = client.get(f"/api/v1/datasets/{ds_id}/transform-rules", headers=AUTH)
    assert get_resp.status_code == 200
    assert get_resp.json()["rules"] == []

    put_resp = client.put(
        f"/api/v1/datasets/{ds_id}/transform-rules",
        headers=AUTH,
        json={"rules": [{"type": "cast_type", "column": "amount", "to": "float"}]},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["rules"][0]["column"] == "amount"
