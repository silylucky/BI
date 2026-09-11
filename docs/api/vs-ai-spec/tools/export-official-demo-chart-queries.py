#!/usr/bin/env python3
"""Export official demo chart SQL registry for DeepTalk plugin / vs-ai-spec assets."""

from __future__ import annotations

import json
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[3] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF
from app.dashboard.templates.official_demo_sql import (
    OFFICIAL_DEMO_CHART_QUERIES,
    chart_query_binding,
)


def main() -> None:
    pack = Path(__file__).resolve().parents[1]
    out_path = pack / "assets" / "official-demo-chart-queries.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "dataSourceRef": TEMPLATE_DEMO_DATASOURCE_REF,
        "note": "Built-in chart demo SQL from backend official_demo_sql.py; requires sample_db (:3307).",
        "queries": {},
    }
    for chart_type, query in sorted(OFFICIAL_DEMO_CHART_QUERIES.items()):
        binding = chart_query_binding(query)
        payload["queries"][chart_type] = {
            "chartType": chart_type,
            "title": query.title,
            "mode": "sql",
            "dataSourceId": TEMPLATE_DEMO_DATASOURCE_REF,
            **binding,
        }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok {out_path} queries={len(payload['queries'])}")


if __name__ == "__main__":
    main()
