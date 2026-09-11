"""Live G5 PDF export (requires FE dev + uvicorn + Playwright; skip when env unavailable)."""

from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from app.core.config import get_settings
from app.dashboard.export_jobs import reset_export_jobs_for_tests
from app.dashboard.export_token import reset_export_tokens_for_tests

pytestmark = pytest.mark.integration

_TESTS_DIR = Path(__file__).resolve().parent
if str(_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(_TESTS_DIR))

BACKEND_BASE = os.environ.get("VITALSPAN_LIVE_API", "http://127.0.0.1:8000")


def _url_reachable(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _fe_probe_url() -> str:
    settings = get_settings()
    base = settings.fe_base_url.rstrip("/")
    path = settings.fe_base_path.strip("/")
    if path:
        base = f"{base}/{path}"
    return f"{base}/"


def _live_auth_headers() -> dict[str, str]:
    from jwt_auth import jwt_auth_headers

    headers = jwt_auth_headers()
    headers["Content-Type"] = "application/json"
    return headers


def _live_request(
    method: str,
    path: str,
    body: dict | None = None,
    *,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    data = json.dumps(body).encode() if body is not None else None
    headers = _live_auth_headers()
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        f"{BACKEND_BASE.rstrip('/')}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


@pytest.fixture(autouse=True)
def _reset_export_state():
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()
    yield
    reset_export_jobs_for_tests()
    reset_export_tokens_for_tests()


def test_fe_base_url_reachable():
    if not _url_reachable(_fe_probe_url()):
        pytest.skip("FE dev not running at FE_BASE_URL")


def test_backend_health_reachable():
    if not _url_reachable(f"{BACKEND_BASE.rstrip('/')}/health"):
        pytest.skip("uvicorn not running at VITALSPAN_LIVE_API")


def test_live_pdf_export_without_playwright_mock():
    if not _url_reachable(_fe_probe_url()):
        pytest.skip("FE dev not running at FE_BASE_URL")
    if not _url_reachable(f"{BACKEND_BASE.rstrip('/')}/health"):
        pytest.skip("uvicorn not running at VITALSPAN_LIVE_API")

    status, raw = _live_request("POST", "/api/v1/dashboards", {"name": f"Live G5 {uuid.uuid4().hex[:6]}"})
    assert status == 201, raw.decode("utf-8", "replace")
    dash_id = json.loads(raw)["id"]

    widget_id = str(uuid.uuid4())
    status, raw = _live_request(
        "PUT",
        f"/api/v1/dashboards/{dash_id}/layout",
        {
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": widget_id,
                        "type": "text",
                        "title": "Live probe",
                        "textConfig": {"content": "export probe"},
                        "colSpan": 6,
                        "rowSpan": 2,
                    },
                ],
            },
        },
    )
    assert status == 200, raw.decode("utf-8", "replace")

    status, raw = _live_request("POST", f"/api/v1/dashboards/{dash_id}/export-jobs", {"format": "pdf"})
    assert status == 201, raw.decode("utf-8", "replace")
    body = json.loads(raw)
    assert body["artifactKind"] == "visual_snapshot"

    status, pdf = _live_request("GET", body["downloadUrl"])
    assert status == 200
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 5120
    assert b"LAYOUT INVENTORY PREVIEW" not in pdf[:4096]


def _mailhog_reachable() -> bool:
    host = os.environ.get("RPT_SMTP_HOST", "localhost")
    api_base = os.environ.get("MAILHOG_API", f"http://{host}:8025")
    try:
        with urllib.request.urlopen(f"{api_base.rstrip('/')}/api/v2/messages", timeout=5) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError):
        return False


@pytest.fixture(scope="module")
def _mailhog_sink():
    """Use real MailHog when reachable; otherwise start stdlib local sink on 1025/8025."""
    if _mailhog_reachable():
        yield "external"
        return
    from local_mailhog import clear_messages, start_local_mailhog, stop_local_mailhog

    start_local_mailhog()
    try:
        yield "local"
    finally:
        stop_local_mailhog()


