from functools import lru_cache
from typing import Any, ClassVar, Literal

from pydantic import computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.crypto.sm2 import Sm2CryptoError, derive_public_key


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    vitalspan_env: Literal["development", "staging", "production"] = "development"
    database_url: str
    jwt_sm2_private_key: str
    jwt_sm2_public_key: str
    credential_sm4_key: str
    cors_origins_raw: str = "http://localhost:5173"
    log_level: str = "INFO"
    query_default_limit: int = 1000
    query_timeout_seconds: int = 30
    analytics_database_url: str | None = None
    api_openapi_version: str = "0.1.0"
    vitalspan_dev_admin_password: str = "changeme"
    vitalspan_bootstrap_admin_username: str = "admin"
    vitalspan_bootstrap_admin_password: str | None = None
    vitalspan_bootstrap_allow_existing: bool = False
    auth_max_failed_logins: int = 5
    auth_lock_minutes: int = 15
    auth_temporary_password_length: int = 20
    rpt_smtp_host: str = "localhost"
    rpt_smtp_port: int = 1025
    rpt_smtp_user: str | None = None
    rpt_smtp_password: str | None = None
    rpt_smtp_from: str = "reports@vitalspan.local"
    vitalspan_data_dir: str = "./data"
    dev_report_seed: bool = False
    ensure_official_demo_datasource: bool = True
    ensure_demo_instances: bool = False
    ensure_workspace_instances: bool = True
    ensure_analytics_datasource: bool = False
    sample_mysql_url: str | None = None
    fe_base_url: str = "http://127.0.0.1:5173"
    fe_base_path: str = ""
    api_public_base_url: str = "http://127.0.0.1:8000"
    rpt_export_fallback: bool = False
    rpt_schedule_store: Literal["memory", "db"] = "db"
    rpt_metadata_store: Literal["memory", "db"] = "db"
    artifact_storage_backend: Literal["memory", "fs"] = "fs"
    artifact_storage_path: str = "./data/artifacts"
    rpt_scheduler_enabled: bool = True
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    agent_system_prompt: str | None = None
    agent_max_tool_iterations: int = 12
    agent_max_history_messages: int = 50
    agent_memory_recall_limit: int = 6
    agent_memory_context_max_chars: int = 4000

    _DEV_JWT_SM2_PRIVATE: ClassVar[str] = (
        "3DA75A807474C867E8E5C60B3E4E32DC8D319D4447B9594D394E6D3BD8778D1F"
    )
    _DEV_JWT_SM2_PUBLIC: ClassVar[str] = (
        "1AE135607AEEB4D7722756BC8C736C79DE6E72452E1CF4DC32448C7393B290B946D1A7D2614DA4814F7AEDAEB92741DB46775298CDFE3D832AD5A44572ADD899"
    )
    _DEV_SM4_EXAMPLE: ClassVar[str] = "0123456789abcdef0123456789abcdef"

    @field_validator("vitalspan_bootstrap_admin_password", mode="before")
    @classmethod
    def normalize_bootstrap_password(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("auth_max_failed_logins")
    @classmethod
    def validate_auth_max_failed_logins(cls, value: int) -> int:
        if not 3 <= value <= 20:
            raise ValueError("AUTH_MAX_FAILED_LOGINS 须在 3..20 之间")
        return value

    @field_validator("auth_lock_minutes")
    @classmethod
    def validate_auth_lock_minutes(cls, value: int) -> int:
        if not 1 <= value <= 1440:
            raise ValueError("AUTH_LOCK_MINUTES 须在 1..1440 之间")
        return value

    @field_validator("auth_temporary_password_length")
    @classmethod
    def validate_auth_temporary_password_length(cls, value: int) -> int:
        if not 16 <= value <= 64:
            raise ValueError("AUTH_TEMPORARY_PASSWORD_LENGTH 须在 16..64 之间")
        return value

    @field_validator("analytics_database_url", mode="before")
    @classmethod
    def normalize_analytics_database_url(cls, value: Any) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            return None
        if not stripped.startswith(("postgresql://", "postgresql+psycopg://")):
            raise ValueError("托管分析库 URL 须为 postgresql 或 postgresql+psycopg 协议")
        return stripped

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: Any) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("DATABASE_URL 不能为空")
        stripped = value.strip()
        if not stripped.startswith(
            (
                "postgresql://",
                "postgresql+psycopg://",
                "mysql://",
                "mysql+pymysql://",
                "sqlite+",
            )
        ):
            raise ValueError(
                "平台元库 URL 须为 postgresql、mysql 或 sqlite 协议"
            )
        if stripped.startswith("mysql://"):
            return "mysql+pymysql://" + stripped[len("mysql://") :]
        return stripped

    @field_validator("jwt_sm2_private_key")
    @classmethod
    def validate_jwt_sm2_private_key(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 64:
            raise ValueError("JWT_SM2_PRIVATE_KEY 须为 64 位十六进制（32 字节）")
        try:
            int(normalized, 16)
        except ValueError as exc:
            raise ValueError("JWT_SM2_PRIVATE_KEY 须为十六进制") from exc
        return normalized

    @field_validator("jwt_sm2_public_key")
    @classmethod
    def validate_jwt_sm2_public_key(cls, value: str) -> str:
        stripped = value.strip()
        if stripped.startswith("04"):
            stripped = stripped[2:]
        normalized = stripped.upper()
        if len(normalized) != 128:
            raise ValueError("JWT_SM2_PUBLIC_KEY 须为 128 位十六进制（未压缩公钥）")
        try:
            int(normalized, 16)
        except ValueError as exc:
            raise ValueError("JWT_SM2_PUBLIC_KEY 须为十六进制") from exc
        return normalized

    @field_validator("credential_sm4_key")
    @classmethod
    def validate_credential_sm4_key(cls, value: str) -> str:
        if not value:
            raise ValueError("CREDENTIAL_SM4_KEY 不能为空")
        try:
            key = bytes.fromhex(value)
        except ValueError as exc:
            raise ValueError("CREDENTIAL_SM4_KEY 须为 32 位十六进制（16 字节）") from exc
        if len(key) != 16:
            raise ValueError("CREDENTIAL_SM4_KEY 须为 32 位十六进制（16 字节）")
        return value.lower()

    @model_validator(mode="after")
    def validate_jwt_sm2_keypair(self) -> "Settings":
        try:
            derived = derive_public_key(self.jwt_sm2_private_key).upper()
        except Sm2CryptoError as exc:
            raise ValueError("JWT SM2 私钥无效") from exc
        if derived != self.jwt_sm2_public_key:
            raise ValueError("JWT_SM2_PUBLIC_KEY 与 JWT_SM2_PRIVATE_KEY 不匹配")
        return self

    @model_validator(mode="after")
    def enforce_production_safety(self) -> "Settings":
        if self.vitalspan_env != "production":
            return self
        if self.jwt_sm2_private_key == self._DEV_JWT_SM2_PRIVATE:
            raise ValueError("生产环境 JWT_SM2_PRIVATE_KEY 必须重新生成")
        if self.credential_sm4_key == self._DEV_SM4_EXAMPLE:
            raise ValueError("生产环境 CREDENTIAL_SM4_KEY 必须重新生成")
        if not self.rpt_smtp_host.strip():
            raise ValueError("生产环境 RPT_SMTP_HOST 不能为空")
        if not self.rpt_smtp_from.strip():
            raise ValueError("生产环境 RPT_SMTP_FROM 不能为空")
        if self.rpt_schedule_store == "memory":
            raise ValueError("生产环境 RPT_SCHEDULE_STORE 不能为 memory")
        if self.rpt_metadata_store == "memory":
            raise ValueError("生产环境 RPT_METADATA_STORE 不能为 memory")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def should_seed_demo_reports(self) -> bool:
        """开发显式开关；staging 且已启用官方演示源时自动幂等种子（与 dev 报表演示一致）。"""
        if self.dev_report_seed:
            return True
        return self.vitalspan_env == "staging" and self.ensure_official_demo_datasource


@lru_cache
def get_settings() -> Settings:
    return Settings()
