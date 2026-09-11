"""NFR-004 — HTTPS audit guard M6 integration."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.nfr.https_audit import (
    clear_audit_ring_for_tests,
    probe_https_mask_budget_ms,
    probe_https_status_budget_ms,
    set_user_https_audit_scope,
)
from app.main import app as fastapi_app
from jwt_auth import AUTH


@pytest.fixture(autouse=True)
def enable_https_audit_guard():
    previous = os.environ.get("HTTPS_AUDIT_GUARD")
    os.environ["HTTPS_AUDIT_GUARD"] = "1"
    clear_audit_ring_for_tests()
    yield
    if previous is None:
        os.environ.pop("HTTPS_AUDIT_GUARD", None)
    else:
        os.environ["HTTPS_AUDIT_GUARD"] = previous
    clear_audit_ring_for_tests()


@pytest.fixture(autouse=True)
def guard_fixture_route():
    @fastapi_app.get("/api/v1/nfr/https-audit/_guard_fixture")
    def _fixture():
        return {"password": "secret123", "token": "tok", "name": "ok"}

    yield
    fastapi_app.routes[:] = [
        r for r in fastapi_app.routes if getattr(r, "path", "") != "/api/v1/nfr/https-audit/_guard_fixture"
    ]


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_nfr_004_m6_01_audit_probe_no_plaintext_leak(client: TestClient):
    client.get("/api/v1/nfr/https-audit/_guard_fixture", headers=AUTH)
    probe = client.get("/api/v1/nfr/https-audit/audit-probe", headers=AUTH)
    assert probe.status_code == 200
    body = probe.json()
    assert body["plaintextLeaked"] is False
    assert body["eventCount"] >= 1


def test_nfr_004_m6_02_audit_events_no_plaintext_values(client: TestClient):
    client.get("/api/v1/nfr/https-audit/_guard_fixture", headers=AUTH)
    probe = client.get("/api/v1/nfr/https-audit/audit-probe", headers=AUTH)
    assert probe.status_code == 200
    raw = probe.json()
    for event in raw["events"]:
        for field in event.get("maskedFields", []):
            assert field not in event or event.get(field) != "secret123"
    serialized = str(raw)
    assert "secret123" not in serialized
    assert '"tok"' not in serialized or "maskedFields" in serialized


def test_nfr_004_m6_03_enterprise_forbidden(client: TestClient):
    async def _enterprise() -> UserContext:
        return UserContext(id="ent-nfr004", username="enterprise", roles=["enterprise"])

    set_user_https_audit_scope("ent-nfr004", frozenset({"api", "webhook"}))
    fastapi_app.dependency_overrides[get_current_user] = _enterprise
    try:
        resp = client.post(
            "/api/v1/nfr/https-audit/mask-probe",
            headers=AUTH,
            json={"samplePayload": {"password": "x"}, "auditScope": "connector"},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "HTTPS_AUDIT_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_nfr_004_m6_04_probe_mask_budget(client: TestClient):
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_https_mask_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50
    status_result = probe_https_status_budget_ms()
    assert status_result.ok is True


def test_nfr_004_m6_05_simulate_audit_failure(client: TestClient):
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={
            "samplePayload": {"password": "x"},
            "simulateAuditFailure": True,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["auditLogged"] is False
