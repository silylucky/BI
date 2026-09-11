from __future__ import annotations

from app.core.config import get_settings
from app.core.crypto.sm4 import Sm4CredentialProvider

SM4_PREFIX = "sm4:"


class CredentialDecryptError(Exception):
    def __init__(self, message: str = "invalid encrypted credential") -> None:
        self.code = "INVALID_ENCRYPTED_CREDENTIAL"
        super().__init__(message)


def encrypt_credential(plain: str) -> str:
    settings = get_settings()
    body = Sm4CredentialProvider(settings.credential_sm4_key).encrypt(plain)
    return f"{SM4_PREFIX}{body}"


def decrypt_credential(cipher: str) -> str:
    if not cipher.startswith(SM4_PREFIX):
        raise CredentialDecryptError("credential must use sm4: prefix")
    body = cipher[len(SM4_PREFIX) :]
    settings = get_settings()
    try:
        return Sm4CredentialProvider(settings.credential_sm4_key).decrypt(body)
    except ValueError as exc:
        raise CredentialDecryptError() from exc


def is_sm4_ciphertext(cipher: str) -> bool:
    return cipher.startswith(SM4_PREFIX)
