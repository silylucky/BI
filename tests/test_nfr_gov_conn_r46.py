"""NFR 横切 + GOV-005 + CONN-019 GBase L1 kickoff r46."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R46_SQLITE_URL = "sqlite+pysqlite:///file:nfr_gov_conn_r46?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r46_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_push = os.environ.get("PUSH_BROWSER_ENABLED")
    previous_xc = os.environ.get("XINCHUANG_MODE")
    os.environ["DATABASE_URL"] = _R46_SQLITE_URL
    os.environ.pop("PUSH_BROWSER_ENABLED", None)
    os.environ.pop("PUSH_WECOM_WEBHOOK", None)
    os.environ.pop("PUSH_DINGTALK_WEBHOOK", None)
    os.environ.setdefault("XINCHUANG_MODE", "permissive")
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
        ("PUSH_BROWSER_ENABLED", previous_push),
        ("XINCHUANG_MODE", previous_xc),
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


def test_r46_fixture_bootstraps(client):
    """T-R46-000-01: r46 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


from app.core.nfr.plugin_extension import (
    PLUGIN_EXTENSION_POINTS,
    get_plugin_registration_meta,
    list_extension_points,
    register_connector_plugin,
)
from app.datasources.registry import registry


def test_nfr005_plugin_extension_points_list():
    """T-R46-005-01: 扩展点清单 ≥3 且含 connector.register。"""
    points = list_extension_points()
    assert len(points) >= 3
    ids = {p.id for p in points}
    assert "connector.register" in ids


def test_nfr005_register_connector_plugin_records_metadata():
    """T-R46-005-02: register_connector_plugin 记录 registered_via=plugin。"""
    class _TmpConnector:
        type = "_tmp_plugin_r46"
        category = "relational"
        capabilities = ("connectivity_test",)
        display_name = "Tmp"

        def test_connection(self, **kwargs):
            from app.datasources.dialects.base import TestConnectionResult
            return TestConnectionResult(ok=True, message="ok", latency_ms=0, code=None)

    conn = _TmpConnector()
    try:
        register_connector_plugin(conn)  # type: ignore[arg-type]
        meta = get_plugin_registration_meta("_tmp_plugin_r46")
        assert meta is not None
        assert meta.get("registered_via") == "plugin"
        assert registry.get("_tmp_plugin_r46") is conn
    finally:
        from app.datasources.registry import unregister
        unregister("_tmp_plugin_r46")


def test_nfr005_plugin_extension_points_frozen():
    """T-R46-005-03: PLUGIN_EXTENSION_POINTS 为冻结元组。"""
    assert isinstance(PLUGIN_EXTENSION_POINTS, tuple)
    assert len(PLUGIN_EXTENSION_POINTS) >= 3


def test_nfr005_registry_source_unchanged_logic():
    """T-R46-005-04: ConnectorRegistry.register/get 方法体行数守卫（零侵入）。"""
    import inspect
    from app.datasources.registry import ConnectorRegistry

    register_src = inspect.getsource(ConnectorRegistry.register)
    get_src = inspect.getsource(ConnectorRegistry.get)
    assert "register_connector_plugin" not in register_src
    assert "register_connector_plugin" not in get_src
    assert register_src.count("\n") <= 12
    assert get_src.count("\n") <= 12


import pymysql.err

from app.datasources.dialects.gbase import GbaseConnector, GBASE_MAX_COLUMNS
from app.datasources.dialects.errors import (
    GBASE_AUTH_FAILED,
    GBASE_CONN_REFUSED,
    GBASE_UNKNOWN,
    map_gbase_error,
)


def test_conn019_gbase_connector_metadata():
    """T-R46-019-01: GbaseConnector 契约字段。"""
    c = GbaseConnector()
    assert c.type == "gbase"
    assert c.category == "relational"
    assert c.display_name == "南大通用 GBase"
    assert "connectivity_test" in c.capabilities
    assert GBASE_MAX_COLUMNS == 500


def test_conn019_gbase_registered_via_plugin():
    """T-R46-019-02: 内置登记走 register_connector_plugin。"""
    meta = get_plugin_registration_meta("gbase")
    assert meta is not None
    assert meta["registered_via"] == "plugin"
    assert registry.get("gbase").type == "gbase"


