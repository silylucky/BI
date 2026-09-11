from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
import uuid
from unittest.mock import MagicMock, patch

import httpx
import pymysql.err
import pytest
from crypto_test_env import settings_kwargs
from pydantic import ValidationError
from httpx import ASGITransport
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.auth.models import Base as AuthBase
from app.datasources import register_builtin_dialects
from app.datasources.credentials import CredentialDecryptError, decrypt_credential
from app.datasources.models import Base, DataSource, get_meta_engine, get_meta_session
from app.datasources.dialects.base import TestConnectionResult
from app.datasources.dialects.errors import MYSQL_SSL_ERROR, MYSQL_UNKNOWN_DATABASE
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.registry import (
    ConnectorAlreadyRegisteredError,
    ConnectorNotFoundError,
    export_type_catalog,
    registry,
    register_dialect,
    unregister,
)
from app.datasources.schemas import ConnectionOptions, DataSourceCreate
from app.main import app

_DS_SQLITE_URL = "sqlite+pysqlite:///file:ds_r24_test?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ds_r24_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DS_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine as ds_get_meta_engine

    ds_get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    ds_get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_data_sources_table_r24():
    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.drop_all(engine, tables=[DataSource.__table__])
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(scope="module", autouse=True)
def ensure_auth_tables_r24():
    engine = get_meta_engine()
    AuthBase.metadata.create_all(engine)
    yield


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_collation_sets_init_command(mock_connect):
    """T-CONN-M11: collation=utf8mb4_unicode_ci → init_command SET NAMES。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h",
        port=3306,
        database="d",
        username="u",
        password="p",
        charset="utf8mb4",
        collation="utf8mb4_unicode_ci",
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs.get("init_command") == "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_layered_timeouts(mock_connect):
    """T-CONN-M12: connect_timeout_sec=3, read_timeout_sec=10。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h",
        port=3306,
        database="d",
        username="u",
        password="p",
        connect_timeout_sec=3.0,
        read_timeout_sec=10.0,
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["connect_timeout"] == 3
    assert kwargs["read_timeout"] == 10


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_ssl_preferred_omits_ssl_kwarg(mock_connect):
    """T-CONN-M13: ssl_mode=preferred 不传 ssl。"""
    mock_connect.return_value = MagicMock()
    MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p", ssl_mode="preferred",
    )
    assert "ssl" not in mock_connect.call_args.kwargs


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_errno_1049_maps_unknown_database(mock_connect):
    """T-CONN-M14: errno 1049 → code MYSQL_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == MYSQL_UNKNOWN_DATABASE
    assert MYSQL_UNKNOWN_DATABASE in result.message


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_ssl_handshake_maps_ssl_error(mock_connect):
    """T-CONN-M15: SSL 握手失败 → MYSQL_SSL_ERROR。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2026, "SSL connection error")
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p", ssl_mode="required",
    )
    assert result.code == MYSQL_SSL_ERROR


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_success_has_no_code(mock_connect):
    """T-CONN-M16: 成功 ok=True, code is None。"""
    mock_connect.return_value = MagicMock()
    result = MysqlConnector().test_connection(
        host="h", port=3306, database="d", username="u", password="p",
    )
    assert result.ok is True
    assert result.code is None
    assert result.latency_ms is not None


class _StubConnector:
    def __init__(self, type: str) -> None:
        self._type = type

    @property
    def type(self) -> str:
        return self._type

    @property
    def category(self) -> str:
        return "stub"

    @property
    def capabilities(self) -> tuple[str, ...]:
        return ("connectivity_test",)

    @property
    def display_name(self) -> str:
        return self._type

    def test_connection(self, **kwargs) -> TestConnectionResult:
        return TestConnectionResult(ok=True, message="ok", latency_ms=0)


def test_concurrent_register_unregister_stub_connectors():
    """T-DS-R09: 10 线程交替 register/unregister stub，最终含 mysql。"""
    registry._connectors.clear()
    register_builtin_dialects()
    errors: list[Exception] = []

    def worker(i: int) -> None:
        name = f"stub_{i % 3}"
        try:
            if name in registry._connectors:
                unregister(name)
            else:
                register_dialect(_StubConnector(name))
        except (ConnectorNotFoundError, ConnectorAlreadyRegisteredError):
            pass
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    types = {item.type for item in registry.list_types()}
    assert "mysql" in types


def test_duplicate_register_raises():
    """T-DS-R10: 重复 register 同 type → ConnectorAlreadyRegisteredError。"""
    registry._connectors.clear()
    register_dialect(_StubConnector("dup_test"))
    with pytest.raises(ConnectorAlreadyRegisteredError):
        register_dialect(_StubConnector("dup_test"))


def test_export_type_catalog_matches_list_types():
    """T-DS-R11: export_type_catalog 与 list_types 一致。"""
    registry._connectors.clear()
    register_builtin_dialects()
    catalog = export_type_catalog()
    listed = registry.list_types()
    assert len(catalog) == len(listed)
    for entry, desc in zip(catalog, listed, strict=True):
        assert entry["type"] == desc.type
        assert entry["displayName"] == desc.display_name
        assert entry["category"] == desc.category
        assert entry["capabilities"] == list(desc.capabilities)


