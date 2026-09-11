from __future__ import annotations

import binascii
import secrets

from gmssl import func, sm3

SM3_PREFIX = "$sm3$"


def _sm3_hex(data: bytes) -> str:
    return sm3.sm3_hash(func.bytes_to_list(data))


def _hash_sm3(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = _sm3_hex(f"{salt}{password}".encode())
    return f"{SM3_PREFIX}{salt}${digest}"


def _verify_sm3(password: str, password_hash: str) -> bool:
    if not password_hash.startswith(SM3_PREFIX):
        return False
    rest = password_hash[len(SM3_PREFIX) :]
    parts = rest.split("$", 1)
    if len(parts) != 2:
        return False
    salt, expected = parts
    try:
        binascii.unhexlify(salt)
        binascii.unhexlify(expected)
    except (binascii.Error, ValueError):
        return False
    actual = _sm3_hex(f"{salt}{password}".encode())
    return secrets.compare_digest(actual, expected)


def hash_password(password: str) -> str:
    return _hash_sm3(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    if not password_hash.startswith(SM3_PREFIX):
        return False
    return _verify_sm3(password, password_hash)


def needs_password_rehash(password_hash: str) -> bool:
    return not password_hash.startswith(SM3_PREFIX)
