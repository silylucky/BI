from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class WorkflowNode(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    role: str


class WorkflowTemplateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str
    nodes: list[WorkflowNode]


class WorkflowTemplateListOut(BaseModel):
    items: list[WorkflowTemplateOut]


class WorkflowTemplateValidateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str
    nodes: list[WorkflowNode]


ALLOWED_NODE_ROLES = frozenset({"requester", "approver", "designer", "publisher", "admin"})


class WorkflowTemplateCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1)
    nodes: list[WorkflowNode]


class WorkflowTemplateUpdateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(default=None, min_length=1)
    nodes: list[WorkflowNode] | None = None


class WorkflowInstanceCreateIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    template_id: str = Field(alias="templateId")
    ref_id: uuid.UUID = Field(alias="refId")


class WorkflowTransitionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    action: str
    actor_role: str = Field(alias="actorRole")


class WorkflowInstanceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    template_id: str = Field(alias="templateId")
    ref_id: uuid.UUID = Field(alias="refId")
    status: str
    allowed_actions: list[str] = Field(alias="allowedActions")
    design_snapshot: dict | None = Field(default=None, alias="designSnapshot")
    snapshot_revision: dict | None = Field(default=None, alias="snapshotRevision")


class WorkflowInstanceListOut(BaseModel):
    items: list[WorkflowInstanceOut]
    total: int


class NodeRoleOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    node_id: str = Field(alias="nodeId")
    role: str
    description: str


class WorkflowNodeRolesOut(BaseModel):
    items: list[NodeRoleOut]
