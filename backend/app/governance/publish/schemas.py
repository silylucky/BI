from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PublishActionOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str
    bus_register_status: str | None = Field(default=None, alias="busRegisterStatus")
    bus_register_error_code: str | None = Field(default=None, alias="busRegisterErrorCode")


class PublishStatusOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    status: str
    allowed_actions: list[str] = Field(alias="allowedActions")


class PublishNotificationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    entry_id: uuid.UUID = Field(alias="entryId")
    event_type: str = Field(alias="eventType")
    timestamp: str
    delivery_mode: str = Field(alias="deliveryMode")
    notification_status: str = Field(alias="notificationStatus")
    message: str


class PublishNotificationListOut(BaseModel):
    items: list[PublishNotificationOut]


class PublishFromWorkflowIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    workflow_instance_id: uuid.UUID = Field(alias="workflowInstanceId")


class PublishFromWorkflowOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    publish_version: int = Field(alias="publishVersion")
    idempotent: bool = False


class PublishLinkPhysicalIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    table_fqn: str = Field(alias="tableFqn", min_length=3, max_length=128)
