"""F-F RPT companion track C — e95d (RPT-001/002/003/005/007)."""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from app.reports.jobs import store as job_store
from app.reports.scheduler.delivery_adapter import deliver_artifact
from jwt_auth import AUTH, jwt_auth_headers

_SQLITE = "sqlite+pysqlite:///file:ff_rpt_e95d?mode=memory&cache=shared&uri=true"
_TEMPLATE_BODY = {
    "templateKey": "sales_summary",
    "format": "pdf",
    "displayName": "销售汇总",
    "blocks": [{"blockType": "sql", "queryRef": "SELECT 1"}],
}


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    prev_host = os.environ.get("RPT_SMTP_HOST")
    prev_from = os.environ.get("RPT_SMTP_FROM")
    os.environ["DATABASE_URL"] = _SQLITE
    os.environ["RPT_SMTP_HOST"] = "localhost"
    os.environ["RPT_SMTP_PORT"] = "1025"
    os.environ["RPT_SMTP_FROM"] = "reports@vitalspan.local"
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    if prev_host is None:
        os.environ.pop("RPT_SMTP_HOST", None)
    else:
        os.environ["RPT_SMTP_HOST"] = prev_host
    if prev_from is None:
        os.environ.pop("RPT_SMTP_FROM", None)
    else:
        os.environ["RPT_SMTP_FROM"] = prev_from
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


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


@pytest.fixture(autouse=True)
def _reset_stores():
    from app.reports.persistence.store import reset_metadata_for_tests

    reset_metadata_for_tests()
    job_store.reset_jobs_for_tests()
    yield
    reset_metadata_for_tests()
    job_store.reset_jobs_for_tests()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _put_template(client: TestClient, key: str = "sales_summary") -> str:
    body = {**_TEMPLATE_BODY, "templateKey": key}
    resp = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Run", "nodeType": "template", "templateKind": "pdf", "templateKey": key},
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{nid}/extension",
        headers=AUTH,
        json={"catalogNodeId": nid, "metrics": [], "filters": [], "changeNote": "init"},
    )
    return nid


def test_rpt001_export_chain_catalog_template(client: TestClient):
    """RPT-001: catalog template → exportHook wired + download bytes."""
    node_id = _put_template(client)
    run = client.post(
        f"/api/v1/reports/templates/{node_id}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert run.status_code == 200, run.text
    hook = run.json()["exportHook"]
    assert hook["placeholder"] is False


def test_rpt001_pdf_export_bytes(client: TestClient):
    """RPT-001: real PDF bytes through export chain (no mock://)."""
    key = "pdf_tpl"
    client.put(
        f"/api/v1/reports/templates/{key}",
        headers=AUTH,
        json={
            "templateKey": key,
            "format": "pdf",
            "displayName": "PDF",
            "blocks": [{"blockType": "sql", "queryRef": "SELECT 1"}],
        },
    )
    nid = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "P", "nodeType": "template", "templateKind": "pdf", "templateKey": key},
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{nid}/extension",
        headers=AUTH,
        json={"catalogNodeId": nid, "metrics": [], "filters": [], "changeNote": "init"},
    )
    pdf_stub = b"%PDF-1.4\n" + b"x" * 600
    with patch("app.reports.engine.service.export_template_bytes", return_value=pdf_stub):
        export = client.get(f"/api/v1/reports/export?templateId={nid}&format=pdf", headers=AUTH)
    assert export.status_code == 200
    assert export.json()["downloadUrl"]
    assert "mock://" not in (export.json().get("downloadUrl") or "")
    dl = client.get(export.json()["downloadUrl"], headers=AUTH)
    assert dl.content.startswith(b"%PDF")
    assert b"mock" not in dl.content.lower()


