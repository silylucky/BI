import os

import pytest
from crypto_test_env import settings_kwargs
from pydantic import ValidationError

from app.core.config import Settings
from app.ingestion.models import decrypt_password, encrypt_password


def test_encrypt_password_decrypt_password_roundtrip():
    """T-D04-05: encrypt → decrypt 明文一致。"""
    plain = "sample-mysql-password"
    cipher = encrypt_password(plain)
    assert cipher.startswith("sm4:")
    assert cipher != plain
    assert decrypt_password(cipher) == plain


def test_decrypt_password_invalid_token_raises_value_error():
    """T-D04-06: 非 sm4 密文抛 ValueError。"""
    with pytest.raises(ValueError, match="invalid encrypted password"):
        decrypt_password("AAAA-invalid-ciphertext-token")


def test_settings_invalid_jwt_sm2_private_key_raises():
    """T-D04-10: 非法 JWT SM2 私钥 → Settings 加载失败。"""
    kwargs = settings_kwargs()
    kwargs["jwt_sm2_private_key"] = "x" * 43
    with pytest.raises(ValidationError):
        Settings(**kwargs)


def test_encrypt_password_sm4_roundtrip():
    """T-D04-13: SM4 路径 encrypt ≠ 明文且 decrypt roundtrip。"""
    plain = "analytics-source-password"
    cipher = encrypt_password(plain)
    assert cipher.startswith("sm4:")
    assert cipher != plain
    assert decrypt_password(cipher) == plain


def test_sm4_multi_job_password_isolation():
    """T-D04-16: 两 job 密码 encrypt/decrypt 互不干扰。"""
    plain_a = "password-job-alpha"
    plain_b = "password-job-beta"
    cipher_a = encrypt_password(plain_a)
    cipher_b = encrypt_password(plain_b)
    assert cipher_a != cipher_b
    assert decrypt_password(cipher_a) == plain_a
    assert decrypt_password(cipher_b) == plain_b
    assert decrypt_password(cipher_a) != plain_b
