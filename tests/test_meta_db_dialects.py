"""Platform meta database dialect acceptance and Alembic smoke tests."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from crypto_test_env import TEST_SM4_KEY, settings_kwargs
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.db.meta import detect_meta_dialect, normalize_meta_database_url
from app.core.nfr.xinchuang import build_compliance_report

_BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_database_url_accepts_mysql_and_normalizes():
    settings = Settings(
        **settings_kwargs(
            database_url="mysql://vitalspan:vitalspan@localhost:3309/vitalspan",
        ),
    )
    assert settings.database_url.startswith("mysql+pymysql://")
    assert detect_meta_dialect(settings.database_url) == "mysql"


def test_database_url_accepts_sqlite_and_postgresql():
    sqlite = Settings(**settings_kwargs(database_url="sqlite+pysqlite:///./meta.db"))
    pg = Settings(
        **settings_kwargs(
            database_url="postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan",
        ),
    )
    assert detect_meta_dialect(sqlite.database_url) == "sqlite"
    assert detect_meta_dialect(pg.database_url) == "postgresql"


def test_database_url_rejects_unsupported_protocol():
    with pytest.raises(ValidationError) as exc_info:
        Settings(**settings_kwargs(database_url="oracle://user:pass@localhost/xe"))
    assert "postgresql" in str(exc_info.value) or "mysql" in str(exc_info.value)


def test_xinchuang_platform_db_passes_for_mysql():
    settings = Settings(
        **settings_kwargs(
            database_url="mysql+pymysql://vitalspan:vitalspan@localhost:3309/vitalspan",
        ),
    )
    report = build_compliance_report(settings)
    platform_item = next(item for item in report.items if item.id == "xc-platform-db")
    assert platform_item.status == "pass"


def _run_alembic_upgrade(database_url: str) -> subprocess.CompletedProcess:
    from crypto_test_env import TEST_JWT_SM2_PRIVATE, TEST_JWT_SM2_PUBLIC

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env.setdefault("JWT_SM2_PRIVATE_KEY", TEST_JWT_SM2_PRIVATE)
    env.setdefault("JWT_SM2_PUBLIC_KEY", TEST_JWT_SM2_PUBLIC)
    env.setdefault("CREDENTIAL_SM4_KEY", TEST_SM4_KEY)
    env.setdefault("VITALSPAN_ENV", "development")
    return subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_alembic_upgrade_head_on_sqlite_file_db():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "meta.db"
        url = f"sqlite+pysqlite:///{db_path.as_posix()}"
        result = _run_alembic_upgrade(url)
        assert result.returncode == 0, result.stderr or result.stdout


@pytest.mark.integration
def test_alembic_upgrade_head_on_mysql_compose():
    url = normalize_meta_database_url(
        os.environ.get(
            "META_MYSQL_URL",
            "mysql://vitalspan:vitalspan@127.0.0.1:3309/vitalspan",
        )
    )
    result = _run_alembic_upgrade(url)
    if result.returncode != 0 and "Can't connect to MySQL server" in (result.stderr or ""):
        pytest.skip("meta-mysql compose service not running on :3309")
    assert result.returncode == 0, result.stderr or result.stdout
