"""Dataset query-time pandas transform tests."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.metadata.dataset.schemas import DatasetItemOut, DatasetTableDef
from app.query.dataset.pandas_transform import (
    apply_query_transform,
    needs_query_time_pandas,
    probe_dataset_pandas_budget_ms,
    records_to_query_result,
    rows_to_records,
    transform_query_result,
)
from app.query.executor import QueryResult
from app.query.schemas import QueryError

_QUERY_DEFAULT_LIMIT = 1000


def _dataset(origin: str = "manual") -> DatasetItemOut:
    return DatasetItemOut(
        datasetId="ds-test",
        displayName="Test",
        tables=[DatasetTableDef(name="public.orders")],
        computedFields=[],
        allowedRoles=["analyst"],
        origin=origin,
    )


def test_rows_to_records_and_back():
    columns = ["a", "b"]
    rows = [[1, " x "], [2, "y"]]
    records = rows_to_records(columns, rows)
    assert records[0]["a"] == 1
    out = records_to_query_result(columns, records, truncated=False)
    assert out.columns == columns
    assert out.rows == rows
    assert out.row_count == 2


def test_apply_query_transform_trims_and_coerces():
    records = [{"product_name": "  Widget  ", "amount": "12.5", "status": "active"}]
    cleaned = apply_query_transform(records, [])
    assert cleaned[0]["product_name"] == "Widget"
    assert cleaned[0]["amount"] == 12.5


def test_apply_query_transform_filters_deleted_status():
    records = [
        {"product_name": "A", "status": "active"},
        {"product_name": "B", "status": "deleted"},
    ]
    cleaned = apply_query_transform(records, [])
    assert len(cleaned) == 1
    assert cleaned[0]["product_name"] == "A"


def test_apply_query_transform_failure_raises_query_error():
    with patch("app.query.dataset.pandas_transform.apply_rules", side_effect=RuntimeError("boom")):
        with pytest.raises(QueryError) as exc:
            apply_query_transform([{"a": 1}], [])
    assert exc.value.code == "QUERY_DATASET_TRANSFORM_FAILED"


def test_needs_query_time_pandas_by_origin():
    db = MagicMock()
    ds_id = uuid.uuid4()
    assert needs_query_time_pandas(db, _dataset(origin="sync_job"), ds_id) is False
    assert needs_query_time_pandas(db, _dataset(origin="manual"), ds_id) is True
    assert needs_query_time_pandas() is True


def test_transform_query_result_skips_sync_dataset():
    db = MagicMock()
    ds_id = uuid.uuid4()
    raw = QueryResult(
        columns=["product_name", "amount", "status"],
        rows=[["  Widget  ", "12.5", "active"]],
        row_count=1,
        truncated=False,
    )
    out = transform_query_result(db, _dataset(origin="sync_job"), ds_id, raw)
    assert out.rows[0][0] == "  Widget  "
    assert out.rows[0][1] == "12.5"


def test_transform_query_result_cleans_managed_analytics():
    db = MagicMock()
    ds_id = uuid.uuid4()
    raw = QueryResult(
        columns=["product_name", "status"],
        rows=[["  A  ", "active"]],
        row_count=1,
        truncated=False,
    )
    out = transform_query_result(db, _dataset(origin="manual"), ds_id, raw)
    assert out.rows[0][0] == "A"


def test_transform_query_result_cleans_external_source():
    db = MagicMock()
    ds_id = uuid.uuid4()
    raw = QueryResult(
        columns=["product_name", "amount", "status"],
        rows=[["  Widget  ", "12.5", "active"]],
        row_count=1,
        truncated=False,
    )
    out = transform_query_result(db, _dataset(origin="manual"), ds_id, raw)
    assert out.rows[0][0] == "Widget"
    assert out.rows[0][1] == 12.5


def test_transform_query_result_preserves_truncated_flag():
    db = MagicMock()
    ds_id = uuid.uuid4()
    raw = QueryResult(columns=["status"], rows=[["active"]], row_count=1, truncated=True)
    out = transform_query_result(db, _dataset(origin="manual"), ds_id, raw)
    assert out.truncated is True


def test_transform_query_result_respects_query_limit_and_truncated():
    """P2-1: QueryExecutor 已截断至 limit 且 truncated=True 时，pandas 不扩行、保留 truncated。"""
    db = MagicMock()
    ds_id = uuid.uuid4()
    rows = [[f"item-{i}", "active"] for i in range(_QUERY_DEFAULT_LIMIT)]
    raw = QueryResult(
        columns=["name", "status"],
        rows=rows,
        row_count=_QUERY_DEFAULT_LIMIT,
        truncated=True,
    )
    out = transform_query_result(db, _dataset(origin="manual"), ds_id, raw)
    assert out.truncated is True
    assert out.row_count == _QUERY_DEFAULT_LIMIT
    assert len(out.rows) == _QUERY_DEFAULT_LIMIT


def test_execute_config_limit_boundary_truncated_after_transform():
    """P2-1: 模拟 fetch 1001 行后 executor 返回 1000 行 + truncated，经 execute 链仍遵守 limit。"""
    from app.auth.deps import UserContext
    from app.query.config_store.models import QueryConfigRecord
    from app.query.dataset.execute_config import execute_dataset_from_config
    from app.query.dataset.schemas import DatasetExecuteRequest
    from app.query.schemas import RlsOptions
    from app.query.translator.schemas import TranslateResponse

    session = MagicMock()
    user = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    config_id = uuid.uuid4()
    ds_id = uuid.uuid4()
    req = DatasetExecuteRequest(
        configId=config_id,
        dataSourceId=ds_id,
        parameters={},
        limit=_QUERY_DEFAULT_LIMIT,
        offset=0,
        rls=RlsOptions(enabled=False),
    )
    bound = _dataset(origin="manual")
    limited_rows = [[f"row-{i}", "active"] for i in range(_QUERY_DEFAULT_LIMIT)]
    raw_result = QueryResult(
        columns=["name", "status"],
        rows=limited_rows,
        row_count=_QUERY_DEFAULT_LIMIT,
        truncated=True,
    )
    config_row = QueryConfigRecord(
        id=config_id,
        config_type="dataset_query",
        schema_version="1.0",
        ref_type="dataset",
        ref_id=uuid.uuid4(),
        payload={
            "dataSourceId": str(ds_id),
            "connectorType": "mysql",
            "schema": "demo",
            "table": "orders",
            "columns": ["name", "status"],
            "conditions": {"logic": "AND", "conditions": []},
            "limit": _QUERY_DEFAULT_LIMIT,
            "offset": 0,
        },
        revision=1,
        owner_id=uuid.uuid4(),
    )

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=config_row),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch(
            "app.query.dataset.execute_config.translate_from_config_record",
            return_value=TranslateResponse(
                sql="SELECT name, status FROM orders",
                parameters={},
                connectorType="mysql",
            ),
        ),
        patch(
            "app.metadata.dataset.service.find_dataset_by_bound_config",
            return_value=bound,
        ),
        patch("app.query.dataset.execute_config._executor.execute_sql", return_value=raw_result),
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = _QUERY_DEFAULT_LIMIT
        mock_settings.return_value.vitalspan_env = "development"
        resp = execute_dataset_from_config(session, user, req)

    assert resp.truncated is True
    assert resp.row_count == _QUERY_DEFAULT_LIMIT
    assert len(resp.rows) == _QUERY_DEFAULT_LIMIT


def test_probe_dataset_pandas_budget_ms():
    result = probe_dataset_pandas_budget_ms()
    assert result.ok is True
    assert result.elapsed_ms >= 0


def test_execute_config_skips_transform_for_sync_dataset():
    from app.auth.deps import UserContext
    from app.query.config_store.models import QueryConfigRecord
    from app.query.dataset.execute_config import execute_dataset_from_config
    from app.query.dataset.schemas import DatasetExecuteRequest
    from app.query.schemas import RlsOptions
    from app.query.translator.schemas import TranslateResponse

    session = MagicMock()
    user = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    config_id = uuid.uuid4()
    ds_id = uuid.uuid4()
    req = DatasetExecuteRequest(
        configId=config_id,
        dataSourceId=ds_id,
        parameters={},
        limit=100,
        offset=0,
        rls=RlsOptions(enabled=False),
    )
    bound = _dataset(origin="sync_job")
    raw_result = QueryResult(
        columns=["product_name", "amount"],
        rows=[["  X  ", "10"]],
        row_count=1,
        truncated=False,
    )
    config_row = QueryConfigRecord(
        id=config_id,
        config_type="dataset_query",
        schema_version="1.0",
        ref_type="dataset",
        ref_id=uuid.uuid4(),
        payload={
            "dataSourceId": str(ds_id),
            "connectorType": "postgresql",
            "schema": "public",
            "table": "orders_clean",
            "columns": ["product_name", "amount"],
            "conditions": {"logic": "AND", "conditions": []},
            "limit": 100,
            "offset": 0,
        },
        revision=1,
        owner_id=uuid.uuid4(),
    )

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=config_row),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch(
            "app.query.dataset.execute_config.translate_from_config_record",
            return_value=TranslateResponse(
                sql="SELECT product_name, amount FROM orders_clean",
                parameters={},
                connectorType="postgresql",
            ),
        ),
        patch(
            "app.metadata.dataset.service.find_dataset_by_bound_config",
            return_value=bound,
        ),
        patch("app.query.dataset.execute_config._executor.execute_sql", return_value=raw_result),
        patch("app.query.dataset.execute_config.transform_query_result") as mock_transform,
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = 1000
        mock_settings.return_value.vitalspan_env = "development"
        resp = execute_dataset_from_config(session, user, req)

    mock_transform.assert_not_called()
    assert resp.rows[0][0] == "  X  "


def test_execute_config_applies_transform_for_external_source():
    from app.auth.deps import UserContext
    from app.query.config_store.models import QueryConfigRecord
    from app.query.dataset.execute_config import execute_dataset_from_config
    from app.query.dataset.schemas import DatasetExecuteRequest
    from app.query.schemas import RlsOptions
    from app.query.translator.schemas import TranslateResponse

    session = MagicMock()
    user = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    config_id = uuid.uuid4()
    ds_id = uuid.uuid4()
    req = DatasetExecuteRequest(
        configId=config_id,
        dataSourceId=ds_id,
        parameters={},
        limit=100,
        offset=0,
        rls=RlsOptions(enabled=False),
    )
    bound = _dataset(origin="manual")
    raw_result = QueryResult(
        columns=["product_name", "amount", "status"],
        rows=[["  X  ", "10", "active"], ["Y", "bad", "deleted"]],
        row_count=2,
        truncated=False,
    )
    config_row = QueryConfigRecord(
        id=config_id,
        config_type="dataset_query",
        schema_version="1.0",
        ref_type="dataset",
        ref_id=uuid.uuid4(),
        payload={
            "dataSourceId": str(ds_id),
            "connectorType": "mysql",
            "schema": "demo",
            "table": "orders",
            "columns": ["product_name", "amount", "status"],
            "conditions": {"logic": "AND", "conditions": []},
            "limit": 100,
            "offset": 0,
        },
        revision=1,
        owner_id=uuid.uuid4(),
    )

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=config_row),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch(
            "app.query.dataset.execute_config.translate_from_config_record",
            return_value=TranslateResponse(
                sql="SELECT product_name, amount, status FROM orders",
                parameters={},
                connectorType="mysql",
            ),
        ),
        patch(
            "app.metadata.dataset.service.find_dataset_by_bound_config",
            return_value=bound,
        ),
        patch("app.query.dataset.execute_config._executor.execute_sql", return_value=raw_result),
        patch(
            "app.query.dataset.execute_config.transform_query_result",
            wraps=transform_query_result,
        ) as mock_transform,
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = 1000
        mock_settings.return_value.vitalspan_env = "development"
        resp = execute_dataset_from_config(session, user, req)

    mock_transform.assert_called_once()
    assert resp.row_count == 1
    assert resp.rows[0][0] == "X"
