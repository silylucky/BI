"""run_pack renderSpec chart section 契约（lifecycle/distribution bar · activity/trend line）。"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.auth.deps import UserContext
from app.reports.standard import service as pack_service
from app.reports.standard.schemas import AnalysisPackOut, FieldMapping, RunIn

_DS_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
_BOUND_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")


@pytest.fixture
def actor() -> UserContext:
    return UserContext(id="u1", username="admin", roles=["admin"])


def _pack() -> AnalysisPackOut:
    return AnalysisPackOut(
        packKey="demo-pack",
        displayName="演示包",
        datasetId="demo_dataset",
        dataSourceId=_DS_ID,
        fieldMapping=FieldMapping(
            status="category_name",
            region="province",
            createdAt="created_at",
        ),
        enabledThemes=["lifecycle", "distribution", "activity", "trend"],
        allowedRoles=["admin"],
        snapshotCronPreset="daily",
    )


def _passthrough_translate(db, render_spec, theme, mapping):  # noqa: ANN001
    return render_spec


@pytest.mark.parametrize(
    ("theme", "section_payload", "expected_kind", "expected_chart_type"),
    [
        (
            "lifecycle",
            {"columns": ["category_name"], "rows": [["办公耗材"], ["电子产品"], ["办公耗材"]]},
            "chart",
            "bar",
        ),
        (
            "distribution",
            {"columns": ["province"], "rows": [["上海市"], ["北京市"]]},
            "chart",
            "bar",
        ),
        (
            "activity",
            {"columns": ["created_at"], "rows": [["2026-08-01"], ["2026-08-02"]]},
            "chart",
            "line",
        ),
        (
            "trend",
            {"columns": ["created_at"], "rows": [["2026-08-01"], ["2026-08-02"]]},
            "chart",
            "line",
        ),
    ],
)
def test_run_pack_returns_chart_section_for_themes(
    actor: UserContext,
    theme: str,
    section_payload: dict,
    expected_kind: str,
    expected_chart_type: str,
) -> None:
    db = MagicMock()
    payload = RunIn(theme=theme)  # type: ignore[arg-type]

    with (
        patch.object(pack_service, "get_pack", return_value=_pack()),
        patch(
            "app.reports.standard.dataset_binding.ensure_analysis_pack_dataset_binding",
            return_value=_BOUND_ID,
        ),
        patch(
            "app.reports.engine.execute.execute_dataset_section",
            return_value=section_payload,
        ),
        patch(
            "app.reports.label_translation.translate_standard_render_spec",
            side_effect=_passthrough_translate,
        ),
    ):
        out = pack_service.run_pack(db, "demo-pack", payload, actor)

    section = out.render_spec["sections"][0]
    assert section["kind"] == expected_kind
    assert section["chartType"] == expected_chart_type
    assert section["columns"] in (["dim", "cnt"], ["d", "cnt"])
