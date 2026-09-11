from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.auth.deps import UserContext
from app.reports.standard.compare import compare_pack, compare_periods_matrix


@pytest.fixture
def actor() -> UserContext:
    return UserContext(id="u1", username="admin", roles=["admin"])


def _pack():
    pack = MagicMock()
    pack.enabled_themes = ["distribution"]
    pack.snapshot_cron_preset = "daily"
    return pack


def test_compare_pack_uses_custom_baseline_period(actor):
    db = MagicMock()
    with (
        patch("app.reports.standard.compare.pack_service.get_pack", return_value=_pack()),
        patch("app.reports.standard.compare.pack_service.period_key_for", return_value=("daily", "2026-08-19")),
        patch("app.reports.standard.compare.pack_service.run_pack") as run_pack,
        patch("app.reports.standard.compare.standard_repo.get_snapshot_for_period") as get_snapshot,
    ):
        run_pack.return_value = MagicMock(
            render_spec={"sections": [{"columns": ["dim", "cnt"], "rows": [["A", 10]]}]},
        )
        get_snapshot.return_value = {
            "payload": {"columns": ["dim", "cnt"], "rows": [["A", 7]]},
        }

        out = compare_pack(
            db,
            "pack-1",
            "distribution",
            actor,
            baseline_period_key="2026-08-15",
        )

    assert out.previous_period_key == "2026-08-15"
    assert out.previous is not None
    assert out.deltas[0].current_value == 10
    assert out.deltas[0].previous_value == 7
    assert out.deltas[0].delta == 3


def test_compare_periods_matrix_requires_two_periods(actor):
    db = MagicMock()
    with patch("app.reports.standard.compare.pack_service.get_pack", return_value=_pack()):
        with pytest.raises(Exception) as exc:
            compare_periods_matrix(db, "pack-1", "distribution", ["2026-08-19"], actor)
    assert exc.value.code == "RPT_STD_COMPARE_INVALID"


def test_compare_periods_matrix_builds_wide_rows(actor):
    db = MagicMock()
    with (
        patch("app.reports.standard.compare.pack_service.get_pack", return_value=_pack()),
        patch("app.reports.standard.compare.pack_service.period_key_for", return_value=("daily", "2026-08-19")),
        patch("app.reports.standard.compare.pack_service.run_pack") as run_pack,
        patch("app.reports.standard.compare.standard_repo.get_snapshot_for_period") as get_snapshot,
    ):
        run_pack.return_value = MagicMock(
            render_spec={"sections": [{"columns": ["dim", "cnt"], "rows": [["A", 10], ["B", 4]]}]},
        )

        def _snapshot(pack_key, theme, kind, key, **kwargs):
            payloads = {
                "2026-08-18": {"columns": ["dim", "cnt"], "rows": [["A", 8], ["B", 2]]},
                "2026-08-17": {"columns": ["dim", "cnt"], "rows": [["A", 5]]},
            }
            payload = payloads.get(key)
            return {"payload": payload} if payload else None

        get_snapshot.side_effect = _snapshot

        out = compare_periods_matrix(
            db,
            "pack-1",
            "distribution",
            ["2026-08-19", "2026-08-18", "2026-08-17"],
            actor,
        )

    assert out.period_keys == ["2026-08-19", "2026-08-18", "2026-08-17"]
    row_a = next(row for row in out.rows if row.key == "A")
    assert row_a.values["2026-08-19"] == 10
    assert row_a.values["2026-08-18"] == 8
    assert row_a.values["2026-08-17"] == 5
