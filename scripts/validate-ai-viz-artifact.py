#!/usr/bin/env python3
"""Repo wrapper → spec pack validator."""

from __future__ import annotations

import runpy
from pathlib import Path

runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "docs/api/vs-ai-spec/tools/validate-ai-viz-bundle.py"),
    run_name="__main__",
)
