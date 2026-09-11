from __future__ import annotations

import logging
import uuid
from typing import Literal

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.resources.service import check_resource_access
from app.auth.rls.hooks import get_query_rls_fragment
from app.auth.rls.predicate import resolve_user_org_node_ids
from app.governance.persistence import gov_repo

logger = logging.getLogger(__name__)


def record_publish_submitter(db: Session, entry_id: uuid.UUID, actor_id: str) -> None:
    gov_repo.record_publish_submitter(db, entry_id, actor_id)


class GovAclError(Exception):
    def __init__(self, code: str, message: str, status: int = 403) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _actor_uuid(actor_id: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(actor_id)
    except ValueError:
        return None


def assert_query_design_action(
    session: Session,
    actor: UserContext,
    action: Literal["save", "publish"],
    *,
    owner_id: uuid.UUID | None,
    status: str,
) -> None:
    if actor.is_root:
        if status == "pending_publish":
            _assert_rls_binding(session, actor)
        return
    if action == "save" and status == "draft":
        actor_uuid = _actor_uuid(actor.id)
        if owner_id is not None and actor_uuid is not None and owner_id != actor_uuid:
            raise GovAclError("GOV_ACL_FORBIDDEN", "Only owner or admin may save draft", 403)
        return
    if action == "save" and status == "pending_publish":
        if "designer" not in actor.roles:
            raise GovAclError("GOV_ACL_FORBIDDEN", "pending_publish requires designer or admin", 403)
        _assert_rls_binding(session, actor)
        return
    if action == "publish":
        raise GovAclError("GOV_ACL_FORBIDDEN", "publish requires admin", 403)


def _assert_rls_binding(session: Session, actor: UserContext) -> None:
    actor_uuid = _actor_uuid(actor.id)
    if actor_uuid is None:
        return
    org_ids = resolve_user_org_node_ids(session, actor_uuid)
    if not org_ids:
        raise GovAclError("GOV_RLS_BINDING_REQUIRED", "User has no organization binding", 403)
    get_query_rls_fragment(session, actor)


def assert_query_design_execute(
    session: Session,
    actor: UserContext,
    *,
    data_source_id: uuid.UUID | None,
) -> str:
    if actor.is_root:
        logger.info(
            "gov_acl_bypass",
            extra={"actor_id": actor.id, "action": "execute", "data_source_id": str(data_source_id)},
        )
        return get_query_rls_fragment(session, actor)
    if "designer" not in actor.roles:
        raise GovAclError("GOV_ACL_FORBIDDEN", "execute requires designer or root", 403)
    actor_uuid = _actor_uuid(actor.id)
    if actor_uuid is None:
        raise GovAclError("GOV_RLS_BINDING_REQUIRED", "User has no organization binding", 403)
    org_ids = resolve_user_org_node_ids(session, actor_uuid)
    if not org_ids:
        raise GovAclError("GOV_RLS_BINDING_REQUIRED", "User has no organization binding", 403)
    return get_query_rls_fragment(session, actor)


def workflow_role_for_action(action: str) -> str | None:
    role_map = {
        "submit": "requester",
        "approve": "approver",
        "reject": "approver",
        "complete_design": "designer",
        "publish": "publisher",
    }
    return role_map.get(action)


def assert_workflow_transition(actor: UserContext, action: str, actor_role: str) -> None:
    _ = actor_role
    required = workflow_role_for_action(action)
    if actor.is_root:
        return
    if required and required not in actor.roles:
        raise GovAclError("GOV_WORKFLOW_FORBIDDEN", f"Role cannot {action}", 403)


def assert_publish_action(
    session: Session,
    actor: UserContext,
    action: Literal["submit", "approve", "reject"],
    entry_id: uuid.UUID,
) -> None:
    if actor.is_root:
        return
    role_req = {"submit": "designer", "approve": "publisher", "reject": "publisher"}
    needed = role_req[action]
    if needed not in actor.roles:
        raise GovAclError("GOV_ACL_FORBIDDEN", f"{action} requires {needed} or admin", 403)
    if action == "approve" and "publisher" in actor.roles:
        submitter_id = gov_repo.get_publish_submitter(session, entry_id)
        if submitter_id and submitter_id == actor.id and not actor.is_root:
            raise GovAclError(
                "GOV_ACL_SELF_APPROVE_FORBIDDEN",
                "Publisher cannot approve own submission without admin",
                403,
            )
        if not check_resource_access(
            session,
            actor.roles,
            "gov_catalog_entry",
            entry_id,
            user_id=actor.id,
        ):
            raise GovAclError("GOV_RESOURCE_FORBIDDEN", "Missing gov_catalog_entry grant", 403)


def assert_bus_register(session: Session, actor: UserContext, entry_path: str) -> None:
    _ = (session, entry_path)
    if actor.is_root or "integration" in actor.roles:
        return
    raise GovAclError("GOV_AUTO_BUS_FORBIDDEN", "Bus register requires integration or admin", 403)
