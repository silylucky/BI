#!/usr/bin/env python3
"""POST chartConfig to POST /charts/validate (L1/L2 built-in charts)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, login, pack_dir, request_json, resolve_spec_path


def load_chart_config(path: Path) -> dict:
    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        raise SystemExit("file root must be a JSON object")
    if "chartConfig" in doc:
        cfg = doc["chartConfig"]
    elif "chartType" in doc:
        cfg = doc
    else:
        raise SystemExit("expected {chartConfig: ...} or a chartConfig object with chartType")
    if not isinstance(cfg, dict) or "chartType" not in cfg:
        raise SystemExit("chartConfig.chartType is required")
    return cfg


def main() -> None:
    pack = pack_dir()
    parser = argparse.ArgumentParser(description="Validate L1/L2 chartConfig against VitalSpan")
    parser.add_argument(
        "--file",
        type=Path,
        default=pack / "examples" / "bar-manual-deStyle.json",
    )
    parser.add_argument("--api", default=default_api())
    parser.add_argument("--username", default=default_credentials()[0])
    parser.add_argument("--password", default=default_credentials()[1])
    args = parser.parse_args()

    path = resolve_spec_path(pack, args.file)
    chart_config = load_chart_config(path)
    api = args.api.rstrip("/")
    print(f"validate target: POST {api}/charts/validate (built-in chart, not customViz)")
    token = login(api, args.username, args.password)
    result = request_json("POST", f"{api}/charts/validate", chart_config, token)
    chart_type = result.get("chartType") or result.get("chart_type") or chart_config.get("chartType")
    print(f"ok chartType={chart_type}")
    print("next: embed chartConfig in layoutJson widget type=chart, then editor-save")


if __name__ == "__main__":
    main()
