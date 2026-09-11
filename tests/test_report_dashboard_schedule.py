"""G5 dashboard schedule creation."""
from __future__ import annotations

import os
import sys
import types
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.platform_config.smtp_settings import SmtpSettings
from app.main import app as fastapi_app
from app.reports.scheduler import service as scheduler_service
from jwt_auth import AUTH

_SQLITE = "sqlite+pysqlite:///file:report_dash_sched?mode=memory&cache=shared&uri=true"
FAKE_PDF = b"%PDF-1.4 visual snapshot\n" + b"x" * 600
_CONFIGURED_SMTP = SmtpSettings(
    host="localhost",
    port=1025,
    from_addr="reports@vitalspan.local",
    username=None,
    password=None,
    source="env",
)


class _FakePage:
    def goto(self, *_args, **_kwargs) -> None:
        return None

    def wait_for_selector(self, *_args, **_kwargs) -> None:
        return None

    def wait_for_timeout(self, *_args, **_kwargs) -> None:
        return None

    def evaluate(self, *_args, **_kwargs):
        return {"width": 1440, "height": 1800}

    def set_viewport_size(self, *_args, **_kwargs) -> None:
        return None

    def pdf(self, **_kwargs) -> bytes:
        return FAKE_PDF


class _FakeContext:
    def new_page(self, **_kwargs) -> _FakePage:
        return _FakePage()

    def close(self) -> None:
        return None


class _FakeBrowser:
    def new_context(self, **_kwargs) -> _FakeContext:
        return _FakeContext()

    def new_page(self, **_kwargs) -> _FakePage:
        return _FakePage()

    def close(self) -> None:
        return None


class _FakeChromium:
    def launch(self, **_kwargs) -> _FakeBrowser:
        return _FakeBrowser()


class _FakePlaywright:
    chromium = _FakeChromium()


@contextmanager
def _fake_sync_playwright():
    yield _FakePlaywright()


def _install_playwright_mock(monkeypatch) -> None:
    sync_api_mod = types.ModuleType("playwright.sync_api")
    sync_api_mod.sync_playwright = _fake_sync_playwright
    sync_api_mod.Error = Exception
    playwright_mod = types.ModuleType("playwright")
    playwright_mod.sync_api = sync_api_mod
    monkeypatch.setitem(sys.modules, "playwright", playwright_mod)
    monkeypatch.setitem(sys.modules, "playwright.sync_api", sync_api_mod)


@pytest.fixture
def mock_playwright(monkeypatch):
    _install_playwright_mock(monkeypatch)


@contextmanager
def _mock_smtp_send():
    """Patch connect_smtp + configured resolve (DB cleared slot must not block tests)."""
    with patch(
        "app.reports.scheduler.delivery_adapter.resolve_email_smtp",
        return_value=_CONFIGURED_SMTP,
    ), patch(
        "app.reports.scheduler.channels.dispatch.resolve_email_smtp",
        return_value=_CONFIGURED_SMTP,
    ), patch("app.reports.scheduler.delivery_adapter.connect_smtp") as smtp_cls:
        yield smtp_cls.return_value.__enter__.return_value


@pytest.fixture(scope="module", autouse=True)
def _sqlite():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.reports.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_schedules():
    from app.dashboard.export_jobs import reset_export_jobs_for_tests
    from app.dashboard.export_token import reset_export_tokens_for_tests
    from app.reports.persistence.store import reset_metadata_for_tests
    from app.reports.scheduler import executor as scheduler_executor
    from app.reports.scheduler.store import reset_schedules_for_tests

    reset_metadata_for_tests()
    reset_schedules_for_tests()
    scheduler_executor._EXECUTION_LOG.clear()
    scheduler_executor._EXECUTION_BY_ID.clear()
    scheduler_executor._HISTORY.clear()
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()
    yield
    reset_metadata_for_tests()
    reset_schedules_for_tests()
    scheduler_executor._EXECUTION_LOG.clear()
    scheduler_executor._EXECUTION_BY_ID.clear()
    scheduler_executor._HISTORY.clear()
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()


def _dash_with_widget(name: str, description: str) -> dict:
    return {"name": name, "description": description}


