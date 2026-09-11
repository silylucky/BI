from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth.audit import service as audit_service
from app.auth.models import AuthUser
from app.auth.password.service import (
    hash_password,
    validate_password_policy,
    verify_password,
)
from app.auth.profile.schemas import MeProfileOut, MeProfileUpdate
from app.auth.users import service as user_service
from app.auth.users.service import UserError
from app.core.logging import trace_id_var


class ProfileError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def resolve_actor_user_id(session: Session, user_id: str, username: str) -> uuid.UUID:
    try:
        requested_id = uuid.UUID(user_id)
    except ValueError:
        user = user_service.get_user_by_username(session, username)
    else:
        user = user_service.get_user_by_id_or_matching_username(session, requested_id, username)
    if user is None:
        raise ProfileError("USER_NOT_FOUND", "User not found", 404)
    return user.id


def _default_email(username: str) -> str:
    return f"{username}@vitalspan.local"


def _display_name(user: AuthUser) -> str:
    return (user.display_name or user.username).strip()


def _email(user: AuthUser) -> str:
    return (user.email or _default_email(user.username)).strip()


def build_me_profile(
    session: Session,
    user_id: uuid.UUID,
    roles: list[str],
    *,
    username: str | None = None,
    permissions: list[str] | None = None,
    is_root: bool = False,
) -> MeProfileOut:
    user = (
        user_service.get_user_by_id_or_matching_username(session, user_id, username)
        if username is not None
        else session.get(AuthUser, user_id)
    )
    if user is None:
        raise ProfileError("USER_NOT_FOUND", "User not found", 404)
    return MeProfileOut(
        id=str(user.id),
        username=user.username,
        display_name=_display_name(user),
        email=_email(user),
        roles=roles,
        permissions=sorted(permissions or []),
        is_root=is_root,
    )


def update_me_profile(
    session: Session,
    *,
    user_id: uuid.UUID,
    roles: list[str],
    actor_username: str,
    payload: MeProfileUpdate,
    permissions: list[str] | None = None,
    is_root: bool = False,
) -> MeProfileOut:
    try:
        user = user_service.get_user(session, user_id)
    except UserError as exc:
        raise ProfileError(exc.code, exc.message, exc.status) from exc
    changes: dict[str, str] = {}
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
        changes["displayName"] = user.display_name
    if payload.email is not None:
        user.email = payload.email
        changes["email"] = user.email
    if not changes:
        raise ProfileError("PROFILE_NO_CHANGES", "No profile fields to update", 422)
    trace_id = trace_id_var.get() or uuid.uuid4().hex
    audit_service.record_event(
        session,
        actor_id=str(user_id),
        actor_username=actor_username,
        target_type="user",
        target_id=user.id,
        action="profile.update",
        detail=changes,
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return build_me_profile(
        session,
        user_id,
        roles,
        username=actor_username,
        permissions=permissions,
        is_root=is_root,
    )


def change_password(
    session: Session,
    *,
    user_id: uuid.UUID,
    actor_username: str,
    current_password: str,
    new_password: str,
) -> None:
    try:
        user = user_service.get_user(session, user_id)
    except UserError as exc:
        raise ProfileError(exc.code, exc.message, exc.status) from exc
    if not user.password_hash:
        raise ProfileError("AUTH_PASSWORD_NOT_SET", "Password is not configured for this account", 422)
    if not verify_password(current_password, user.password_hash):
        raise ProfileError("AUTH_INVALID_CURRENT_PASSWORD", "当前密码不正确", 401)
    if current_password == new_password:
        raise ProfileError("AUTH_PASSWORD_UNCHANGED", "新密码不能与当前密码相同", 422)
    validate_password_policy(new_password)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.token_version = user.token_version + 1
    trace_id = trace_id_var.get() or uuid.uuid4().hex
    audit_service.record_event(
        session,
        actor_id=str(user_id),
        actor_username=actor_username,
        target_type="user",
        target_id=user.id,
        action="password.change",
        detail=None,
        trace_id=trace_id,
    )
    session.commit()
