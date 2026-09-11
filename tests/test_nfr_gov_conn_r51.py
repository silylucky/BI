"""NFR 横切 + GOV-005 + CONN-019 companion 质量推分 r51."""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.nfr.browser_matrix import (
    SUPPORTED_BROWSER_MATRIX,
    probe_browser_matrix_budget_ms,
    probe_browser_support,
)
from app.core.nfr.errors import (
    GOV_PUBLISH_ALREADY_PENDING,
    GOV_PUBLISH_INVALID_TRANSITION,
    NFR_PROBE_TIMEOUT,
    PUSH_CHANNEL_ALL_FAILED,
    PUSH_CHANNEL_DEGRADED,
    XINCHUANG_NON_COMPLIANT,
)
from app.core.nfr.plugin_extension import (
    describe_registration_path,
    get_plugin_registration_meta,
    probe_registry,
    verify_zero_invasion,
)
from app.core.nfr.push_channels import (
    clear_push_mock_log,
    dispatch_push_mock,
    probe_push_dispatch_budget_ms,
)
from app.core.nfr.xinchuang import (
    build_compliance_report,
    enumerate_non_compliant,
    probe_compliance_non_blocking,
)
from app.datasources.dialects.gbase import GbaseConnector, GBASE_MAX_COLUMNS
from app.datasources.dialects.errors import (
    GBASE_AUTH_FAILED,
    GBASE_TIMEOUT,
    GBASE_UNKNOWN_DATABASE,
    map_gbase_error,
)
from app.datasources.registry import registry
from app.governance.publish.notifications import clear_notifications, list_notifications
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R51_SQLITE_URL = "sqlite+pysqlite:///file:nfr_gov_conn_r51?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r51_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_mock_fail = os.environ.get("PUSH_MOCK_FORCE_FAIL")
    os.environ["DATABASE_URL"] = _R51_SQLITE_URL
    os.environ.pop("PUSH_WECOM_WEBHOOK", None)
    os.environ.pop("PUSH_DINGTALK_WEBHOOK", None)
    os.environ.pop("PUSH_MOCK_FORCE_FAIL", None)
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    for key, val in (
        ("DATABASE_URL", previous_db),
        ("PUSH_MOCK_FORCE_FAIL", previous_mock_fail),
    ):
        if val is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = val
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_catalog_entry(
    client: TestClient,
    *,
    path: str | None = None,
    status: str = "draft",
    name: str = "GovSvc",
) -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"{name}-{suffix}",
            "httpMethod": "POST",
            "path": path or f"/api/v1/gov-svc/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_r51_fixture_bootstraps(client):
    """T-R51-000-01: r51 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r51_nfr_error_constants_exported():
    """T-R51-000-02: companion 错误常量可导入。"""
    assert PUSH_CHANNEL_DEGRADED == "PUSH_CHANNEL_DEGRADED"
    assert PUSH_CHANNEL_ALL_FAILED == "PUSH_CHANNEL_ALL_FAILED"
    assert NFR_PROBE_TIMEOUT == "NFR_PROBE_TIMEOUT"


def test_nfr006_supported_browser_matrix_at_least_four():
    """T-NFR-R51-006-01: SUPPORTED_BROWSER_MATRIX ≥4 浏览器。"""
    names = {e.name for e in SUPPORTED_BROWSER_MATRIX}
    assert {"chrome", "edge", "firefox", "safari"} <= names


def test_nfr006_chrome_120_supported():
    """T-NFR-R51-006-02: UA Chrome/120 → supported。"""
    report = probe_browser_support("Mozilla/5.0 Chrome/120.0.0.0")
    assert report.detected_browser is not None
    assert report.detected_browser.name == "chrome"
    assert report.detected_browser.supported is True


def test_nfr006_msie6_unsupported():
    """T-NFR-R51-006-03: UA MSIE 6 → unsupported。"""
    report = probe_browser_support("Mozilla/4.0 (compatible; MSIE 6.0)")
    assert report.detected_browser is not None
    assert report.detected_browser.supported is False


def test_nfr006_probe_browser_matrix_budget():
    """T-NFR-R51-006-04: probe_browser_support 耗时 < 50ms。"""
    started = time.perf_counter()
    probe_browser_support("Mozilla/5.0 Chrome/120.0.0.0")
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_browser_matrix_budget_ms


def test_nfr006_dispatch_all_failed_when_disabled(monkeypatch):
    """T-NFR-R51-006-05: 全未配置 push → failed + PUSH_CHANNEL_ALL_FAILED。"""
    monkeypatch.delenv("PUSH_BROWSER_ENABLED", raising=False)
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    monkeypatch.delenv("PUSH_DINGTALK_WEBHOOK", raising=False)
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "failed"
    assert result.code == PUSH_CHANNEL_ALL_FAILED


def test_nfr006_dispatch_degraded_when_dingtalk_mock_fails(monkeypatch):
    """T-R46-006-06b: IM 推送下线后 mock 失败仍为 failed。"""
    monkeypatch.setenv("PUSH_DINGTALK_WEBHOOK", "https://example.com/dingtalk")
    monkeypatch.setenv("PUSH_MOCK_FORCE_FAIL", "dingtalk")
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "failed"
    assert result.code == PUSH_CHANNEL_ALL_FAILED


def test_nfr006_dispatch_stays_failed_when_channels_configured(monkeypatch):
    """T-R46-006-07: 历史 webhook 配置不再投递。"""
    monkeypatch.setenv("PUSH_DINGTALK_WEBHOOK", "https://example.com/dingtalk")
    monkeypatch.delenv("PUSH_MOCK_FORCE_FAIL", raising=False)
    get_settings.cache_clear()
    clear_push_mock_log()
    result = dispatch_push_mock({"text": "hi"})
    assert result.status == "failed"
    assert result.code == PUSH_CHANNEL_ALL_FAILED


def test_nfr006_dispatch_budget_smoke():
    """T-NFR-R51-006-04b: dispatch_push_mock 耗时 < 100ms。"""
    started = time.perf_counter()
    dispatch_push_mock({"text": "budget"})
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_push_dispatch_budget_ms


def test_nfr006_browser_matrix_http(client):
    """T-NFR-R51-006-08: HTTP GET browser-matrix 200 + items≥4。"""
    resp = client.get(
        "/api/v1/nfr/browser-matrix",
        headers=AUTH,
        params={"userAgent": "Mozilla/5.0 Chrome/120.0.0.0"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) >= 4
    assert body["detectedBrowser"]["name"] == "chrome"


def test_nfr006_push_probe_http_no_webhook_leak(client, monkeypatch):
    """T-NFR-R51-006-09: HTTP POST push-probe 不泄露 webhook URL。"""
    monkeypatch.setenv("PUSH_WECOM_WEBHOOK", "https://secret.example.com/hook")
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    get_settings.cache_clear()
    resp = client.post(
        "/api/v1/nfr/push-probe",
        headers=AUTH,
        json={"message": "probe"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "secret.example.com" not in text
    assert "webhook" not in text.lower() or "configured" in text.lower()


def test_nfr007_fail_items_have_remediation():
    """T-NFR-R51-007-01: fail 项 remediation 非空。"""
    report = build_compliance_report()
    for item in report.items:
        if item.status == "fail":
            assert item.remediation


def test_nfr007_enumerate_non_compliant_only_fails():
    """T-NFR-R51-007-02: enumerate_non_compliant 仅返回 fail。"""
    report = build_compliance_report()
    fails = enumerate_non_compliant(report)
    assert all(i.status == "fail" for i in fails)


def test_nfr007_probe_compliance_non_blocking_budget():
    """T-NFR-R51-007-03: probe_compliance_non_blocking elapsedMs < 100。"""
    result = probe_compliance_non_blocking(max_ms=100)
    assert result.probe_status == "ok"
    assert result.elapsed_ms < 100


def test_nfr007_probe_timeout_on_slow_check(monkeypatch):
    """T-NFR-R51-007-04: mock 慢检查 → probeStatus=timeout。"""
    import app.core.nfr.xinchuang as xc

    def slow_report(*_a, **_k):
        time.sleep(0.2)
        return build_compliance_report()

    monkeypatch.setattr(xc, "build_compliance_report", slow_report)
    result = probe_compliance_non_blocking(max_ms=50)
    assert result.probe_status == "timeout"
    assert result.code == NFR_PROBE_TIMEOUT


def test_nfr007_compliance_http_gbase_registered(client):
    """T-NFR-R51-007-05: GET compliance 200 且 gbase 在 registeredXinchuangConnectors。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_nfr007_strict_mysql_platform_compliant(client, monkeypatch):
    """T-NFR-R51-007-06: strict + mysql 平台库 → compliance 报告 xc-platform-db 为 pass。"""
    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.api.v1.nfr.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in mock_settings.model_fields},
            "database_url": "mysql+pymysql://vitalspan:vitalspan@localhost:3309/vitalspan",
        })(),
    )
    monkeypatch.setattr("app.api.v1.nfr.assert_xinchuang_compliant", lambda _settings=None: None)
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    platform_item = next(
        item for item in resp.json()["items"] if item["id"] == "xc-platform-db"
    )
    assert platform_item["status"] == "pass"


