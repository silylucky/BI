#!/usr/bin/env python3
"""Deep scan CDP profile for VitalSpan FE hot functions."""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

APP_HINT = re.compile(
    r"(5173|render|chart|d3|geo|pixel|measure|execute|layout|react|antv|three|maplibre)",
    re.I,
)


def load_profile(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("profile") or data


def analyze_samples(profile: dict) -> list[tuple[str, int]]:
    nodes = profile.get("nodes") or []
    samples = profile.get("samples") or []
    time_deltas = profile.get("timeDeltas") or []
    node_by_id = {n["id"]: n for n in nodes}
    totals: dict[str, int] = defaultdict(int)

    for i, sample_id in enumerate(samples):
        delta = time_deltas[i] if i < len(time_deltas) else 0
        if delta <= 0:
            continue
        seen: set[int] = set()
        node_id = sample_id
        while node_id is not None and node_id not in seen:
            seen.add(node_id)
            node = node_by_id.get(node_id)
            if not node:
                break
            cf = node.get("callFrame") or {}
            fn = cf.get("functionName") or "(anonymous)"
            if fn in ("(idle)", "(program)", "(root)"):
                node_id = node.get("parent")
                continue
            url = cf.get("url") or ""
            file = url.split("/")[-1] if url else "(native)"
            key = f"{fn} | {file}"
            totals[key] += delta
            node_id = node.get("parent")

    return sorted(totals.items(), key=lambda x: x[1], reverse=True)


def analyze_hitcount(profile: dict) -> list[tuple[str, int]]:
    totals: dict[str, int] = defaultdict(int)
    for node in profile.get("nodes") or []:
        hit = node.get("hitCount") or 0
        if hit <= 0:
            continue
        cf = node.get("callFrame") or {}
        fn = cf.get("functionName") or "(anonymous)"
        if fn in ("(idle)", "(program)", "(root)"):
            continue
        url = cf.get("url") or ""
        file = url.split("/")[-1] if url else "(native)"
        totals[f"{fn} | {file}"] += hit
    return sorted(totals.items(), key=lambda x: x[1], reverse=True)


def pick_app_relevant(ranked: list[tuple[str, int]], top_n: int = 12) -> list[dict]:
    app = [(k, v) for k, v in ranked if APP_HINT.search(k)]
    pool = app if len(app) >= 3 else ranked
    return [{"name": k, "score": v} for k, v in pool[:top_n]]


def main() -> None:
    path = Path(sys.argv[1])
    label = sys.argv[2] if len(sys.argv) > 2 else path.stem
    profile = load_profile(path)
    ranked = analyze_samples(profile)
    if len(ranked) < 5:
        ranked = analyze_hitcount(profile)
    top = pick_app_relevant(ranked)
    print(json.dumps({"label": label, "top": top[:3], "full": top}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
