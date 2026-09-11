from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.datasources.models import get_meta_session
from app.integration import embed_token_repo
from app.integration.errors import IntegrationError
from app.viz.embed import _ORIGIN_RE

ShareMode = Literal["embed", "public"]

# 公开/嵌入分享 token 有效期：默认 7 天；API 可调 1 分钟 ~ 30 天
EMBED_TOKEN_DEFAULT_EXPIRES_SEC = 7 * 24 * 3600
EMBED_TOKEN_MAX_EXPIRES_SEC = 30 * 24 * 3600


class EmbedTokenIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    allowed_origins: list[str] = Field(default_factory=list, alias="allowedOrigins")
    expires_in_sec: int = Field(
        default=EMBED_TOKEN_DEFAULT_EXPIRES_SEC,
        alias="expiresInSec",
        ge=60,
        le=EMBED_TOKEN_MAX_EXPIRES_SEC,
    )
    theme: Literal["light", "dark"] = "light"
    share_mode: ShareMode = Field(default="embed", alias="shareMode")


class EmbedTokenOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    token: str
    expires_at: str = Field(alias="expiresAt")
    embed_url: str = Field(alias="embedUrl")
    sdk_params: dict = Field(alias="sdkParams")


from app.auth.permissions import permission_matches


def _assert_embed_issue(actor: UserContext) -> None:
    if actor.is_root or permission_matches(
        set(actor.permissions), "dashboard:share", actor.is_root
    ):
        return
    raise IntegrationError(
        "EMBED_TOKEN_FORBIDDEN",
        "Embed token requires dashboard:share permission",
        403,
    )


def assert_embed_origin(meta: dict, origin_header: str | None) -> None:
    if meta.get("share_mode") == "public":
        allowed = meta.get("allowed_origins") or []
        if not allowed:
            return
    else:
        allowed = meta.get("allowed_origins") or []
    if allowed and origin_header and origin_header not in allowed:
        raise IntegrationError("EMBED_ORIGIN_DENIED", "Origin not allowed", 403)


def _validate_origins(origins: list[str]) -> None:
    invalid = [
        {"field": f"allowedOrigins[{i}]", "message": f"invalid origin: {o}"}
        for i, o in enumerate(origins)
        if not _ORIGIN_RE.match(o)
    ]
    if invalid:
        raise IntegrationError(
            "EMBED_INVALID_ORIGIN", "invalid origin", 422, fields=invalid
        )


def issue_embed_token(
    actor: UserContext,
    payload: EmbedTokenIn,
    origin_header: str | None,
) -> EmbedTokenOut:
    _assert_embed_issue(actor)
    if payload.chart_id is None and payload.dashboard_id is None:
        raise IntegrationError(
            "EMBED_MISSING_TARGET",
            "chartId or dashboardId is required",
            422,
            fields=[
                {"field": "chartId", "message": "required"},
                {"field": "dashboardId", "message": "required"},
            ],
        )
    if payload.chart_id is not None and payload.dashboard_id is not None:
        raise IntegrationError(
            "EMBED_TARGET_CONFLICT",
            "chartId conflicts with dashboardId",
            422,
            fields=[
                {"field": "chartId", "message": "conflict"},
                {"field": "dashboardId", "message": "conflict"},
            ],
        )
    if payload.share_mode == "public" and payload.allowed_origins:
        raise IntegrationError(
            "EMBED_PUBLIC_ORIGINS_FORBIDDEN",
            "public shareMode must not set allowedOrigins",
            422,
            fields=[{"field": "allowedOrigins", "message": "must be empty for public shareMode"}],
        )
    _validate_origins(payload.allowed_origins)
    if payload.share_mode != "public" and origin_header and payload.allowed_origins:
        if origin_header not in payload.allowed_origins:
            raise IntegrationError(
                "EMBED_ORIGIN_DENIED",
                "Origin not in allowedOrigins",
                403,
            )
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(seconds=payload.expires_in_sec)
    container_id = f"embed-{token[:8]}"
    api_base = "/api/v1"
    meta = {
        "container_id": container_id,
        "theme": payload.theme,
        "api_base": api_base,
        "allowed_origins": list(payload.allowed_origins),
        "share_mode": payload.share_mode,
        "chart_id": str(payload.chart_id) if payload.chart_id else None,
        "dashboard_id": str(payload.dashboard_id) if payload.dashboard_id else None,
        "actor_id": actor.id,
        "actor_username": actor.username,
        "actor_roles": list(actor.roles),
        "actor_permissions": list(actor.permissions),
        "actor_is_root": actor.is_root,
    }
    session = get_meta_session()
    try:
        embed_token_repo.save_token(session, token, expires_at, meta)
    finally:
        session.close()
    share_qs = "&shareMode=public" if payload.share_mode == "public" else ""
    if payload.chart_id is not None:
        embed_path = f"/embed/chart/{payload.chart_id}?token={token}{share_qs}"
    elif payload.dashboard_id is not None:
        embed_path = f"/embed/screen/{payload.dashboard_id}?token={token}{share_qs}"
    else:
        embed_path = f"/embed/chart?token={token}{share_qs}"
    return EmbedTokenOut(
        token=token,
        expires_at=expires_at.isoformat(),
        embed_url=embed_path,
        sdk_params={
            "containerId": container_id,
            "theme": payload.theme,
            "apiBase": api_base,
            "token": token,
        },
    )


def require_token_meta(token: str) -> dict:
    session = get_meta_session()
    try:
        row = embed_token_repo.get_token(session, token)
        if row is None:
            raise IntegrationError("EMBED_TOKEN_INVALID", "Invalid embed token", 404)
        _exp, meta = row
        if datetime.now(UTC) > meta["expires_at"]:
            raise IntegrationError("EMBED_TOKEN_EXPIRED", "Embed token expired", 404)
        return meta
    finally:
        session.close()


def resolve_embed_actor(token: str) -> UserContext:
    row = require_token_meta(token)
    chart_id = row.get("chart_id")
    dash_id = row.get("dashboard_id")
    return UserContext(
        id=str(row["actor_id"]),
        username=str(row.get("actor_username") or ""),
        roles=list(row.get("actor_roles") or []),
        permissions=set(row.get("actor_permissions") or []),
        is_root=bool(row.get("actor_is_root")),
    )


def resolve_sdk_params(token: str, origin_header: str | None = None) -> dict:
    row = require_token_meta(token)
    assert_embed_origin(row, origin_header)
    chart_raw = row.get("chart_id")
    dash_raw = row.get("dashboard_id")
    return {
        "containerId": row["container_id"],
        "theme": row["theme"],
        "apiBase": row["api_base"],
        "token": token,
        "shareMode": row.get("share_mode") or "embed",
        **(
            {"targetType": "chart", "targetId": chart_raw}
            if chart_raw
            else {}
        ),
        **(
            {"targetType": "dashboard", "targetId": dash_raw}
            if dash_raw
            else {}
        ),
    }