def test_conn019_gbase_types_catalog_http(client):
    """T-R46-019-03: GET /datasources/types 含 gbase relational。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    items = {i["type"]: i for i in resp.json()["items"]}
    assert "gbase" in items
    assert items["gbase"]["category"] == "relational"


def test_conn019_map_gbase_error_prefix():
    """T-R46-019-04: map_gbase_error 镜像 tidb 前缀替换。"""
    exc = pymysql.err.OperationalError(2003, "Can't connect")
    code, _ = map_gbase_error(exc)
    assert code == GBASE_CONN_REFUSED


def test_conn019_gbase_test_connection_ok_mock():
    """T-R46-019-05: mock 连接成功。"""
    connector = GbaseConnector()
    with patch.object(connector._inner, "open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        result = connector.test_connection(host="h", port=5258, username="u", password="p", database="d")
    assert result.ok is True


def test_conn019_gbase_test_connection_auth_failed_mock():
    """T-R46-019-06: mock 认证失败映射 GBASE_AUTH_FAILED。"""
    connector = GbaseConnector()
    with patch.object(connector._inner, "open_connection", side_effect=pymysql.err.OperationalError(1045, "Access denied")):
        result = connector.test_connection(host="h", port=5258, username="u", password="p", database="d")
    assert result.ok is False
    assert result.code == GBASE_AUTH_FAILED


def test_conn019_gbase_list_schemas_delegates():
    """T-R46-019-07: list_schemas 委托 mysql。"""
    connector = GbaseConnector()
    mock_conn = MagicMock()
    with patch.object(connector._inner, "list_schemas", return_value=[]) as mock_ls:
        connector.list_schemas(mock_conn)
    mock_ls.assert_called_once_with(mock_conn)


def test_conn019_gbase_http_test_connection_draft(client):
    """T-R46-019-08: POST test draft 链可达。"""
    with patch("app.datasources.dialects.mysql.MysqlConnector.open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "gbase",
                "name": "gbase-test",
                "code": f"gbase-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 5258,
                "username": "u",
                "password": "p",
                "database": "demo",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


from app.core.nfr.xinchuang import assert_xinchuang_compliant, build_compliance_report
from app.core.nfr.errors import XINCHUANG_NON_COMPLIANT


def test_nfr007_compliance_report_items(client):
    """T-R46-007-01: 合规报告 ≥4 项含 xc-db-connector。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) >= 4
    ids = {i["id"] for i in body["items"]}
    assert "xc-db-connector" in ids


def test_nfr007_registered_xinchuang_connectors_include_gbase(client):
    """T-R46-007-02: 登记 gbase 后 registeredXinchuangConnectors 含 gbase。"""
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    registered = resp.json()["registeredXinchuangConnectors"]
    assert "gbase" in registered


def test_nfr007_build_compliance_report_unit():
    """T-R46-007-03: build_compliance_report 返回 overallStatus。"""
    report = build_compliance_report()
    assert report.overall_status in {"compliant", "non_compliant", "degraded"}
    assert report.mode == "strict"


def test_nfr007_strict_mode_non_compliant_422(client, monkeypatch):
    """T-R46-007-04: 违规平台库 → 422 XINCHUANG_NON_COMPLIANT。"""
    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.api.v1.nfr.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in mock_settings.model_fields},
            "database_url": "oracle://bad:1521/db",
        })(),
    )
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == XINCHUANG_NON_COMPLIANT


def test_nfr007_assert_raises_on_non_compliant(monkeypatch):
    """T-R46-007-05: assert_xinchuang_compliant 违规抛错。"""
    from app.core.nfr.xinchuang import XinchuangComplianceError

    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.core.nfr.xinchuang.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in mock_settings.model_fields},
            "database_url": "oracle://bad:1521/db",
        })(),
    )

    with pytest.raises(XinchuangComplianceError) as exc:
        assert_xinchuang_compliant()
    assert exc.value.code == XINCHUANG_NON_COMPLIANT


from app.core.nfr.push_config import resolve_push_mode, validate_push_settings
from jwt_auth import AUTH, jwt_auth_headers


def test_nfr006_default_disabled(monkeypatch):
    """T-R46-006-01: 默认 deliveryMode=disabled 且 degradedReason 非空。"""
    monkeypatch.delenv("PUSH_BROWSER_ENABLED", raising=False)
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "disabled"
    assert out.degraded_reason


def test_nfr006_stays_disabled_with_legacy_env(monkeypatch):
    """T-R46-006-02: 历史钉钉环境变量不再启用 IM 推送。"""
    monkeypatch.setenv("PUSH_DINGTALK_WEBHOOK", "https://oapi.dingtalk.com/robot/send?access_token=x")
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "disabled"
    assert out.dingtalk_configured is False


