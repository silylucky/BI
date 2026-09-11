from __future__ import annotations

import time
from dataclasses import dataclass
from unittest.mock import MagicMock, patch

from app.datasources.dialects.kingbase.connector import KingbaseConnector

probe_kingbase_budget_ms_limit = 50


@dataclass(frozen=True)
class KingbaseProbeResult:
    elapsed_ms: float
    ok: bool


def probe_test_connection_budget_ms(**kwargs) -> KingbaseProbeResult:
    connector = KingbaseConnector()
    mock_conn = MagicMock()
    started = time.perf_counter()
    with patch.object(connector._inner, "open_connection", return_value=mock_conn):
        connector.test_connection(**kwargs)
    elapsed = (time.perf_counter() - started) * 1000
    return KingbaseProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_kingbase_budget_ms_limit)
