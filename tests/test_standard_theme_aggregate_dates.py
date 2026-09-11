from app.reports.standard.schemas import FieldMapping
from app.reports.standard.theme_aggregate import aggregate_pack_theme


def test_activity_drops_epoch_sentinel_dates():
    mapping = FieldMapping(created_at="sale_date")
    columns = ["sale_date", "amount"]
    rows = [
        ["1970-01-01", 1],
        ["2025-04-05", 10],
        ["2025-04-06", 20],
        [None, 3],
        ["", 4],
    ]
    out_cols, out_rows, meta = aggregate_pack_theme(
        "activity",
        columns,
        rows,
        mapping,
        snapshot_preset="daily",
    )
    dims = [r[0] for r in out_rows]
    assert "1970-01-01" not in dims
    assert "2025-04-05" in dims
    assert "2025-04-06" in dims
    assert meta["aggregatedPointCount"] == 2


def test_activity_all_invalid_dates_returns_empty():
    mapping = FieldMapping(created_at="sale_date")
    columns = ["sale_date"]
    rows = [["1970-01-01"], ["invalid"]]
    out_cols, out_rows, meta = aggregate_pack_theme(
        "activity",
        columns,
        rows,
        mapping,
        snapshot_preset="daily",
    )
    assert out_rows == []
    assert meta["aggregatedPointCount"] == 0
