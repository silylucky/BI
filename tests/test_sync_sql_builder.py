from app.ingestion.models import SyncJob, encrypt_password
from app.ingestion.sync_sql_builder import build_sync_select, qualify_sync_table
from app.query.dialects import get_sql_dialect


def _job(**overrides: object) -> SyncJob:
    base = dict(
        name="t",
        source_type="mysql",
        source_host="127.0.0.1",
        source_port=3306,
        source_database="db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="orders",
        target_table="orders_clean",
        enabled=True,
    )
    base.update(overrides)
    return SyncJob(**base)


def test_build_sync_select_full_mysql():
    sql, params = build_sync_select(_job(), "mysql")
    assert "LIMIT" in sql.upper()
    assert params == (100_000,)


def test_qualify_sync_table_trino():
    dialect = get_sql_dialect("trino")
    ref = qualify_sync_table(dialect, _job(source_database="hive", source_table="orders"))
    assert ref == '"hive"."default"."orders"'


def test_qualify_sync_table_postgresql_uses_schema_not_database():
    dialect = get_sql_dialect("postgresql")
    ref = qualify_sync_table(
        dialect,
        _job(
            source_type="timescaledb",
            source_database="ops_tsdb",
            source_schema="public",
            source_table="service_metrics",
        ),
    )
    assert ref == '"public"."service_metrics"'


def test_qualify_sync_table_postgresql_defaults_public():
    dialect = get_sql_dialect("postgresql")
    ref = qualify_sync_table(
        dialect,
        _job(
            source_type="timescaledb",
            source_database="ops_tsdb",
            source_table="service_metrics",
        ),
    )
    assert ref == '"public"."service_metrics"'