def test_ingestion_mysql_type_in_catalog():
    """T-DS-R12: mysql 与 postgresql ∈ catalog（CONN-002）。"""
    registry._connectors.clear()
    register_builtin_dialects()
    types = {entry["type"] for entry in export_type_catalog()}
    assert "mysql" in types
    assert "postgresql" in types


@pytest.fixture(autouse=True)
def clean_data_sources_r24():
    yield
    with get_meta_engine().begin() as conn:
        conn.execute(text("DELETE FROM data_sources"))


def test_settings_missing_credential_sm4_key_raises():
    """T-DS-K11: 缺 CREDENTIAL_SM4_KEY → Settings 构造失败。"""
    kwargs = settings_kwargs()
    kwargs["credential_sm4_key"] = ""
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_decrypt_non_sm4_ciphertext_raises():
    """T-DS-K09: 非 sm4 前缀密文 → CredentialDecryptError。"""
    with pytest.raises(CredentialDecryptError):
        decrypt_credential("legacy-fernet-body")


def test_decrypt_invalid_sm4_body_raises():
    """T-DS-K10: 无效 sm4 密文 → CredentialDecryptError。"""
    with pytest.raises(CredentialDecryptError):
        decrypt_credential("sm4:not-valid-base64!!!")


def test_test_failure_path_logs_no_secrets(caplog, client, auth_headers):
    """T-DS-K12: test 失败路径 caplog 无 password 明文与完整 cipher。"""
    caplog.set_level(logging.INFO)
    created = client.post(
        "/api/v1/datasources",
        json={
            "name": "Log DS",
            "code": "log_ds",
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3306,
            "database": "demo",
            "username": "root",
            "password": "plain-secret",
        },
        headers=auth_headers,
    )
    ds_id = created.json()["id"]
    session = get_meta_session()
    row = session.get(DataSource, uuid.UUID(ds_id))
    cipher = row.password_encrypted
    row.password_encrypted = "corrupt-cipher"
    session.commit()
    session.close()
    with patch("app.datasources.dialects.mysql.pymysql.connect") as mock_connect:
        mock_connect.side_effect = pymysql.err.OperationalError(2003, "refused")
        client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert "plain-secret" not in caplog.text
    assert "password=" not in caplog.text.lower()
    assert cipher not in caplog.text


def test_connection_options_defaults():
    opts = ConnectionOptions()
    assert opts.charset == "utf8mb4"
    assert opts.ssl_mode == "preferred"
    assert opts.connect_timeout_sec == 5.0


def test_datasource_create_accepts_connection_options():
    payload = DataSourceCreate(
        name="Opts DS",
        code="opts_ds",
        type="mysql",
        host="127.0.0.1",
        port=3306,
        database="demo",
        username="root",
        password="secret",
        connection_options=ConnectionOptions(ssl_mode="required", connect_timeout_sec=3.0),
    )
    assert payload.connection_options is not None
    assert payload.connection_options.ssl_mode == "required"


def _payload(**overrides) -> dict:
    base = {
        "name": "Demo MySQL",
        "code": "demo_mysql",
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "demo",
        "username": "root",
        "password": "plain-secret",
    }
    base.update(overrides)
    return base


def test_list_offset_beyond_total(client, auth_headers):
    """T-DS-C17: offset=9999 → items=[], total 不变。"""
    client.post("/api/v1/datasources", json=_payload(), headers=auth_headers)
    resp = client.get("/api/v1/datasources?offset=9999", headers=auth_headers)
    body = resp.json()
    assert body["items"] == []
    assert body["total"] >= 1
    assert body["offset"] == 9999


def test_soft_delete_code_reuse(client, auth_headers):
    """T-DS-C18: 软删后同 code 再 POST → 201。"""
    created = client.post("/api/v1/datasources", json=_payload(code="reuse_code"), headers=auth_headers)
    ds_id = created.json()["id"]
    assert client.delete(f"/api/v1/datasources/{ds_id}", headers=auth_headers).status_code == 204
    resp = client.post("/api/v1/datasources", json=_payload(code="reuse_code", name="Reused"), headers=auth_headers)
    assert resp.status_code == 201


