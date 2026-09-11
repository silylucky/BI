"""SM2 签名/验签（gmssl 封装；业务层禁止直接 import gmssl）。"""

from __future__ import annotations

import secrets

from gmssl import sm2


class Sm2CryptoError(Exception):
    pass


def derive_public_key(private_key_hex: str) -> str:
    normalized = _normalize_private_key(private_key_hex)
    crypt = sm2.CryptSM2(private_key=normalized, public_key="00")
    return crypt._kg(int(normalized, 16), crypt.ecc_table["g"])


def generate_keypair() -> tuple[str, str]:
    private_key = secrets.token_hex(32).upper()
    public_key = derive_public_key(private_key)
    return private_key, public_key


def _normalize_private_key(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise Sm2CryptoError("SM2 private key is empty")
    if not all(ch in "0123456789abcdefABCDEF" for ch in stripped):
        raise Sm2CryptoError("SM2 private key must be hex")
    if len(stripped) != 64:
        raise Sm2CryptoError("SM2 private key must be 64 hex chars (32 bytes)")
    return stripped.upper()


def _normalize_public_key(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("04"):
        stripped = stripped[2:]
    if not stripped:
        raise Sm2CryptoError("SM2 public key is empty")
    if not all(ch in "0123456789abcdefABCDEF" for ch in stripped):
        raise Sm2CryptoError("SM2 public key must be hex")
    if len(stripped) != 128:
        raise Sm2CryptoError("SM2 public key must be 128 hex chars (uncompressed point)")
    return stripped.upper()


class Sm2Signer:
    def __init__(self, *, private_key_hex: str = "", public_key_hex: str = "") -> None:
        private = _normalize_private_key(private_key_hex) if private_key_hex.strip() else ""
        public = _normalize_public_key(public_key_hex) if public_key_hex.strip() else ""
        if private and not public:
            public = derive_public_key(private)
        if not public:
            raise Sm2CryptoError("SM2 public key is required")
        self._private_key = private
        self._public_key = public
        self._signer = (
            sm2.CryptSM2(private_key=private, public_key=public) if private else None
        )
        self._verifier = sm2.CryptSM2(private_key=private or "00", public_key=public)

    @property
    def public_key_hex(self) -> str:
        return self._public_key

    def sign(self, data: bytes) -> str:
        if self._signer is None:
            raise Sm2CryptoError("SM2 private key is required for signing")
        signature = self._signer.sign_with_sm3(data)
        if not signature:
            raise Sm2CryptoError("SM2 signing failed")
        return signature.upper()

    def verify(self, data: bytes, signature_hex: str) -> bool:
        if not signature_hex:
            return False
        try:
            return bool(self._verifier.verify_with_sm3(signature_hex.lower(), data))
        except (TypeError, ValueError):
            return False
