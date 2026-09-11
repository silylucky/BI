from __future__ import annotations

from app.reports.standard.schemas import FieldMapping
from app.reports.standard.theme_aggregate import aggregate_pack_theme
from app.reports.standard.volume_policy import (
    DISTRIBUTION_TOP_N,
    OTHER_BUCKET_LABEL,
    apply_top_n_bucket,
    bucket_time_series,
    cap_recent_time_points,
    resolve_time_step,
)


def test_resolve_time_step_follows_snapshot_preset() -> None:
    assert resolve_time_step("weekly") == "weekly"
    assert resolve_time_step("unknown") == "daily"


def test_apply_top_n_bucket_merges_tail_into_other() -> None:
    import pandas as pd

    frame = pd.DataFrame({"dim": [f"c{i}" for i in range(25)], "cnt": [1] * 25})
    out, truncated = apply_top_n_bucket(frame, "dim", "cnt", DISTRIBUTION_TOP_N)
    assert truncated is True
    assert len(out) == DISTRIBUTION_TOP_N + 1
    assert out.iloc[-1]["dim"] == OTHER_BUCKET_LABEL
    assert int(out.iloc[-1]["cnt"]) == 5


def test_bucket_time_series_weekly() -> None:
    import pandas as pd

    series = pd.Series(["2026-01-15", "2026-01-16"])
    buckets = bucket_time_series(series, "weekly")
    assert buckets.iloc[0].endswith("-W03")


def test_cap_recent_time_points_keeps_tail() -> None:
    import pandas as pd

    frame = pd.DataFrame({"d": [f"2026-01-{i:02d}" for i in range(1, 29)], "cnt": [1] * 28})
    out, applied = cap_recent_time_points(frame, "daily")
    assert applied is False
    assert len(out) == 28

    long_frame = pd.DataFrame({"d": [f"day-{i:04d}" for i in range(120)], "cnt": [1] * 120})
    capped, applied_long = cap_recent_time_points(long_frame, "daily")
    assert applied_long is True
    assert len(capped) == 90
    assert capped.iloc[0]["d"] == "day-0030"
    assert capped.iloc[-1]["d"] == "day-0119"


def test_aggregate_pack_theme_distribution_meta() -> None:
    columns = ["region", "amount"]
    rows = [[f"city-{i}", i] for i in range(30)]
    mapping = FieldMapping(region="region")
    out_columns, out_rows, meta = aggregate_pack_theme(
        "distribution",
        columns,
        rows,
        mapping,
        snapshot_preset="daily",
        query_limit=5000,
    )
    assert out_columns == ["dim", "cnt"]
    assert len(out_rows) == DISTRIBUTION_TOP_N + 1
    assert meta["topNTruncated"] is True
    assert meta["sourceRowCount"] == 30
    assert meta["sampleBased"] is True


def test_aggregate_pack_theme_activity_sorts_by_date() -> None:
    columns = ["created_at"]
    rows = [
        ["2026-01-03"],
        ["2026-01-01"],
        ["2026-01-02"],
    ]
    mapping = FieldMapping(createdAt="created_at")
    _, out_rows, _ = aggregate_pack_theme(
        "activity",
        columns,
        rows,
        mapping,
        snapshot_preset="daily",
        query_limit=5000,
    )
    dates = [row[0] for row in out_rows]
    assert dates == ["2026-01-01", "2026-01-02", "2026-01-03"]


def test_aggregate_pack_theme_weekly_activity_meta() -> None:
    columns = ["created_at"]
    rows = [[f"2026-01-{i:02d}"] for i in range(1, 8)]
    mapping = FieldMapping(createdAt="created_at")
    _, out_rows, meta = aggregate_pack_theme(
        "activity",
        columns,
        rows,
        mapping,
        snapshot_preset="weekly",
        query_limit=5000,
    )
    assert len(out_rows) >= 1
    assert meta["timeStep"] == "weekly"
    assert meta["pointCap"] == 52