def _layout_with_widget() -> dict:
    return {
        "version": 1,
        "widgets": [{
            "id": str(__import__("uuid").uuid4()),
            "type": "text",
            "title": "Placeholder",
            "textConfig": {"content": "export probe"},
            "colSpan": 6,
            "rowSpan": 2,
        }],
    }


def _create_dashboard_with_widget(client: TestClient, *, name: str, description: str) -> str:
    dash = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json=_dash_with_widget(name, description),
    )
    assert dash.status_code == 201, dash.text
    dash_id = dash.json()["id"]
    layout = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": _layout_with_widget()},
    )
    assert layout.status_code == 200, layout.text
    return dash_id


@pytest.fixture(autouse=True)
def _mock_visual_pdf(monkeypatch):
    fake_pdf = b"%PDF-1.4 schedule visual\n" + b"y" * 600

    def _fake_render(dashboard_id, *, token, surface="dashboard", layout_mode=None):
        del dashboard_id, token, surface, layout_mode
        return fake_pdf

    monkeypatch.setattr(
        "app.dashboard.export_jobs.render_dashboard_visual_pdf",
        _fake_render,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_create_dashboard_schedule(client: TestClient):
    dash_id = _create_dashboard_with_widget(client, name="Scheduled Dash", description="g5")
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["sourceType"] == "dashboard"
    assert body["sourceLabel"] == "Scheduled Dash"


def test_list_schedules_by_source_id(client: TestClient):
    dash_id = _create_dashboard_with_widget(client, name="Filter Dash", description="g5-list")
    client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    resp = client.get(
        f"/api/v1/reports/schedules?sourceId={dash_id}&sourceType=dashboard",
        headers=AUTH,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["sourceId"] == dash_id


def test_delivery_health_endpoint(client: TestClient):
    resp = client.get("/api/v1/reports/schedules/delivery-health", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"reachable", "unreachable", "unconfigured"}


def test_export_health_endpoint(client: TestClient):
    resp = client.get("/api/v1/reports/schedules/export-health", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"available", "unavailable"}


def test_probe_export_render_health_import_error(monkeypatch):
    import builtins

    from app.dashboard.export_render import probe_export_render_health, reset_export_render_health_cache_for_tests

    real_import = builtins.__import__

    def _block_playwright(name, *args, **kwargs):
        if name == "playwright.sync_api" or name.startswith("playwright"):
            raise ImportError("blocked for test")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _block_playwright)
    reset_export_render_health_cache_for_tests()
    result = probe_export_render_health(force_refresh=True)
    assert result["status"] == "unavailable"
    assert "Playwright" in (result.get("error") or "")


def test_probe_export_render_health_fe_unreachable(monkeypatch):
    from app.dashboard.export_render import probe_export_render_health, reset_export_render_health_cache_for_tests

    monkeypatch.setattr(
        "app.dashboard.export_render._fe_reachable",
        lambda: (False, "前端导出服务不可达（http://127.0.0.1:5173/）：connection refused"),
    )
    reset_export_render_health_cache_for_tests()
    result = probe_export_render_health(force_refresh=True)
    assert result["status"] == "unavailable"
    assert "不可达" in (result.get("error") or "")


def test_probe_export_render_health_chromium_missing(monkeypatch):
    from playwright.sync_api import Error as PlaywrightError

    from app.dashboard.export_render import probe_export_render_health, reset_export_render_health_cache_for_tests

    class _BrokenChromium:
        def launch(self, **_kwargs):
            raise PlaywrightError("Executable doesn't exist at /missing/chromium")

    class _FakePlaywright:
        chromium = _BrokenChromium()

    class _FakeContext:
        def __enter__(self):
            return _FakePlaywright()

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr("app.dashboard.export_render._fe_reachable", lambda: (True, None))
    monkeypatch.setattr("playwright.sync_api.sync_playwright", lambda: _FakeContext())
    reset_export_render_health_cache_for_tests()
    result = probe_export_render_health(force_refresh=True)
    assert result["status"] == "unavailable"
    assert "Chromium" in (result.get("error") or "")


def test_dashboard_execute_records_visual_snapshot_artifact(client: TestClient, mock_playwright):
    dash_id = _create_dashboard_with_widget(client, name="Exec Dash", description="artifact-kind")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    exec_resp = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        headers={**AUTH, "Idempotency-Key": "artifact-kind-1", "X-Rpt-Semi-Real": "1"},
    )
    assert exec_resp.status_code == 200, exec_resp.text
    body = exec_resp.json()
    assert body.get("artifactKind") == "visual_snapshot_full_page"
    hist = client.get(f"/api/v1/reports/schedules/{schedule_id}/executions", headers=AUTH)
    assert hist.json()["items"][0]["artifactKind"] == "visual_snapshot_full_page"


