"""G5 dashboard visual PDF export (Playwright path, mocked in CI)."""
from __future__ import annotations

import sys
import types
import uuid
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.dashboard.export_jobs import reset_export_jobs_for_tests
from app.dashboard.export_token import issue_export_token, reset_export_tokens_for_tests

FAKE_PDF = b"%PDF-1.4 visual snapshot\n" + b"x" * 600


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


@pytest.fixture(autouse=True)
def _reset_export_state():
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()
    yield
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()


@pytest.fixture
def mock_playwright(monkeypatch):
    _install_playwright_mock(monkeypatch)


def test_export_layout_requires_valid_token(client: TestClient, auth_headers: dict) -> None:
    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Export Layout {uuid.uuid4().hex[:6]}"},
    )
    assert created.status_code == 201
    dash_id = created.json()["id"]
    token = issue_export_token(uuid.UUID(dash_id))

    ok = client.get(f"/api/v1/dashboards/{dash_id}/export-layout?token={token}")
    assert ok.status_code == 200
    body = ok.json()
    assert body["id"] == dash_id
    assert "layoutJson" in body

    bad = client.get(f"/api/v1/dashboards/{dash_id}/export-layout?token=invalid")
    assert bad.status_code == 403


def test_submit_pdf_export_returns_visual_snapshot(
    client: TestClient,
    auth_headers: dict,
    mock_playwright,
) -> None:
    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Visual PDF {uuid.uuid4().hex[:6]}"},
    )
    assert created.status_code == 201
    dash_id = created.json()["id"]
    layout = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=auth_headers,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [{
                    "id": str(uuid.uuid4()),
                    "type": "text",
                    "title": "T",
                    "textConfig": {"content": "x"},
                    "colSpan": 6,
                    "rowSpan": 2,
                }],
            },
        },
    )
    assert layout.status_code == 200, layout.text

    job = client.post(
        f"/api/v1/dashboards/{dash_id}/export-jobs",
        headers=auth_headers,
        json={"format": "pdf"},
    )
    assert job.status_code == 201, job.text
    body = job.json()
    assert body["status"] == "ready"
    assert body["artifactKind"] == "visual_snapshot_full_page"

    download = client.get(body["downloadUrl"], headers=auth_headers)
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")
    assert b"LAYOUT INVENTORY PREVIEW" not in download.content[:4096]


def test_full_page_pdf_options_scale_when_too_tall() -> None:
    from app.dashboard.export_render import MAX_PDF_PAGE_HEIGHT_PX, _full_page_pdf_options

    class _TallPage:
        def evaluate(self, *_args, **_kwargs):
            return {"width": 1920, "height": MAX_PDF_PAGE_HEIGHT_PX + 2000}

    opts = _full_page_pdf_options(_TallPage())
    assert opts["height"] == f"{MAX_PDF_PAGE_HEIGHT_PX}px"
    assert opts["scale"] < 1.0
    assert opts["margin"]["top"] == "0"


def test_render_rejects_inventory_leak(monkeypatch) -> None:
    from app.dashboard import service as dash_service
    from app.dashboard.export_render import render_dashboard_visual_pdf

    inventory_pdf = b"LAYOUT INVENTORY PREVIEW\n" + b"x" * 600

    class _InventoryPage(_FakePage):
        def pdf(self, **_kwargs) -> bytes:
            return inventory_pdf

    class _InventoryContext(_FakeContext):
        def new_page(self, **_kwargs) -> _InventoryPage:
            return _InventoryPage()

    class _InventoryBrowser(_FakeBrowser):
        def new_context(self, **_kwargs) -> _InventoryContext:
            return _InventoryContext()

    class _InventoryChromium(_FakeChromium):
        def launch(self, **_kwargs) -> _InventoryBrowser:
            return _InventoryBrowser()

    @contextmanager
    def _inventory_playwright():
        fake = _FakePlaywright()
        fake.chromium = _InventoryChromium()
        yield fake

    sync_api_mod = types.ModuleType("playwright.sync_api")
    sync_api_mod.sync_playwright = _inventory_playwright
    sync_api_mod.Error = Exception
    monkeypatch.setitem(sys.modules, "playwright", types.ModuleType("playwright"))
    monkeypatch.setitem(sys.modules, "playwright.sync_api", sync_api_mod)

    dash_id = uuid.uuid4()
    token = issue_export_token(dash_id)
    with pytest.raises(dash_service.DashboardError) as exc:
        render_dashboard_visual_pdf(dash_id, token=token)
    assert exc.value.code == "DASH_EXPORT_RENDER_INVENTORY_LEAK"


