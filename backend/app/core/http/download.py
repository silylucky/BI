"""HTTP download response helpers."""

from __future__ import annotations

from urllib.parse import quote


def content_disposition_attachment(filename: str) -> str:
    """Build RFC 5987 Content-Disposition for file downloads.

    Starlette encodes response headers as latin-1; non-ASCII filenames must use
    ``filename*`` while keeping an ASCII ``filename`` fallback.
    """
    if all(ord(char) < 128 for char in filename):
        return f'attachment; filename="{filename}"'
    if "." in filename:
        stem, ext = filename.rsplit(".", 1)
        ascii_stem = "".join(char for char in stem if ord(char) < 128).strip("-_ ") or "download"
        ascii_name = f"{ascii_stem}.{ext}"
    else:
        ascii_name = "".join(char for char in filename if ord(char) < 128) or "download"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"
