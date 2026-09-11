"""FE/BE persistence contract: strict writes and style field roundtrip."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.auth.deps import UserContext
from app.dashboard.schemas import DashboardLayout, DashboardStyleConfig
from app.datasources.dialects.base import TestConnectionResult
from app.datasources.dialects.rest_api import RestApiConnector
from app.datasources.schemas import ConnectionOptions
from app.datasources.service import _run_test
from app.integration.errors import IntegrationError
from app.integration.reports_export import _generate_artifact_bytes


def test_unknown_layout_widget_field_rejected() -> None:
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(
            {
                "version": 2,
                "canvas": {"width": 1440, "height": 900},
                "widgets": [
                    {
                        "id": "00000000-0000-4000-8000-000000000001",
                        "type": "text",
                        "title": "t",
                        "textConfig": {"content": "x", "variant": "plain"},
                        "unknownWidgetField": True,
                    }
                ],
            }
        )


def test_canvas_background_image_fit_and_position_roundtrip() -> None:
    payload = {
        "canvasBackgroundImageFit": "contain",
        "canvasBackgroundImagePosition": "center top",
        "themeVariants": {
            "light": {
                "canvasBackgroundImageFit": "cover",
                "canvasBackgroundImagePosition": "50% 50%",
            }
        },
    }
    cfg = DashboardStyleConfig.model_validate(payload)
    dumped = cfg.model_dump(by_alias=True, exclude_none=True)
    assert dumped["canvasBackgroundImageFit"] == "contain"
    assert dumped["canvasBackgroundImagePosition"] == "center top"
    assert dumped["themeVariants"]["light"]["canvasBackgroundImageFit"] == "cover"
    assert dumped["themeVariants"]["light"]["canvasBackgroundImagePosition"] == "50% 50%"


def test_rest_api_test_connection_receives_connection_options(monkeypatch) -> None:
    captured: dict = {}

    def fake_test(_self, **kwargs):
        captured.update(kwargs)
        return TestConnectionResult(ok=True, message="ok", latency_ms=1, code=None)

    monkeypatch.setattr(RestApiConnector, "test_connection", fake_test)
    opts = ConnectionOptions(rest_auth_mode="bearer")
    _run_test(
        RestApiConnector(),
        host="http://127.0.0.1:8000",
        port=8000,
        database="/sample-api/health",
        username="bearer",
        password="secret-token",
        options=opts,
    )
    assert captured.get("connection_options") == opts.model_dump(by_alias=False, exclude_none=True)


def test_integration_export_generation_failure_returns_502() -> None:
    actor = UserContext(id="u1", username="u", roles=["admin"])
    template_id = uuid.uuid4()
    with patch(
        "app.reports.engine.service.export_template_bytes",
        side_effect=RuntimeError("render failed"),
    ):
        with pytest.raises(IntegrationError) as exc_info:
            _generate_artifact_bytes("pdf", template_id, actor)
    err = exc_info.value
    assert err.code == "REPORT_EXPORT_GENERATION_FAILED"
    assert err.status == 502
