"""Persistence tests for entity/physical, gov config, embed tokens (Alembic 0039+)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.datasources.models import get_meta_engine


@pytest.fixture(autouse=True)
def clear_memory_stores():
    from app.metadata.entity import service as entity_service
    from app.metadata.physical import service as physical_service
    from app.governance.catalog.cat01 import service as cat01_service

    entity_service._store.clear()
    physical_service._store.clear()
    cat01_service._store.clear()
    yield
    entity_service._store.clear()
    physical_service._store.clear()
    cat01_service._store.clear()


def test_entity_type_survives_new_session(alembic_meta_engine):
    from app.metadata.entity import entity_repo

    record = {
        "typeCode": "order_persist",
        "displayName": "订单",
        "attributes": [{"name": "order_id", "dataType": "string", "required": True}],
        "lifecycleStates": [],
        "physicalTableFqn": None,
        "refCount": 0,
    }
    with Session(alembic_meta_engine) as db:
        entity_repo.create(db, record)

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        row = entity_repo.get(db, "order_persist")
    assert row is not None
    assert row["displayName"] == "订单"


def test_physical_table_survives_new_session(alembic_meta_engine):
    from app.metadata.physical import physical_repo

    record = {
        "tableFqn": "sales.orders_persist",
        "dataSourceId": str(uuid.uuid4()),
        "displayName": "Orders",
        "columns": [{"name": "id", "dataType": "bigint", "nullable": False}],
        "entityTypeCode": None,
        "sourceSchema": None,
        "sourceTable": None,
    }
    with Session(alembic_meta_engine) as db:
        physical_repo.create(db, record)

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        row = physical_repo.get(db, "sales.orders_persist")
    assert row is not None
    assert row["displayName"] == "Orders"


def test_cat01_template_persists(alembic_meta_engine):
    from app.governance.catalog import gov_config_store

    key = f"TPL_PERSIST_{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "templateKey": key,
        "displayName": "Persist",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["open", "closed"],
        "readOnlyOpenApi": False,
        "allowedRoles": ["analyst"],
    }
    with Session(alembic_meta_engine) as db:
        gov_config_store.upsert_json(
            db,
            config_type="gov_lifecycle_template",
            ref_type="lifecycle_template",
            key=key,
            payload=payload,
        )

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        row = gov_config_store.get_json(
            db,
            config_type="gov_lifecycle_template",
            ref_type="lifecycle_template",
            key=key,
        )
    assert row is not None
    assert row["templateKey"] == key


def test_embed_token_persists(alembic_meta_engine):
    from app.integration import embed_token_repo

    token = f"test-token-{uuid.uuid4().hex}"
    expires = datetime.now(UTC) + timedelta(minutes=5)
    meta = {"container_id": "embed-x", "theme": "light", "api_base": "/api/v1", "actor_id": "u1"}

    with Session(alembic_meta_engine) as db:
        embed_token_repo.save_token(db, token, expires, meta)

    get_meta_engine.cache_clear()
    with Session(get_meta_engine()) as db:
        row = embed_token_repo.get_token(db, token)
    assert row is not None
