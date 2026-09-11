"""Unit tests for report crosstab pivot."""

from __future__ import annotations

import pytest

from app.reports.engine.crosstab import pivot_table
from app.reports.engine.crosstab_apply import apply_crosstab_blocks


def test_pivot_table_sum_basic() -> None:
    out = pivot_table(
        ["region", "month", "amount"],
        [
            ["华东", "1月", 10],
            ["华东", "2月", 20],
            ["华北", "1月", 5],
            ["华北", "2月", 15],
        ],
        row_field="region",
        col_field="month",
        value_field="amount",
        agg="sum",
    )
    assert out["kind"] == "crosstab"
    assert out["rowLabels"] == ["华东", "华北"]
    assert out["colLabels"] == ["1月", "2月"]
    assert out["matrix"] == [[10, 20], [5, 15]]
    assert out["rows"][0] == ["华东", 10, 20]


def test_pivot_table_count() -> None:
    out = pivot_table(
        ["a", "b", "v"],
        [["x", "p", 1], ["x", "q", 9], ["y", "p", 3]],
        row_field="a",
        col_field="b",
        value_field="v",
        agg="count",
    )
    assert out["matrix"] == [[1, 1], [1, 0]]


def test_pivot_missing_field_raises() -> None:
    with pytest.raises(ValueError, match="字段不存在"):
        pivot_table(["a"], [["1"]], row_field="missing", col_field="a", value_field="a")


def test_apply_crosstab_blocks_reports_error_on_invalid_field(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.reports.engine.crosstab_apply.template_repo.get_template",
        lambda _key: {
            "blocks": [{
                "blockType": "crosstab",
                "tableRef": "sales",
                "rowField": "missing",
                "colField": "month",
                "valueField": "amount",
            }],
        },
    )
    sections = [{
        "kind": "table",
        "metricKey": "sales",
        "columns": ["region", "month", "amount"],
        "rows": [["华东", "1月", 10]],
    }]
    out = apply_crosstab_blocks(sections, "demo")
    assert len(out) == 1
    assert out[0]["kind"] == "error"
    assert "交叉表透视失败" in out[0]["errorMessage"]


def test_apply_crosstab_blocks_replaces_metric_table(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.reports.engine.crosstab_apply.template_repo.get_template",
        lambda _key: {
            "blocks": [{
                "blockType": "crosstab",
                "tableRef": "sales",
                "rowField": "region",
                "colField": "month",
                "valueField": "amount",
            }],
        },
    )
    sections = [{
        "kind": "table",
        "metricKey": "sales",
        "columns": ["region", "month", "amount"],
        "rows": [["华东", "1月", 10], ["华北", "2月", 15]],
    }]
    out = apply_crosstab_blocks(sections, "demo")
    assert len(out) == 1
    assert out[0]["kind"] == "crosstab"
    assert out[0]["matrix"] == [[10, 0], [0, 15]]
