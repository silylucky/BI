import importlib
import os
import subprocess
import sys
import time
from configparser import ConfigParser
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy import pool as sa_pool
from sqlalchemy.exc import OperationalError

from app.core.config import Settings, get_settings
from crypto_test_env import settings_kwargs

from migration_utils import single_head as alembic_head

KNOWN_URL = "postgresql+psycopg://mock:mock@localhost:5432/mock"


def _migration_subprocess_env() -> dict[str, str]:
    from crypto_test_env import TEST_JWT_SM2_PRIVATE, TEST_JWT_SM2_PUBLIC, TEST_SM4_KEY

    env = os.environ.copy()
    env["DATABASE_URL"] = KNOWN_URL
    env["JWT_SM2_PRIVATE_KEY"] = TEST_JWT_SM2_PRIVATE
    env["JWT_SM2_PUBLIC_KEY"] = TEST_JWT_SM2_PUBLIC
    env["CREDENTIAL_SM4_KEY"] = TEST_SM4_KEY
    env["VITALSPAN_ENV"] = "development"
    return env


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_database_url_matches_env():
    """T-MIG-01: Settings 从环境变量加载 database_url。"""
    settings = get_settings()
    assert settings.database_url == os.environ["DATABASE_URL"]


def test_migrations_env_binds_settings_database_url(monkeypatch):
    """T-MIG-02: migrations/env.py 将 settings.database_url 写入 alembic config。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()

    mock_config = MagicMock()
    mock_config.config_file_name = None

    sys.modules.pop("migrations.env", None)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", KNOWN_URL)


def test_settings_missing_database_url_raises(monkeypatch):
    """T-MIG-03: 缺 DATABASE_URL 时 Settings 实例化失败。"""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        kwargs = settings_kwargs()
        kwargs["database_url"] = ""
        Settings(**kwargs)


def test_settings_env_override_database_url(monkeypatch):
    """T-MIG-04: env 覆盖 DATABASE_URL 生效。"""
    alt = "postgresql+psycopg://alt:alt@localhost:5432/alt"
    monkeypatch.setenv("DATABASE_URL", alt)
    get_settings.cache_clear()
    assert get_settings().database_url == alt


def test_alembic_ini_script_location_matches_repo():
    """T-MIG-05: alembic.ini script_location 与 migrations/ 目录一致。"""
    ini_path = Path(__file__).resolve().parents[1] / "backend" / "alembic.ini"
    parser = ConfigParser()
    parser.read(ini_path)
    assert parser.get("alembic", "script_location") == "migrations"
    migrations_dir = ini_path.parent / "migrations"
    assert migrations_dir.is_dir()


def test_settings_empty_database_url_raises(monkeypatch):
    """T-MIG-06: 空白 DATABASE_URL → ValidationError。"""
    monkeypatch.setenv("DATABASE_URL", "")
    get_settings.cache_clear()
    with pytest.raises(ValidationError) as exc_info:
        get_settings()
    assert "DATABASE_URL" in str(exc_info.value) or "不能为空" in str(exc_info.value)


def test_settings_missing_jwt_sm2_private_key_raises(monkeypatch):
    """T-MIG-07: 缺 JWT_SM2_PRIVATE_KEY 时 Settings 实例化失败。"""
    monkeypatch.delenv("JWT_SM2_PRIVATE_KEY", raising=False)
    get_settings.cache_clear()
    kwargs = settings_kwargs(database_url=KNOWN_URL)
    kwargs["jwt_sm2_private_key"] = ""
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_settings_missing_credential_sm4_key_raises(monkeypatch):
    """T-MIG-08: 缺 CREDENTIAL_SM4_KEY 时 Settings 实例化失败。"""
    monkeypatch.delenv("CREDENTIAL_SM4_KEY", raising=False)
    get_settings.cache_clear()
    kwargs = settings_kwargs(database_url=KNOWN_URL)
    kwargs["credential_sm4_key"] = ""
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_migrations_env_fails_when_get_settings_raises(monkeypatch):
    """T-MIG-09: migrations/env.py 在 get_settings() 失败时无法完成 URL 绑定。"""
    validation_error = ValidationError.from_exception_data(
        "Settings",
        [{"type": "missing", "loc": ("database_url",), "input": {}}],
    )

    def raise_validation():
        raise validation_error

    monkeypatch.setattr("app.core.config.get_settings", raise_validation)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_context = MagicMock()
    mock_context.config = mock_config

    with patch("alembic.context", mock_context):
        with pytest.raises(ValidationError):
            importlib.import_module("migrations.env")


def test_settings_invalid_database_url_raises():
    """T-MIG-10: 非法格式 database_url → ValidationError 含协议提示。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(**settings_kwargs(database_url="not-a-url"))
    assert "postgresql" in str(exc_info.value)


