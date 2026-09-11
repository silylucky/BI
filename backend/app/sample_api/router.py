"""内置样例 REST API — 供连接管理 REST API 连接器本地测连 / Native 查询。"""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.sample_api.internal import SampleApiAuthError, dispatch_sample_api_get

router = APIRouter(prefix="/sample-api", tags=["sample-api"])

_basic = HTTPBasic(auto_error=False)


@router.get("/health")
def sample_api_health() -> dict[str, str]:
    return cast(dict[str, str], dispatch_sample_api_get("/sample-api/health"))


@router.get("/orders")
def sample_api_orders() -> list[dict[str, object]]:
    """Native 查询 body: {\"path\": \"/sample-api/orders\"}"""
    return cast(list[dict[str, object]], dispatch_sample_api_get("/sample-api/orders"))


@router.get("/v1/orders")
def sample_api_orders_wrapped() -> dict[str, object]:
    """Native 查询 body: {\"path\": \"/sample-api/v1/orders\", \"jsonPath\": \"data\"}"""
    return cast(dict[str, object], dispatch_sample_api_get("/sample-api/v1/orders"))


@router.get("/protected/orders")
def sample_api_protected_orders(
    credentials: HTTPBasicCredentials | None = Depends(_basic),
) -> list[dict[str, object]]:
    """Basic 认证测试：用户名 demo / 密码 demo"""
    try:
        return cast(
            list[dict[str, object]],
            dispatch_sample_api_get(
                "/sample-api/protected/orders",
                username=credentials.username if credentials else None,
                password=credentials.password if credentials else None,
            ),
        )
    except SampleApiAuthError as exc:
        raise HTTPException(status_code=401, detail="Unauthorized") from exc
