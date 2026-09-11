"""G5 export FE URL builder tests."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.dashboard.export_fe_url import build_export_snapshot_url


def test_build_export_snapshot_url_root_path() -> None:
    dash_id = uuid.uuid4()
    settings = SimpleNamespace(fe_base_url="http://127.0.0.1:5173", fe_base_path="")
    url = build_export_snapshot_url(dash_id, token="tok", surface="dashboard", settings=settings)
    assert url == f"http://127.0.0.1:5173/export/dashboard/{dash_id}?token=tok"


def test_build_export_snapshot_url_with_base_path() -> None:
    dash_id = uuid.uuid4()
    settings = SimpleNamespace(fe_base_url="http://localhost:5173", fe_base_path="my-app")
    url = build_export_snapshot_url(dash_id, token="tok", surface="data_screen", settings=settings)
    assert url == f"http://localhost:5173/my-app/export/data-screen/{dash_id}?token=tok"