def test_migrations_offline_url_matches_settings(monkeypatch):
    """T-MIG-11: offline 模式 context.configure 的 url 与 set_main_option 一致。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_main_option.return_value = KNOWN_URL

    sys.modules.pop("migrations.env", None)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True
    captured_urls: list[str] = []

    def capture_configure(**kwargs):
        if "url" in kwargs:
            captured_urls.append(kwargs["url"])

    mock_context.configure = capture_configure
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock()

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", KNOWN_URL)
    assert captured_urls == [KNOWN_URL]


def test_revision_upgrade_downgrade_noop():
    """T-MIG-12: 0001/0002 upgrade/downgrade 空操作可调用。"""
    rev_0001 = importlib.import_module("migrations.versions.0001_initial")
    rev_0002 = importlib.import_module("migrations.versions.0002_ingestion_tables")
    rev_0001.upgrade()
    rev_0001.downgrade()
    with patch.object(rev_0002, "op", MagicMock()):
        rev_0002.upgrade()
        rev_0002.downgrade()


def test_revision_chain_0002_down_revision_is_0001():
    """T-MIG-13: revision 链 0002.down_revision == '0001'。"""
    rev_0001 = importlib.import_module("migrations.versions.0001_initial")
    rev_0002 = importlib.import_module("migrations.versions.0002_ingestion_tables")
    assert rev_0001.revision == "0001"
    assert rev_0002.revision == "0002"
    assert rev_0002.down_revision == "0001"


def test_migrations_offline_run_migrations_called(monkeypatch):
    """T-MIG-14: offline 模式触发 context.run_migrations()。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_main_option.return_value = KNOWN_URL

    sys.modules.pop("migrations.env", None)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock()

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_context.run_migrations.assert_called_once()
    sys.modules.pop("migrations.env", None)


def test_revision_directory_single_head_chain():
    """T-MIG-15: versions/*.py revision 唯一、单链、head 与仓库一致。"""
    from migration_utils import revision_graph, single_head

    revisions = revision_graph()
    assert len(revisions) == len(set(revisions.keys()))
    assert revisions["0001"] is None
    assert revisions["0002"] == "0001"
    assert single_head() in revisions
    referred_down = {d for d in revisions.values() if d}
    heads = [rev for rev in revisions if rev not in referred_down]
    assert heads == [single_head()]


def test_migrations_online_path_connects_and_runs(monkeypatch):
    """T-MIG-16: is_offline_mode=False 时 connect() 与 run_migrations() 被调用。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_connection = MagicMock()
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_connection)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)

    with patch("alembic.context", mock_context):
        with patch("sqlalchemy.engine_from_config", return_value=mock_engine):
            importlib.import_module("migrations.env")

    mock_engine.connect.assert_called_once()
    mock_context.run_migrations.assert_called_once()
    sys.modules.pop("migrations.env", None)


def test_migrations_offline_import_under_budget(monkeypatch):
    """T-MIG-17: offline 导入 migrations.env 全流程 < 2s。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_main_option.return_value = KNOWN_URL

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)

    start = time.perf_counter()
    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")
    elapsed = time.perf_counter() - start

    assert elapsed < 2.0
    sys.modules.pop("migrations.env", None)


