"""M9 viz advanced chart types L1 kickoff r42 smoke — VIZ-003/004/005/006/008."""
from __future__ import annotations

import uuid

import pytest

from app.viz.registry import (
    ChartTypeAlreadyRegisteredError,
    ChartTypeNotRegistered,
    ChartTypeRegistry,
    get_spec,
)
from app.viz.specs import ChartTypeSpec, FieldRule


def test_registry_register_get_roundtrip():
    """T-VIZ-R42-003-03(unit): 自定义 registry register→get 往返。"""
    reg = ChartTypeRegistry()
    spec = ChartTypeSpec(
        type="custom_x",
        display_name="自定义",
        category="advanced",
        renderer="echarts",
        field_rule=FieldRule(min_dimensions=1, max_dimensions=1),
    )
    reg.register(spec)
    assert reg.get("custom_x").category == "advanced"
    assert reg.has("custom_x") is True


def test_registry_duplicate_raises():
    """T-VIZ-R42-003-05a: 重复 type register → AlreadyRegistered。"""
    reg = ChartTypeRegistry()
    spec = ChartTypeSpec(type="dup", display_name="d", category="basic", renderer="table")
    reg.register(spec)
    with pytest.raises(ChartTypeAlreadyRegisteredError):
        reg.register(spec)


def test_get_spec_unknown_raises():
    """T-VIZ-R42-003-04: get_spec 未注册 → ChartTypeNotRegistered。"""
    with pytest.raises(ChartTypeNotRegistered):
        get_spec("no_such_type_xyz")


def test_builtin_get_spec_category():
    """T-VIZ-R42-003-03: builtin sankey category=flow（依赖 Task 2 注册）。"""
    assert get_spec("sankey").category == "flow"


from app.viz.builtin import register_builtin_chart_types
from app.viz.registry import export_chart_type_catalog


def test_catalog_has_nine_types_with_shape():
    """T-VIZ-R42-003-01: catalog 含 9 类型，每项字段齐备。"""
    catalog = export_chart_type_catalog()
    types = {c["type"] for c in catalog}
    assert {"table", "line", "bar", "pie", "gauge", "map", "sankey", "funnel", "graph"} <= types
    for item in catalog:
        for key in ("type", "displayName", "category", "renderer", "styleVariants", "fieldRule"):
            assert key in item, key


def test_catalog_has_advanced_types():
    """T-VIZ-R42-003-02: 高级类型 sankey/graph/map/funnel/gauge/pie 出现。"""
    types = {c["type"] for c in export_chart_type_catalog()}
    assert {"sankey", "graph", "map", "funnel", "gauge", "pie"} <= types


def test_register_builtin_idempotent():
    """T-VIZ-R42-003-06: register_builtin_chart_types 幂等，二次调用不抛。"""
    register_builtin_chart_types()
    register_builtin_chart_types()
    assert get_spec("bar").renderer == "echarts"


