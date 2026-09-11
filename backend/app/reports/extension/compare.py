from __future__ import annotations

_VALID_MODES = frozenset({"yoy", "mom"})
_LABELS = {"yoy": "同比", "mom": "环比"}


def build_compare_slots(compare_mode: str, metrics: list[dict], metric_keys: list[str] | None) -> list[dict]:
    if compare_mode not in _VALID_MODES:
        return []
    selected = metrics
    if metric_keys:
        keys = set(metric_keys)
        selected = [m for m in metrics if m.get("key") in keys]
    slots = []
    for m in selected:
        mode = m.get("compareMode", "none")
        if mode == "none" and compare_mode:
            mode = compare_mode
        if mode not in _VALID_MODES:
            continue
        slots.append({
            "key": m["key"],
            "label": m.get("label", m["key"]),
            "compareMode": mode,
            "baselineLabel": _LABELS[mode],
        })
    return slots