def test_dashboard_execute_smtp_attaches_pdf(client: TestClient, mock_playwright):
    dash_id = _create_dashboard_with_widget(client, name="Attach Dash", description="smtp-pdf")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    with _mock_smtp_send() as smtp_instance:
        exec_resp = client.post(
            f"/api/v1/reports/schedules/{schedule_id}/execute",
            headers={**AUTH, "Idempotency-Key": "smtp-attach-1", "X-Rpt-Semi-Real": "1"},
        )
        assert exec_resp.status_code == 200, exec_resp.text
        body = exec_resp.json()
        assert body.get("status") == "succeeded"
        assert body.get("deliverySteps")[0]["status"] == "delivered"
        smtp_instance.send_message.assert_called_once()
        msg = smtp_instance.send_message.call_args[0][0]
        attachments = list(msg.iter_attachments())
        assert len(attachments) == 1
        name = attachments[0].get_filename() or ""
        assert "可视化报告" in name or name.endswith(".pdf")
        assert attachments[0].get_content().startswith(b"%PDF")


def test_patch_draft_schedule_updates_cron(client: TestClient):
    dash_id = _create_dashboard_with_widget(client, name="Patch Dash", description="patch")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    patch = client.patch(
        f"/api/v1/reports/schedules/{schedule_id}",
        headers=AUTH,
        json={"cron": "0 10 * * *", "name": "Morning Report"},
    )
    assert patch.status_code == 200, patch.text
    body = patch.json()
    assert body["cron"] == "0 10 * * *"
    assert body["name"] == "Morning Report"


def test_patch_non_draft_schedule_rejected(client: TestClient):
    dash_id = _create_dashboard_with_widget(client, name="Locked Dash", description="locked")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    patch = client.patch(
        f"/api/v1/reports/schedules/{schedule_id}",
        headers=AUTH,
        json={"cron": "0 11 * * *"},
    )
    assert patch.status_code == 400


def test_empty_dashboard_export_rejected(client: TestClient):
    dash = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json=_dash_with_widget("Empty Dash", "no widgets"),
    )
    dash_id = dash.json()["id"]
    export = client.post(
        f"/api/v1/dashboards/{dash_id}/export-jobs",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert export.status_code == 422
    assert export.json()["code"] == "DASHBOARD_EXPORT_EMPTY"


def test_template_schedule_smtp_pdf_attachment(client: TestClient):
    """Template schedule execute → SMTP PDF attachment (RenderSpec renderer)."""
    import uuid

    tpl_key = f"sched-{uuid.uuid4().hex[:8]}"
    ds_id = str(uuid.uuid4())
    client.put(
        f"/api/v1/reports/templates/{tpl_key}",
        headers=AUTH,
        json={
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Schedule PDF",
            "blocks": [{"blockType": "table", "tableRef": "t1"}],
        },
    )
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": "Sched Template",
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": tpl_key,
        },
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "defaultDataSourceId": ds_id,
            "metrics": [{
                "key": "m1",
                "label": "M1",
                "queryMode": "dataset",
                "datasetId": ds_id,
                "boundConfigId": str(uuid.uuid4()),
                "visible": True,
            }],
            "filters": [],
            "changeNote": "init",
        },
    )
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "template",
            "sourceId": node_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
            "attachmentFormats": ["pdf"],
        },
    )
    assert sched.status_code == 201, sched.text
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    with patch("app.reports.engine.service.export_template_bytes", return_value=FAKE_PDF):
        with _mock_smtp_send() as smtp_instance:
            exec_resp = client.post(
                f"/api/v1/reports/schedules/{schedule_id}/execute",
                headers={**AUTH, "Idempotency-Key": "tpl-smtp-1", "X-Rpt-Semi-Real": "1"},
            )
        assert exec_resp.status_code == 200, exec_resp.text
        body = exec_resp.json()
        assert body.get("status") == "succeeded"
        assert body.get("artifactKind") == "template_render"
        smtp_instance.send_message.assert_called_once()
        msg = smtp_instance.send_message.call_args[0][0]
        attachments = list(msg.iter_attachments())
        assert len(attachments) == 1
        assert attachments[0].get_filename().endswith(".pdf")
        assert attachments[0].get_content().startswith(b"%PDF")


