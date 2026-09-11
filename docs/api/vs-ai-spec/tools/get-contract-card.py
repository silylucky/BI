#!/usr/bin/env python3
"""Return contract_card.json for L3-ZeroRef agents (no long docs)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARD = ROOT / "assets" / "contract_card.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Print customViz contract_card JSON")
    parser.add_argument("--json", action="store_true", help="pretty-print JSON (default)")
    args = parser.parse_args()
    if not CARD.is_file():
        raise SystemExit(f"contract_card missing: {CARD}")
    data = json.loads(CARD.read_text(encoding="utf-8"))
    print(json.dumps(data, ensure_ascii=False, indent=2))
    if not args.json:
        pass


if __name__ == "__main__":
    main()
