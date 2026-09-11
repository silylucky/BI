"""M9 viz advanced chart types companion quality r43 — VIZ-003/004/005/006/008."""
from __future__ import annotations

import uuid

import pytest

from app.viz.embed import is_origin_allowed


def test_is_origin_allowed_empty_list_allows_all():
    assert is_origin_allowed("https://a.com", []) is True


def test_is_origin_allowed_match():
    assert is_origin_allowed("https://a.com", ["https://a.com"]) is True


def test_is_origin_allowed_port():
    assert is_origin_allowed("https://a.com:8443", ["https://a.com:8443"]) is True


def test_is_origin_allowed_no_match():
    assert is_origin_allowed("https://evil.com", ["https://a.com"]) is False


from app.schemas.chart_view import ChartViewError, validate_chart_view_config


def _sql_base(chart_type: str, **extra) -> dict:
    data = {
        "chartType": chart_type,
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1",
    }
    data.update(extra)
    return data


def test_post_render_spec_sankey_ok(client, auth_headers):
    """T-VIZ-R43-008-04: POST /charts/render-spec 合法 sankey → 200 engine=echarts。"""
    payload = {
        "chartType": "sankey",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1",
        "dimensions": [{"field": "src"}, {"field": "dst"}],
        "metrics": [{"field": "amt"}],
    }
    resp = client.post("/api/v1/charts/render-spec", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["engine"] == "echarts"


def test_post_render_spec_funnel_ok(client, auth_headers):
    """T-VIZ-R43-008-05: funnel render-spec → echarts。"""
    resp = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("funnel", dimensions=[{"field": "s"}], metrics=[{"field": "v"}]),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["chartType"] == "funnel"


def test_post_render_spec_graph_ok(client, auth_headers):
    resp = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("graph", dimensions=[{"field": "a"}, {"field": "b"}]),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["engine"] == "echarts"


def test_post_render_spec_map_ok(client, auth_headers):
    resp = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("map", dimensions=[{"field": "r"}], metrics=[{"field": "v"}]),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["chartType"] == "map"


def test_post_render_spec_gauge_ok(client, auth_headers):
    resp = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("gauge", metrics=[{"field": "v"}]),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["engine"] == "echarts"


def test_post_render_spec_radar_422(client, auth_headers):
    bad = client.post("/api/v1/charts/render-spec", json=_sql_base("radar"), headers=auth_headers)
    assert bad.status_code == 422
    assert bad.json()["code"] == "CHART_INVALID_TYPE"


def test_get_charts_types_twelve_types(client, auth_headers):
    """T-VIZ-R43-003-04: GET /charts/types 12 类型含 map fieldRule + DASH-003 heatmap/kpi/timeline。"""
    resp = client.get("/api/v1/charts/types", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 12
    types = {c["type"] for c in body}
    assert "map" in types
    assert {"heatmap", "kpi", "timeline"} <= types
    map_item = next(c for c in body if c["type"] == "map")
    assert "fieldRule" in map_item


def test_catalog_map_field_rule(client, auth_headers):
    resp = client.get("/api/v1/charts/types", headers=auth_headers)
    map_item = next(c for c in resp.json() if c["type"] == "map")
    assert map_item.get("fieldRule", {}).get("minDimensions", 0) >= 1


def test_catalog_sankey_in_types(client, auth_headers):
    types = {c["type"] for c in client.get("/api/v1/charts/types", headers=auth_headers).json()}
    assert "sankey" in types


def test_style_variant_bar_stacked_ok():
    """T-VIZ-R43-004-01: bar stacked 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("bar", styleVariant="stacked", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "stacked"


def test_style_variant_invalid_rejected():
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("bar", styleVariant="donut", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
        )
    assert exc.value.code == "CHART_INVALID_STYLE_VARIANT"


def test_field_rule_funnel_missing_metric():
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("funnel", dimensions=[{"field": "stage"}]))
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_sankey_ok():
    cfg = validate_chart_view_config(
        _sql_base("sankey", dimensions=[{"field": "src"}, {"field": "dst"}], metrics=[{"field": "amt"}])
    )
    assert cfg.chart_type == "sankey"


def test_field_rule_sankey_missing_dim():
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("sankey", dimensions=[{"field": "src"}], metrics=[{"field": "amt"}]))
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_gauge_ok():
    cfg = validate_chart_view_config(_sql_base("gauge", metrics=[{"field": "v"}]))
    assert cfg.chart_type == "gauge"


def test_field_rule_graph_ok():
    cfg = validate_chart_view_config(_sql_base("graph", dimensions=[{"field": "a"}, {"field": "b"}]))
    assert cfg.chart_type == "graph"


from app.viz.embed import ChartEmbedError, validate_chart_embed_config


def test_embed_chart_id_only_ok():
    """T-VIZ-R42-006-01: 仅 chartId + 合法 origins 通过。"""
    cfg = validate_chart_embed_config({"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com"]})
    assert cfg.chart_id is not None


def test_embed_dashboard_id_only_ok():
    cfg = validate_chart_embed_config({"dashboardId": str(uuid.uuid4())})
    assert cfg.dashboard_id is not None


def test_embed_missing_target():
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"allowedOrigins": []})
    assert exc.value.code == "EMBED_MISSING_TARGET"


def test_embed_target_conflict():
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"chartId": str(uuid.uuid4()), "dashboardId": str(uuid.uuid4())})
    assert exc.value.code == "EMBED_TARGET_CONFLICT"


def test_embed_invalid_origin():
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"chartId": str(uuid.uuid4()), "allowedOrigins": ["not-a-url"]})
    assert exc.value.code == "EMBED_INVALID_ORIGIN"


def test_embed_origin_with_port_ok():
    cfg = validate_chart_embed_config(
        {"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com:8443"]}
    )
    assert cfg.allowed_origins == ["https://a.com:8443"]


def test_embed_http_endpoint(client, auth_headers, unauthorized_headers):
    bad = client.post(
        "/api/v1/charts/embed/validate",
        json={"allowedOrigins": []},
        headers=auth_headers,
    )
    assert bad.status_code == 422
    assert bad.json()["code"] == "EMBED_MISSING_TARGET"
    noauth = client.post(
        "/api/v1/charts/embed/validate",
        json={"chartId": str(uuid.uuid4())},
        headers=unauthorized_headers,
    )
    assert noauth.status_code == 401


def test_embed_theme_default():
    ok = validate_chart_embed_config({"chartId": str(uuid.uuid4())})
    assert ok.theme == "light"
