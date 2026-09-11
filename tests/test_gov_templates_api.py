"""政务大屏模板 API 验收（content_revision=7 + 物化样式）。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.dashboard.templates.seed import seed_builtin_dashboard_templates
from app.datasources.models import get_meta_session


def _seed_templates() -> None:
    session = get_meta_session()
    try:
        seed_builtin_dashboard_templates(session)
    finally:
        session.close()


def test_gov_data_screen_list_returns_six(
    client: TestClient,
    auth_headers: dict,
) -> None:
    _seed_templates()
    res = client.get(
        "/api/v1/dashboard-templates?categoryKey=government&surfaceKind=data-screen",
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 6
    keys = {item["templateKey"] for item in body["items"]}
    assert "builtin-gov-smart-city" in keys
    assert "builtin-gov-digital-cockpit" in keys


def test_gov_smart_city_detail_has_materialized_layout(
    client: TestClient,
    auth_headers: dict,
) -> None:
    _seed_templates()
    listed = client.get(
        "/api/v1/dashboard-templates?categoryKey=government&surfaceKind=data-screen",
        headers=auth_headers,
    ).json()
    smart = next(i for i in listed["items"] if i["templateKey"] == "builtin-gov-smart-city")
    detail = client.get(
        f"/api/v1/dashboard-templates/{smart['id']}",
        headers=auth_headers,
    )
    assert detail.status_code == 200
    layout = detail.json()["layoutJson"]
    style = layout["styleConfig"]
    assert style.get("canvasBackgroundCustom") is True
    assert style.get("canvasBackgroundImage") or style.get("canvasBackground")
    assert "gov-enterprise-v1" in (style.get("canvasBackgroundImage") or "")
    assert style.get("paletteColors")
    charts = [w for w in layout["widgets"] if w.get("type") == "chart"]
    assert len(charts) >= 6
    assert any(w["chartConfig"].get("nativeBody", {}).get("deStyle") for w in charts)
