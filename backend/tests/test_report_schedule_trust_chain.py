"""M-RPT F-A：调度 list/executions 探针 + standard 投递诚实 e2e（memory store）。"""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest

from app.auth.deps import UserContext
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleRecipientIn
from app.reports.scheduler.store import reset_schedules_for_tests


@pytest.fixture()
def admin() -> UserContext:
    return UserContext(id="u-admin", username="admin", roles=["admin"])


@pytest.fixture()
def viewer() -> UserContext:
    return UserContext(id="u-viewer", username="viewer", roles=["viewer"])


@pytest.fixture(autouse=True)
def memory_schedule_store(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_schedules_for_tests()
    mock_settings = MagicMock()
    mock_settings.rpt_schedule_store = "memory"
    monkeypatch.setattr("app.reports.scheduler.store.get_settings", lambda: mock_settings)

    def _repo_get_pack(key: str):
        if key == "equipment-overview":
            return {"packKey": key, "displayName": "设备标准分析"}
        return None

    monkeypatch.setattr("app.reports.persistence.standard_repo.get_pack", _repo_get_pack)


def _standard_pack() -> MagicMock:
    pack = MagicMock()
    pack.pack_key = "equipment-overview"
    pack.display_name = "设备标准分析"
    pack.enabled_themes = ["distribution"]
    return pack


@contextmanager
def _pack_patches():
    pack = _standard_pack()
    repo_row = {"packKey": pack.pack_key, "displayName": pack.display_name}
    with (
        patch("app.reports.scheduler.service.get_pack", return_value=pack),
        patch("app.reports.persistence.standard_repo.get_pack", return_value=repo_row),
    ):
        yield pack


def _create_standard_schedule(actor: UserContext, pack_key: str = "equipment-overview"):
    payload = ScheduleCreate(
        sourceType="standard",
        sourceKey=pack_key,
        name="标准分析定时投递",
        cron="0 8 * * *",
        recipients=[ScheduleRecipientIn(type="email", value="ops@example.com")],
        attachmentFormats=["pdf"],
        deliveryChannels=["email"],
    )
    with _pack_patches():
        return scheduler_service.create_schedule(payload, actor)


def test_schedules_list_probe_returns_empty_page(admin: UserContext) -> None:
    """部署探针：list_schedules 在空库下须成功返回分页结构（防 list 500 回归）。"""
    out = scheduler_service.list_schedules(admin)
    assert out.total == 0
    assert out.items == []


def test_schedule_executions_list_probe(admin: UserContext) -> None:
    """部署探针：executions 列表在空调度下可调用（schedule 存在但无历史）。"""
    from app.reports.scheduler import executor as scheduler_executor

    created = _create_standard_schedule(admin)
    out = scheduler_executor.list_executions(created.id)
    assert out["total"] == 0
    assert out["items"] == []


def test_standard_schedule_missing_pack_rejected(admin: UserContext) -> None:
    from app.reports.standard.errors import StandardAnalysisError, RPT_STD_NOT_FOUND

    payload = ScheduleCreate(
        sourceType="standard",
        sourceKey="missing-pack",
        cron="0 8 * * *",
        recipients=[ScheduleRecipientIn(type="email", value="ops@example.com")],
    )
    with patch(
        "app.reports.scheduler.service.get_pack",
        side_effect=StandardAnalysisError(RPT_STD_NOT_FOUND, "pack not found", 404),
    ):
        with pytest.raises(ScheduleError) as exc:
            scheduler_service.create_schedule(payload, admin)
    assert exc.value.code == "RPT_SCHEDULE_SOURCE_NOT_FOUND"


def test_standard_schedule_e2e_honest_failure_without_smtp(admin: UserContext) -> None:
    """standard create → schedule → execute：无 SMTP 时 semi_real_failed，禁止 mock_succeeded。"""
    from app.reports.scheduler import executor as scheduler_executor

    created = _create_standard_schedule(admin)
    scheduled = scheduler_service.transition_schedule(created.id, "schedule", admin)

    assert scheduled.status == "scheduled"
    assert scheduled.source_type == "standard"
    assert scheduled.source_key == "equipment-overview"

    pdf_bytes = b"%PDF-1.4 test"
    mock_session = MagicMock()
    mock_session_cm = MagicMock()
    mock_session_cm.__enter__.return_value = mock_session
    mock_session_cm.__exit__.return_value = None
    with (
        patch("app.reports.scheduler.standard_export.get_pack", return_value=_standard_pack()),
        patch(
            "app.reports.scheduler.standard_export.run_pack",
            return_value=MagicMock(render_spec={"sections": [{"columns": ["dim", "cnt"], "rows": [["A", 1]]}]}),
        ),
        patch("app.reports.scheduler.standard_export.render_document", return_value=pdf_bytes),
        patch(
            "app.reports.scheduler.executor.resolve_recipient_emails",
            return_value=["ops@example.com"],
        ),
        patch("app.reports.scheduler.executor.get_meta_session", return_value=mock_session_cm),
        patch(
            "app.reports.scheduler.executor.dispatch_artifact",
            return_value={
                "status": "unconfigured",
                "error": "SMTP delivery not configured",
                "deliverySteps": [{
                    "channel": "email",
                    "status": "failed",
                    "attempt": 1,
                    "mode": "smtp",
                    "error": "SMTP delivery not configured",
                    "recipients": ["ops@example.com"],
                }],
            },
        ),
        patch("app.reports.scheduler.executor.register_artifact_owner"),
        patch("app.reports.scheduler.executor._record_delivery_attempts"),
        patch(
            "app.reports.scheduler.executor._persist_execution_artifact",
            return_value=("artifact://test", "storage-key", []),
        ),
    ):
        out = scheduler_executor.semi_real_execute_schedule(
            created.id,
            f"idem-{uuid.uuid4()}",
            admin,
        )

    assert out.status != "mock_succeeded"
    assert out.status in {"failed", "delivery_degraded", "semi_real_failed", "semi_real_delivery_degraded"}
    assert out.error_message
    history = scheduler_executor.list_executions(created.id)
    assert history["total"] >= 1
    assert history["items"][0].get("errorMessage")


def test_viewer_cannot_create_standard_schedule(viewer: UserContext) -> None:
    from app.reports.standard.errors import StandardAnalysisError, RPT_STD_FORBIDDEN

    payload = ScheduleCreate(
        sourceType="standard",
        sourceKey="equipment-overview",
        cron="0 8 * * *",
        recipients=[ScheduleRecipientIn(type="email", value="ops@example.com")],
    )
    with patch(
        "app.reports.scheduler.service.get_pack",
        side_effect=StandardAnalysisError(RPT_STD_FORBIDDEN, "viewer cannot manage", 403),
    ):
        with pytest.raises(ScheduleError) as exc:
            scheduler_service.create_schedule(payload, viewer)
    assert exc.value.status == 403


def test_standard_schedule_smtp_unconfigured_real_delivery_adapter(admin: UserContext) -> None:
    """无 SMTP 时走真实 delivery_adapter，须 semi_real_failed（非 mock dispatch）。"""
    from app.reports.scheduler import executor as scheduler_executor

    created = _create_standard_schedule(admin)
    scheduler_service.transition_schedule(created.id, "schedule", admin)

    pdf_bytes = b"%PDF-1.4 test"
    smtp = MagicMock()
    smtp.is_configured = False
    smtp.from_addr = "noreply@example.com"
    mock_session = MagicMock()
    mock_session_cm = MagicMock()
    mock_session_cm.__enter__.return_value = mock_session
    mock_session_cm.__exit__.return_value = None
    with (
        patch("app.reports.scheduler.standard_export.get_pack", return_value=_standard_pack()),
        patch(
            "app.reports.scheduler.standard_export.run_pack",
            return_value=MagicMock(render_spec={"sections": [{"columns": ["dim", "cnt"], "rows": [["A", 1]]}]}),
        ),
        patch("app.reports.scheduler.standard_export.render_document", return_value=pdf_bytes),
        patch(
            "app.reports.scheduler.executor.resolve_recipient_emails",
            return_value=["ops@example.com"],
        ),
        patch("app.reports.scheduler.executor.get_meta_session", return_value=mock_session_cm),
        patch("app.reports.scheduler.delivery_adapter.resolve_email_smtp", return_value=smtp),
        patch("app.reports.scheduler.executor.register_artifact_owner"),
        patch("app.reports.scheduler.executor._record_delivery_attempts"),
        patch(
            "app.reports.scheduler.executor._persist_execution_artifact",
            return_value=("artifact://test", "storage-key", []),
        ),
    ):
        out = scheduler_executor.semi_real_execute_schedule(
            created.id,
            f"idem-{uuid.uuid4()}",
            admin,
        )

    assert out.status == "failed"
    assert out.error_message
    assert out.delivery_steps
    assert out.delivery_steps[0]["channel"] == "email"
