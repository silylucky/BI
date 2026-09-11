"""DELETE /ai-viz/artifacts route contract for unlink query."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

from fastapi import Response

from app.ai_viz.schemas import AiVizArtifactDeleteOut, AiVizArtifactUnlinkDashboardOut
from app.api.v1.ai_viz import delete_artifact as delete_artifact_route
from app.auth.deps import UserContext


def _actor() -> UserContext:
    return UserContext(
        id=str(uuid.uuid4()),
        username="tester",
        roles=[],
        permissions=set(),
    )


def test_delete_route_unlink_true_returns_json_body() -> None:
    artifact_id = uuid.uuid4()
    user = _actor()
    db = MagicMock()
    payload = AiVizArtifactDeleteOut(
        artifactId=artifact_id,
        unlinked=[
            AiVizArtifactUnlinkDashboardOut(
                dashboardId=uuid.uuid4(),
                dashboardName="运营看板",
                removedWidgetIds=["w9"],
            )
        ],
    )
    with patch("app.api.v1.ai_viz.ai_viz_service.delete_artifact", return_value=payload) as mock_delete:
        result = delete_artifact_route(artifact_id, user, db, unlink=True)
        mock_delete.assert_called_once_with(db, artifact_id, user, unlink=True)
        assert result == payload


def test_delete_route_default_returns_204() -> None:
    artifact_id = uuid.uuid4()
    user = _actor()
    db = MagicMock()
    with patch("app.api.v1.ai_viz.ai_viz_service.delete_artifact", return_value=None) as mock_delete:
        result = delete_artifact_route(artifact_id, user, db, unlink=False)
        mock_delete.assert_called_once_with(db, artifact_id, user, unlink=False)
        assert isinstance(result, Response)
        assert result.status_code == 204
