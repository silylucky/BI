from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

VendorType = Literal["enterprise", "scheme", "model", "dcas"]
LocType = Literal["warehouse", "retail", "all"]


class ProductionStatsItemIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    stats_key: str = Field(alias="statsKey", pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    vendor_type: str = Field(alias="vendorType")
    brand_id: str = Field(alias="brandId", pattern=r"^[A-Z0-9]{2,16}$")
    loc_type: LocType = Field(default="all", alias="locType")
    metric_keys: list[str] = Field(
        default_factory=lambda: ["inbound", "inventory", "activation"],
        alias="metricKeys",
    )


class ProductionStatsItemOut(ProductionStatsItemIn):
    pass


class ProductionStatsValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    stats_key: str = Field(alias="statsKey")


class ProductionStatsProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    inbound: int
    inventory: int
    opened: int
    activated: int
    sampled_at: datetime = Field(alias="sampledAt")


class ProductionStatsListResponse(BaseModel):
    items: list[ProductionStatsItemOut]
    total: int
