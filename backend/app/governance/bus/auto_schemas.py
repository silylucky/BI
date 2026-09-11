from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FsmState = Literal["idle", "auto_registering", "succeeded", "failed", "deferred"]


class AutoRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")


class AutoRegisterOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    auto_registered: bool = Field(alias="autoRegistered")
    bus_id: str | None = Field(default=None, alias="busId")
    fsm_state: FsmState = Field(alias="fsmState")
