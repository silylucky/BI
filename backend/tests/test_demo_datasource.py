"""demo 数据源 code 与 legacy rename 契约。"""

from __future__ import annotations

from app.dashboard.templates.demo_datasource import (
    DEMO_DATASOURCE_NAME,
    DEMO_DATASOURCE_POOL_SIZE,
    LEGACY_DEMO_DATASOURCE_CODES,
    OFFICIAL_DEMO_DATASOURCE_CODE,
    is_demo_package_datasource_code,
)


def test_official_demo_code_is_demo() -> None:
    assert OFFICIAL_DEMO_DATASOURCE_CODE == "demo"
    assert DEMO_DATASOURCE_NAME == "示例数据"
    assert DEMO_DATASOURCE_POOL_SIZE == 6


def test_is_demo_package_datasource_code() -> None:
    assert is_demo_package_datasource_code("demo") is True
    assert is_demo_package_datasource_code("Demo") is True
    assert is_demo_package_datasource_code("official-demo-mysql") is False


def test_legacy_codes_include_official_demo_mysql() -> None:
    assert "official-demo-mysql" in LEGACY_DEMO_DATASOURCE_CODES