def test_export_actor_bypasses_owned_query_config_acl() -> None:
    from types import SimpleNamespace

    from app.dashboard.export_snapshot import _export_actor
    from app.query.config_store.access import assert_config_readable

    actor = _export_actor()
    assert actor.is_root is True
    record = SimpleNamespace(owner_id=uuid.uuid4())
    assert_config_readable(actor, record)


def test_export_query_requires_token(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/dashboards/export-query/execute",
        json={"mode": "sql", "dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1"},
    )
    assert resp.status_code == 401


def test_export_query_rejects_invalid_token(client: TestClient, auth_headers: dict) -> None:
    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Export Query {uuid.uuid4().hex[:6]}"},
    )
    assert created.status_code == 201
    dash_id = created.json()["id"]
    resp = client.post(
        "/api/v1/dashboards/export-query/execute",
        headers={
            "X-Export-Token": "invalid-token",
            "X-Export-Dashboard-Id": dash_id,
        },
        json={"mode": "sql", "dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1"},
    )
    assert resp.status_code == 403


def test_export_query_accepts_valid_token(client: TestClient, auth_headers: dict, monkeypatch) -> None:
    from app.query.schemas import ExecuteResponse

    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Export Query OK {uuid.uuid4().hex[:6]}"},
    )
    dash_id = created.json()["id"]
    token = issue_export_token(uuid.UUID(dash_id))

    def _fake_execute(_db, _actor, _payload):
        return ExecuteResponse(columns=["x"], rows=[[1]], rowCount=1, truncated=False, traceId="t")

    monkeypatch.setattr("app.dashboard.export_snapshot.query_service.execute_query", _fake_execute)

    resp = client.post(
        "/api/v1/dashboards/export-query/execute",
        headers={"X-Export-Token": token, "X-Export-Dashboard-Id": dash_id},
        json={"mode": "sql", "dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["rowCount"] == 1


def test_export_dataset_query_requires_token(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/dashboards/export-query/dataset/execute",
        json={
            "dataSourceId": str(uuid.uuid4()),
            "configId": str(uuid.uuid4()),
            "limit": 10,
        },
    )
    assert resp.status_code == 401


def test_export_dataset_query_accepts_valid_token(
    client: TestClient, auth_headers: dict, monkeypatch
) -> None:
    from app.query.dataset.schemas import DatasetExecuteResponse

    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Export Dataset {uuid.uuid4().hex[:6]}"},
    )
    dash_id = created.json()["id"]
    token = issue_export_token(uuid.UUID(dash_id))
    cfg_id = uuid.uuid4()
    ds_id = uuid.uuid4()

    def _fake_dataset(_db, _actor, _payload):
        return DatasetExecuteResponse(
            configId=cfg_id,
            configRevision=1,
            columns=["x"],
            rows=[[1]],
            rowCount=1,
            truncated=False,
            traceId="t",
        )

    monkeypatch.setattr(
        "app.dashboard.export_snapshot.execute_dataset_from_config",
        _fake_dataset,
    )

    resp = client.post(
        "/api/v1/dashboards/export-query/dataset/execute",
        headers={"X-Export-Token": token, "X-Export-Dashboard-Id": dash_id},
        json={"dataSourceId": str(ds_id), "configId": str(cfg_id), "limit": 10},
    )
    assert resp.status_code == 200
    assert resp.json()["rowCount"] == 1


def test_pdf_export_fallback_when_env_set(
    client: TestClient,
    auth_headers: dict,
    monkeypatch,
) -> None:
    from app.core.config import get_settings
    from app.dashboard import service as dash_service

    monkeypatch.setenv("RPT_EXPORT_FALLBACK", "1")
    get_settings.cache_clear()

    def _fail_render(*_args, **_kwargs):
        raise dash_service.DashboardError("DASH_EXPORT_RENDER_FAILED", "render failed", 502)

    monkeypatch.setattr("app.dashboard.export_jobs.render_dashboard_visual_pdf", _fail_render)

    created = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": f"Fallback PDF {uuid.uuid4().hex[:6]}"},
    )
    dash_id = created.json()["id"]
    job = client.post(
        f"/api/v1/dashboards/{dash_id}/export-jobs",
        headers=auth_headers,
        json={"format": "pdf"},
    )
    assert job.status_code == 201, job.text
    body = job.json()
    assert body["artifactKind"] == "layout_inventory"
    get_settings.cache_clear()
