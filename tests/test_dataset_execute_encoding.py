"""execute_config encoding overlay integration tests."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from app.auth.deps import UserContext
from app.query.config_store.models import QueryConfigRecord
from app.query.dataset.execute_config import execute_dataset_from_config
from app.query.dataset.schemas import (
    ChartExecuteEncoding,
    ChartFilterEncoding,
    ChartMetricEncoding,
    DatasetExecuteRequest,
)
from app.query.executor import QueryResult
from app.query.schemas import RlsOptions
from app.query.translator.schemas import TranslateResponse

_QUERY_DEFAULT_LIMIT = 1000


def _config_row(config_id: uuid.UUID, ds_id: uuid.UUID) -> QueryConfigRecord:
    return QueryConfigRecord(
        id=config_id,
        config_type="dataset_query",
        schema_version="1.0",
        ref_type="dataset",
        ref_id=uuid.uuid4(),
        payload={
            "dataSourceId": str(ds_id),
            "connectorType": "postgresql",
            "schema": "public",
            "table": "orders",
            "columns": ["region_name", "amount", "sale_date"],
            "conditions": {"logic": "AND", "conditions": []},
            "limit": _QUERY_DEFAULT_LIMIT,
            "offset": 0,
        },
        revision=1,
        owner_id=uuid.uuid4(),
    )


def _raw_result() -> QueryResult:
    return QueryResult(
        columns=["region_name", "amount"],
        rows=[["华东", 50]],
        row_count=1,
        truncated=False,
    )


def test_execute_without_encoding_uses_translate_not_chart_sql():
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
    translated = TranslateResponse(
        sql='SELECT "region_name", "amount", "sale_date" FROM "public"."orders" LIMIT 100',
        parameters={},
        connectorType="postgresql",
    )

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=_config_row(config_id, ds_id)),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch("app.query.dataset.execute_config.translate_from_config_record", return_value=translated) as translate_mock,
        patch("app.query.dataset.execute_config.build_chart_sql") as chart_sql_mock,
        patch("app.metadata.dataset.service.find_dataset_by_bound_config", return_value=None),
        patch("app.query.dataset.execute_config._executor.execute_sql", return_value=_raw_result()) as exec_mock,
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = _QUERY_DEFAULT_LIMIT
        mock_settings.return_value.vitalspan_env = "development"
        execute_dataset_from_config(session, user, req)

    translate_mock.assert_called_once()
    chart_sql_mock.assert_not_called()
    assert exec_mock.call_args.args[3] == translated.sql


def test_execute_with_encoding_uses_chart_sql_not_translate():
    session = MagicMock()
    user = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    config_id = uuid.uuid4()
    ds_id = uuid.uuid4()
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["region_name"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
    )
    req = DatasetExecuteRequest(
        configId=config_id,
        dataSourceId=ds_id,
        parameters={},
        limit=100,
        offset=0,
        rls=RlsOptions(enabled=False),
        encoding=encoding,
    )
    overlay_sql = (
        'SELECT "region_name", SUM("amount") AS "amount" '
        'FROM (SELECT "region_name", "amount" FROM "public"."orders") _src '
        'GROUP BY "region_name" LIMIT 100'
    )

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=_config_row(config_id, ds_id)),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch(
            "app.query.dataset.execute_config.build_chart_sql",
            return_value=(overlay_sql, {}),
        ) as chart_sql_mock,
        patch("app.query.dataset.execute_config.translate_from_config_record") as translate_mock,
        patch("app.metadata.dataset.service.find_dataset_by_bound_config", return_value=None),
        patch("app.query.dataset.execute_config._executor.execute_sql", return_value=_raw_result()) as exec_mock,
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = _QUERY_DEFAULT_LIMIT
        mock_settings.return_value.vitalspan_env = "development"
        execute_dataset_from_config(session, user, req)

    chart_sql_mock.assert_called_once()
    translate_mock.assert_not_called()
    assert exec_mock.call_args.args[3] == overlay_sql


def test_execute_filter_encoding_reaches_executor_sql():
    """Filtered vs unfiltered: encoding filter must appear in SQL sent to executor."""
    session = MagicMock()
    user = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    config_id = uuid.uuid4()
    ds_id = uuid.uuid4()
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["region_name"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
        filters=[ChartFilterEncoding(field="amount", operator="lte", value=100)],
    )
    req = DatasetExecuteRequest(
        configId=config_id,
        dataSourceId=ds_id,
        parameters={},
        limit=500,
        offset=0,
        rls=RlsOptions(enabled=False),
        encoding=encoding,
    )
    captured: dict[str, object] = {}

    def _capture_execute(_session, _user, _ds_id, sql, **kwargs):
        captured["sql"] = sql
        captured["parameters"] = kwargs.get("parameters")
        return _raw_result()

    with (
        patch("app.query.dataset.execute_config.get_config_by_id", return_value=_config_row(config_id, ds_id)),
        patch("app.query.dataset.execute_config.assert_config_readable"),
        patch("app.query.dataset.execute_config.assert_visible"),
        patch("app.metadata.dataset.service.find_dataset_by_bound_config", return_value=None),
        patch("app.query.dataset.execute_config._executor.execute_sql", side_effect=_capture_execute),
        patch("app.query.dataset.execute_config.get_settings") as mock_settings,
    ):
        mock_settings.return_value.query_default_limit = _QUERY_DEFAULT_LIMIT
        mock_settings.return_value.vitalspan_env = "development"
        execute_dataset_from_config(session, user, req)

    sql = str(captured["sql"]).upper()
    params = captured["parameters"]
    assert "WHERE" in sql
    assert "GROUP BY" in sql
    assert sql.index("WHERE") < sql.index("GROUP BY")
    assert isinstance(params, dict)
    assert any(v == 100 for v in params.values())
