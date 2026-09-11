"""sample_db 官方演示包增量迁移（对标 DataEase Flyway 启动灌数）。"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.dashboard.templates.demo_datasource import (
    SampleMysqlConnection,
    can_connect_sample_mysql,
    resolve_official_demo_connection,
)
from app.datasources.dialects.mysql import MysqlConnector

logger = logging.getLogger(__name__)

_MIGRATION_DIR = Path(__file__).resolve().parents[4] / "docker" / "demo-mysql" / "migrations"
_LAST_RESULT: SchemaBootstrapResult | None = None


@dataclass(frozen=True)
class SchemaBootstrapResult:
    mysql_reachable: bool
    schema_version: int
    applied_count: int
    message: str | None = None

    @property
    def ready(self) -> bool:
        return self.mysql_reachable and self.schema_version >= _latest_migration_version()


def _latest_migration_version() -> int:
    versions = _discover_migration_versions()
    return max(versions) if versions else 0


def _discover_migration_versions() -> list[int]:
    if not _MIGRATION_DIR.is_dir():
        return []
    versions: list[int] = []
    for path in sorted(_MIGRATION_DIR.glob("*.sql")):
        match = re.match(r"^(\d+)_", path.name)
        if match:
            versions.append(int(match.group(1)))
    return versions


def _split_sql_statements(sql_text: str) -> list[str]:
    parts = [chunk.strip() for chunk in sql_text.split(";")]
    statements: list[str] = []
    for part in parts:
        if not part:
            continue
        lines = [
            line
            for line in part.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        body = "\n".join(lines).strip()
        if body:
            statements.append(body)
    return statements


def _read_applied_versions(cur) -> set[int]:
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_name = 'vs_schema_migrations'",
    )
    if (cur.fetchone() or [0])[0] == 0:
        return set()
    cur.execute("SELECT version FROM vs_schema_migrations")
    return {int(row[0]) for row in cur.fetchall()}


def probe_sample_db_schema(
    conn: SampleMysqlConnection | None = None,
) -> SchemaBootstrapResult:
    """只读探测 sample_db 迁移版本，不执行 pending migrations。"""
    resolved = conn or resolve_official_demo_connection()
    if not can_connect_sample_mysql(resolved):
        return SchemaBootstrapResult(
            mysql_reachable=False,
            schema_version=0,
            applied_count=0,
            message="sample_db 不可达，请启动 docker compose sample-mysql",
        )

    connector = MysqlConnector()
    try:
        db_conn = connector.open_connection(
            host=resolved.host,
            port=resolved.port,
            database=resolved.database,
            username=resolved.username,
            password=resolved.password,
        )
        with db_conn.cursor() as cur:
            applied = _read_applied_versions(cur)
            schema_version = max(applied) if applied else 0
    except Exception as exc:
        return SchemaBootstrapResult(
            mysql_reachable=True,
            schema_version=0,
            applied_count=0,
            message=str(exc),
        )

    return SchemaBootstrapResult(
        mysql_reachable=True,
        schema_version=schema_version,
        applied_count=0,
        message=None if schema_version >= _latest_migration_version() else "schema 未完全迁移",
    )


def ensure_sample_db_schema(
    conn: SampleMysqlConnection | None = None,
) -> SchemaBootstrapResult:
    """幂等应用 docker/demo-mysql/migrations 下未执行的 SQL。"""
    global _LAST_RESULT
    resolved = conn or resolve_official_demo_connection()
    if not can_connect_sample_mysql(resolved):
        result = SchemaBootstrapResult(
            mysql_reachable=False,
            schema_version=0,
            applied_count=0,
            message="sample_db 不可达，请启动 docker compose sample-mysql",
        )
        _LAST_RESULT = result
        return result

    migration_files = sorted(_MIGRATION_DIR.glob("*.sql"))
    if not migration_files:
        result = SchemaBootstrapResult(
            mysql_reachable=True,
            schema_version=0,
            applied_count=0,
            message="未找到 migration 文件",
        )
        _LAST_RESULT = result
        return result

    connector = MysqlConnector()
    applied_count = 0
    try:
        db_conn = connector.open_connection(
            host=resolved.host,
            port=resolved.port,
            database=resolved.database,
            username=resolved.username,
            password=resolved.password,
        )
        with db_conn.cursor() as cur:
            applied = _read_applied_versions(cur)
            for path in migration_files:
                match = re.match(r"^(\d+)_", path.name)
                if not match:
                    continue
                version = int(match.group(1))
                if version in applied:
                    continue
                sql_text = path.read_text(encoding="utf-8")
                for statement in _split_sql_statements(sql_text):
                    cur.execute(statement)
                cur.execute(
                    "INSERT INTO vs_schema_migrations (version) VALUES (%s) "
                    "ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP",
                    (version,),
                )
                db_conn.commit()
                applied.add(version)
                applied_count += 1
                logger.info("sample_db_migration_applied version=%s file=%s", version, path.name)
            final_applied = _read_applied_versions(cur)
            schema_version = max(final_applied) if final_applied else 0
    except Exception as exc:
        logger.warning("sample_db_migration_failed", exc_info=True)
        result = SchemaBootstrapResult(
            mysql_reachable=True,
            schema_version=0,
            applied_count=applied_count,
            message=str(exc),
        )
        _LAST_RESULT = result
        return result

    result = SchemaBootstrapResult(
        mysql_reachable=True,
        schema_version=schema_version,
        applied_count=applied_count,
        message=None if schema_version >= _latest_migration_version() else "schema 未完全迁移",
    )
    _LAST_RESULT = result
    return result


def get_last_schema_bootstrap_result() -> SchemaBootstrapResult | None:
    return _LAST_RESULT
