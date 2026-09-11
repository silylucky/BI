from __future__ import annotations

from pydantic import BaseModel, Field


class EmailDeliveryConfigOut(BaseModel):
    slot: str = Field(description="qq | 163")
    label: str
    configured: bool
    source: str = Field(description="db | env | none")
    host: str | None = None
    port: int | None = None
    from_addr: str | None = Field(default=None, alias="from")
    username: str | None = None
    has_password: bool = Field(alias="hasPassword")
    probe_status: str | None = Field(default=None, alias="probeStatus")
    probe_error: str | None = Field(default=None, alias="probeError")

    model_config = {"populate_by_name": True}


class EmailDeliverySlotsOut(BaseModel):
    items: list[EmailDeliveryConfigOut]

    model_config = {"populate_by_name": True}


class EmailDeliveryConfigPut(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    from_addr: str = Field(min_length=3, max_length=255, alias="from")
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, max_length=256)

    model_config = {"populate_by_name": True}
