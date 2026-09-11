import os

import pytest
from crypto_test_env import settings_kwargs

from app.core.config import Settings, get_settings


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_loads_analytics_database_url_from_env(monkeypatch):
    url = "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", url)
    settings = Settings(**settings_kwargs(), analytics_database_url=url)
    assert settings.analytics_database_url == url


def test_settings_analytics_database_url_optional(monkeypatch):
    monkeypatch.delenv("ANALYTICS_DATABASE_URL", raising=False)
    settings = Settings(**settings_kwargs())
    assert settings.analytics_database_url is None


from pydantic import ValidationError


def test_settings_analytics_url_blank_treated_as_none(monkeypatch):
    """T-D04-03: 空白 ANALYTICS_DATABASE_URL → None。"""
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", "   ")
    settings = Settings(**settings_kwargs())
    assert settings.analytics_database_url is None


def test_settings_analytics_url_invalid_raises_validation_error(monkeypatch):
    """T-D04-03: 非法 scheme → ValidationError。"""
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", "not-a-valid-url")
    with pytest.raises(ValidationError) as exc_info:
        Settings(**settings_kwargs())
    assert "托管分析库 URL" in str(exc_info.value)


def test_settings_analytics_url_valid_postgresql_passes(monkeypatch):
    """T-D04-08: 合法 postgresql+psycopg URL 通过。"""
    url = "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", url)
    settings = Settings(**settings_kwargs())
    assert settings.analytics_database_url == url


def test_ingestion_migration_0002_revision_and_tables_exist():
    """T-D04-09: 0002 ingestion 迁移 revision 与三表名锚点。"""
    import importlib
    from pathlib import Path

    rev = importlib.import_module("migrations.versions.0002_ingestion_tables")
    assert rev.revision == "0002"
    text = Path("migrations/versions/0002_ingestion_tables.py").read_text(encoding="utf-8")
    for table in (
        "ingestion_sync_jobs",
        "ingestion_sync_runs",
        "ingestion_etl_rules",
    ):
        assert table in text


