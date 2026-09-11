"""Tests for HTTP download helpers."""
from __future__ import annotations

from app.core.http.download import content_disposition_attachment


def test_content_disposition_ascii_filename() -> None:
    header = content_disposition_attachment("schedule-abc.pdf")
    assert header == 'attachment; filename="schedule-abc.pdf"'


def test_content_disposition_unicode_filename() -> None:
    header = content_disposition_attachment("schedule-abc-可视化报告.pdf")
    assert 'filename="schedule-abc.pdf"' in header
    assert "filename*=UTF-8''" in header
    assert "%E5%8F%AF" in header
