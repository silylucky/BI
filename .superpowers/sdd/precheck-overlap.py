from pathlib import Path
from collections import defaultdict
import re

text = Path("docs/superpowers/plans/2026-07-09-concurrent-refactor-plan.md").read_text(encoding="utf-8")
parts = re.split(r"### task_id: (P\d+)", text)
own: dict[str, set[str]] = defaultdict(set)
for i in range(1, len(parts), 2):
    tid = parts[i]
    head = parts[i + 1].split("root_architecture_problem")[0]
    for f in re.findall("`([^`]+)`", head):
        if f.endswith((".ts", ".tsx", ".py")) or f.endswith("/**") or "/errors/" in f:
            own[f].add(tid)
print("paths", len(own))
ol = {k: sorted(v) for k, v in own.items() if len(v) > 1}
print("overlaps", len(ol))
for k, v in sorted(ol.items()):
    print(k, "->", v)
