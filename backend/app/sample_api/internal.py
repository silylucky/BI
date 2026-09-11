"""内置样例 REST API 进程内分发 — 避免同步任务 HTTP 自调用本机 uvicorn 导致死锁。"""

from __future__ import annotations

SAMPLE_ORDERS: list[dict[str, object]] = [
    {
        "id": 1,
        "product_name": "Widget A",
        "amount": 12.5,
        "status": "active",
        "region": "华东",
        "updated_at": "2026-08-01T10:00:00Z",
    },
    {
        "id": 2,
        "product_name": "Widget B",
        "amount": 8.0,
        "status": "active",
        "region": "华北",
        "updated_at": "2026-08-02T11:30:00Z",
    },
    {
        "id": 3,
        "product_name": "Widget C",
        "amount": 19.9,
        "status": "pending",
        "region": "华南",
        "updated_at": "2026-08-03T09:15:00Z",
    },
    {
        "id": 4,
        "product_name": "Widget D",
        "amount": 3.2,
        "status": "deleted",
        "region": "西南",
        "updated_at": "2026-08-03T14:00:00Z",
    },
]


class SampleApiAuthError(Exception):
    """Basic 认证失败。"""


def _normalize_path(path: str) -> str:
    trimmed = path.strip()
    if not trimmed.startswith("/"):
        trimmed = f"/{trimmed}"
    return trimmed


def dispatch_sample_api_get(
    path: str,
    *,
    username: str | None = None,
    password: str | None = None,
) -> object:
    normalized = _normalize_path(path)
    if normalized == "/sample-api/health":
        return {"status": "ok", "service": "vitalspan-sample-api"}
    if normalized == "/sample-api/orders":
        return list(SAMPLE_ORDERS)
    if normalized == "/sample-api/v1/orders":
        return {"data": list(SAMPLE_ORDERS), "total": len(SAMPLE_ORDERS)}
    if normalized == "/sample-api/protected/orders":
        if username != "demo" or password != "demo":
            raise SampleApiAuthError()
        return list(SAMPLE_ORDERS)
    raise ValueError(f"unknown sample-api path: {path}")
