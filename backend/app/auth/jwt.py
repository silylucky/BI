from __future__ import annotations

import base64
import json
import time
from typing import Any

from app.core.config import get_settings
from app.core.crypto.sm2 import Sm2CryptoError, Sm2Signer

ALGORITHM = "SM2"
DEFAULT_EXPIRES_MINUTES = 480
# 兼容发布窗口：0024 部署前签发的历史 token 缺 tokenVersion，按版本 1 解析。
DEFAULT_TOKEN_VERSION = 1


class JwtError(Exception):
    pass


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _encode_part(payload: dict[str, Any]) -> str:
    return _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )


def _decode_part(value: str) -> dict[str, Any]:
    try:
        decoded = json.loads(_b64url_decode(value))
    except (json.JSONDecodeError, ValueError, UnicodeDecodeError) as exc:
        raise JwtError("invalid token") from exc
    if not isinstance(decoded, dict):
        raise JwtError("invalid token")
    return decoded


def _signing_input(header_b64: str, payload_b64: str) -> bytes:
    return f"{header_b64}.{payload_b64}".encode("ascii")


def _signer() -> Sm2Signer:
    settings = get_settings()
    try:
        return Sm2Signer(
            private_key_hex=settings.jwt_sm2_private_key,
            public_key_hex=settings.jwt_sm2_public_key,
        )
    except Sm2CryptoError as exc:
        raise JwtError("invalid jwt signing configuration") from exc


def create_access_token(
    user_id: str,
    username: str,
    *,
    expires_minutes: int = DEFAULT_EXPIRES_MINUTES,
    token_version: int = DEFAULT_TOKEN_VERSION,
) -> str:
    now = int(time.time())
    header = {"alg": ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "tokenVersion": token_version,
        "iat": now,
        "exp": now + expires_minutes * 60,
    }
    header_b64 = _encode_part(header)
    payload_b64 = _encode_part(payload)
    signing_input = _signing_input(header_b64, payload_b64)
    signature = _signer().sign(signing_input)
    return f"{header_b64}.{payload_b64}.{_b64url_encode(bytes.fromhex(signature))}"


def decode_access_token(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise JwtError("invalid token")
    header_b64, payload_b64, signature_b64 = parts
    try:
        header = _decode_part(header_b64)
        payload = _decode_part(payload_b64)
        signature = _b64url_decode(signature_b64).hex()
    except JwtError:
        raise
    except ValueError as exc:
        raise JwtError("invalid token") from exc

    if header.get("alg") != ALGORITHM:
        raise JwtError("invalid token")

    settings = get_settings()
    try:
        verifier = Sm2Signer(public_key_hex=settings.jwt_sm2_public_key)
    except Sm2CryptoError as exc:
        raise JwtError("invalid jwt verification configuration") from exc

    if not verifier.verify(_signing_input(header_b64, payload_b64), signature):
        raise JwtError("invalid token")

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise JwtError("invalid token")

    return payload


def token_version_from_claims(claims: dict[str, Any]) -> int:
    """从 JWT claims 读取 tokenVersion；历史 token 缺该声明时按版本 1 兼容。"""
    raw = claims.get("tokenVersion", DEFAULT_TOKEN_VERSION)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return DEFAULT_TOKEN_VERSION
