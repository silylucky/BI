"""AiViz artifact API 响应契约：warnings[] 与 styleComplianceTier（POST/GET 路径）。"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.ai_viz.models import AiVizArtifact
from app.ai_viz.schemas import AiVizArtifactCreateIn, AiVizManifestIn
from app.ai_viz.service import create_artifact, to_artifact_out
from app.auth.deps import UserContext

_MIN_FIELD_SLOTS = {"dimensions": {"min": 1}, "metrics": {"min": 1}}


def _actor(user_id: uuid.UUID | None = None) -> UserContext:
    return UserContext(
        id=str(user_id or uuid.uuid4()),
        username="tester",
        roles=[],
        permissions=set(),
    )


def test_to_artifact_out_includes_warnings_for_non_compliant_html() -> None:
    row = AiVizArtifact(
        id=uuid.uuid4(),
        manifest_json={
            "id": "wild-v1",
            "displayName": "Wild",
            "fieldSlots": _MIN_FIELD_SLOTS,
            "runtime": "html",
        },
        files_json={
            "index.html": (
                "<!DOCTYPE html><html><body><script>"
                "host.vsCv.mount(function(p){});"
                "</script></body></html>"
            ),
        },
        content_hash="abc123",
        status="draft",
    )
    out = to_artifact_out(row)
    codes = {item.code for item in out.warnings}
    assert "AIVIZ_WARN_STYLE_COMPLIANCE" in codes
    assert out.style_compliance_tier == "partial"


def test_create_artifact_returns_warnings_without_blocking_ingest() -> None:
    db = MagicMock()

    def add(row: AiVizArtifact) -> None:
        row.id = uuid.uuid4()

    db.add = add
    db.commit = MagicMock()
    db.refresh = MagicMock()

    payload = AiVizArtifactCreateIn(
        manifest=AiVizManifestIn(
            id="wild-widget-v1",
            displayName="Wild Widget",
            runtime="html",
            field_slots=_MIN_FIELD_SLOTS,
            style_schema={"properties": {"accentColor": {"type": "string"}}},
        ),
        files={
            "index.html": (
                "<!DOCTYPE html><html><body><script>"
                "if(host&&host.vsCv&&host.vsCv.mount){host.vsCv.mount(function(p){});}"
                "</script></body></html>"
            ),
        },
    )

    out = create_artifact(db, payload, _actor())
    assert out.artifact_id
    assert any(item.code == "AIVIZ_WARN_STYLE_COMPLIANCE" for item in out.warnings)
    assert out.style_compliance_tier == "partial"
    db.commit.assert_called_once()


def test_create_artifact_rejects_html_without_mount() -> None:
    db = MagicMock()
    payload = AiVizArtifactCreateIn(
        manifest=AiVizManifestIn(
            id="no-mount-v1",
            displayName="No Mount",
            runtime="html",
            field_slots=_MIN_FIELD_SLOTS,
            style_schema={"properties": {"accentColor": {"type": "string"}}},
        ),
        files={"index.html": "<!DOCTYPE html><html><body><div>static</div></body></html>"},
    )
    from app.ai_viz.errors import AiVizError

    try:
        create_artifact(db, payload, _actor())
    except AiVizError as exc:
        assert exc.code == "AIVIZ_MOUNT_REQUIRED"
    else:
        raise AssertionError("expected AIVIZ_MOUNT_REQUIRED")
