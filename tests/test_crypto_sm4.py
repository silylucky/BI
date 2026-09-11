import os

import pytest

from app.core.config import get_settings
from app.core.crypto.credentials import (
    CredentialDecryptError,
    decrypt_credential,
    encrypt_credential,
)
from app.core.crypto.sm4 import Sm4CredentialProvider


@pytest.fixture(autouse=True)
def _sm4_env(monkeypatch):
    monkeypatch.setenv("CREDENTIAL_SM4_KEY", "0123456789abcdef0123456789abcdef")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_sm4_round_trip():
    plain = "mysql-secret-pw"
    cipher = encrypt_credential(plain)
    assert cipher.startswith("sm4:")
    assert decrypt_credential(cipher) == plain


def test_sm4_iv_unique():
    a = encrypt_credential("same")
    b = encrypt_credential("same")
    assert a != b


def test_sm4_wrong_key_fails(monkeypatch):
    cipher = encrypt_credential("x")
    monkeypatch.setenv("CREDENTIAL_SM4_KEY", "fedcba9876543210fedcba9876543210")
    get_settings.cache_clear()
    with pytest.raises(CredentialDecryptError):
        decrypt_credential(cipher)


def test_non_sm4_prefix_decrypt_fails():
    with pytest.raises(CredentialDecryptError, match="sm4:"):
        decrypt_credential("fernet:legacy-ciphertext")


def test_sm4_provider_invalid_key():
    with pytest.raises(ValueError, match="16 bytes"):
        Sm4CredentialProvider("abcd")
