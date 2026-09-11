#!/usr/bin/env python3
"""Summarize Chrome CDP Profiler.stop() JSON — Top N by inclusive stack time."""
import json
import sys
from collections import defaultdict
from pathlib import Path


def analyze(profile: dict, top_n: int = 12) -> list[dict]:
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
            url = cf.get("url") or ""
            file = url.split("/")[-1] if url else "(native)"
            key = f"{fn} | {file}"
            totals[key] += delta
            node_id = node.get("parent")

    ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    skip = {"(idle)", "(program)", "(root)"}
    filtered = [
        (name, us)
        for name, us in ranked
        if not any(name.startswith(f"{s} ") for s in skip)
    ][:top_n]
    return [{"name": name, "ms": round(us / 1000)} for name, us in filtered]


def main() -> None:
    path = Path(sys.argv[1])
    label = sys.argv[2] if len(sys.argv) > 2 else path.stem
    data = json.loads(path.read_text(encoding="utf-8"))
    profile = data.get("profile") or data
    top = analyze(profile)
    print(f"## {label}")
    for i, row in enumerate(top[:3], 1):
        print(f"{i}. `{row['name']}` — {row['ms']} ms (inclusive sample time)")
    print("---full-top---")
    print(json.dumps(top, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
