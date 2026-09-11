"""官方演示 SQL 注册表与内置模板契约验收。"""

from __future__ import annotations

import socket

import pytest

from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF
from app.dashboard.templates.official_demo_sql import (
    OFFICIAL_DEMO_CHART_QUERIES,
    all_covered_chart_types,
    get_official_sql,
)
from app.dashboard.templates.presets_official_gallery import build_official_component_gallery_layout
from app.dashboard.templates.seed import _builtin_template_specs
from app.viz.registry import export_chart_type_catalog


def _non_deprecated_chart_types() -> set[str]:
    return {
        item["type"]
        for item in export_chart_type_catalog()
        if not item.get("deprecated")
    }


def test_official_sql_covers_all_non_deprecated_chart_types() -> None:
    expected = _non_deprecated_chart_types()
    covered = all_covered_chart_types()
    missing = expected - covered
    extra = covered - expected
    assert not missing, f"missing official SQL for: {sorted(missing)}"
    assert not extra, f"unknown chart types in registry: {sorted(extra)}"


def test_get_official_sql_returns_query_for_each_type() -> None:
    for chart_type in all_covered_chart_types():
        query = get_official_sql(chart_type)
        assert query.chart_type == chart_type
        assert query.sql.strip()
        assert query.title.strip()


def test_gallery_layout_has_one_widget_per_chart_type() -> None:
    layout = build_official_component_gallery_layout()
    charts = [w for w in layout["widgets"] if w.get("type") == "chart"]
    assert len(charts) == len(OFFICIAL_DEMO_CHART_QUERIES)
    types = {w["chartConfig"]["chartType"] for w in charts}
    assert types == all_covered_chart_types()


def test_builtin_templates_use_official_datasource_ref() -> None:
    for spec in _builtin_template_specs():
        layout = spec["layout_json"]
        widgets = layout.get("widgets") or []
        for widget in widgets:
            if widget.get("type") != "chart":
                continue
            cfg = widget.get("chartConfig") or {}
            if not cfg.get("chartType"):
                continue
            if cfg.get("bindingId"):
                continue
            if cfg.get("mode") not in ("sql", "table", None):
                continue
            assert cfg.get("dataSourceId") == TEMPLATE_DEMO_DATASOURCE_REF


def _sample_mysql_reachable() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 3307), timeout=1.0):
            return True
    except OSError:
        return False


@pytest.mark.skipif(not _sample_mysql_reachable(), reason="sample-mysql not running on 3307")
def test_official_views_queryable() -> None:
    from app.dashboard.templates.demo_datasource import resolve_official_demo_connection
    from app.dashboard.templates.official_demo_bootstrap import ensure_sample_db_schema
    from app.datasources.dialects.mysql import MysqlConnector

    bootstrap = ensure_sample_db_schema()
    assert bootstrap.mysql_reachable, bootstrap.message

    conn = resolve_official_demo_connection()
    connector = MysqlConnector()
    db_conn = connector.open_connection(
        host=conn.host,
        port=conn.port,
        database=conn.database,
        username=conn.username,
        password=conn.password,
    )
    try:
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.views "
                "WHERE table_schema = %s AND table_name = 'vs_official_bar_range' LIMIT 1",
                (conn.database,),
            )
            if cur.fetchone() is None:
                pytest.fail("vs_official_* views missing after migration bootstrap")
            for chart_type in sorted(all_covered_chart_types()):
                sql = get_official_sql(chart_type).sql.strip().rstrip(";")
                cur.execute(f"SELECT * FROM ({sql}) AS official_probe LIMIT 1")
                cur.fetchone()
    finally:
        db_conn.close()
