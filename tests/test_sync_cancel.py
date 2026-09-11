from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.ingestion.sync_cancel import SyncCancelled, raise_if_cancel_requested, request_cancel_run
from app.ingestion.sync_executor import run_job


def test_request_cancel_run_transitions_to_cancelling():
    run = MagicMock()
    run.status = "running"
    db = MagicMock()
    updated = request_cancel_run(db, run)
    assert updated.status == "cancelling"
    db.commit.assert_called()


def test_raise_if_cancel_requested_on_cancelling():
    run = MagicMock()
    run.status = "cancelling"
    db = MagicMock()
    with pytest.raises(SyncCancelled):
        raise_if_cancel_requested(db, run)


@patch("app.ingestion.sync_executor.guard_api_sync_start")
@patch("app.ingestion.sync_executor.get_meta_session")
@patch("app.ingestion.sync_executor.fetch_source_rows_result")
@patch("app.ingestion.sync_executor.get_settings")
def test_run_job_aborts_before_write_when_cancelled(
    mock_settings, mock_fetch, mock_session, mock_guard,
):
    mock_settings.return_value.analytics_database_url = "postgresql+psycopg://u:p@localhost:5433/a"
    mock_fetch.return_value = [{"id": 1}]

    run_id = uuid.uuid4()
    job_id = uuid.uuid4()
    run = MagicMock()
    run.id = run_id
    run.status = "running"
    job = MagicMock()
    job.id = job_id

    db = MagicMock()
    mock_session.return_value = db
    db.get.side_effect = lambda model, key: run if key == run_id else job
    db.scalar.return_value = None

    refresh_count = {"n": 0}

    def refresh(_run):
        refresh_count["n"] += 1
        # 首次检查仍 running；拉数后第二次检查变为 cancelling
        if refresh_count["n"] >= 2:
            run.status = "cancelling"

    db.refresh.side_effect = refresh

    with patch("app.ingestion.sync_executor.apply_rules", return_value=[{"id": 1}]) as mock_rules:
        with patch("app.ingestion.sync_executor.write_analytics") as mock_write:
            result = run_job(job_id, "trace", run_id=run_id)
            assert result == run_id
            mock_fetch.assert_called_once()
            mock_rules.assert_not_called()
            mock_write.assert_not_called()
            assert run.status == "cancelled"
