#!/usr/bin/env python3
"""Check VitalSpan /health before publish workflows."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, health_check


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    args = parser.parse_args()
    health_check(str(args.api).rstrip("/"))


if __name__ == "__main__":
    main()
