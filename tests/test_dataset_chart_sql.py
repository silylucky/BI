"""Chart encoding overlay SQL generation tests."""

from app.query.config_store.schemas import DatasetQueryConfigPayload
from app.query.dataset.chart_sql import build_chart_sql
from app.query.dataset.schemas import (
    ChartExecuteEncoding,
    ChartFilterEncoding,
    ChartMetricEncoding,
    ChartTimeRangeEncoding,
)
from app.query.translator.schemas import TranslateError


def _payload(**overrides) -> DatasetQueryConfigPayload:
    base = {
        "dataSourceId": "550e8400-e29b-41d4-a716-446655440000",
        "connectorType": "postgresql",
        "schema": "public",
        "table": "orders",
        "columns": ["region_name", "amount", "sale_date"],
    }
    base.update(overrides)
    return DatasetQueryConfigPayload.model_validate(base)


def test_filter_lte_before_group_by():
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["region_name"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
        filters=[ChartFilterEncoding(field="amount", operator="lte", value=100)],
    )
    sql, params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=500, offset=0)
    upper = sql.upper()
    assert "WHERE" in upper
    assert "GROUP BY" in upper
    assert "SUM" in upper
    assert "LIMIT 500" in upper
    where_at = upper.index("WHERE")
    group_at = upper.index("GROUP BY")
    assert where_at < group_at
    assert any(v == 100 for v in params.values())


def test_line_chart_group_by_sum_and_limit():
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["sale_date"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
    )
    sql, _params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=100, offset=0)
    assert '"sale_date"' in sql
    assert "SUM" in sql.upper()
    assert "GROUP BY" in sql.upper()
    assert "LIMIT 100" in sql


def test_detail_table_no_group_by():
    encoding = ChartExecuteEncoding(
        chartType="table-info",
        dimensions=["region_name", "amount", "sale_date"],
        metrics=[],
    )
    sql, _params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=200, offset=0)
    assert "GROUP BY" not in sql.upper()
    assert "LIMIT 200" in sql
    assert 'ORDER BY "sale_date" DESC' in sql


def test_invalid_field_raises():
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["unknown_col"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
    )
    try:
        build_chart_sql(_payload(), encoding, computed_fields=[], limit=100, offset=0)
        raise AssertionError("expected TranslateError")
    except TranslateError as exc:
        assert exc.code == "QUERY_CHART_INVALID_FIELD"


def test_invalid_operator_raises():
    filt = ChartFilterEncoding.model_construct(
        field="amount",
        operator="like",
        value="x",
    )
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["region_name"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
        filters=[filt],
    )
    try:
        build_chart_sql(_payload(), encoding, computed_fields=[], limit=100, offset=0)
        raise AssertionError("expected TranslateError")
    except TranslateError as exc:
        assert exc.code == "QUERY_CHART_INVALID_OPERATOR"


def test_kpi_sum_without_group_by():
    encoding = ChartExecuteEncoding(
        chartType="kpi",
        dimensions=[],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
    )
    sql, _params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=10, offset=0)
    assert "GROUP BY" not in sql.upper()
    assert "SUM" in sql.upper()


def test_duplicate_dimension_does_not_repeat_select_alias():
    encoding = ChartExecuteEncoding(
        chartType="area-stack",
        dimensions=["sale_date", "sale_date"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
    )
    sql, _params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=100, offset=0)
    assert 'GROUP BY "sale_date", "sale_date"' not in sql
    assert 'GROUP BY "sale_date"' in sql


def test_duplicate_metric_fields_get_unique_aliases():
    encoding = ChartExecuteEncoding(
        chartType="stock-line",
        dimensions=["sale_date"],
        metrics=[
            ChartMetricEncoding(field="amount", agg="sum"),
            ChartMetricEncoding(field="quantity", agg="sum"),
            ChartMetricEncoding(field="quantity", agg="sum"),
            ChartMetricEncoding(field="amount", agg="sum"),
        ],
    )
    payload = _payload(columns=["sale_date", "amount", "quantity"])
    sql, _params = build_chart_sql(payload, encoding, computed_fields=[], limit=100, offset=0)
    assert 'AS "quantity_2"' in sql
    assert 'AS "amount_2"' in sql
    assert sql.upper().count("SUM") == 4


def test_time_range_between_before_group_by():
    encoding = ChartExecuteEncoding(
        chartType="line",
        dimensions=["sale_date"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
        timeRange=ChartTimeRangeEncoding(
            enabled=True,
            field="sale_date",
            start="2025-01-01",
            end="2025-12-31",
        ),
    )
    sql, params = build_chart_sql(_payload(), encoding, computed_fields=[], limit=100, offset=0)
    upper = sql.upper()
    assert "BETWEEN" in upper
    assert "WHERE" in upper
    assert "GROUP BY" in upper
    assert upper.index("WHERE") < upper.index("GROUP BY")
    assert "2025-01-01" in params.values()
    assert "2025-12-31" in params.values()
