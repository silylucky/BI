"""Standard analysis schedule + delivery — RPT-002 / RPT-005."""
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
from app.reports.scheduler.store import reset_schedules_for_tests
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:standard_schedule?mode=memory&cache=shared&uri=true"
_EQUIPMENT_FQN = "ops.equipment"
_DS_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
_PACK_KEY = "equipment-overview"


@pytest.fixture(scope="module", autouse=True)
def _sqlite_env():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    os.environ["RPT_METADATA_STORE"] = "memory"
    os.environ["RPT_SCHEDULE_STORE"] = "memory"
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

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
    os.environ.pop("RPT_SCHEDULE_STORE", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_stores():
    memory_stores.clear_all()
    reset_schedules_for_tests()
    yield
    memory_stores.clear_all()
    reset_schedules_for_tests()


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


def _pack_payload() -> dict:
    return {
        "packKey": _PACK_KEY,
        "displayName": "设备标准分析",
        "datasetId": f"std-pack-{_PACK_KEY}",
        "boundConfigId": str(uuid.uuid4()),
        "dataSourceId": str(_DS_ID),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle", "distribution"],
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


def _pack_payload_lifecycle_only() -> dict:
    payload = _pack_payload()
    payload["enabledThemes"] = ["lifecycle"]
    return payload


def _create_standard_schedule(client: TestClient) -> str:
    created = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "standard",
            "sourceKey": _PACK_KEY,
            "cron": "0 8 * * *",
            "timezone": "Asia/Shanghai",
            "recipients": [{"type": "role", "value": "admin"}],
            "deliveryChannels": ["email"],
            "attachmentFormats": ["pdf"],
        },
    )
    assert created.status_code == 201, created.text
    schedule_id = created.json()["id"]
    activated = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    assert activated.status_code == 200, activated.text
    return schedule_id


def test_standard_schedule_requires_source_key(client: TestClient):
    _seed_physical_equipment()
    client.put(f"/api/v1/reports/standard/packs/{_PACK_KEY}", headers=AUTH, json=_pack_payload())
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "standard",
            "cron": "0 8 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    assert resp.status_code == 422


def test_standard_schedule_list_by_source_key(client: TestClient):
    _seed_physical_equipment()
    client.put(f"/api/v1/reports/standard/packs/{_PACK_KEY}", headers=AUTH, json=_pack_payload())
    schedule_id = _create_standard_schedule(client)
    listed = client.get(
        f"/api/v1/reports/schedules?sourceType=standard&sourceKey={_PACK_KEY}",
        headers=AUTH,
    )
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] >= 1
    assert any(item["id"] == schedule_id for item in body["items"])
    assert body["items"][0]["sourceKey"] == _PACK_KEY
    assert body["items"][0]["sourceLabel"] == "设备标准分析"


@patch("app.reports.scheduler.standard_export.export_standard_attachments")
def test_standard_schedule_execute_with_mock_delivery(mock_export, client: TestClient):
    _seed_physical_equipment()
    client.put(f"/api/v1/reports/standard/packs/{_PACK_KEY}", headers=AUTH, json=_pack_payload())
    mock_export.return_value = (
        "semi://reports/standard/equipment-overview/test",
        "standard_render",
        [(b"%PDF-1.4 test", "application/pdf", f"standard-{_PACK_KEY}.pdf")],
        None,
    )
    schedule_id = _create_standard_schedule(client)
    executed = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": "std-schedule-1",
            "X-Rpt-Semi-Real": "1",
            "X-Rpt-Delivery-Mock": "success",
        },
    )
    assert executed.status_code == 200, executed.text
    body = executed.json()
    assert body["artifactKind"] == "standard_render"
    assert body["deliverySteps"]
    assert body["deliverySteps"][0]["status"] == "delivered"

    history = client.get(f"/api/v1/reports/schedules/{schedule_id}/executions", headers=AUTH)
    assert history.status_code == 200
    assert history.json()["total"] >= 1


@patch("app.reports.standard.dataset_binding.ensure_analysis_pack_dataset_binding")
@patch("app.reports.standard.service.engine_execute.execute_dataset_section")
def test_export_standard_attachments_pdf_bytes(mock_section, mock_binding, client: TestClient):
    """DG3: non-mock export returns real PDF bytes."""
    from app.reports.scheduler.standard_export import export_standard_attachments

    mock_binding.return_value = uuid.uuid4()
    _seed_physical_equipment()
    client.put(f"/api/v1/reports/standard/packs/{_PACK_KEY}", headers=AUTH, json=_pack_payload_lifecycle_only())
    mock_section.return_value = {
        "columns": ["status", "cnt"],
        "rows": [["active", 3]],
        "elapsedMs": 1.0,
    }
    actor = UserContext(id="1", username="admin", roles=["admin"])
    _ref, kind, attachments, export_error = export_standard_attachments(_PACK_KEY, ["pdf"], actor)
    assert export_error is None
    assert kind == "standard_render"
    assert attachments
    pdf_bytes = attachments[0][0]
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


@patch("app.reports.standard.dataset_binding.ensure_analysis_pack_dataset_binding")
@patch("app.reports.standard.service.engine_execute.execute_dataset_section")
def test_standard_schedule_execute_no_fake_deliver_without_delivery_mock(
    mock_section,
    mock_binding,
    client: TestClient,
):
    """DG5: without X-Rpt-Delivery-Mock, standard schedule must not report delivered."""
    mock_binding.return_value = uuid.uuid4()
    _seed_physical_equipment()
    client.put(f"/api/v1/reports/standard/packs/{_PACK_KEY}", headers=AUTH, json=_pack_payload_lifecycle_only())
    mock_section.return_value = {
        "columns": ["status", "cnt"],
        "rows": [["active", 3]],
        "elapsedMs": 1.0,
    }
    schedule_id = _create_standard_schedule(client)
    executed = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": "std-schedule-unconfigured",
            "X-Rpt-Semi-Real": "1",
        },
    )
    assert executed.status_code == 200, executed.text
    body = executed.json()
    assert body["status"] != "semi_real_succeeded"
    assert body["status"] in {"failed", "delivery_degraded", "semi_real_failed", "semi_real_delivery_degraded"}
    assert body.get("errorMessage")
    steps = body.get("deliverySteps", [])
    assert steps
    assert all(step.get("status") != "delivered" for step in steps)
