from __future__ import annotations

import re
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

_ORIGIN_RE = re.compile(r"^https?://[a-zA-Z0-9.-]+(:\d+)?$")


def is_origin_allowed(origin: str, allowed: list[str]) -> bool:
    if not allowed:
        return True
    if not _ORIGIN_RE.match(origin):
        return False
    return origin in allowed


class ChartEmbedError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class ChartEmbedConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chart_id: uuid.UUID | None = Field(default=None, alias="chartId")
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    allowed_origins: list[str] = Field(
        default_factory=list, alias="allowedOrigins", max_length=32
    )
    theme: Literal["light", "dark"] = "light"
    token: str | None = Field(default=None, max_length=512)


def validate_chart_embed_config(data: dict[str, Any]) -> ChartEmbedConfig:
    try:
        cfg = ChartEmbedConfig.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        field_name = ".".join(str(p) for p in first.get("loc", ())) or "config"
        raise ChartEmbedError(
            "EMBED_INVALID",
            "Invalid embed config",
            422,
            [{"field": field_name, "message": str(first.get("msg", "invalid"))}],
        ) from exc
    if cfg.chart_id is None and cfg.dashboard_id is None:
        raise ChartEmbedError(
            "EMBED_MISSING_TARGET",
            "chartId or dashboardId is required",
            422,
            [{"field": "chartId", "message": "required"},
             {"field": "dashboardId", "message": "required"}],
        )
    if cfg.chart_id is not None and cfg.dashboard_id is not None:
        raise ChartEmbedError(
            "EMBED_TARGET_CONFLICT",
            "chartId conflicts with dashboardId",
            422,
            [{"field": "chartId", "message": "conflict"},
             {"field": "dashboardId", "message": "conflict"}],
        )
    invalid = [
        {"field": f"allowedOrigins[{i}]", "message": f"invalid origin: {o}"}
        for i, o in enumerate(cfg.allowed_origins)
        if not _ORIGIN_RE.match(o)
    ]
    if invalid:
        raise ChartEmbedError("EMBED_INVALID_ORIGIN", "invalid origin", 422, invalid)
    return cfg
