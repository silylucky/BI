"""标准分析包主题聚合（Dataset 出数后在内存聚合，替代手写 SQL）。"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.reports.standard.errors import RPT_STD_FIELD_MAPPING, RPT_STD_THEME_UNSUPPORTED, StandardAnalysisError
from app.reports.standard.schemas import FieldMapping, ThemeType
from app.reports.standard.volume_policy import (
    DISTRIBUTION_TOP_N,
    LIFECYCLE_TOP_N,
    POINT_CAP_BY_STEP,
    apply_top_n_bucket,
    bucket_time_series,
    build_render_meta,
    cap_recent_time_points,
    resolve_time_step,
)

# 聚合前丢弃无效/哨兵日期，避免 1970-01-01 等脏值进入活跃度维度
_MIN_VALID_DATE = pd.Timestamp("1990-01-01")


def _drop_invalid_time_rows(df: pd.DataFrame, col: str) -> pd.DataFrame:
    parsed = pd.to_datetime(df[col], errors="coerce")
    valid = parsed.notna() & (parsed >= _MIN_VALID_DATE)
    return df.loc[valid].copy()


def aggregate_pack_theme(
    theme: ThemeType,
    columns: list[str],
    rows: list[list[Any]],
    mapping: FieldMapping,
    snapshot_preset: str = "daily",
    query_limit: int = 5000,
) -> tuple[list[str], list[list[Any]], dict[str, Any]]:
    source_row_count = len(rows)
    time_step = resolve_time_step(snapshot_preset)

    if not rows:
        meta = build_render_meta(
            source_row_count=0,
            aggregated_point_count=0,
            query_limit=query_limit,
            time_step=time_step if theme in {"activity", "trend"} else None,
        )
        return columns, rows, meta

    df = pd.DataFrame(rows, columns=columns)
    top_n: int | None = None
    top_n_truncated = False
    point_cap_applied = False

    if theme == "lifecycle":
        col = mapping.status
        if not col or col not in df.columns:
            raise StandardAnalysisError(RPT_STD_FIELD_MAPPING, "status mapping required", 422)
        out = df.groupby(col, dropna=False).size().reset_index(name="cnt")
        out.columns = ["dim", "cnt"]
        top_n = LIFECYCLE_TOP_N
        out, top_n_truncated = apply_top_n_bucket(out, "dim", "cnt", LIFECYCLE_TOP_N)
    elif theme == "distribution":
        col = mapping.region
        if not col or col not in df.columns:
            raise StandardAnalysisError(RPT_STD_FIELD_MAPPING, "region mapping required", 422)
        out = df.groupby(col, dropna=False).size().reset_index(name="cnt")
        out.columns = ["dim", "cnt"]
        top_n = DISTRIBUTION_TOP_N
        out, top_n_truncated = apply_top_n_bucket(out, "dim", "cnt", DISTRIBUTION_TOP_N)
    else:
        col = mapping.created_at
        if not col or col not in df.columns:
            raise StandardAnalysisError(RPT_STD_FIELD_MAPPING, "createdAt mapping required", 422)
        df = _drop_invalid_time_rows(df, col)
        if df.empty:
            meta = build_render_meta(
                source_row_count=source_row_count,
                aggregated_point_count=0,
                query_limit=query_limit,
                time_step=time_step,
            )
            return columns, [], meta
        buckets = bucket_time_series(df[col], time_step)
        out = df.assign(_d=buckets).groupby("_d", dropna=False).size().reset_index(name="cnt")
        out.columns = ["d", "cnt"]
        if theme not in {"activity", "trend"}:
            raise StandardAnalysisError(RPT_STD_THEME_UNSUPPORTED, f"unsupported theme={theme}", 422)
        out = out.sort_values("d")
        out, point_cap_applied = cap_recent_time_points(out, time_step)

    result_columns = list(out.columns)
    result_rows = out.values.tolist()
    meta = build_render_meta(
        source_row_count=source_row_count,
        aggregated_point_count=len(result_rows),
        query_limit=query_limit,
        time_step=time_step if theme in {"activity", "trend"} else None,
        top_n=top_n,
        top_n_truncated=top_n_truncated,
        point_cap=POINT_CAP_BY_STEP[time_step] if theme in {"activity", "trend"} else None,
        point_cap_applied=point_cap_applied,
    )
    return result_columns, result_rows, meta