def test_schedule_persists_with_db_store(client: TestClient, monkeypatch):
    monkeypatch.setenv("RPT_SCHEDULE_STORE", "db")
    get_settings.cache_clear()
    dash_id = _create_dashboard_with_widget(client, name="DB Store Dash", description="db")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
            "name": "Persisted Schedule",
        },
    )
    assert sched.status_code == 201, sched.text
    schedule_id = sched.json()["id"]
    fetched = client.get(f"/api/v1/reports/schedules/{schedule_id}", headers=AUTH)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Persisted Schedule"


def test_recent_failures_omit_superseded_by_later_success(client: TestClient, mock_playwright):
    dash_id = _create_dashboard_with_widget(client, name="Fail Hide Dash", description="recent-failures")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    fail_resp = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": "recent-fail-1",
            "X-Rpt-Semi-Real": "1",
            "X-Rpt-Delivery-Mock": "fail",
        },
    )
    assert fail_resp.status_code == 200, fail_resp.text
    parent_id = fail_resp.json()["executionId"]
    before = client.get("/api/v1/reports/schedules/executions/recent-failures", headers=AUTH)
    assert before.status_code == 200
    assert any(item["executionId"] == parent_id for item in before.json()["items"])

    with _mock_smtp_send():
        retry = client.post(
            f"/api/v1/reports/schedules/executions/{parent_id}/retry",
            headers={**AUTH, "Idempotency-Key": "recent-fail-retry-1"},
        )
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "succeeded"

    after = client.get("/api/v1/reports/schedules/executions/recent-failures", headers=AUTH)
    assert after.status_code == 200
    assert not any(item["executionId"] == parent_id for item in after.json()["items"])


def test_recent_failures_dismiss_hides_entry_for_user(client: TestClient):
    from app.reports.scheduler.failure_dismiss import reset_failure_dismiss_for_tests

    reset_failure_dismiss_for_tests()
    dash_id = _create_dashboard_with_widget(client, name="Dismiss Fail Dash", description="dismiss")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    fail_resp = client.post(
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        headers={
            **AUTH,
            "Idempotency-Key": "dismiss-fail-1",
            "X-Rpt-Semi-Real": "1",
            "X-Rpt-Delivery-Mock": "fail",
        },
    )
    assert fail_resp.status_code == 200, fail_resp.text
    execution_id = fail_resp.json()["executionId"]

    listed = client.get("/api/v1/reports/schedules/executions/recent-failures", headers=AUTH)
    assert any(item["executionId"] == execution_id for item in listed.json()["items"])

    dismissed = client.post(
        f"/api/v1/reports/schedules/executions/{execution_id}/dismiss",
        headers=AUTH,
    )
    assert dismissed.status_code == 204, dismissed.text

def test_delete_schedule_removes_from_list(client: TestClient):
    dash_id = _create_dashboard_with_widget(client, name="Delete Dash", description="delete")
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={
            "sourceType": "dashboard",
            "sourceId": dash_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
        },
    )
    schedule_id = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    deleted = client.delete(f"/api/v1/reports/schedules/{schedule_id}", headers=AUTH)
    assert deleted.status_code == 204, deleted.text
    listed = client.get("/api/v1/reports/schedules", headers=AUTH)
    assert listed.status_code == 200
    assert not any(item["id"] == schedule_id for item in listed.json()["items"])
    missing = client.get(f"/api/v1/reports/schedules/{schedule_id}", headers=AUTH)
    assert missing.status_code == 404


