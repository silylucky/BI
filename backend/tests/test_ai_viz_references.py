"""Artifact reference guard for delete."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.ai_viz.errors import AiVizError
from app.ai_viz.layout_refs import find_artifact_references, unlink_artifact_from_layouts
from app.ai_viz.service import delete_artifact
from app.auth.deps import UserContext


def _actor(user_id: uuid.UUID | None = None) -> UserContext:
    return UserContext(
        id=str(user_id or uuid.uuid4()),
        username="tester",
        roles=[],
        permissions=set(),
    )


def test_find_artifact_references_from_layout_json() -> None:
    aid = uuid.uuid4()
    dash_id = uuid.uuid4()
    row = MagicMock()
    row.id = dash_id
    row.name = "测试大屏"
    row.layout_json = {
        "widgets": [
            {
                "id": "w1",
                "customVizConfig": {"artifactId": str(aid)},
            }
        ]
    }
    db = MagicMock()
    db.scalars.return_value.all.return_value = [row]
    refs = find_artifact_references(db, aid)
    assert len(refs) == 1
    assert refs[0].dashboard_id == dash_id
    assert refs[0].widget_id == "w1"


def test_delete_artifact_blocks_when_referenced() -> None:
    owner = uuid.uuid4()
    aid = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    dash = MagicMock()
    dash.id = uuid.uuid4()
    dash.name = "screen"
    dash.layout_json = {"widgets": [{"id": "w9", "customVizConfig": {"artifactId": str(aid)}}]}
    db = MagicMock()
    db.get.return_value = row
    db.scalars.return_value.all.return_value = [dash]
    with pytest.raises(AiVizError) as exc:
        delete_artifact(db, aid, _actor(owner))
    assert exc.value.code == "AIVIZ_IN_USE"
    assert exc.value.status == 409
    assert exc.value.fields
    assert exc.value.fields[0]["field"] == "references[0].dashboardName"
    assert "screen" in exc.value.fields[0]["message"]
    db.delete.assert_not_called()


def test_delete_artifact_unlink_removes_widgets_then_deletes() -> None:
    owner = uuid.uuid4()
    aid = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    dash = MagicMock()
    dash.id = uuid.uuid4()
    dash.name = "运营看板"
    dash.layout_json = {
        "widgets": [
            {"id": "w9", "customVizConfig": {"artifactId": str(aid)}},
            {"id": "w10", "type": "chart"},
        ]
    }
    db = MagicMock()
    db.get.return_value = row
    db.scalars.return_value.all.return_value = [dash]

    result = delete_artifact(db, aid, _actor(owner), unlink=True)

    assert result is not None
    assert result.artifact_id == aid
    assert len(result.unlinked) == 1
    assert result.unlinked[0].dashboard_name == "运营看板"
    assert result.unlinked[0].removed_widget_ids == ["w9"]
    assert dash.layout_json["widgets"] == [{"id": "w10", "type": "chart"}]
    db.delete.assert_called_once_with(row)
    db.commit.assert_called_once()


def test_delete_artifact_unlink_single_dashboard_scan() -> None:
    owner = uuid.uuid4()
    aid = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    dash = MagicMock()
    dash.id = uuid.uuid4()
    dash.name = "运营看板"
    dash.layout_json = {
        "widgets": [
            {"id": "w9", "customVizConfig": {"artifactId": str(aid)}},
            {"id": "w10", "type": "chart"},
        ]
    }
    db = MagicMock()
    db.get.return_value = row
    db.scalars.return_value.all.return_value = [dash]

    delete_artifact(db, aid, _actor(owner), unlink=True)

    assert db.scalars.call_count == 1


def test_unlink_artifact_from_layouts_keeps_unrelated_widgets() -> None:
    aid = uuid.uuid4()
    other = uuid.uuid4()
    dash = MagicMock()
    dash.id = uuid.uuid4()
    dash.name = "mixed"
    dash.layout_json = {
        "widgets": [
            {"id": "keep", "customVizConfig": {"artifactId": str(other)}},
            {"id": "drop", "customVizConfig": {"artifactId": str(aid)}},
        ]
    }
    db = MagicMock()
    db.scalars.return_value.all.return_value = [dash]

    summaries = unlink_artifact_from_layouts(db, aid)

    assert len(summaries) == 1
    assert summaries[0].removed_widget_ids == ["drop"]
    assert dash.layout_json["widgets"] == [
        {"id": "keep", "customVizConfig": {"artifactId": str(other)}},
    ]
