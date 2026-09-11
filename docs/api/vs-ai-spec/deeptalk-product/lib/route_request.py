"""Rule-based workflow routing for DeepTalk VitalSpan Agent (IRWS Phase 1)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from config import spec_pack_path


@dataclass
class RouteResult:
    ok: bool
    workflow: str
    reason: str
    chart_type: str | None = None
    template: str | None = None
    rhythm: str | None = None
    runtime: str | None = None
    paradigm: str | None = None
    redirect: str | None = None

    def to_dict(self) -> dict:
        out = {
            "ok": self.ok,
            "workflow": self.workflow,
            "reason": self.reason,
            "chartType": self.chart_type,
            "runtime": self.runtime,
            "redirect": self.redirect,
        }
        if self.paradigm:
            out["paradigm"] = self.paradigm
        if self.template:
            out["template"] = self.template
        if self.rhythm:
            out["rhythm"] = self.rhythm
        return out


def _routing_path() -> Path:
    return spec_pack_path() / "assets" / "capability-routing.json"


def _load_rules() -> list[dict]:
    path = _routing_path()
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data.get("rules") or [])


def route_request(text: str) -> RouteResult:
    normalized = (text or "").strip().lower()
    if not normalized:
        return RouteResult(False, "unknown", "empty request")

    for rule in _load_rules():
        patterns = rule.get("match") or []
        if not any(re.search(pat, normalized, re.I) for pat in patterns):
            continue
        wf = str(rule.get("workflow") or "unknown")
        return RouteResult(
            True,
            wf,
            str(rule.get("reason") or ""),
            chart_type=rule.get("chartType"),
            template=rule.get("template"),
            rhythm=rule.get("rhythm"),
            runtime=rule.get("runtime"),
            paradigm=rule.get("paradigm"),
            redirect=rule.get("redirect"),
        )

    if re.search(r"(大屏|看板|dashboard|data-screen|编排|拼屏)", normalized):
        return RouteResult(
            True,
            "3",
            "wf3 free layout — create → get → write layoutJson → upload (no preset templates v0.4.6)",
            redirect="create_dashboard",
        )
    if re.search(r"(组件|custom|customviz|artifact|入库|脚手架|scaffold)", normalized):
        return RouteResult(True, "2", "customViz keywords", runtime="html")
    if re.search(r"(柱|线|饼|表|地图|sankey|graph|内置)", normalized):
        return RouteResult(True, "1", "built-in chart keywords", chart_type="bar")

    return RouteResult(False, "unknown", "no routing rule matched; call vitalspan_get_contract_card or ask user")
