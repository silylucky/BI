"""Tests for standard analysis legacy physical-table migration."""

from __future__ import annotations

import os
import uuid

import pytest

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.metadata.entity import service as entity_service
from app.metadata.entity.schemas import EntityTypeCreate
from app.metadata.physical import service as physical_service
from app.metadata.physical.schemas import PhysicalTableRegisterIn
from app.reports.persistence import memory_stores
from app.reports.persistence import standard_repo
from app.reports.standard.legacy_cleanup import migrate_physical_packs_to_dataset

_SQLITE = "sqlite+pysqlite:///file:std_legacy_migration?mode=memory&cache=shared&uri=true"
_EQUIPMENT_FQN = "ops.equipment"
_DS_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
_ADMIN = UserContext(id="1", username="admin", roles=["admin"])


@pytest.fixture(scope="module", autouse=True)
def _sqlite_env():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    os.environ["RPT_METADATA_STORE"] = "memory"
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if prev is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = prev
    os.environ.pop("RPT_METADATA_STORE", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture(autouse=True)
def memory_report_metadata() -> None:
    memory_stores.clear_all()


def _seed_physical_equipment() -> None:
    try:
        entity_service.get_entity_type("equipment")
    except Exception:
        entity_service.create_entity_type(
            EntityTypeCreate(typeCode="equipment", displayName="设备", attributes=[], lifecycleStates=[]),
        )
    try:
        physical_service.get_physical_table(_EQUIPMENT_FQN)
    except Exception:
        physical_service.register_physical_table(
            PhysicalTableRegisterIn(
                tableFqn=_EQUIPMENT_FQN,
                dataSourceId=_DS_ID,
                displayName="设备表",
                entityTypeCode="equipment",
                columns=[
                    {"name": "status", "dataType": "varchar", "nullable": False},
                    {"name": "region", "dataType": "varchar", "nullable": False},
                    {"name": "created_at", "dataType": "datetime", "nullable": True},
                ],
            ),
            _ADMIN,
        )


def test_migrate_physical_packs_to_dataset() -> None:
    _seed_physical_equipment()
    standard_repo.save_pack(
        "equipment-overview",
        {
            "packKey": "equipment-overview",
            "displayName": "设备标准分析",
            "businessObjectCode": "equipment",
            "physicalTableFqn": _EQUIPMENT_FQN,
            "dataSourceId": str(_DS_ID),
            "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
            "enabledThemes": ["lifecycle"],
            "allowedRoles": ["analyst", "admin"],
            "snapshotCronPreset": "daily",
            "snapshotRetentionPeriods": 12,
        },
    )

    migrated = migrate_physical_packs_to_dataset()

    assert migrated == 1
    pack = standard_repo.get_pack("equipment-overview")
    assert pack is not None
    assert pack["datasetId"] == "std-pack-equipment-overview"
    assert pack.get("boundConfigId")
    assert not pack.get("physicalTableFqn")
    assert not pack.get("businessObjectCode")
