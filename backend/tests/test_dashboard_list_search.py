from __future__ import annotations

import uuid

from app.auth.deps import UserContext
from app.dashboard import service as dash_service
from app.dashboard.models import Dashboard
from app.core.db.meta import get_meta_session


def test_list_dashboards_filters_by_q() -> None:
    db = get_meta_session()
    actor = UserContext(id=str(uuid.uuid4()), username="admin", roles=["admin"])
    suffix = uuid.uuid4().hex[:8]
    rows = [
        Dashboard(name=f"搜索命中-{suffix}", slug=f"search-hit-{suffix}", layout_json={"version": 1, "widgets": []}),
        Dashboard(name=f"其他看板-{suffix}", slug=f"other-{suffix}", layout_json={"version": 1, "widgets": []}),
    ]
    db.add_all(rows)
    db.commit()
    try:
        filtered = dash_service.list_dashboards(
            db,
            limit=50,
            offset=0,
            actor=actor,
            surface_kind="dashboard",
            q="搜索命中",
        )
        names = [item.name for item in filtered.items]
        assert any(name.startswith("搜索命中-") for name in names)
        assert all(not name.startswith("其他看板-") for name in names)
    finally:
        for row in rows:
            db.delete(row)
        db.commit()
        db.close()
