"""M-RPT F-B：标准分析快照 retention 清理（memory store，无 PG）。"""

from __future__ import annotations

import pytest

from app.reports.persistence import memory_stores, standard_repo


@pytest.fixture(autouse=True)
def _memory_standard_store(monkeypatch: pytest.MonkeyPatch) -> None:
    memory_stores.clear_all()
    monkeypatch.setattr(standard_repo, "_use_db", lambda: False)


def test_snapshot_retention_prunes_old_periods() -> None:
    pack_key = "retention-pack"
    theme = "lifecycle"
    kind = "daily"
    for day in range(1, 16):
        standard_repo.upsert_snapshot(
            pack_key,
            theme,
            kind,
            f"2026-08-{day:02d}",
            {"columns": [], "rows": []},
        )
    deleted = standard_repo.prune_snapshots(pack_key, theme, kind, 12)
    assert deleted == 3
    remaining = standard_repo.list_snapshots(pack_key, theme=theme)
    assert len(remaining) == 12
    keys = sorted(s["periodKey"] for s in remaining)
    assert keys[0] == "2026-08-04"
    assert keys[-1] == "2026-08-15"


def test_compare_list_excludes_pruned_periods() -> None:
    pack_key = "compare-retention-pack"
    theme = "distribution"
    kind = "weekly"
    for week in range(1, 6):
        standard_repo.upsert_snapshot(
            pack_key,
            theme,
            kind,
            f"2026-W{week:02d}",
            {"columns": ["dim"], "rows": [["a", 1]]},
        )
    standard_repo.prune_snapshots(pack_key, theme, kind, 3)
    remaining = standard_repo.list_snapshots(pack_key, theme=theme)
    period_keys = {s["periodKey"] for s in remaining}
    assert period_keys == {"2026-W03", "2026-W04", "2026-W05"}
    assert "2026-W01" not in period_keys
