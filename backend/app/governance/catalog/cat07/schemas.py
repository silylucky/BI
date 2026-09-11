from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BehaviorRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    action: str
    timestamp: datetime
    audit_ref: str = Field(alias="auditRef")


class WorknoBehaviorOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    workno: str
    behaviors: list[BehaviorRow]
    total: int
    audit_linked: bool = Field(default=True, alias="auditLinked")
