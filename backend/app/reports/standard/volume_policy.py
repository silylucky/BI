"""标准分析：查数上限、时间步长、Top N 与 renderSpec.meta。"""

from __future__ import annotations

from typing import Any, Literal

import pandas as pd

TimeStep = Literal["daily", "weekly", "monthly"]

DEFAULT_QUERY_LIMIT = 5000
MAX_QUERY_LIMIT = 10000
DISTRIBUTION_TOP_N = 20
LIFECYCLE_TOP_N = 15
OTHER_BUCKET_LABEL = "其他"

POINT_CAP_BY_STEP: dict[TimeStep, int] = {
    "daily": 90,
    "weekly": 52,
    "monthly": 24,
}

STEP_LABELS: dict[TimeStep, str] = {
    "daily": "按日",
    "weekly": "按周",
    "monthly": "按月",
}


def resolve_time_step(snapshot_preset: str) -> TimeStep:
    if snapshot_preset in POINT_CAP_BY_STEP:
        return snapshot_preset  # type: ignore[return-value]
    return "daily"


def bucket_time_series(series: pd.Series, step: TimeStep) -> pd.Series:
    parsed = pd.to_datetime(series, errors="coerce")
    if step == "weekly":
        iso = parsed.dt.isocalendar()
        return iso.year.astype(str) + "-W" + iso.week.astype(str).str.zfill(2)
    if step == "monthly":
        return parsed.dt.to_period("M").astype(str)
    return parsed.dt.date.astype(str)


def apply_top_n_bucket(
    frame: pd.DataFrame,
    dim_col: str,
    cnt_col: str,
    top_n: int,
) -> tuple[pd.DataFrame, bool]:
    if len(frame) <= top_n:
        return frame, False
    sorted_frame = frame.sort_values(cnt_col, ascending=False).reset_index(drop=True)
    head = sorted_frame.iloc[:top_n]
    other_count = int(sorted_frame.iloc[top_n:][cnt_col].sum())
    if other_count <= 0:
        return head, False
    other_row = pd.DataFrame([{dim_col: OTHER_BUCKET_LABEL, cnt_col: other_count}])
    return pd.concat([head, other_row], ignore_index=True), True


def cap_recent_time_points(frame: pd.DataFrame, step: TimeStep) -> tuple[pd.DataFrame, bool]:
    cap = POINT_CAP_BY_STEP[step]
    if len(frame) <= cap:
        return frame, False
    sorted_frame = frame.sort_values("d").reset_index(drop=True)
    return sorted_frame.tail(cap), True


def build_render_meta(
    *,
    source_row_count: int,
    aggregated_point_count: int,
    query_limit: int,
    time_step: TimeStep | None = None,
    top_n: int | None = None,
    top_n_truncated: bool = False,
    point_cap: int | None = None,
    point_cap_applied: bool = False,
) -> dict[str, Any]:
    return {
        "sourceRowCount": source_row_count,
        "aggregatedPointCount": aggregated_point_count,
        "queryLimit": query_limit,
        "timeStep": time_step,
        "timeStepLabel": STEP_LABELS[time_step] if time_step else None,
        "topN": top_n,
        "topNTruncated": top_n_truncated,
        "pointCap": point_cap,
        "pointCapApplied": point_cap_applied,
        "sampleBased": True,
    }