def test_settings_missing_jwt_sm2_private_key_raises(monkeypatch):
    """T-D04-04: 缺 JWT_SM2_PRIVATE_KEY 时 Settings 实例化失败。"""
    monkeypatch.delenv("JWT_SM2_PRIVATE_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(**{k: v for k, v in settings_kwargs().items() if k != "jwt_sm2_private_key"})


from unittest.mock import MagicMock, patch

from app.ingestion.models import SyncJob, encrypt_password
from app.ingestion.sync_write import write_analytics


@patch("app.ingestion.sync_write.create_engine")
@patch("app.ingestion.sync_write.get_settings")
def test_write_analytics_uses_pool_pre_ping(mock_get_settings, mock_create_engine):
    """T-D04-11: write_analytics 使用 pool_pre_ping=True。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    job = SyncJob(
        name="pool-ping-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_pool",
        enabled=True,
    )
    write_analytics(job, [{"col": "val"}])

    mock_create_engine.assert_called_once_with(
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics",
        pool_pre_ping=True,
    )


def test_analytics_sqlite_fixture_contract(analytics_sqlite):
    """T-D04-12: analytics_sqlite fixture 返回内存 sqlite URL。"""
    assert analytics_sqlite == "sqlite+pysqlite:///:memory:"


def test_settings_rejects_sqlite_analytics_url(monkeypatch):
    """T-D04-12: Settings 校验拒绝 sqlite 托管库 URL（生产仅 postgresql）。"""
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    with pytest.raises(ValidationError) as exc_info:
        Settings(**settings_kwargs())
    assert "托管分析库 URL" in str(exc_info.value)


import uuid

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.ingestion.models import (
    Base,
    EtlRuleSet,
    SyncRun,
    encrypt_password,
    get_meta_engine,
    get_meta_session,
)
from app.ingestion.sync_executor import run_job

os.environ.setdefault(
    "DATABASE_URL",
    "sqlite+pysqlite:///file:ingestion_config_run?mode=memory&cache=shared&uri=true",
)
get_meta_engine.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def ensure_ingestion_meta_tables():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ingestion_sync_runs"))
        conn.execute(text("DELETE FROM ingestion_etl_rules"))
        conn.execute(text("DELETE FROM ingestion_sync_jobs"))


def _seed_config_run_job() -> uuid.UUID:
    db = get_meta_session()
    job = SyncJob(
        name="analytics-fail-job",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_analytics_fail",
        enabled=True,
    )
    db.add(job)
    db.flush()
    db.add(EtlRuleSet(job_id=job.id, rules=[]))
    db.commit()
    job_id = job.id
    db.close()
    return job_id


def _latest_run_for_config(job_id: uuid.UUID) -> SyncRun:
    db = get_meta_session()
    run = db.scalar(
        select(SyncRun).where(SyncRun.job_id == job_id).order_by(SyncRun.started_at.desc())
    )
    db.close()
    assert run is not None
    return run


@patch("app.ingestion.sync_write.create_engine")
@patch("app.ingestion.sync_write.get_settings")
def test_write_analytics_connection_refused_propagates(mock_get_settings, mock_create_engine):
    """T-D04-14: begin() OperationalError → write_analytics 向外传播。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.side_effect = OperationalError("connection refused", None, None)

    job = SyncJob(
        name="conn-refused-direct",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3307,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="t",
        target_table="tgt_refused",
        enabled=True,
    )
    with pytest.raises(OperationalError, match="connection refused"):
        write_analytics(job, [{"col": "val"}])


@patch("app.ingestion.sync_write.create_engine")
@patch("app.ingestion.sync_write.get_settings")
@patch(
    "app.ingestion.sync_executor.fetch_mysql_rows",
    return_value=[{"product_name": "A", "amount": "1", "status": "active", "note": None}],
)
def test_run_job_analytics_connection_refused_failed(
    mock_fetch, mock_get_settings, mock_create_engine
):
    """T-D04-14: analytics 连接拒绝经 run_job → failed + 可读 error_message ≤500。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.side_effect = OperationalError("connection refused", None, None)

    job_id = _seed_config_run_job()
    run_job(job_id, "trace-analytics-refused")
    run = _latest_run_for_config(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert "connection refused" in run.error_message or "refused" in run.error_message.lower()
    assert len(run.error_message) <= 500


@patch("app.ingestion.sync_write.create_engine")
@patch("app.ingestion.sync_write.get_settings")
@patch(
    "app.ingestion.sync_executor.fetch_mysql_rows",
    return_value=[{"col": "v"}],
)
def test_run_job_bad_analytics_host_runtime_write_failed(
    mock_fetch, mock_get_settings, mock_create_engine
):
    """T-D04-15: 非法 host URL Settings 可过但 runtime write 失败 → failed。"""
    bad_url = "postgresql+psycopg://bad:bad@127.0.0.1:1/none"
    mock_get_settings.return_value.analytics_database_url = bad_url
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.side_effect = OperationalError("could not connect", None, None)

    job_id = _seed_config_run_job()
    run_job(job_id, "trace-bad-host")
    run = _latest_run_for_config(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert len(run.error_message) <= 500
    mock_create_engine.assert_called_with(bad_url, pool_pre_ping=True)


import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


@patch("app.ingestion.sync_write.create_engine")
@patch("app.ingestion.sync_write.get_settings")
@patch(
    "app.ingestion.sync_executor.fetch_mysql_rows",
    return_value=[{"col": "v"}],
)
def test_run_job_connection_timeout_failed(
    mock_fetch, mock_get_settings, mock_create_engine
):
    """T-D04-17: 连接超时 OperationalError → failed + error_message 含 timeout。"""
    mock_get_settings.return_value.analytics_database_url = (
        "postgresql+psycopg://vitalspan:vitalspan@localhost:5433/analytics"
    )
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    mock_engine.begin.side_effect = OperationalError("connection timeout", None, None)

    job_id = _seed_config_run_job()
    run_job(job_id, "trace-timeout")
    run = _latest_run_for_config(job_id)
    assert run.status == "failed"
    assert run.error_message is not None
    assert "timeout" in run.error_message.lower()
    assert len(run.error_message) <= 500


def _compose_service_block(compose_text: str, service: str) -> str:
    pattern = rf"^\s*{re.escape(service)}:\s*$"
    lines = compose_text.splitlines()
    start = next(i for i, line in enumerate(lines) if re.match(pattern, line))
    block: list[str] = []
    for line in lines[start + 1 :]:
        if re.match(r"^\S", line) and not line.startswith(" "):
            break
        block.append(line)
    return "\n".join(block)


def test_docker_compose_healthcheck_contract():
    """T-D04-18: analytics-postgres / sample-mysql healthcheck 字段契约。"""
    compose_path = Path(__file__).resolve().parents[1] / "docker-compose.yml"
    text = compose_path.read_text(encoding="utf-8")
    analytics = _compose_service_block(text, "analytics-postgres")
    mysql = _compose_service_block(text, "sample-mysql")
    assert "pg_isready" in analytics
    assert "mysqladmin" in mysql and "ping" in mysql
    for block in (analytics, mysql):
        assert "interval:" in block
        assert "timeout:" in block
        assert "retries:" in block


@pytest.fixture
def config_api_client() -> TestClient:
    return TestClient(app)


def test_trigger_run_without_analytics_url_503_regression(
    config_api_client, auth_headers, monkeypatch
):
    """T-D04-19: 缺失 ANALYTICS_DATABASE_URL 时 POST run → 503 ANALYTICS_DB_NOT_CONFIGURED。"""
    from app.core.config import get_settings

    job_payload = {
        "name": "no-analytics-url",
        "source": {
            "type": "mysql",
            "host": "127.0.0.1",
            "port": 3307,
            "database": "sample_db",
            "username": "sample",
            "password": "sample",
            "table": "dirty_orders",
        },
        "target_table": "orders_clean",
        "schedule_cron": None,
    }
    create = config_api_client.post(
        "/api/v1/ingestion/sync-jobs", json=job_payload, headers=auth_headers
    )
    assert create.status_code == 201
    job_id = create.json()["id"]
    get_settings.cache_clear()
    with patch("app.api.v1.ingestion.sync.get_settings") as mock_get:
        mock_get.return_value.analytics_database_url = None
        response = config_api_client.post(
            f"/api/v1/ingestion/sync-jobs/{job_id}/run",
            headers=auth_headers,
        )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ANALYTICS_DB_NOT_CONFIGURED"
    config_api_client.delete(
        f"/api/v1/ingestion/sync-jobs/{job_id}", headers=auth_headers
    )
