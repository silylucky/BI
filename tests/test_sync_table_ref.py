from app.ingestion.models import SyncJob, encrypt_password
from app.ingestion.sync_table_ref import resolve_sync_schema_and_table, uses_postgres_schema_semantics


def _job(**overrides: object) -> SyncJob:
    base = dict(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted=encrypt_password("p"),
        source_table="orders",
        target_table="orders_clean",
    )
    base.update(overrides)
    return SyncJob(**base)


def test_uses_postgres_schema_semantics() -> None:
    assert uses_postgres_schema_semantics("timescaledb") is True
    assert uses_postgres_schema_semantics("postgresql") is True
    assert uses_postgres_schema_semantics("mysql") is False


def test_resolve_postgresql_defaults_to_public() -> None:
    job = _job(
        source_type="timescaledb",
        source_database="ops_tsdb",
        source_table="service_metrics",
    )
    assert resolve_sync_schema_and_table(job) == ("public", "service_metrics")


def test_resolve_postgresql_uses_explicit_schema() -> None:
    job = _job(
        source_type="timescaledb",
        source_database="ops_tsdb",
        source_schema="public",
        source_table="service_metrics",
    )
    assert resolve_sync_schema_and_table(job) == ("public", "service_metrics")


def test_resolve_qualified_table_overrides_schema() -> None:
    job = _job(
        source_type="timescaledb",
        source_database="ops_tsdb",
        source_schema="public",
        source_table="_timescaledb_cache.cache_inval_extension",
    )
    assert resolve_sync_schema_and_table(job) == (
        "_timescaledb_cache",
        "cache_inval_extension",
    )


def test_resolve_mysql_uses_database_as_namespace() -> None:
    job = _job(source_type="mysql", source_database="sample_db", source_table="sales")
    assert resolve_sync_schema_and_table(job) == ("sample_db", "sales")


def test_resolve_mysql_qualified_table() -> None:
    job = _job(source_type="mysql", source_database="sample_db", source_table="sample_db.sales")
    assert resolve_sync_schema_and_table(job) == ("sample_db", "sales")
