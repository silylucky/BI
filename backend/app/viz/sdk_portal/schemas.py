from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TargetType = Literal["chart", "dashboard"]
AuthMode = Literal["token", "none"]
LifecyclePhase = Literal["init", "destroy"]


class LifecycleHooks(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    on_init: bool = Field(default=True, alias="onInit")
    on_destroy: bool = Field(default=True, alias="onDestroy")


class SdkPortalInitIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    app_id: str = Field(alias="appId", pattern=r"^[a-z][a-z0-9_-]{2,31}$")
    target_type: TargetType = Field(alias="targetType")
    target_id: uuid.UUID | None = Field(default=None, alias="targetId")
    auth_mode: AuthMode = Field(default="token", alias="authMode")
    embed_token: str | None = Field(default=None, alias="embedToken", max_length=512)
    allowed_origins: list[str] = Field(default_factory=list, alias="allowedOrigins", max_length=32)
    lifecycle_hooks: LifecycleHooks = Field(default_factory=LifecycleHooks, alias="lifecycleHooks")


class SdkPortalValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    app_id: str = Field(alias="appId")
    token_required: bool = Field(alias="tokenRequired")


class SdkLifecycleIn(BaseModel):
    phase: LifecyclePhase


class SdkLifecycleOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    phase: LifecyclePhase
    ready: bool
    sdk_version: str = Field(alias="sdkVersion")


class SdkCapabilitiesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    target_types: list[str] = Field(alias="targetTypes")
    auth_modes: list[str] = Field(alias="authModes")