def test_nfr006_disabled_without_channels(monkeypatch):
    """T-R46-006-03: 无消息通道 → disabled。"""
    monkeypatch.delenv("PUSH_WECOM_WEBHOOK", raising=False)
    monkeypatch.delenv("PUSH_DINGTALK_WEBHOOK", raising=False)
    get_settings.cache_clear()
    out = resolve_push_mode()
    assert out.delivery_mode == "disabled"


def test_nfr006_invalid_webhook_is_ignored():
    """T-R46-006-04: IM 推送下线后不再校验 webhook。"""
    validate_push_settings(get_settings())  # type: ignore[arg-type]


def test_nfr005_plugin_extension_points_http(client):
    """T-R46-005-05: GET /nfr/plugin-extension-points ≥3。"""
    resp = client.get("/api/v1/nfr/plugin-extension-points", headers=AUTH)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) >= 3


def test_nfr006_push_config_http(client):
    """T-R46-006-05: GET /nfr/push-config 不泄露 webhook 明文。"""
    resp = client.get("/api/v1/nfr/push-config", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "webhook" not in str(body).lower() or body.get("wecomConfigured") is False
    assert body["deliveryMode"] in {"disabled", "degraded", "active"}


def test_nfr007_compliance_http_strict_guard(client, monkeypatch):
    """T-R46-007-06: 非合规 GET compliance → 422。"""
    mock_settings = get_settings()
    monkeypatch.setattr(
        "app.api.v1.nfr.get_settings",
        lambda: type("S", (), {
            **{k: getattr(mock_settings, k) for k in mock_settings.model_fields},
            "database_url": "oracle://bad:1521/db",
        })(),
    )
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 422


def test_gov005_submit_pending_publish(client):
    """T-R46-GOV-01: draft submit → pending_publish。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_publish"


def test_gov005_approve_published(client):
    """T-R46-GOV-02: pending approve → published。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


def test_gov005_reject_back_to_draft(client):
    """T-R46-GOV-03: pending reject → draft。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/reject", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_gov005_invalid_draft_to_published_via_gov(client):
    """T-R46-GOV-04: gov 路径 draft 直 approve → 400。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "GOV_PUBLISH_INVALID_TRANSITION"


def test_gov005_published_resubmit_forbidden(client):
    """T-R46-GOV-05: published 再 submit → 400。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 400


def test_gov005_double_submit_conflict(client):
    """T-R46-GOV-06: pending 重复 submit → 409。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "GOV_PUBLISH_ALREADY_PENDING"


def test_gov005_status_allowed_actions(client):
    """T-R46-GOV-07: GET status 返回 allowedActions。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.get(f"/api/v1/gov/publish/entries/{eid}/status", headers=AUTH)
    assert resp.status_code == 200
    assert "submit" in resp.json()["allowedActions"]


def test_gov005_approve_visible_in_integration_list(client):
    """T-R46-GOV-08: gov approve 后 integration list 含 published。"""
    eid = _create_catalog_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{eid}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{eid}/approve", headers=AUTH)
    resp = client.get("/api/v1/services", headers=AUTH, params={"limit": 50})
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()["items"]}
    assert eid in ids


def test_r46_cross_gbase_xinchuang_plugin(client):
    """T-R46-X-01: gbase 登记 + 信创清单 + 插件元数据联动。"""
    assert get_plugin_registration_meta("gbase")["registered_via"] == "plugin"
    resp = client.get("/api/v1/nfr/xinchuang/compliance", headers=AUTH)
    assert resp.status_code == 200
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_r46_cross_integration_fast_path_still_works(client):
    """T-R46-X-02: integration 快路径 draft→published 仍可用。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(f"/api/v1/services/{eid}/publish", headers=AUTH)
    assert resp.status_code == 201
    assert resp.json()["status"] == "published"


def test_r46_cross_plugin_points_include_export_catalog(client):
    """T-R46-X-03: 扩展点含 connector.export_catalog 且 types 含 gbase。"""
    resp = client.get("/api/v1/nfr/plugin-extension-points", headers=AUTH)
    ids = {i["id"] for i in resp.json()["items"]}
    assert "connector.export_catalog" in ids
    types = client.get("/api/v1/datasources/types", headers=AUTH).json()["items"]
    assert any(t["type"] == "gbase" for t in types)
