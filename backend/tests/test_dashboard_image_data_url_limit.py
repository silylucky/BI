"""本地上传背景图 data URL 长度限制应与 FE 2MB 对齐。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.dashboard.schemas import IMAGE_DATA_URL_MAX_LENGTH, DashboardStyleConfig


def test_canvas_background_image_accepts_large_data_url() -> None:
    # 远超旧上限 2048，但仍在 IMAGE_DATA_URL_MAX_LENGTH 内
    payload = "data:image/png;base64," + ("A" * 10_000)
    assert len(payload) > 2048
    cfg = DashboardStyleConfig.model_validate({"canvasBackgroundImage": payload})
    assert cfg.canvas_background_image == payload


def test_canvas_background_image_rejects_oversize_data_url() -> None:
    payload = "data:image/png;base64," + ("A" * (IMAGE_DATA_URL_MAX_LENGTH + 1))
    with pytest.raises(ValidationError) as exc:
        DashboardStyleConfig.model_validate({"canvasBackgroundImage": payload})
    assert "canvasBackgroundImage" in str(exc.value)