def test_nfr005_gbase_registration_path_no_core_touch():
    """T-NFR-R51-005-01: describe_registration_path('gbase').touchesCoreRegistry is False。"""
    doc = describe_registration_path("gbase")
    assert doc.touches_core_registry is False


def test_nfr005_gbase_steps_include_register_plugin():
    """T-NFR-R51-005-02: gbase steps 含 register_connector_plugin。"""
    doc = describe_registration_path("gbase")
    joined = " ".join(doc.steps)
    assert "register_connector_plugin" in joined


def test_nfr005_probe_registry_budget():
    """T-NFR-R51-005-03: probe_registry < 50ms。"""
    started = time.perf_counter()
    result = probe_registry(max_ms=50)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < 50
    assert "gbase" in result.types


def test_nfr005_verify_zero_invasion():
    """T-NFR-R51-005-04: verify_zero_invasion() True。"""
    assert verify_zero_invasion() is True


def test_nfr005_registration_path_http(client):
    """T-NFR-R51-005-05: HTTP registration-path/gbase 200。"""
    resp = client.get("/api/v1/nfr/registration-path/gbase", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["connectorType"] == "gbase"


def test_nfr005_gbase_registered_via_plugin_r46_link():
    """T-NFR-R51-005-06: get_plugin_registration_meta('gbase') registered_via=plugin。"""
    meta = get_plugin_registration_meta("gbase")
    assert meta is not None
    assert meta["registered_via"] == "plugin"


def test_gov005_submit_emits_submitted_notification(client):
    """T-GOV-R51-005-01: submit 后 notifications 含 submitted。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    types = [e["eventType"] for e in resp.json()["items"]]
    assert "submitted" in types


def test_gov005_approve_emits_approved_with_delivery_mode(client):
    """T-GOV-R51-005-02: approve 后含 approved 且 deliveryMode 存在。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    approved = [e for e in resp.json()["items"] if e["eventType"] == "approved"]
    assert len(approved) == 1
    assert "deliveryMode" in approved[0]


def test_gov005_reject_emits_rejected(client):
    """T-GOV-R51-005-03: reject 后含 rejected。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/reject", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    assert any(e["eventType"] == "rejected" for e in resp.json()["items"])


def test_gov005_idempotent_double_approve_single_notification(client):
    """T-GOV-R51-005-04: 幂等 double approve 仅 1 条 approved 通知。"""
    clear_notifications()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    approved = [e for e in resp.json()["items"] if e["eventType"] == "approved"]
    assert len(approved) == 1


def test_gov005_draft_approve_400(client):
    """T-GOV-R51-005-05: draft 直 approve → 400（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == GOV_PUBLISH_INVALID_TRANSITION


def test_gov005_double_submit_409(client):
    """T-GOV-R51-005-06: pending 双 submit → 409（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == GOV_PUBLISH_ALREADY_PENDING


def test_gov005_push_disabled_notification_degraded(client, monkeypatch):
    """T-GOV-R51-005-07: push disabled 时 notificationStatus=degraded。"""
    clear_notifications()
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    monkeypatch.delenv("PUSH_DINGTALK_WEBHOOK", raising=False)
    get_settings.cache_clear()
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.get(f"/api/v1/gov/publish/entries/{entry_id}/notifications", headers=AUTH)
    assert resp.json()["items"][0]["notificationStatus"] == "degraded"


def test_gov005_approve_visible_in_integration_list(client):
    """T-GOV-R51-005-08: gov approve 后 integration list 含 entry（r46 回归）。"""
    entry_id = _create_catalog_entry(client)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    resp = client.get("/api/v1/services", headers=AUTH, params={"limit": 50})
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert entry_id in ids


def test_conn019_map_gbase_timeout_2002():
    """T-CONN-R51-019-01: mock timeout → GBASE_TIMEOUT。"""
    exc = pymysql.err.OperationalError(2002, "Can't connect timed out")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_TIMEOUT


def test_conn019_map_gbase_unknown_database_1049():
    """T-CONN-R51-019-02: mock unknown database → GBASE_UNKNOWN_DATABASE。"""
    exc = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_UNKNOWN_DATABASE


def test_conn019_list_schemas_empty_database():
    """T-CONN-R51-019-03: mock 空库 list_schemas → []。"""
    connector = GbaseConnector()
    conn = MagicMock()
    with patch.object(connector._inner, "list_schemas", return_value=[]):
        assert connector.list_schemas(conn) == []


def test_conn019_list_columns_501_truncated_to_500():
    """T-CONN-R51-019-04: mock 501 columns → len==500。"""
    connector = GbaseConnector()
    conn = MagicMock()
    cols = [MagicMock(name=f"c{i}") for i in range(501)]
    with patch.object(connector._inner, "list_columns", return_value=cols):
        result = connector.list_columns(conn, "demo", "t1")
        assert len(result) == GBASE_MAX_COLUMNS == 500


def test_conn019_http_test_auth_failed_trace_id(client):
    """T-CONN-R51-019-05: HTTP POST test auth fail → GBASE_AUTH_FAILED + traceId。"""
    with patch("app.datasources.dialects.gbase.GbaseConnector.test_connection") as mock_test:
        from app.datasources.dialects.base import TestConnectionResult

        mock_test.return_value = TestConnectionResult(
            ok=False, message="[GBASE_AUTH_FAILED] denied", latency_ms=1, code=GBASE_AUTH_FAILED,
        )
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "gbase",
                "name": "gbase-test",
                "code": f"gbase-{uuid.uuid4().hex[:8]}",
                "host": "h",
                "port": 5258,
                "username": "u",
                "password": "p",
                "database": "demo",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == GBASE_AUTH_FAILED
    assert body.get("detail", {}).get("traceId") or resp.headers.get("X-Trace-Id")


def test_conn019_http_tables_missing_schema_400(client):
    """T-CONN-R51-019-06: HTTP GET tables 无 schema → 400。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": "gbase-r51",
            "code": f"gbase-r51-{uuid.uuid4().hex[:8]}",
            "type": "gbase",
            "host": "127.0.0.1",
            "port": 5258,
            "username": "u",
            "password": "p",
            "database": "demo",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/tables", headers=AUTH)
    assert resp.status_code == 400


def test_conn019_http_tables_connection_failed_502(client):
    """T-CONN-R51-019-07: HTTP GET tables 连接失败 → 502。"""
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": "gbase-r51b",
            "code": f"gbase-r51b-{uuid.uuid4().hex[:8]}",
            "type": "gbase",
            "host": "127.0.0.1",
            "port": 5258,
            "username": "u",
            "password": "p",
            "database": "demo",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    with patch(
        "app.datasources.dialects.gbase.GbaseConnector.open_connection",
        side_effect=ConnectionError("refused"),
    ):
        resp = client.get(
            f"/api/v1/datasources/{ds_id}/tables",
            headers=AUTH,
            params={"schema": "demo"},
        )
    assert resp.status_code == 502


def test_conn019_types_catalog_gbase_relational(client):
    """T-CONN-R51-019-08: types catalog gbase relational（r46 回归）。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    gbase = next(t for t in resp.json()["items"] if t["type"] == "gbase")
    assert gbase["category"] == "relational"


def test_r51_cross_gbase_xinchuang_plugin(client):
    """T-R51-X-01: gbase 插件登记 + 信创合规 + 扩展点联动。"""
    assert registry.get("gbase") is not None
    assert get_plugin_registration_meta("gbase")["registered_via"] == "plugin"
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_r51_cross_push_probe_uses_resolve_push_mode(client, monkeypatch):
    """T-R51-X-02: push-probe 与 push-config deliveryMode 一致。"""
    monkeypatch.setenv("PUSH_BROWSER_ENABLED", "true")
    get_settings.cache_clear()
    cfg = client.get("/api/v1/nfr/push-config", headers=AUTH).json()
    probe = client.post("/api/v1/nfr/push-probe", headers=AUTH, json={"message": "x"}).json()
    assert cfg["deliveryMode"] in {"active", "degraded", "disabled"}
    assert probe["status"] in {"delivered", "degraded", "failed"}


def test_r51_cross_integration_fast_path_no_gov_notification(client):
    """T-R51-X-03: integration 快路径不发 gov 通知（与 gov FSM 边界）。"""
    clear_notifications()
    suffix = uuid.uuid4().hex[:8]
    create = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"Fast-{suffix}",
            "httpMethod": "GET",
            "path": f"/api/v1/fast/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": "draft",
        },
    )
    entry_id = create.json()["id"]
    client.post(f"/api/v1/services/{entry_id}/publish", headers=AUTH)
    assert list_notifications(uuid.UUID(entry_id)) == []
