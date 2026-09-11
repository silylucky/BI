"""T-CFG-01~03: Settings 安全边界与 .env.example 对齐。"""

import logging
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from crypto_test_env import TEST_JWT_SM2_PRIVATE, settings_kwargs

REQUIRED_ENV_KEYS = (
    "DATABASE_URL",
    "JWT_SM2_PRIVATE_KEY",
    "JWT_SM2_PUBLIC_KEY",
    "CREDENTIAL_SM4_KEY",
)
ENV_TO_FIELD = {
    "DATABASE_URL": "database_url",
    "JWT_SM2_PRIVATE_KEY": "jwt_sm2_private_key",
    "JWT_SM2_PUBLIC_KEY": "jwt_sm2_public_key",
    "CORS_ORIGINS": "cors_origins_raw",
}


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_cors_origins_raw_splits_and_trims():
    """T-CFG-01: cors_origins_raw 逗号分割与 trim。"""
    settings = Settings(
        **settings_kwargs(),
        cors_origins_raw=" http://a.com , http://b.com ",
    )
    assert settings.cors_origins == ["http://a.com", "http://b.com"]


def test_vitalspan_env_defaults_to_development():
    """T-CFG-02: vitalspan_env 默认 development。"""
    settings = Settings(**settings_kwargs())
    assert settings.vitalspan_env == "development"


def test_env_example_covers_required_settings_fields():
    """T-CFG-03: .env.example 键名覆盖 Settings 必填 env。"""
    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env.example"
    lines = env_path.read_text(encoding="utf-8").splitlines()
    keys = {
        line.split("=", 1)[0].strip()
        for line in lines
        if line.strip() and not line.strip().startswith("#") and "=" in line
    }
    for env_key in REQUIRED_ENV_KEYS:
        assert env_key in keys, f"missing {env_key} in .env.example"
    for env_key, field_name in ENV_TO_FIELD.items():
        if env_key in keys:
            assert field_name in Settings.model_fields


def test_vitalspan_env_invalid_enum_raises():
    """T-CFG-04: vitalspan_env 非法枚举 → ValidationError。"""
    with pytest.raises(ValidationError):
        Settings(**settings_kwargs(), vitalspan_env="invalid")


def test_jwt_sm2_public_mismatch_raises():
    """T-CFG-05: JWT 公私钥不匹配 → ValidationError。"""
    kwargs = settings_kwargs()
    kwargs["jwt_sm2_public_key"] = "0" * 128
    with pytest.raises(ValidationError) as exc_info:
        Settings(**kwargs)
    message = str(exc_info.value)
    assert "JWT_SM2_PUBLIC_KEY" in message or "不匹配" in message


def test_query_default_limit_zero_documents_current_behavior():
    """T-CFG-06: query_default_limit=0 记录现状（当前无 ge 约束）。"""
    settings = Settings(**settings_kwargs(), query_default_limit=0)
    assert settings.query_default_limit == 0


def test_configure_logging_accepts_warning_level(monkeypatch):
    """T-CFG-07: LOG_LEVEL=WARNING 可加载。"""
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    get_settings.cache_clear()
    configure_logging(get_settings())
    assert logging.getLogger().level == logging.WARNING


def test_missing_jwt_sm2_private_key_env_raises():
    """T-CFG-08: 空 jwt_sm2_private_key → ValidationError。"""
    kwargs = settings_kwargs()
    kwargs["jwt_sm2_private_key"] = ""
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_blank_jwt_sm2_private_key_raises():
    """T-CFG-09: 空白 jwt_sm2_private_key → ValidationError。"""
    kwargs = settings_kwargs()
    kwargs["jwt_sm2_private_key"] = "   "
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_query_timeout_seconds_zero_documents_behavior():
    """T-CFG-10: query_timeout_seconds=0 记录现状（当前无 ge 约束）。"""
    settings = Settings(**settings_kwargs(), query_timeout_seconds=0)
    assert settings.query_timeout_seconds == 0


def test_cors_origins_raw_empty_string():
    """T-CFG-11: cors_origins_raw='' → cors_origins == []。"""
    settings = Settings(**settings_kwargs(), cors_origins_raw="")
    assert settings.cors_origins == []


def test_analytics_database_url_rejects_mysql():
    """T-CFG-12: analytics_database_url=mysql:// → ValidationError 含 postgresql 提示。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(**settings_kwargs(), analytics_database_url="mysql://bad")
    message = str(exc_info.value)
    assert "postgresql" in message


def test_sm4_key_required():
    """T-CFG-15: 缺 CREDENTIAL_SM4_KEY → ValidationError。"""
    kwargs = settings_kwargs()
    kwargs.pop("credential_sm4_key")
    with pytest.raises(ValidationError) as exc_info:
        Settings(**kwargs, credential_sm4_key="")
    assert "CREDENTIAL_SM4_KEY" in str(exc_info.value)


def test_production_env_allows_sqlite_meta_url():
    """T-CFG-13: vitalspan_env=production + sqlite database_url 可实例化（文档化现状）。"""
    prod_kwargs = settings_kwargs(
        database_url="sqlite+pysqlite:///./meta.db",
        credential_sm4_key="fedcba9876543210fedcba9876543210",
        jwt_sm2_private_key="7AF248DE02B19AA0AC4A0B0D553198984B1EF67C24E2255F8AB13BB44D7EB5AC",
        jwt_sm2_public_key=(
            "EAECFB11DAC50283B90A47C6BF1A433D041C7160B12666759F3671AB68D6637F"
            "114C18CC7A4ECE8EC9BBED49AA0D060032177F80F53697A7D72383C1428AA711"
        ),
    )
    settings = Settings(**prod_kwargs, vitalspan_env="production")
    assert settings.vitalspan_env == "production"
    assert settings.database_url.startswith("sqlite+")


def test_database_url_accepts_mysql_and_normalizes():
    """T-CFG-14: mysql:// 平台元库 URL 归一化为 mysql+pymysql://。"""
    settings = Settings(
        **settings_kwargs(
            database_url="mysql://vitalspan:vitalspan@localhost:3309/vitalspan",
        ),
    )
    assert settings.database_url == "mysql+pymysql://vitalspan:vitalspan@localhost:3309/vitalspan"


def test_production_rejects_dev_jwt_private_key():
    """T-CFG-16: 生产环境拒绝示例 JWT 私钥。"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            **settings_kwargs(
                credential_sm4_key="fedcba9876543210fedcba9876543210",
            ),
            vitalspan_env="production",
        )
    assert "JWT_SM2_PRIVATE_KEY" in str(exc_info.value)
