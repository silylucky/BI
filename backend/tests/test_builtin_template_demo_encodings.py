"""内置模板 Dataset 字段必须落在精简后的 4 个官方 Dataset 列上。"""

from __future__ import annotations

from app.dashboard.templates.seed import _builtin_template_specs
from app.metadata.dataset.demo_bindings import _DEMO_DATASET_BINDING_SPECS
from app.metadata.dataset.demo_seed import DEMO_DATASET_IDS


def _fields_of(cfg: dict) -> list[str]:
    names: list[str] = []
    for key in ("dimensions", "metrics"):
        for item in cfg.get(key) or []:
            if isinstance(item, dict) and item.get("field"):
                names.append(str(item["field"]))
    axes = cfg.get("axes") or {}
    if isinstance(axes, dict):
        for refs in axes.values():
            if not isinstance(refs, list):
                continue
            for item in refs:
                if isinstance(item, dict) and item.get("field"):
                    names.append(str(item["field"]))
    return names


def test_builtin_templates_all_charts_bound_to_demo_datasets() -> None:
    for spec in _builtin_template_specs():
        widgets = (spec["layout_json"] or {}).get("widgets") or []
        for widget in widgets:
            if widget.get("type") != "chart":
                continue
            cfg = widget.get("chartConfig")
            if not isinstance(cfg, dict) or not cfg.get("chartType"):
                continue
            if cfg.get("mode") != "dataset":
                continue
            dataset_id = cfg.get("datasetId")
            if not dataset_id:
                continue
            assert dataset_id in DEMO_DATASET_IDS, (widget.get("title"), dataset_id)
            allowed = set(_DEMO_DATASET_BINDING_SPECS[dataset_id]["columns"])  # type: ignore[index]
            illegal = [name for name in _fields_of(cfg) if name not in allowed]
            assert not illegal, (spec["template_key"], widget.get("title"), illegal)
