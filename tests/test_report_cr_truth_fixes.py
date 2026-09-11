"""M-RPT code-reviewer 修复回归。"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext
from app.main import app
from app.reports.engine.errors import ReportEngineError
from app.reports.errors import ReportExtensionError
from app.reports.engine.schemas import RenderRunIn
from app.reports.engine import service as engine_service
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleRecipientIn
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.store import reset_schedules_for_tests


@pytest.fixture()
def admin() -> UserContext:
    return UserContext(id="u-admin", username="admin", roles=["admin"])


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_seed_demo_forbidden_in_production(client: TestClient, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch) -> None:
    mock_settings = MagicMock()
    mock_settings.vitalspan_env = "production"
    monkeypatch.setattr("app.api.v1.reports.center.get_settings", lambda: mock_settings)
    resp = client.post(
        "/api/v1/reports/center/seed-demo",
        headers=auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_SEED_DEMO_FORBIDDEN"


def test_run_template_empty_when_placeholder_only(admin: UserContext) -> None:
    node_id = uuid.uuid4()
    node = MagicMock()
    node.id = node_id
    node.node_type = "template"
    node.template_kind = None
    node.template_key = None
    with (
        patch("app.reports.engine.service.engine_acl.assert_engine_run_access"),
        patch("app.reports.engine.service.catalog_service.get_node", return_value=node),
        patch(
            "app.reports.engine.service.extension_service.get_extension",
            side_effect=ReportExtensionError("RPT_EXTENSION_NOT_FOUND", "missing", 404),
        ),
        patch(
            "app.reports.engine.service.build_engine_render_spec",
            return_value=engine_service.build_engine_render_spec(node, {}, "web"),
        ),
    ):
        out = engine_service.run_template(node_id, RenderRunIn(format="web"), admin)
    assert out.status == "empty"
    assert out.export_hook is None


def test_export_template_rejects_placeholder(admin: UserContext) -> None:
    node_id = uuid.uuid4()
    empty_run = MagicMock()
    empty_run.render_spec.sections = [{"kind": "table", "placeholder": True}]
    with (
        patch("app.reports.engine.service.run_template", return_value=empty_run),
        pytest.raises(ReportEngineError) as exc,
    ):
        engine_service.export_template_bytes(node_id, "pdf", admin)
    assert exc.value.code == "RPT_ENGINE_EMPTY_TEMPLATE"


def test_standard_schedule_rejects_excel_attachment(admin: UserContext, monkeypatch: pytest.MonkeyPatch) -> None:
    reset_schedules_for_tests()
    mock_settings = MagicMock()
    mock_settings.rpt_schedule_store = "memory"
    monkeypatch.setattr("app.reports.scheduler.store.get_settings", lambda: mock_settings)
    pack = MagicMock()
    pack.pack_key = "equipment-overview"
    with (
        patch("app.reports.scheduler.service.get_pack", return_value=pack),
        patch("app.reports.persistence.standard_repo.get_pack", return_value={"packKey": "equipment-overview"}),
        pytest.raises(ScheduleError) as exc,
    ):
        scheduler_service.create_schedule(
            ScheduleCreate(
                sourceType="standard",
                sourceKey="equipment-overview",
                cron="0 8 * * *",
                recipients=[ScheduleRecipientIn(type="email", value="ops@example.com")],
                attachmentFormats=["excel"],
            ),
            admin,
        )
    assert exc.value.code == "RPT_SCHEDULE_FORMAT_UNSUPPORTED"


def test_smtp_unconfigured_maps_to_unconfigured_status() -> None:
    from app.reports.scheduler.delivery_adapter import deliver_artifact

    smtp = MagicMock()
    smtp.is_configured = False
    with patch("app.reports.scheduler.delivery_adapter.resolve_email_smtp", return_value=smtp):
        out = deliver_artifact("artifact://test", ["email"], None, session=MagicMock())
    assert out["status"] == "unconfigured"