def test_template_schedule_smtp_live(_mailhog_sink):
    """Live: template schedule execute → MailHog receives PDF attachment."""
    if not _url_reachable(f"{BACKEND_BASE.rstrip('/')}/health"):
        pytest.skip("uvicorn not running at VITALSPAN_LIVE_API")

    from local_mailhog import clear_messages

    if _mailhog_sink == "local":
        clear_messages()
    elif not _mailhog_reachable():
        pytest.skip("MailHog API not reachable")

    tpl_key = f"live-{uuid.uuid4().hex[:6]}"
    status, raw = _live_request(
        "PUT",
        f"/api/v1/reports/templates/{tpl_key}",
        {
            "templateKey": tpl_key,
            "format": "pdf",
            "displayName": "Live Schedule PDF",
            "blocks": [{"blockType": "table", "tableRef": "t1"}],
        },
    )
    assert status == 200, raw.decode("utf-8", "replace")

    status, raw = _live_request(
        "POST",
        "/api/v1/reports/catalog/nodes",
        {
            "name": "Live Sched Node",
            "nodeType": "template",
            "templateKind": "pdf",
            "templateKey": tpl_key,
        },
    )
    assert status == 201, raw.decode("utf-8", "replace")
    node_id = json.loads(raw)["id"]
    ds_id = str(uuid.uuid4())

    status, raw = _live_request(
        "PUT",
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        {
            "catalogNodeId": node_id,
            "defaultDataSourceId": ds_id,
            "metrics": [],
            "filters": [],
            "changeNote": "live",
        },
    )
    assert status == 200, raw.decode("utf-8", "replace")

    status, raw = _live_request(
        "POST",
        "/api/v1/reports/schedules",
        {
            "sourceType": "template",
            "sourceId": node_id,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
            "attachmentFormats": ["pdf"],
        },
    )
    assert status == 201, raw.decode("utf-8", "replace")
    schedule_id = json.loads(raw)["id"]

    status, raw = _live_request(
        "POST",
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        {"action": "schedule"},
    )
    assert status == 200, raw.decode("utf-8", "replace")

    status, raw = _live_request(
        "POST",
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        None,
        extra_headers={"Idempotency-Key": f"live-{schedule_id}", "X-Rpt-Semi-Real": "1"},
    )
    assert status == 200, raw.decode("utf-8", "replace")
    body = json.loads(raw)
    assert body.get("status") in {"semi_real_succeeded", "semi_real_delivery_degraded"}

    host = os.environ.get("RPT_SMTP_HOST", "localhost")
    api_base = os.environ.get("MAILHOG_API", f"http://{host}:8025")
    with urllib.request.urlopen(f"{api_base.rstrip('/')}/api/v2/messages", timeout=10) as resp:
        messages = json.loads(resp.read())
    items = messages.get("items") or []
    assert items, "expected MailHog to receive schedule email"
    latest = items[0]
    mime_parts = latest.get("MIME", {}).get("Parts") or []
    pdf_found = any(
        part.get("Body", "").startswith("%PDF") or "application/pdf" in (part.get("Headers", {}).get("Content-Type") or [""])[0]
        for part in mime_parts
    )
    assert pdf_found or "pdf" in json.dumps(latest).lower()


def test_standard_schedule_smtp_live(_mailhog_sink):
    """Live: standard analysis schedule execute → SMTP receives PDF attachment (DG6)."""
    if not _url_reachable(f"{BACKEND_BASE.rstrip('/')}/health"):
        pytest.skip("uvicorn not running at VITALSPAN_LIVE_API")

    from local_mailhog import clear_messages

    if _mailhog_sink == "local":
        clear_messages()
    elif not _mailhog_reachable():
        pytest.skip("MailHog API not reachable")

    pack_key = "equipment-overview"
    status, raw = _live_request("GET", f"/api/v1/reports/standard/packs/{pack_key}")
    if status == 404:
        pytest.skip("standard pack equipment-overview not seeded on live DB")

    status, raw = _live_request(
        "POST",
        "/api/v1/reports/schedules",
        {
            "sourceType": "standard",
            "sourceKey": pack_key,
            "cron": "0 9 * * *",
            "recipients": [{"type": "role", "value": "admin"}],
            "deliveryChannels": ["email"],
            "attachmentFormats": ["pdf"],
        },
    )
    assert status == 201, raw.decode("utf-8", "replace")
    schedule_id = json.loads(raw)["id"]

    status, raw = _live_request(
        "POST",
        f"/api/v1/reports/schedules/{schedule_id}/transition",
        {"action": "schedule"},
    )
    assert status == 200, raw.decode("utf-8", "replace")

    status, raw = _live_request(
        "POST",
        f"/api/v1/reports/schedules/{schedule_id}/execute",
        None,
        extra_headers={
            "Idempotency-Key": f"live-std-{schedule_id}",
            "X-Rpt-Semi-Real": "1",
        },
    )
    assert status == 200, raw.decode("utf-8", "replace")
    body = json.loads(raw)
    assert body.get("artifactKind") == "standard_render"
    assert body.get("status") == "semi_real_succeeded", body
    steps = body.get("deliverySteps") or []
    assert steps and steps[0].get("status") == "delivered"
    assert steps[0].get("mode") == "smtp"

    host = os.environ.get("RPT_SMTP_HOST", "localhost")
    api_base = os.environ.get("MAILHOG_API", f"http://{host}:8025")
    with urllib.request.urlopen(f"{api_base.rstrip('/')}/api/v2/messages", timeout=10) as resp:
        messages = json.loads(resp.read())
    items = messages.get("items") or []
    assert items, "expected MailHog to receive standard schedule email"
    latest = items[0]
    mime_parts = latest.get("MIME", {}).get("Parts") or []
    pdf_found = any(
        part.get("Body", "").startswith("%PDF")
        or "application/pdf" in (part.get("Headers", {}).get("Content-Type") or [""])[0]
        for part in mime_parts
    )
    assert pdf_found or "pdf" in json.dumps(latest).lower()