def test_create_with_connection_options_echoed(client, auth_headers):
    """T-DS-C19: POST connectionOptions → GET 回显。"""
    payload = _payload(
        code="opts_echo",
        connectionOptions={"sslMode": "required", "connectTimeoutSec": 3.0},
    )
    created = client.post("/api/v1/datasources", json=payload, headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["connectionOptions"]["sslMode"] == "required"
    got = client.get(f"/api/v1/datasources/{body['id']}", headers=auth_headers)
    assert got.json()["connectionOptions"]["connectTimeoutSec"] == 3.0


def test_patch_connection_options_only(client, auth_headers):
    """T-DS-C20: PATCH 仅 connectionOptions.sslMode。"""
    created = client.post("/api/v1/datasources", json=_payload(code="patch_opts"), headers=auth_headers)
    ds_id = created.json()["id"]
    before_name = created.json()["name"]
    patched = client.patch(
        f"/api/v1/datasources/{ds_id}",
        json={"connectionOptions": {"sslMode": "disabled"}},
        headers=auth_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == before_name
    assert patched.json()["connectionOptions"]["sslMode"] == "disabled"


def test_list_query_count_bounded(client, auth_headers, monkeypatch):
    """T-DS-C21: list 路径 DB execute/scalar 调用 ≤ 3。"""
    for i in range(3):
        client.post("/api/v1/datasources", json=_payload(code=f"cnt_{i}", name=f"C {i}"), headers=auth_headers)
    calls = {"n": 0}
    import sqlalchemy.orm

    real_scalar = sqlalchemy.orm.Session.scalar
    real_scalars = sqlalchemy.orm.Session.scalars

    def counting_scalar(self, *args, **kwargs):
        calls["n"] += 1
        return real_scalar(self, *args, **kwargs)

    def counting_scalars(self, *args, **kwargs):
        calls["n"] += 1
        return real_scalars(self, *args, **kwargs)

    monkeypatch.setattr(sqlalchemy.orm.Session, "scalar", counting_scalar)
    monkeypatch.setattr(sqlalchemy.orm.Session, "scalars", counting_scalars)
    # AuthMiddleware（Task 4）每请求解析身份会产生固定笔数的 scalar/scalars 读。
    # 本用例约束的是 list 路径自身的查询数，故先用一次「仅经中间件鉴权、路由体
    # 近乎零查询」的控制请求（GET /api/v1/me 前的 401 反例不触发解析，此处用
    # 一个不存在资源的 404 明细请求：中间件解析 + 单次 get）测得鉴权基线，再相减。
    calls["n"] = 0
    client.get(f"/api/v1/datasources/{uuid.uuid4()}", headers=auth_headers)
    auth_baseline = calls["n"]
    calls["n"] = 0
    client.get("/api/v1/datasources?limit=2", headers=auth_headers)
    list_path_calls = calls["n"] - auth_baseline
    assert list_path_calls <= 3


def test_responses_exclude_encrypted_password(client, auth_headers):
    """T-DS-C22: 响应无 password_encrypted 与明文。"""
    created = client.post("/api/v1/datasources", json=_payload(code="no_cipher"), headers=auth_headers)
    assert "password_encrypted" not in created.text
    assert "plain-secret" not in created.text
    listed = client.get("/api/v1/datasources", headers=auth_headers)
    assert "password_encrypted" not in listed.text


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_failed_test_includes_code(mock_connect, client, auth_headers):
    """T-DS-T11: 失败含 code MYSQL_*。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    resp = client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "MYSQL_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_back_to_back_test_without_waiting(mock_connect, client, auth_headers):
    """T-DS-T12: 连续两次 test 均 200（release 后）。"""
    mock_connect.return_value = MagicMock()
    created = client.post("/api/v1/datasources", json=_payload(code="dbl_test"), headers=auth_headers)
    ds_id = created.json()["id"]
    first = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    second = client.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
    assert first.status_code == 200
    assert second.status_code == 200


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_concurrent_test_same_id(mock_connect, client, auth_headers):
    """T-DS-T13: 3 路并行 test → 无 500（async ASGI，避免 TestClient 线程 SIGSEGV）。"""
    def slow(**kwargs):
        time.sleep(0.05)
        return MagicMock()

    mock_connect.side_effect = slow
    created = client.post("/api/v1/datasources", json=_payload(code="conc_test"), headers=auth_headers)
    ds_id = created.json()["id"]

    async def run_parallel() -> list[int]:
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
            responses = await asyncio.gather(
                *[
                    ac.post(f"/api/v1/datasources/{ds_id}/test", headers=auth_headers)
                    for _ in range(3)
                ]
            )
            return [r.status_code for r in responses]

    codes = asyncio.run(run_parallel())
    assert all(c in (200, 429) for c in codes)
    assert 500 not in codes


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_test_logs_trace_id(mock_connect, client, auth_headers, caplog):
    """T-DS-T14: caplog 含 traceId / datasource_test。"""
    caplog.set_level(logging.INFO)
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "refused")
    client.post("/api/v1/datasources/test", json=_payload(), headers=auth_headers)
    assert "datasource_test" in caplog.text or any("traceId" in str(r.__dict__) for r in caplog.records)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_draft_test_passes_connection_options(mock_connect, client, auth_headers):
    """T-DS-T15: draft test 传 connectionOptions → connect kwargs。"""
    mock_connect.return_value = MagicMock()
    client.post(
        "/api/v1/datasources/test",
        json=_payload(connectionOptions={"sslMode": "required", "charset": "utf8mb4"}),
        headers=auth_headers,
    )
    kwargs = mock_connect.call_args.kwargs
    assert kwargs.get("ssl") == {"ssl": {}}
    assert kwargs["charset"] == "utf8mb4"
