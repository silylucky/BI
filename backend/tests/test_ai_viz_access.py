import uuid
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.ai_viz.errors import AiVizError
from app.ai_viz.service import get_artifact
from app.auth.deps import UserContext


def _actor(user_id: UUID) -> UserContext:
    return UserContext(id=str(user_id), username="u", roles=[], permissions=set())


def test_get_artifact_read_denies_non_owner() -> None:
    owner = uuid.uuid4()
    other = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    with pytest.raises(AiVizError) as exc:
        get_artifact(db, uuid.uuid4(), _actor(other))
    assert exc.value.code == "AIVIZ_FORBIDDEN"


def test_get_artifact_read_allows_owner() -> None:
    owner = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    assert get_artifact(db, uuid.uuid4(), _actor(owner)) is row


def test_get_artifact_write_denies_non_owner() -> None:
    owner = uuid.uuid4()
    other = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    with pytest.raises(AiVizError) as exc:
        get_artifact(db, uuid.uuid4(), _actor(other), write=True)
    assert exc.value.code == "AIVIZ_FORBIDDEN"


def test_get_artifact_write_allows_owner() -> None:
    owner = uuid.uuid4()
    row = MagicMock()
    row.owner_user_id = owner
    db = MagicMock()
    db.get.return_value = row
    assert get_artifact(db, uuid.uuid4(), _actor(owner), write=True) is row
