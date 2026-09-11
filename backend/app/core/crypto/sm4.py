from __future__ import annotations

import base64
import os

from gmssl.sm4 import CryptSM4, SM4_DECRYPT, SM4_ENCRYPT


class Sm4CredentialProvider:
    prefix = "sm4"
    _iv_len = 16
    _block = 16

    def __init__(self, key_hex: str) -> None:
        key = bytes.fromhex(key_hex)
        if len(key) != 16:
            raise ValueError("SM4 key must be 16 bytes (32 hex chars)")
        self._key = key

    @staticmethod
    def _pad(data: bytes) -> bytes:
        pad_len = Sm4CredentialProvider._block - (len(data) % Sm4CredentialProvider._block)
        return data + bytes([pad_len]) * pad_len

    @staticmethod
    def _unpad(data: bytes) -> bytes:
        if not data:
            raise ValueError("invalid sm4 payload")
        pad_len = data[-1]
        if pad_len < 1 or pad_len > Sm4CredentialProvider._block:
            raise ValueError("invalid sm4 padding")
        if data[-pad_len:] != bytes([pad_len]) * pad_len:
            raise ValueError("invalid sm4 padding")
        return data[:-pad_len]

    def encrypt(self, plain: str) -> str:
        iv = os.urandom(self._iv_len)
        crypt = CryptSM4()
        crypt.set_key(self._key, SM4_ENCRYPT)
        padded = self._pad(plain.encode())
        cipher = crypt.crypt_cbc(iv, padded)
        return base64.b64encode(iv + cipher).decode()

    def decrypt(self, cipher_body: str) -> str:
        raw = base64.b64decode(cipher_body.encode())
        if len(raw) <= self._iv_len:
            raise ValueError("invalid sm4 payload")
        iv, cipher = raw[: self._iv_len], raw[self._iv_len :]
        crypt = CryptSM4()
        crypt.set_key(self._key, SM4_DECRYPT)
        plain = self._unpad(crypt.crypt_cbc(iv, cipher))
        return plain.decode()
