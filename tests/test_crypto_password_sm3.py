import pytest

from app.auth.password.service import hash_password, needs_password_rehash, verify_password


def test_sm3_hash_and_verify():
    hashed = hash_password("MyPassword1!")
    assert hashed.startswith("$sm3$")
    assert verify_password("MyPassword1!", hashed)
    assert not verify_password("wrong", hashed)


def test_legacy_bcrypt_hash_rejected():
    legacy = "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012"
    assert not verify_password("legacy-pass", legacy)
    assert needs_password_rehash(legacy)


def test_sm3_no_rehash():
    hashed = hash_password("x")
    assert not needs_password_rehash(hashed)