def test_get_charts_types_ok(client, auth_headers):
    """T-VIZ-R42-003-07: GET /charts/types → 200，9 项列表。"""
    resp = client.get("/api/v1/charts/types", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    types = {c["type"] for c in body}
    assert {"sankey", "funnel", "graph", "map", "gauge", "pie"} <= types


def test_get_charts_types_unauthorized(client, unauthorized_headers):
    """T-VIZ-R42-003-08: GET /charts/types 无有效鉴权 → 401。"""
    resp = client.get("/api/v1/charts/types", headers=unauthorized_headers)
    assert resp.status_code == 401


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


def test_style_variant_bar_stacked_ok():
    """T-VIZ-R42-004-01: bar + stacked 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("bar", styleVariant="stacked",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "stacked"


def test_style_variant_line_area_ok():
    """T-VIZ-R42-004-02: line + area 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("line", styleVariant="area",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "area"


def test_style_variant_pie_donut_ok():
    """T-VIZ-R42-004-03: pie + donut 通过。"""
    cfg = validate_chart_view_config(
        _sql_base("pie", styleVariant="donut",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.style_variant == "donut"


def test_style_variant_invalid_rejected():
    """T-VIZ-R42-004-04: bar + donut（不属 bar）→ CHART_INVALID_STYLE_VARIANT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("bar", styleVariant="donut",
                      dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
        )
    assert exc.value.code == "CHART_INVALID_STYLE_VARIANT"
    assert any(f["field"] == "styleVariant" for f in exc.value.fields)


def test_style_variant_default_backcompat():
    """T-VIZ-R42-004-05: 省略 styleVariant 默认 default 通过。"""
    cfg = validate_chart_view_config(_sql_base("table"))
    assert cfg.style_variant == "default"


def test_field_rule_sankey_ok():
    """T-VIZ-R42-005-01: sankey 2 维+1 度量通过。"""
    cfg = validate_chart_view_config(
        _sql_base("sankey",
                  dimensions=[{"field": "src"}, {"field": "dst"}],
                  metrics=[{"field": "amt"}])
    )
    assert cfg.chart_type == "sankey"


def test_field_rule_sankey_missing_dim():
    """T-VIZ-R42-005-02: sankey 仅 1 维 → CHART_FIELD_REQUIREMENT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("sankey", dimensions=[{"field": "src"}], metrics=[{"field": "amt"}])
        )
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any(f["field"] == "dimensions" for f in exc.value.fields)


def test_field_rule_funnel_missing_metric():
    """T-VIZ-R42-005-03: funnel 缺度量 → CHART_FIELD_REQUIREMENT。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("funnel", dimensions=[{"field": "stage"}]))
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_gauge_dim_bounds():
    """T-VIZ-R42-005-04: gauge 0 维+1 度量通过；含 1 维 → CHART_FIELD_REQUIREMENT。"""
    ok = validate_chart_view_config(_sql_base("gauge", metrics=[{"field": "v"}]))
    assert ok.chart_type == "gauge"
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _sql_base("gauge", dimensions=[{"field": "d"}], metrics=[{"field": "v"}])
        )
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_field_rule_pie_ok():
    """T-VIZ-R42-005-05: pie 1 维+1 度量通过。"""
    cfg = validate_chart_view_config(
        _sql_base("pie", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert cfg.chart_type == "pie"


def test_field_rule_graph_zero_metric_ok():
    """T-VIZ-R42-005-06: graph 2 维+0 度量通过（metrics 0-1）。"""
    cfg = validate_chart_view_config(
        _sql_base("graph", dimensions=[{"field": "a"}, {"field": "b"}])
    )
    assert cfg.chart_type == "graph"


def test_field_rule_line_missing_series_backcompat():
    """T-VIZ-R42-005-07: line 缺 metrics 仍 → CHART_MISSING_SERIES（向后兼容）。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(_sql_base("line", dimensions=[{"field": "x"}]))
    assert exc.value.code == "CHART_MISSING_SERIES"


from app.viz.render import build_render_spec


def test_render_spec_table_engine():
    """T-VIZ-R42-008-01: table → engine=table。"""
    cfg = validate_chart_view_config(_sql_base("table"))
    spec = build_render_spec(cfg)
    assert spec["engine"] == "table"


def test_render_spec_bar_echarts():
    """T-VIZ-R42-008-02: bar → engine=echarts, chartType=bar。"""
    cfg = validate_chart_view_config(
        _sql_base("bar", dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    spec = build_render_spec(cfg)
    assert spec["engine"] == "echarts"
    assert spec["chartType"] == "bar"


def test_render_spec_encoding_matches_input():
    """T-VIZ-R42-008-03: encoding.dimensions/metrics 与输入一致。"""
    cfg = validate_chart_view_config(
        _sql_base("sankey",
                  dimensions=[{"field": "src"}, {"field": "dst"}],
                  metrics=[{"field": "amt"}])
    )
    spec = build_render_spec(cfg)
    assert [d["field"] for d in spec["encoding"]["dimensions"]] == ["src", "dst"]
    assert [m["field"] for m in spec["encoding"]["metrics"]] == ["amt"]


def test_render_spec_binding_only_source():
    """T-VIZ-R42-008-04: binding-only → source={'bindingId':...}。"""
    bid = uuid.uuid4()
    cfg = validate_chart_view_config({"chartType": "table", "bindingId": str(bid)})
    spec = build_render_spec(cfg)
    assert spec["source"] == {"bindingId": str(bid)}


def test_render_spec_style_variant_passthrough():
    """T-VIZ-R42-008-06: styleVariant 透传入 render-spec。"""
    cfg = validate_chart_view_config(
        _sql_base("line", styleVariant="smooth",
                  dimensions=[{"field": "d"}], metrics=[{"field": "m"}])
    )
    assert build_render_spec(cfg)["styleVariant"] == "smooth"


def test_post_render_spec_http(client, auth_headers):
    """T-VIZ-R42-008-05: POST /charts/render-spec 合法→200 含 engine；非法 type→422。"""
    ok = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("bar", dimensions=[{"field": "d"}], metrics=[{"field": "m"}]),
        headers=auth_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["engine"] == "echarts"
    bad = client.post(
        "/api/v1/charts/render-spec",
        json=_sql_base("radar"),
        headers=auth_headers,
    )
    assert bad.status_code == 422
    assert bad.json()["code"] == "CHART_INVALID_TYPE"


from app.viz.embed import ChartEmbedError, validate_chart_embed_config


def test_embed_chart_id_only_ok():
    """T-VIZ-R42-006-01: 仅 chartId + 合法 origins 通过。"""
    cfg = validate_chart_embed_config(
        {"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com"]}
    )
    assert cfg.chart_id is not None


def test_embed_dashboard_id_only_ok():
    """T-VIZ-R42-006-02: 仅 dashboardId 通过。"""
    cfg = validate_chart_embed_config({"dashboardId": str(uuid.uuid4())})
    assert cfg.dashboard_id is not None


def test_embed_missing_target():
    """T-VIZ-R42-006-03: 都缺 → EMBED_MISSING_TARGET。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"allowedOrigins": []})
    assert exc.value.code == "EMBED_MISSING_TARGET"


def test_embed_target_conflict():
    """T-VIZ-R42-006-04: 都给 → EMBED_TARGET_CONFLICT。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config(
            {"chartId": str(uuid.uuid4()), "dashboardId": str(uuid.uuid4())}
        )
    assert exc.value.code == "EMBED_TARGET_CONFLICT"


def test_embed_invalid_origin():
    """T-VIZ-R42-006-05: allowedOrigins=['not-a-url'] → EMBED_INVALID_ORIGIN。"""
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config(
            {"chartId": str(uuid.uuid4()), "allowedOrigins": ["not-a-url"]}
        )
    assert exc.value.code == "EMBED_INVALID_ORIGIN"


def test_embed_origin_with_port_ok():
    """T-VIZ-R42-006-06: https://a.com:8443 通过。"""
    cfg = validate_chart_embed_config(
        {"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.com:8443"]}
    )
    assert cfg.allowed_origins == ["https://a.com:8443"]


def test_embed_http_endpoint(client, auth_headers, unauthorized_headers):
    """T-VIZ-R42-006-07: POST /charts/embed/validate 非法→422 结构化；无鉴权→401。"""
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


def test_embed_theme_default_and_invalid():
    """T-VIZ-R42-006-08: 默认 theme=light；theme=pink → EMBED_INVALID。"""
    ok = validate_chart_embed_config({"chartId": str(uuid.uuid4())})
    assert ok.theme == "light"
    with pytest.raises(ChartEmbedError) as exc:
        validate_chart_embed_config({"chartId": str(uuid.uuid4()), "theme": "pink"})
    assert exc.value.code == "EMBED_INVALID"
