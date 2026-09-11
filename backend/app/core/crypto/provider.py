from __future__ import annotations

from typing import Protocol


class CredentialCryptoProvider(Protocol):
    prefix: str

    def encrypt(self, plain: str) -> str: ...

    def decrypt(self, cipher_body: str) -> str: ...
