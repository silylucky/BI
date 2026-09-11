"""组件库封面：存储路径与读写。"""

from __future__ import annotations

import uuid

import pytest

from app.dashboard.thumbnails import (
    read_thumbnail_bytes,
    viz_component_thumbnail_ref_for,
    write_viz_component_thumbnail,
)

_MIN_PNG = b"\x89PNG\r\n\x1a\n" + (b"\x00" * 250)


def test_viz_component_thumbnail_ref_for_uses_dedicated_prefix() -> None:
    component_id = uuid.UUID("00000000-0000-4000-8003-000000000003")
    assert viz_component_thumbnail_ref_for(component_id, "png") == (
        "viz-component-thumbnails/00000000-0000-4000-8003-000000000003.png"
    )


def test_write_viz_component_thumbnail_roundtrip(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.dashboard.thumbnails.resolve_data_dir",
        lambda: tmp_path,
    )
    component_id = uuid.UUID("11111111-1111-4111-8111-111111111111")
    ref = write_viz_component_thumbnail(component_id, _MIN_PNG, "image/png")
    assert ref.startswith("viz-component-thumbnails/")
    body, media = read_thumbnail_bytes(ref)
    assert media == "image/png"
    assert len(body) >= 256


def test_write_viz_component_thumbnail_rejects_empty(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.dashboard.thumbnails.resolve_data_dir",
        lambda: tmp_path,
    )
    with pytest.raises(ValueError, match="empty"):
        write_viz_component_thumbnail(
            uuid.UUID("22222222-2222-4222-8222-222222222222"),
            b"",
            "image/png",
        )
