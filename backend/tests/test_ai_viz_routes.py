"""Service-layer tests for ai_viz delete and list."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.ai_viz.errors import AiVizError
from app.ai_viz.service import delete_artifact, list_artifacts
from app.auth.deps import UserContext


def _actor(user_id: uuid.UUID | None = None) -> UserContext:
    return UserContext(
        id=str(user_id or uuid.uuid4()),
        username="tester",
        roles=[],
        permissions=set(),
    )


def test_delete_artifact_removes_owned_row() -> None:
    owner = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    delete_artifact(db, uuid.uuid4(), _actor(owner))
    db.delete.assert_called_once_with(row)
    db.commit.assert_called_once()


def test_delete_artifact_denies_non_owner() -> None:
    owner = uuid.uuid4()
    other = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    with pytest.raises(AiVizError) as exc:
        delete_artifact(db, uuid.uuid4(), _actor(other))
    assert exc.value.code == "AIVIZ_FORBIDDEN"
    db.delete.assert_not_called()


def test_list_artifacts_scopes_to_owner() -> None:
    owner = uuid.uuid4()
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    list_artifacts(db, _actor(owner), limit=10, offset=0)
    db.scalars.assert_called_once()