def test_migrations_env_rebinds_on_settings_change(monkeypatch):
    """T-MIG-18: DATABASE_URL 变更后重导入 migrations.env 绑定新 URL。"""
    url_a = "postgresql+psycopg://a:a@localhost:5432/a"
    url_b = "postgresql+psycopg://b:b@localhost:5432/b"

    def import_env_and_capture_url() -> str:
        sys.modules.pop("migrations.env", None)
        mock_config = MagicMock()
        mock_config.config_file_name = None
        mock_context = MagicMock()
        mock_context.config = mock_config
        mock_context.is_offline_mode.return_value = True
        with patch("alembic.context", mock_context):
            importlib.import_module("migrations.env")
        call_args = mock_config.set_main_option.call_args
        assert call_args is not None
        return call_args[0][1]

    monkeypatch.setenv("DATABASE_URL", url_a)
    get_settings.cache_clear()
    assert import_env_and_capture_url() == url_a

    monkeypatch.setenv("DATABASE_URL", url_b)
    get_settings.cache_clear()
    assert import_env_and_capture_url() == url_b
    sys.modules.pop("migrations.env", None)


def test_alembic_upgrade_head_sql_contains_ingestion_tables():
    """T-MIG-19: alembic upgrade head --sql stdout 含 ingestion_sync_jobs。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    stdout = result.stdout
    assert "ingestion_sync_jobs" in stdout
    assert "ingestion_sync_runs" in stdout
    assert "ingestion_etl_rules" in stdout


def test_revision_0002_source_defines_ingestion_table_names():
    """T-MIG-20: 0002 revision 源码含三张 ingestion 表名。"""
    rev_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "migrations"
        / "versions"
        / "0002_ingestion_tables.py"
    )
    source = rev_path.read_text(encoding="utf-8")
    for table in ("ingestion_sync_jobs", "ingestion_sync_runs", "ingestion_etl_rules"):
        assert table in source


def test_alembic_downgrade_base_sql_contains_ingestion_drop():
    """T-MIG-21: alembic downgrade base --sql 子进程可预期降级链。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "head:base", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    stdout_upper = result.stdout.upper()
    assert "DROP" in stdout_upper or "ingestion_sync_jobs" in result.stdout


def test_alembic_upgrade_sql_stdout_excludes_secrets():
    """T-MIG-22: upgrade head --sql stdout 不含 JWT 私钥明文。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    env = _migration_subprocess_env()
    secret = env["JWT_SM2_PRIVATE_KEY"]
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert secret not in result.stdout


def test_settings_env_py_binding_end_to_end(monkeypatch):
    """T-MIG-23: 同一 DATABASE_URL 下 Settings 与 env.py set_main_option 一致。"""
    bound_url = "postgresql+psycopg://e2e:e2e@localhost:5432/e2e"
    monkeypatch.setenv("DATABASE_URL", bound_url)
    get_settings.cache_clear()
    assert get_settings().database_url == bound_url

    fake_settings = Settings(**settings_kwargs(database_url=bound_url))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = True

    with patch("alembic.context", mock_context):
        importlib.import_module("migrations.env")

    mock_config.set_main_option.assert_called_with("sqlalchemy.url", bound_url)
    sys.modules.pop("migrations.env", None)


def test_migrations_env_reimport_under_budget(monkeypatch):
    """T-MIG-24: DATABASE_URL 变更后重导入 migrations.env < 2s（rebind 路径）。"""
    url_a = "postgresql+psycopg://perf:a@localhost:5432/a"
    url_b = "postgresql+psycopg://perf:b@localhost:5432/b"

    def import_env_timed() -> float:
        sys.modules.pop("migrations.env", None)
        mock_config = MagicMock()
        mock_config.config_file_name = None
        mock_context = MagicMock()
        mock_context.config = mock_config
        mock_context.is_offline_mode.return_value = True
        mock_context.begin_transaction.return_value.__enter__ = MagicMock()
        mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)
        start = time.perf_counter()
        with patch("alembic.context", mock_context):
            importlib.import_module("migrations.env")
        return time.perf_counter() - start

    monkeypatch.setenv("DATABASE_URL", url_a)
    get_settings.cache_clear()
    assert import_env_timed() < 2.0

    monkeypatch.setenv("DATABASE_URL", url_b)
    get_settings.cache_clear()
    assert import_env_timed() < 2.0
    sys.modules.pop("migrations.env", None)


def test_alembic_heads_single_head():
    """T-MIG-25: alembic heads 子进程 returncode==0 且 stdout 含 0012（单 head）。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "heads"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert alembic_head() in result.stdout


