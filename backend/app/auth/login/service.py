from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.auth.audit import service as audit_service
from app.auth.models import AuthUser
from app.auth.password.service import hash_password, needs_password_rehash, verify_password
from app.auth.users import service as user_service
from app.core.config import get_settings
from app.core.logging import trace_id_var


class LoginError(Exception):
    def __init__(self, code: str, message: str, status: int = 401) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _record_lock(session: Session, user: AuthUser, failed_count: int) -> None:
    audit_service.record_event(
        session,
        actor_id=str(user.id),
        actor_username=user.username,
        target_type="user",
        target_id=user.id,
        action="user.lock",
        detail={"failedLoginCount": failed_count},
        trace_id=trace_id_var.get() or uuid.uuid4().hex,
    )


def authenticate(session: Session, username: str, password: str) -> AuthUser:
    """校验凭证并维护连续失败/锁定状态。

    - 禁用用户 → 403 ``AUTH_USER_DISABLED``。
    - 未到期锁定 → 403 ``AUTH_USER_LOCKED``（不累加计数）。
    - 成功 → 清零 ``failed_login_count`` 与 ``locked_until``。
    - 失败 → 连续计数 +1；达到阈值设定 ``locked_until`` 并写 ``user.lock`` 审计；
      锁定到期后的首次失败从 1 重新计数。
    """
    settings = get_settings()
    try:
        user = user_service.get_user_by_username(session, username)
    except (OperationalError, ProgrammingError):
        raise LoginError("AUTH_INVALID_CREDENTIALS", "用户名或密码错误", 401) from None
    if user is None or not user.password_hash:
        raise LoginError("AUTH_INVALID_CREDENTIALS", "用户名或密码错误", 401)
    if not user.is_active:
        raise LoginError("AUTH_USER_DISABLED", "账户已被禁用", 403)

    now = datetime.now(timezone.utc)
    locked_until = _aware(user.locked_until)
    if locked_until is not None and locked_until > now:
        raise LoginError("AUTH_USER_LOCKED", "账户已锁定，请稍后再试", 403)

    lock_expired = locked_until is not None and locked_until <= now

    if verify_password(password, user.password_hash):
        dirty = bool(user.failed_login_count or user.locked_until is not None)
        if needs_password_rehash(user.password_hash):
            user.password_hash = hash_password(password)
            dirty = True
        if dirty:
            user.failed_login_count = 0
            user.locked_until = None
            session.commit()
        return user

    baseline = 0 if lock_expired else user.failed_login_count
    new_count = baseline + 1
    user.failed_login_count = new_count
    user.locked_until = None
    if new_count >= settings.auth_max_failed_logins:
        user.locked_until = now + timedelta(minutes=settings.auth_lock_minutes)
        _record_lock(session, user, new_count)
    session.commit()
    raise LoginError("AUTH_INVALID_CREDENTIALS", "用户名或密码错误", 401)


def resolve_role_codes(session: Session, user_id: uuid.UUID) -> list[str]:
    return user_service.resolve_role_codes_for_user(session, user_id)


def handle_oidc_callback(
    session: Session,
    *,
    provider: str,
    code: str,
    state: str | None,
):
    """OIDC 登录回调占位；完整实现见 `auth/login/oidc.py` 与 spec gate 文档。"""
    from app.auth.login.oidc import handle_oidc_callback as _handle_oidc_callback

    return _handle_oidc_callback(session, provider=provider, code=code, state=state)
