from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

StatusFilter = Literal["open", "closed", "pending"]


class TicketStatsItemIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ticket_category_key: str = Field(alias="ticketCategoryKey", pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    status_filters: list[StatusFilter] = Field(default_factory=lambda: ["open"], alias="statusFilters")
    table_ref: str | None = Field(default=None, alias="tableRef", max_length=128)
    allowed_roles: list[str] = Field(default_factory=lambda: ["analyst"], alias="allowedRoles")


class TicketStatsItemOut(TicketStatsItemIn):
    pass


class TicketStatsValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    category_key: str = Field(alias="categoryKey")
    status_count: int = Field(alias="statusCount")


class TicketStatsProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    open: int
    closed: int
    pending: int
    sampled_at: datetime = Field(alias="sampledAt")


class TicketStatsListResponse(BaseModel):
    items: list[TicketStatsItemOut]
    total: int
