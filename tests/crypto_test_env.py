"""Shared国密 test keys for Settings / JWT (CI + local pytest)."""

from __future__ import annotations

TEST_JWT_SM2_PRIVATE = (
    "3DA75A807474C867E8E5C60B3E4E32DC8D319D4447B9594D394E6D3BD8778D1F"
)
TEST_JWT_SM2_PUBLIC = (
    "1AE135607AEEB4D7722756BC8C736C79DE6E72452E1CF4DC32448C7393B290B946D1A7D2614DA4814F7AEDAEB92741DB46775298CDFE3D832AD5A44572ADD899"
)
TEST_SM4_KEY = "0123456789abcdef0123456789abcdef"
TEST_DATABASE_URL = "postgresql+psycopg://vitalspan:vitalspan@localhost:5432/vitalspan"


def settings_kwargs(**overrides: str) -> dict[str, str]:
    base = {
        "database_url": TEST_DATABASE_URL,
        "jwt_sm2_private_key": TEST_JWT_SM2_PRIVATE,
        "jwt_sm2_public_key": TEST_JWT_SM2_PUBLIC,
        "credential_sm4_key": TEST_SM4_KEY,
    }
    base.update(overrides)
    return base
