"""DS-007 F-B: displayGroup / categoryLabel taxonomy companion."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.registry import export_type_catalog, registry
from app.main import app

AUTH = jwt_auth_headers()
_FB_SQLITE_URL = "sqlite+pysqlite:///file:ds_fb_taxonomy?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def fb_taxonomy_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _FB_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_types_response_includes_display_group_fields(client: TestClient):
    """FB-1-01: GET /types 每项含 displayGroup、categoryLabel。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items, "builtin dialects should be registered"
    for item in items:
        assert "displayGroup" in item, item
        assert "categoryLabel" in item, item
        assert item["category"]  # 引擎 category 不变


def test_display_group_mapping_oltp():
    """FB-1-02: mysql relational → oltp + 关系型数据库。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["mysql"]["category"] == "relational"
    assert types["mysql"]["displayGroup"] == "oltp"
    assert types["mysql"]["categoryLabel"] == "关系型数据库"


def test_display_group_mapping_olap():
    """FB-1-03: starrocks → olap + OLAP。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["starrocks"]["displayGroup"] == "olap"
    assert types["starrocks"]["categoryLabel"] == "OLAP"


def test_display_group_mapping_warehouse():
    """FB-1-04: hive/trino → warehouse。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["hive"]["displayGroup"] == "warehouse"
    assert types["trino"]["displayGroup"] == "warehouse"
    assert types["hive"]["categoryLabel"] == "数仓/湖仓"


def test_display_group_mapping_file():
    """FB-1-05: excel → file。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["excel"]["displayGroup"] == "file"
    assert types["excel"]["categoryLabel"] == "文件"


def test_display_group_mapping_api():
    """FB-1-05: rest_api → api。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["rest_api"]["displayGroup"] == "api"
    assert types["rest_api"]["categoryLabel"] == "API"


def test_display_group_mapping_extension():
    """FB-1-06: mongodb/elasticsearch/sqlite → extension + 更多。"""
    types = {t["type"]: t for t in export_type_catalog()}
    for key in ("mongodb", "elasticsearch", "sqlite"):
        assert types[key]["displayGroup"] == "extension", key
        assert types[key]["categoryLabel"] == "更多", key


def test_unknown_category_falls_back_to_extension():
    """防御：未知 category → extension。"""
    from app.datasources.taxonomy import resolve_display_group

    assert resolve_display_group("unknown_future_category") == "extension"
