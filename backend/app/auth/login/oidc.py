"""OIDC / LDAP external identity integration stubs (Phase C5)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.login.service import LoginError
from app.auth.users import service as user_service


@dataclass(frozen=True)
class OidcCallbackResult:
    user_id: uuid.UUID
    username: str
    provider: str
    subject: str


class ExternalAuthNotConfiguredError(LoginError):
    def __init__(self) -> None:
        super().__init__(
            "AUTH_EXTERNAL_NOT_CONFIGURED",
            "外部身份源尚未配置，请联系管理员",
            501,
        )


def handle_oidc_callback(
    session: Session,
    *,
    provider: str,
    code: str,
    state: str | None,
) -> OidcCallbackResult:
    """OIDC authorization_code 回调占位：校验 state、换 token、映射本地用户。

    完整实现见 docs/specs/auth-ldap-oidc-integration.md。
    """
    _ = (session, provider, code, state)
    raise ExternalAuthNotConfiguredError()


def resolve_local_user_for_external_subject(
    session: Session,
    *,
    provider: str,
    subject: str,
) -> uuid.UUID | None:
    """按外部 IdP subject 查找已绑定的本地用户（占位）。"""
    _ = (session, provider, subject)
    return None


def provision_user_from_oidc_claims(
    session: Session,
    *,
    username: str,
    display_name: str | None,
    email: str | None,
) -> uuid.UUID:
    """首次 OIDC 登录自动开户占位（默认禁用，须 spec 门禁后启用）。"""
    user = user_service.get_user_by_username(session, username)
    if user is not None:
        return user.id
    raise ExternalAuthNotConfiguredError()
