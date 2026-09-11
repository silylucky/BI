"""看板封面：拒绝空文件与带 charset 的 Content-Type。"""

from __future__ import annotations

import pytest

from app.dashboard.thumbnails import (
    normalize_thumbnail_content_type,
    validate_thumbnail_payload,
)

_MIN_PNG = b"\x89PNG\r\n\x1a\n" + (b"\x00" * 250)


def test_normalize_strips_charset() -> None:
    assert normalize_thumbnail_content_type("image/png; charset=utf-8") == "image/png"


def test_validate_rejects_empty() -> None:
    with pytest.raises(ValueError, match="empty"):
        validate_thumbnail_payload(b"", "image/png")


def test_validate_rejects_non_png_bytes() -> None:
    with pytest.raises(ValueError, match="not an image"):
        validate_thumbnail_payload(b"not-an-image" + (b"\x00" * 250), "image/png")


def test_validate_accepts_jpeg_magic_even_if_declared_png() -> None:
    jpeg = b"\xff\xd8\xff" + (b"\x00" * 260)
    assert validate_thumbnail_payload(jpeg, "image/png") == "image/jpeg"


def test_validate_rejects_too_large() -> None:
    from app.dashboard.thumbnails import THUMBNAIL_MAX_BYTES

    huge = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (THUMBNAIL_MAX_BYTES))
    with pytest.raises(ValueError, match="too large"):
        validate_thumbnail_payload(huge, "image/png")


def test_validate_accepts_png_with_charset_header() -> None:
    assert validate_thumbnail_payload(_MIN_PNG, "image/png; charset=utf-8") == "image/png"
