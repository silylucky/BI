#!/usr/bin/env python3
"""Repo wrapper → spec pack publish script."""

from __future__ import annotations

import runpy
from pathlib import Path

runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "docs/api/vs-ai-spec/tools/publish-ai-viz-artifact.py"),
    run_name="__main__",
)
