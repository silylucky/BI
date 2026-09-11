"""密码哈希、校验、策略与临时密码生成（登录/改密/重置共用）。"""

from __future__ import annotations

import secrets
import string

from app.core.config import get_settings
from app.core.crypto.password import (
    hash_password as _hash_password,
    needs_password_rehash,
    verify_password as _verify_password,
)

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

_TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*-_"


class PasswordPolicyError(Exception):
    """密码不满足策略（与 ChangePasswordRequest 长度约束一致）。"""

    code = "AUTH_PASSWORD_POLICY"
    status = 422

    def __init__(
        self, message: str = "密码长度须为 8-128 个字符"
    ) -> None:
        self.message = message
        super().__init__(message)


def validate_password_policy(password: str) -> None:
    """校验密码策略；不满足抛 ``PasswordPolicyError``。"""
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise PasswordPolicyError()


def hash_password(password: str) -> str:
    return _hash_password(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _verify_password(password, password_hash)


def generate_temporary_password(length: int | None = None) -> str:
    """用 ``secrets`` 生成满足策略的随机临时密码；不使用固定默认密码。"""
    size = length if length is not None else get_settings().auth_temporary_password_length
    while True:
        candidate = "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(size))
        try:
            validate_password_policy(candidate)
        except PasswordPolicyError:
            continue
        return candidate


__all__ = [
    "MIN_PASSWORD_LENGTH",
    "MAX_PASSWORD_LENGTH",
    "PasswordPolicyError",
    "generate_temporary_password",
    "hash_password",
    "needs_password_rehash",
    "validate_password_policy",
    "verify_password",
]
