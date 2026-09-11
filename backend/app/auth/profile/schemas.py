from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class MeProfileOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    username: str
    display_name: str = Field(serialization_alias="displayName")
    email: str
    roles: list[str]
    permissions: list[str] = Field(default_factory=list)
    is_root: bool = Field(default=False, serialization_alias="isRoot")


class MeProfileUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    display_name: str | None = Field(default=None, min_length=1, max_length=128, alias="displayName")
    email: str | None = Field(default=None, min_length=3, max_length=255)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("display name must not be blank")
        return normalized

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("invalid email format")
        return normalized


class ChangePasswordIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(min_length=1, max_length=128, alias="currentPassword")
    new_password: str = Field(min_length=8, max_length=128, alias="newPassword")
