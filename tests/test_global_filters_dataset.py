"""Global filter execute — Dataset-only 出数路径。"""
from __future__ import annotations

import os
import uuid

import pytest

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.dashboard.global_filters.errors import GlobalFilterError
from app.dashboard.global_filters.execute import execute_widget_with_filters
from app.datasources.models import Base, get_meta_engine, get_meta_session
from app.dashboard.service import create_dashboard

_SQLITE = "sqlite+pysqlite:///file:gf_dataset?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def _sqlite_env():
    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_engine

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    import app.dashboard.models  # noqa: F401
    Base.metadata.create_all(engine)
    yield
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def db_session():
    session = get_meta_session()
    try:
        yield session
        session.rollback()
    finally:
        session.close()


def test_global_filter_execute_requires_dataset_binding(db_session):
    """无 Dataset 绑定的图表 widget → DASH_FILTER_DATASET_REQUIRED。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    user_id = uuid.UUID("00000000-0000-4000-8000-000000000001")
    dash = create_dashboard(db_session, name="GF", slug="gf-dataset", created_by=user_id)
    wid = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [{
            "id": wid,
            "type": "chart",
            "title": "图",
            "colSpan": 6,
            "rowSpan": 1,
            "order": 0,
            "chartConfig": {
                "chartType": "bar",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "dataset",
                "datasetId": "demo-orders",
            },
        }],
        "globalFilters": [],
    }
    from app.dashboard.service import update_layout

    update_layout(db_session, dash.id, layout)
    with pytest.raises(GlobalFilterError) as exc:
        execute_widget_with_filters(db_session, dash.id, wid, {}, actor)
    assert exc.value.code == "DASH_FILTER_DATASET_REQUIRED"
