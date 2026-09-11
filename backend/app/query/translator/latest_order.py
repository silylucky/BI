"""Pick a time-like column so LIMIT N means the latest N rows."""

from __future__ import annotations

import re
from typing import Protocol

_TIME_EXACT_SCORE: dict[str, int] = {
    "updated_at": 100,
    "modified_at": 95,
    "created_at": 90,
    "sale_date": 88,
    "event_time": 86,
    "event_date": 85,
    "timestamp": 80,
    "datetime": 78,
    "date": 70,
    "time": 60,
}

_SUFFIX_SCORE = (
    ("_at", 82),
    ("_time", 72),
    ("_date", 68),
    ("_ts", 74),
)

_SKIP = frozenset({"deleted_at", "timeout", "runtime"})


class _QuoteDialect(Protocol):
    def quote_identifier(self, name: str) -> str: ...

    def wrap_limit(self, sql: str, *, limit: int, offset: int = 0) -> str: ...


def _score_column(name: str) -> int:
    key = name.strip().lower()
    if not key or key in _SKIP:
        return 0
    if key in _TIME_EXACT_SCORE:
        return _TIME_EXACT_SCORE[key]
    for suffix, score in _SUFFIX_SCORE:
        if key.endswith(suffix) and key not in _SKIP:
            return score
    if re.search(r"(?:^|_)(date|time|datetime|timestamp)(?:$|_)", key):
        return 55
    return 0


def pick_latest_order_column(columns: list[str]) -> str | None:
    best: str | None = None
    best_score = 0
    for col in columns:
        score = _score_column(col)
        if score > best_score:
            best = col
            best_score = score
    return best


def apply_latest_limit(
    sql: str,
    dialect: _QuoteDialect,
    columns: list[str],
    *,
    limit: int,
    offset: int,
) -> str:
    """LIMIT after ORDER BY time DESC, then re-sort ASC for chart axes."""
    col = pick_latest_order_column(columns)
    if not col:
        return dialect.wrap_limit(sql, limit=limit, offset=offset)
    quoted = dialect.quote_identifier(col)
    limited = dialect.wrap_limit(
        f"{sql} ORDER BY {quoted} DESC",
        limit=limit,
        offset=offset,
    )
    inner = limited.strip().rstrip(";")
    return f"SELECT * FROM ({inner}) _vs_latest ORDER BY {quoted} ASC"