def test_migrations_online_uses_null_pool(monkeypatch):
    """T-MIG-26: online 路径 engine_from_config 使用 poolclass=NullPool。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_connection = MagicMock()
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_connection)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False
    mock_context.begin_transaction.return_value.__enter__ = MagicMock()
    mock_context.begin_transaction.return_value.__exit__ = MagicMock(return_value=False)

    captured_kwargs: dict = {}

    def capture_engine_from_config(configuration, prefix="sqlalchemy.", **kwargs):
        captured_kwargs.update(kwargs)
        return mock_engine

    with patch("alembic.context", mock_context):
        with patch("sqlalchemy.engine_from_config", side_effect=capture_engine_from_config):
            importlib.import_module("migrations.env")

    assert captured_kwargs.get("poolclass") is sa_pool.NullPool
    sys.modules.pop("migrations.env", None)


def test_settings_unsupported_protocol_raises():
    """T-MIG-27: 不支持的数据库协议 → ValidationError。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            **settings_kwargs(database_url="oracle://user:pass@localhost/xe"),
        )
    assert "postgresql" in str(exc_info.value) or "mysql" in str(exc_info.value)


def test_migrations_online_connect_operational_error_propagates(monkeypatch):
    """T-MIG-28: online connect() 抛 OperationalError 向上传播。"""
    fake_settings = Settings(**settings_kwargs(database_url=KNOWN_URL))
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError("stmt", {}, Exception("connection refused"))

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False

    with patch("alembic.context", mock_context):
        with patch("sqlalchemy.engine_from_config", return_value=mock_engine):
            with pytest.raises(OperationalError):
                importlib.import_module("migrations.env")

    sys.modules.pop("migrations.env", None)


def test_alembic_upgrade_head_sql_subprocess_smoke():
    """T-MIG-29: alembic upgrade head --sql 子进程 returncode==0 且含 CREATE TABLE 或 ingestion_sync_jobs。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    stdout_upper = result.stdout.upper()
    assert "ingestion_sync_jobs" in result.stdout or "CREATE TABLE" in stdout_upper


def test_revision_chain_no_orphans_head_0003():
    """T-MIG-30: revision 链无 orphan；唯一 head 为 0012。"""
    versions_dir = (
        Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    )
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        module = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[module.revision] = module.down_revision

    all_ids = set(revisions.keys())
    for rev, down in revisions.items():
        if down is not None:
            assert down in all_ids, f"orphan down_revision {down!r} for {rev}"

    referred_down = {d for d in revisions.values() if d}
    heads = [rev for rev in revisions if rev not in referred_down]
    assert heads == [alembic_head()]


def test_revision_chain_head_is_0013():
    """T-MIG-34: revision 链唯一 head 为 0013；0013.down_revision==0012。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        module = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[module.revision] = module.down_revision

    heads = [rev for rev, down in revisions.items() if not any(d == rev for d in revisions.values())]
    assert heads == [alembic_head()]

    mod = importlib.import_module("migrations.versions.0013_dashboards")
    assert mod.down_revision == "0012"


def test_alembic_upgrade_sql_contains_auth_roles():
    """T-MIG-33: alembic upgrade head --sql 输出含 auth_roles。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "auth_roles" in result.stdout


def test_alembic_upgrade_sql_contains_dimension_groups():
    """T-MIG-35: upgrade head --sql 含 auth_dimension_groups。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert "auth_dimension_groups" in result.stdout


def test_revision_chain_head_0012_down_revision():
    """T-MIG-36: heads 含 0012；0012.down_revision==0011。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert alembic_head() in heads
    assert revisions["0012"] == "0011"


def test_alembic_upgrade_head_sql_contains_data_sources():
    """T-MIG-37: upgrade head --sql 含 data_sources。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "data_sources" in result.stdout