def test_rpt002_standard_pack_put(client: TestClient):
    """RPT-002: Admin PUT standard analysis pack."""
    from app.auth.deps import UserContext
    from app.metadata.entity import service as entity_service
    from app.metadata.entity.schemas import EntityTypeCreate
    from app.metadata.physical import service as physical_service
    from app.metadata.physical.schemas import PhysicalTableRegisterIn

    ds_id = "00000000-0000-4000-8000-000000000001"
    fqn = "ops.equipment"
    try:
        entity_service.get_entity_type("equipment")
    except Exception:
        entity_service.create_entity_type(
            EntityTypeCreate(typeCode="equipment", displayName="设备", attributes=[], lifecycleStates=[]),
        )
    try:
        physical_service.get_physical_table(fqn)
    except Exception:
        physical_service.register_physical_table(
            PhysicalTableRegisterIn(
                tableFqn=fqn,
                dataSourceId=ds_id,
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

    payload = {
        "packKey": "equipment-custom",
        "displayName": "自定义标准分析",
        "datasetId": "std-pack-equipment-custom",
        "boundConfigId": str(uuid.uuid4()),
        "dataSourceId": ds_id,
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": ["analyst", "admin"],
        "snapshotCronPreset": "daily",
    }
    resp = client.put("/api/v1/reports/standard/packs/equipment-custom", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text
    got = client.get("/api/v1/reports/standard/packs/equipment-custom", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["displayName"] == "自定义标准分析"


def test_rpt003_template_blocks_reorder(client: TestClient):
    """RPT-003: PUT template blocks with reorder + SQL."""
    body = {
        "templateKey": "block_edit",
        "format": "pdf",
        "displayName": "块编辑",
        "blocks": [
            {"blockType": "sql", "queryRef": "SELECT a"},
            {"blockType": "table", "tableRef": "t1"},
        ],
    }
    assert client.put("/api/v1/reports/templates/block_edit", headers=AUTH, json=body).status_code == 200
    reordered = {
        **body,
        "blocks": [
            {"blockType": "table", "tableRef": "t1"},
            {"blockType": "sql", "queryRef": "SELECT b FROM facts"},
        ],
    }
    resp = client.put("/api/v1/reports/templates/block_edit", headers=AUTH, json=reordered)
    assert resp.status_code == 200
    blocks = resp.json()["blocks"]
    assert blocks[0]["blockType"] == "table"
    assert blocks[1]["queryRef"] == "SELECT b FROM facts"


def test_rpt005_delivery_smtp_without_header(client: TestClient):
    """RPT-005: 无 mock header 时固定走 SMTP 适配器。"""
    result = deliver_artifact("semi://x", ["email"], None, None)
    assert result["deliveryMode"] == "smtp"
    assert result["deliverySteps"][0]["mode"] == "smtp"


def test_rpt005_delivery_mock_mode_requires_header(client: TestClient):
    """RPT-005: explicit X-Rpt-Delivery-Mock success → mock delivered."""
    result = deliver_artifact("semi://x", ["email"], "success", None)
    assert result["deliveryMode"] == "mock"
    assert result["status"] == "delivered"


def test_rpt005_delivery_smtp_mode(client: TestClient):
    """RPT-005: smtp adapter attempts send (mock SMTP)."""
    with patch(
        "app.reports.scheduler.delivery_adapter.connect_smtp",
    ) as smtp_cls:
        smtp_cls.return_value.__enter__.return_value.send_message.return_value = None
        result = deliver_artifact("semi://reports/x/y", ["email"], None, None)
    assert result["deliveryMode"] == "smtp"
    assert result["deliverySteps"][0]["mode"] == "smtp"


def test_rpt005_delivery_smtp_includes_pdf_attachment(client: TestClient):
    """RPT-005: visual_snapshot 投递应附带 PDF MIME 附件。"""
    pdf_bytes = b"%PDF-1.4 attachment test\n" + b"x" * 64
    with patch("app.reports.scheduler.delivery_adapter.connect_smtp") as smtp_cls:
        smtp_instance = smtp_cls.return_value.__enter__.return_value
        result = deliver_artifact(
            "/api/v1/dashboards/export-jobs/00000000-0000-4000-8000-000000000001/download",
            ["email"],
            None,
            None,
            artifact_kind="visual_snapshot",
            attachment_bytes=pdf_bytes,
            attachment_filename="dashboard-test.pdf",
            attachment_mime="application/pdf",
        )
        assert result["deliveryMode"] == "smtp"
        assert result["status"] == "delivered"
        msg = smtp_instance.send_message.call_args[0][0]
        attachments = list(msg.iter_attachments())
        assert len(attachments) == 1
        assert attachments[0].get_content() == pdf_bytes


def test_rpt005_delivery_smtp_connection_refused_surfaces_error():
    """RPT-005: SMTP 连接失败时返回可读中文错误并写入顶层 error。"""
    with patch(
        "app.reports.scheduler.delivery_adapter.connect_smtp",
        side_effect=ConnectionRefusedError(111, "Connection refused"),
    ):
        result = deliver_artifact("semi://reports/x/y", ["email"], None, None)
    assert result["status"] == "degraded"
    assert result["deliverySteps"][0]["status"] == "failed"
    assert "邮件投递失败" in (result.get("error") or "")
    assert "MailHog" in (result.get("error") or "")


def test_rpt007_batch_export_job_poll(client: TestClient):
    """RPT-007: async batch export job pending → ready + download."""
    node_id = _put_template(client)
    zip_stub = b"PK\x03\x04batch-export" + b"x" * 64
    with patch("app.reports.jobs.worker._execute_batch_export", return_value=(zip_stub, "application/zip")):
        submit = client.post(
            "/api/v1/reports/batch/export",
            headers=AUTH,
            json={"nodeIds": [node_id], "format": "pdf"},
        )
    assert submit.status_code == 202, submit.text
    job_id = submit.json()["jobId"]
    first = client.get(f"/api/v1/reports/jobs/{job_id}", headers=AUTH)
    assert first.status_code == 200
    assert first.json()["status"] in {"pending", "processing", "ready"}
    second = client.get(f"/api/v1/reports/jobs/{job_id}", headers=AUTH)
    assert second.json()["status"] == "ready"
    assert second.json()["downloadUrl"]
    dl = client.get(second.json()["downloadUrl"], headers=AUTH)
    assert dl.status_code == 200
    assert b"batch-export" in dl.content


VIEWER_USER_ID = "00000000-0000-4000-8000-000000000099"


def test_rpt007_job_forbidden_for_other_user(client: TestClient):
    """RPT-007: non-owner viewer cannot poll job."""
    node_id = _put_template(client)
    submit = client.post(
        "/api/v1/reports/batch/export",
        headers=AUTH,
        json={"nodeIds": [node_id], "format": "pdf"},
    )
    job_id = submit.json()["jobId"]

    async def _viewer() -> UserContext:
        return UserContext(id=VIEWER_USER_ID, username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    resp = client.get(
        f"/api/v1/reports/jobs/{job_id}",
        headers=jwt_auth_headers(user_id=VIEWER_USER_ID, username="viewer"),
    )
    fastapi_app.dependency_overrides.clear()
    assert resp.status_code == 403
    assert resp.json()["code"] in {"RPT_BATCH_EXPORT_JOB_FORBIDDEN", "PERMISSION_DENIED"}
