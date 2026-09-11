from unittest.mock import MagicMock, patch
import uuid

import pytest

from app.auth.deps import UserContext
from app.datasources.schemas import ColumnItemOut, ColumnListResponse
from app.datasources.service import DataSourceError
from app.ingestion.etl_seed import resolve_initial_etl_rules, resolve_source_schema_table
from app.ingestion.models import SyncJob


def test_resolve_source_schema_table_qualified() -> None:
    job = SyncJob(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted="p",
        source_table="sample_db.sales",
        target_table="sales_clean",
    )
    assert resolve_source_schema_table(job) == ("sample_db", "sales")


def test_resolve_source_schema_table_unqualified_mysql() -> None:
    job = SyncJob(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted="p",
        source_table="sales",
        target_table="sales_clean",
    )
    assert resolve_source_schema_table(job) == ("sample_db", "sales")


def test_resolve_source_schema_table_unqualified_postgresql() -> None:
    job = SyncJob(
        name="t",
        source_type="timescaledb",
        source_host="h",
        source_port=5434,
        source_database="ops_tsdb",
        source_username="u",
        source_password_encrypted="p",
        source_table="service_metrics",
        target_table="service_metrics_clean",
    )
    assert resolve_source_schema_table(job) == ("public", "service_metrics")


def test_resolve_initial_etl_rules_prefers_demo_template() -> None:
    job = SyncJob(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted="p",
        source_table="dirty_orders",
        target_table="orders_clean",
        source_data_source_id=uuid.uuid4(),
    )
    actor = UserContext(id=str(uuid.uuid4()), roles=["admin"], username="admin")
    db = MagicMock()
    rules = resolve_initial_etl_rules(db, job, actor)
    assert any(rule["type"] == "cast_type" for rule in rules)


def test_resolve_initial_etl_rules_from_columns() -> None:
    ds_id = uuid.uuid4()
    job = SyncJob(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted="p",
        source_table="sales",
        target_table="sales_clean",
        source_data_source_id=ds_id,
    )
    actor = UserContext(id=str(uuid.uuid4()), roles=["admin"], username="admin")
    db = MagicMock()
    columns = ColumnListResponse(
        items=[ColumnItemOut(name="product_name", data_type="varchar", nullable=True)],
    )
    with patch("app.ingestion.etl_seed.list_columns", return_value=columns):
        rules = resolve_initial_etl_rules(db, job, actor)
    assert rules == [{"type": "rename_column", "from": "product_name", "to": "product"}]


def test_resolve_initial_etl_rules_propagates_metadata_error() -> None:
    ds_id = uuid.uuid4()
    job = SyncJob(
        name="t",
        source_type="mysql",
        source_host="h",
        source_port=3306,
        source_database="sample_db",
        source_username="u",
        source_password_encrypted="p",
        source_table="sales",
        target_table="sales_clean",
        source_data_source_id=ds_id,
    )
    actor = UserContext(id=str(uuid.uuid4()), roles=["admin"], username="admin")
    db = MagicMock()
    with patch(
        "app.ingestion.etl_seed.list_columns",
        side_effect=DataSourceError("DS_CONN_FAILED", "connection refused"),
    ):
        with pytest.raises(DataSourceError, match="connection refused"):
            resolve_initial_etl_rules(db, job, actor)