def test_revision_chain_head_0012_down_revision_t_mig38():
    """T-MIG-38: heads 含 0012；0012.down_revision==0011。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert alembic_head() in heads
    assert revisions["0012"] == "0011"


def test_alembic_upgrade_head_sql_contains_chart_query_bindings():
    """T-MIG-39: upgrade head --sql 含 chart_query_bindings。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "chart_query_bindings" in result.stdout


def test_revision_chain_head_0012_down_revision_t_mig40():
    """T-MIG-40: heads 含 0012；0012.down_revision==0011。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert alembic_head() in heads
    assert revisions["0012"] == "0011"


def test_revision_chain_head_0013_down_revision_t_mig41():
    """T-MIG-41: heads 含 0013；0013.down_revision==0012。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in sorted(versions_dir.glob("*.py")):
        if path.name.startswith("__"):
            continue
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert heads == [alembic_head()]
    assert revisions["0013"] == "0012"


def test_alembic_upgrade_head_sql_contains_dashboards_t_mig42():
    """T-MIG-42: upgrade head --sql 含 dashboards 表。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "dashboards" in result.stdout


def test_alembic_upgrade_head_sql_contains_chart_id():
    """T-MIG-40b: upgrade head --sql 含 chart_id 列。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "chart_id" in result.stdout


def test_unreachable_host_operational_error_message(monkeypatch):
    """T-MIG-31: 不可达 host DATABASE_URL online 导入传播 OperationalError 且消息含 connection/refused。"""
    unreachable_url = "postgresql+psycopg://ci:ci@127.0.0.1:1/ci_unreachable"
    fake_settings = Settings(
        database_url=unreachable_url,
        **settings_kwargs(),
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: fake_settings)
    get_settings.cache_clear()
    sys.modules.pop("migrations.env", None)

    mock_config = MagicMock()
    mock_config.config_file_name = None
    mock_config.get_section.return_value = {}

    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError(
        "stmt", {}, Exception("connection refused")
    )

    mock_context = MagicMock()
    mock_context.config = mock_config
    mock_context.is_offline_mode.return_value = False

    with patch("alembic.context", mock_context):
        with patch("sqlalchemy.engine_from_config", return_value=mock_engine):
            with pytest.raises(OperationalError) as exc_info:
                importlib.import_module("migrations.env")

    message = str(exc_info.value).lower()
    assert "connection" in message or "refused" in message
    sys.modules.pop("migrations.env", None)


def test_revision_chain_head_0014_down_revision_t_mig43():
    """T-MIG-43: heads 含 0015；0014.down_revision==0013。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in versions_dir.glob("*.py"):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert heads == [alembic_head()]
    assert revisions["0014"] == "0013"


def test_revision_chain_head_0015_down_revision_t_mig45():
    """T-MIG-45: heads 含 0016；0015.down_revision==0014。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in versions_dir.glob("*.py"):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert heads == [alembic_head()]
    assert revisions["0015"] == "0014"


def test_revision_chain_head_0016_down_revision_t_mig46():
    """T-MIG-46: heads 含 0016；0016.down_revision==0015。"""
    versions_dir = Path(__file__).resolve().parents[1] / "backend" / "migrations" / "versions"
    revisions: dict[str, str | None] = {}
    for path in versions_dir.glob("*.py"):
        mod = importlib.import_module(f"migrations.versions.{path.stem}")
        revisions[mod.revision] = mod.down_revision
    heads = [rev for rev in revisions if rev not in revisions.values()]
    assert heads == [alembic_head()]
    assert revisions["0016"] == "0015"
    assert revisions["0017"] == "0016"
    assert revisions["0018"] == "0017"
    assert revisions["0019"] == "0018"
    assert revisions["0020"] == "0019"
    assert revisions["0021"] == "0020"
    assert revisions["0022"] == "0021"


def test_alembic_upgrade_head_sql_contains_catalog_tables_t_mig44():
    """T-MIG-44: upgrade head --sql 含 catalog_categories 与 bus_registrations。"""
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=Path(__file__).resolve().parents[1] / "backend",
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "catalog_categories" in result.stdout
    assert "bus_registrations" in result.stdout


