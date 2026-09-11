"""Standard analysis packs — RPT-002 replacement."""
from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.metadata.entity import service as entity_service
from app.metadata.entity.schemas import EntityTypeCreate
from app.metadata.physical import service as physical_service
from app.metadata.physical.schemas import PhysicalTableRegisterIn
from app.reports.persistence import memory_stores
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:standard_analysis?mode=memory&cache=shared&uri=true"
_EQUIPMENT_FQN = "ops.equipment"
_DS_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


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
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_stores():
    from app.metadata.dataset import service as dataset_service
    from app.reports.persistence.store import reset_metadata_for_tests

    memory_stores.clear_all()
    reset_metadata_for_tests()
    dataset_service._store.clear()
    yield
    memory_stores.clear_all()
    reset_metadata_for_tests()
    dataset_service._store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


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
            UserContext(id="1", username="admin", roles=["admin"]),
        )


def _pack_payload(key: str = "equipment-overview") -> dict:
    return {
        "packKey": key,
        "displayName": "设备标准分析",
        "datasetId": f"std-pack-{key}",
        "boundConfigId": str(uuid.uuid4()),
        "dataSourceId": str(_DS_ID),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle", "distribution", "trend"],
        "allowedRoles": ["analyst", "admin"],
        "snapshotCronPreset": "daily",
    }


@pytest.fixture(autouse=True)
def _mock_pack_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.reports.standard.service._load_pack_columns",
        lambda _pack: [
            {"name": "status"},
            {"name": "region"},
            {"name": "created_at"},
        ],
    )


def _mock_dataset_section() -> dict:
    return {
        "columns": ["status", "region", "created_at"],
        "rows": [
            ["active", "east", "2024-01-01"],
            ["idle", "west", "2024-01-02"],
        ],
        "elapsedMs": 1.0,
    }


@patch("app.reports.standard.dataset_binding.ensure_analysis_pack_dataset_binding")
@patch("app.reports.standard.service.engine_execute.execute_dataset_section")
def test_std_pack_upsert_and_run(mock_execute, mock_binding, client: TestClient):
    mock_binding.return_value = uuid.uuid4()
    _seed_physical_equipment()
    put = client.put(
        "/api/v1/reports/standard/packs/equipment-overview",
        headers=AUTH,
        json=_pack_payload(),
    )
    assert put.status_code == 200, put.text
    mock_execute.return_value = _mock_dataset_section()
    run = client.post(
        "/api/v1/reports/standard/packs/equipment-overview/run",
        headers=AUTH,
        json={"theme": "lifecycle"},
    )
    assert run.status_code == 200
    assert "dim" in run.json()["renderSpec"]["sections"][0]["columns"]


def test_std_seed_builtin(client: TestClient):
    from app.reports.standard.seed import seed_builtin_analysis_pack

    _seed_physical_equipment()
    assert seed_builtin_analysis_pack() == 1
    listed = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1


