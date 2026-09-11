from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LifecycleTemplateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_key: str = Field(alias="templateKey", pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    entity_type_code: str = Field(alias="entityTypeCode", pattern=r"^[a-z][a-z0-9_]{1,63}$")
    lifecycle_stages: list[str] = Field(alias="lifecycleStages")
    read_only_open_api: bool = Field(default=True, alias="readOnlyOpenApi")
    allowed_roles: list[str] = Field(default_factory=lambda: ["analyst"], alias="allowedRoles")


class LifecycleTemplateOut(LifecycleTemplateIn):
    pass


class LifecycleTemplateValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    template_key: str = Field(alias="templateKey")


class LifecycleTemplateListResponse(BaseModel):
    items: list[LifecycleTemplateOut]
    total: int


class LifecycleStageMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    stage_name: str = Field(alias="stageName", min_length=1, max_length=64)
    to_index: int = Field(alias="toIndex", ge=0)