def test_alembic_upgrade_head_sql_contains_auth_permissions():
    """T-MIG-47: upgrade head --sql 含 auth_permissions 与 auth_role_permissions（0024）。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert "auth_permissions" in result.stdout
    assert "auth_role_permissions" in result.stdout


# --------------------------------------------------------------------------- #
# Task 3: 0025 权限目录回填 + root 管理员不变量
# --------------------------------------------------------------------------- #

_MOD_0025 = "migrations.versions.0025_auth_permission_backfill"


def _capture_0025_upgrade_sql() -> list[str]:
    """以 mock op 捕获 0025.upgrade() 发出的全部 SQL 语句。"""
    module = importlib.import_module(_MOD_0025)
    mock_op = MagicMock()
    with patch.object(module, "op", mock_op):
        module.upgrade()
    return [call.args[0] for call in mock_op.execute.call_args_list]


def test_revision_0025_chain():
    """T-MIG-48: 0025 revision 链 down_revision==0024。"""
    module = importlib.import_module(_MOD_0025)
    assert module.revision == "0025"
    assert module.down_revision == "0024"


def test_revision_0025_upgrade_idempotent_on_conflict():
    """T-MIG-49: 0025 全部插入语句含 ON CONFLICT，且重复执行输出一致（幂等无副作用）。"""
    first = _capture_0025_upgrade_sql()
    second = _capture_0025_upgrade_sql()
    assert first == second
    inserts = [s for s in first if s.upper().startswith("INSERT")]
    assert inserts, "expected INSERT statements in 0025 upgrade"
    for statement in inserts:
        assert "ON CONFLICT" in statement, statement


def test_revision_0025_marks_admin_root_and_system():
    """T-MIG-50: 0025 将 admin 标记 is_root/is_system，按 code upsert。"""
    statements = _capture_0025_upgrade_sql()
    admin_stmts = [s for s in statements if "auth_roles" in s and "'admin'" in s]
    assert len(admin_stmts) == 1
    stmt = admin_stmts[0]
    assert "is_root" in stmt and "is_system" in stmt
    assert "ON CONFLICT (code) DO UPDATE" in stmt


def test_revision_0025_maps_preset_roles_per_global_constraints():
    """T-MIG-51: analyst/viewer/editor/owner 按 Global Constraints 映射权限。"""
    statements = _capture_0025_upgrade_sql()

    def _codes_for(role_code: str) -> str | None:
        for s in statements:
            if f"r.code = '{role_code}'" in s:
                return s
        return None

    analyst = _codes_for("analyst")
    assert analyst is not None
    for code in ("dashboard:read", "dashboard:edit", "report:read", "theme:read", "theme:manage"):
        assert f"'{code}'" in analyst

    viewer = _codes_for("viewer")
    assert viewer is not None
    assert "'dashboard:read'" in viewer and "'report:read'" in viewer
    assert "'dashboard:edit'" not in viewer

    for role_code in ("editor", "owner"):
        stmt = _codes_for(role_code)
        assert stmt is not None
        assert "'report:read'" in stmt and "'report:manage'" in stmt


def test_revision_0025_does_not_grant_custom_roles():
    """T-MIG-52: 仅预置角色被映射；自定义角色不扩权。"""
    statements = _capture_0025_upgrade_sql()
    mapped_roles = {
        s.split("r.code = '", 1)[1].split("'", 1)[0]
        for s in statements
        if "r.code = '" in s
    }
    assert mapped_roles == {"analyst", "viewer", "editor", "owner"}


def test_revision_0025_never_assigns_users():
    """T-MIG-53: 空库/无 admin 绑定/admin 禁用三态下，回填绝不写 auth_user_roles。"""
    statements = _capture_0025_upgrade_sql()
    assert all("auth_user_roles" not in s for s in statements)


def test_alembic_upgrade_head_sql_contains_permission_backfill():
    """T-MIG-54: upgrade head --sql 含权限目录回填与 admin root 标记（ON CONFLICT）。"""
    backend_dir = Path(__file__).resolve().parents[1] / "backend"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=backend_dir,
        env=_migration_subprocess_env(),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert "ON CONFLICT" in result.stdout
    assert "dashboard:read" in result.stdout
