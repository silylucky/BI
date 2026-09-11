"""M-RPT F-C：报表展示层维度码值翻译。"""

from __future__ import annotations

import os

import pytest
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.metadata.dimensions.schemas import DimensionCreate, DimensionValueItem
from app.metadata.dimensions import service as dimension_service
from app.reports import label_translation


@pytest.fixture()
def meta_session() -> Session:
    from app.datasources.models import Base, get_meta_engine
    import app.metadata.dimensions.models  # noqa: F401

    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    session = Session(bind=engine)
    yield session
    session.close()
    os.environ["DATABASE_URL"] = prev if prev else os.environ.pop("DATABASE_URL", None)
    get_settings.cache_clear()
    get_meta_engine.cache_clear()


@pytest.fixture()
def admin() -> UserContext:
    return UserContext(id="u-admin", username="admin", roles=["admin"])


def test_translate_status_codes(meta_session: Session, admin: UserContext) -> None:
    dim = dimension_service.create_dimension(
        meta_session,
        DimensionCreate(code="status", name="状态"),
        admin,
    )
    dimension_service.register_values(
        meta_session,
        dim.id,
        [
            DimensionValueItem(code="running", label="运行中"),
            DimensionValueItem(code="idle", label="空闲"),
        ],
        admin,
    )
    payload = {
        "columns": ["dim", "cnt"],
        "rows": [["running", 3], ["idle", 1], ["unknown", 2]],
    }
    bindings = [label_translation.ColumnDimensionBinding(column="dim", dimension_code="status")]
    translated, meta = label_translation.translate_table_payload(meta_session, payload, bindings)
    assert translated["rows"][0][0] == "运行中"
    assert translated["rows"][1][0] == "空闲"
    assert translated["rows"][2][0] == "unknown"
    assert "未翻译" in meta.get("translationNote", "")


def test_lookup_missing_dimension_honest(meta_session: Session) -> None:
    payload = {"columns": ["dim"], "rows": [["running"]]}
    bindings = [label_translation.ColumnDimensionBinding(column="dim", dimension_code="status")]
    translated, meta = label_translation.translate_table_payload(meta_session, payload, bindings)
    assert translated["rows"][0][0] == "running"
    assert "未翻译" in meta.get("translationNote", "")


def test_standard_analysis_bindings_use_field_mapping() -> None:
    from app.reports.standard.schemas import FieldMapping

    lifecycle = label_translation.standard_analysis_bindings(
        "lifecycle",
        FieldMapping(status="equipment_status", region="reg"),
    )
    assert lifecycle == [
        label_translation.ColumnDimensionBinding(column="dim", dimension_code="status"),
    ]
    missing_status = label_translation.standard_analysis_bindings(
        "lifecycle",
        FieldMapping(status=None, region="reg"),
    )
    assert missing_status == []
    trend = label_translation.standard_analysis_bindings(
        "trend",
        FieldMapping(status="status", region="region", createdAt="created_at"),
    )
    assert trend == []