def test_std_not_found_404(client: TestClient):
    resp = client.post(
        "/api/v1/reports/standard/packs/missing-key/run",
        headers=AUTH,
        json={"theme": "lifecycle"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_STD_NOT_FOUND"


@patch("app.reports.standard.dataset_binding.ensure_analysis_pack_dataset_binding")
@patch("app.reports.standard.service.engine_execute.execute_dataset_section")
def test_std_compare(mock_execute, mock_binding, client: TestClient):
    mock_binding.return_value = uuid.uuid4()
    _seed_physical_equipment()
    client.put("/api/v1/reports/standard/packs/equipment-overview", headers=AUTH, json=_pack_payload())
    mock_execute.return_value = _mock_dataset_section()
    compare = client.get(
        "/api/v1/reports/standard/packs/equipment-overview/compare?theme=distribution",
        headers=AUTH,
    )
    assert compare.status_code == 200
    assert compare.json()["currentPeriodKey"]


def test_std_viewer_cannot_upsert(client: TestClient):
    _seed_physical_equipment()
    async def _viewer() -> UserContext:
        return UserContext(id="viewer", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.put(
            "/api/v1/reports/standard/packs/test-pack",
            headers=AUTH,
            json=_pack_payload("test-pack"),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] in {"RPT_STD_FORBIDDEN", "PERMISSION_DENIED"}
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def _seed_dataset_with_binding(client: TestClient) -> tuple[str, str]:
    ds_id = "equipment-dataset"
    data_source_id = str(_DS_ID)
    assert client.post(
        "/api/v1/datasets",
        headers=AUTH,
        json={"datasetId": ds_id, "displayName": "设备数据集", "tables": [{"name": "ops.equipment"}]},
    ).status_code == 201
    cfg = client.put(
        "/api/v1/query/configs",
        headers=AUTH,
        json={
            "configType": "dataset_query",
            "schemaVersion": "1.0",
            "refType": "dataset",
            "refId": str(uuid.uuid4()),
            "payload": {
                "dataSourceId": data_source_id,
                "connectorType": "mysql",
                "schema": "ops",
                "table": "equipment",
                "columns": ["status", "region", "created_at"],
                "conditions": {"logic": "AND", "conditions": []},
                "limit": 1000,
                "offset": 0,
            },
        },
    ).json()
    bound_config_id = cfg["id"]
    assert client.post(
        f"/api/v1/datasets/{ds_id}/bind-query-config",
        headers=AUTH,
        json={"configId": bound_config_id},
    ).status_code == 200
    return ds_id, bound_config_id


def _dataset_pack_payload(ds_id: str, bound_config_id: str, key: str = "equipment-dataset-pack") -> dict:
    return {
        "packKey": key,
        "displayName": "设备数据集分析",
        "datasetId": ds_id,
        "boundConfigId": bound_config_id,
        "dataSourceId": str(_DS_ID),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle", "distribution", "trend"],
        "allowedRoles": ["analyst", "admin"],
        "snapshotCronPreset": "daily",
    }


@patch("app.reports.standard.service.engine_execute.execute_dataset_section")
def test_std_pack_dataset_binding_upsert_and_run(mock_execute, client: TestClient):
    ds_id, bound_config_id = _seed_dataset_with_binding(client)
    put = client.put(
        "/api/v1/reports/standard/packs/equipment-dataset-pack",
        headers=AUTH,
        json=_dataset_pack_payload(ds_id, bound_config_id),
    )
    assert put.status_code == 200, put.text
    caps = client.get("/api/v1/reports/standard/packs/equipment-dataset-pack/capabilities", headers=AUTH)
    assert caps.status_code == 200
    assert "status" in caps.json()["columns"]
    mock_execute.return_value = _mock_dataset_section()
    run = client.post(
        "/api/v1/reports/standard/packs/equipment-dataset-pack/run",
        headers=AUTH,
        json={"theme": "lifecycle"},
    )
    assert run.status_code == 200
    assert "dim" in run.json()["renderSpec"]["sections"][0]["columns"]


def test_snapshot_retention_prunes_old_periods():
    from app.reports.persistence import standard_repo

    pack_key = "retention-pack"
    theme = "lifecycle"
    kind = "daily"
    for day in range(1, 16):
        standard_repo.upsert_snapshot(
            pack_key,
            theme,
            kind,
            f"2026-08-{day:02d}",
            {"columns": [], "rows": []},
        )
    deleted = standard_repo.prune_snapshots(pack_key, theme, kind, 12)
    assert deleted == 3
    remaining = standard_repo.list_snapshots(pack_key, theme=theme)
    assert len(remaining) == 12
    keys = sorted(s["periodKey"] for s in remaining)
    assert keys[0] == "2026-08-04"
    assert keys[-1] == "2026-08-15"


def test_pack_snapshot_retention_periods_persisted(client: TestClient):
    ds_id, bound_config_id = _seed_dataset_with_binding(client)
    payload = _dataset_pack_payload(ds_id, bound_config_id, key="retention-pack")
    payload["snapshotRetentionPeriods"] = 6
    put = client.put(
        "/api/v1/reports/standard/packs/retention-pack",
        headers=AUTH,
        json=payload,
    )
    assert put.status_code == 200, put.text
    got = client.get("/api/v1/reports/standard/packs/retention-pack", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["snapshotRetentionPeriods"] == 6
