from __future__ import annotations

import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.governance.workflow.errors import WorkflowError

probe_workflow_transition_budget_ms = 50

_REQUIRED_TEMPLATE_NODES = frozenset({"draft", "published"})


@dataclass(frozen=True)
class NodeRoleDescriptor:
    node_id: str
    role: str
    description: str


@dataclass(frozen=True)
class WorkflowProbeResult:
    elapsed_ms: float
    ok: bool


_ROLE_DESCRIPTIONS: dict[str, str] = {
    "draft": "起草节点，由 requester 提交",
    "pending_approval": "待审批，由 approver 审批或驳回",
    "designing": "设计中，由 designer 完成设计",
    "pending_publish": "待发布，由 publisher 发布",
    "published": "已发布终态",
}


def describe_node_roles(session: Session, template_id: str) -> list[NodeRoleDescriptor]:
    from app.governance.workflow.service import get_template

    template = get_template(session, template_id)
    return [
        NodeRoleDescriptor(
            node_id=node.id,
            role=node.role,
            description=_ROLE_DESCRIPTIONS.get(node.id, node.id),
        )
        for node in template.nodes
    ]


def resolve_required_role(session: Session, template_id: str, status: str) -> str:
    from app.governance.workflow.service import get_template

    template = get_template(session, template_id)
    for node in template.nodes:
        if node.id == status:
            return node.role
    raise WorkflowError("GOV_WORKFLOW_INVALID_TEMPLATE", f"Unknown status node: {status}", 422)


def probe_transition_path() -> WorkflowProbeResult:
    from app.governance.workflow.service import _TRANSITIONS

    started = time.perf_counter()
    status = "draft"
    actions = [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]
    ok = True
    for action, role in actions:
        rules = _TRANSITIONS.get(status, {})
        if action not in rules:
            ok = False
            break
        next_status, required_role = rules[action]
        if role != required_role:
            ok = False
            break
        status = next_status
    elapsed_ms = (time.perf_counter() - started) * 1000
    return WorkflowProbeResult(elapsed_ms=elapsed_ms, ok=ok and status == "published")
