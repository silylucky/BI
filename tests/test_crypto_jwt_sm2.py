import pytest

from app.auth.jwt import JwtError, create_access_token, decode_access_token


def test_jwt_sm2_round_trip():
    token = create_access_token("user-1", "admin", token_version=2)
    claims = decode_access_token(token)
    assert claims["sub"] == "user-1"
    assert claims["username"] == "admin"
    assert claims["tokenVersion"] == 2


def test_jwt_sm2_tampered_signature_fails():
    token = create_access_token("user-1", "admin")
    parts = token.split(".")
    parts[2] = parts[2][:-1] + ("A" if parts[2][-1] != "A" else "B")
    with pytest.raises(JwtError):
        decode_access_token(".".join(parts))
