"""一次性脚本：将官方模板 layout 中 mode=sql widget 迁移为 mode=dataset。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYOUT_DIR = ROOT / "backend" / "app" / "dashboard" / "templates" / "layouts"

SQL_DATASET_MAP: list[tuple[str, str, dict[str, str]]] = [
    (
        r"gov_grid_stats",
        "demo-gov-grid-stats",
        {"网格": "grid_name", "事件数": "event_count", "已办结": "resolved_count"},
    ),
    (
        r"v_gov_region_service",
        "demo-v-sales-geo",
        {"省份": "province", "城市": "city", "区县": "district", "服务量": "amount"},
    ),
    (
        r"gov_incidents",
        "demo-gov-grid-stats",
        {"事件类型": "grid_name", "数量": "event_count"},
    ),
    (
        r"gov_hotwords",
        "demo-sales-wide",
        {"热词": "product_name", "权重": "amount"},
    ),
    (
        r"gov_issues",
        "demo-gov-grid-stats",
        {
            "问题类型": "grid_name",
            "地点": "grid_name",
            "责任单位": "grid_name",
            "状态": "grid_name",
            "进度": "event_count",
        },
    ),
    (
        r"gov_budget_items",
        "demo-sales-wide",
        {"类别": "category_name", "支出金额": "amount"},
    ),
    (
        r"gov_investment",
        "demo-sales-wide",
        {"产业": "category_name", "投资额": "amount"},
    ),
    (
        r"gov_service_metrics",
        "demo-sales-wide",
        {"指标": "product_name", "数值": "amount"},
    ),
]


def _rename_field_list(items: object, mapping: dict[str, str]) -> None:
    if not isinstance(items, list):
        return
    for item in items:
        if not isinstance(item, dict):
            continue
        field = item.get("field")
        if isinstance(field, str) and field in mapping:
            item["field"] = mapping[field]


def _rename_fields(chart_cfg: dict, mapping: dict[str, str]) -> None:
    _rename_field_list(chart_cfg.get("dimensions"), mapping)
    _rename_field_list(chart_cfg.get("metrics"), mapping)
    axes = chart_cfg.get("axes")
    if isinstance(axes, dict):
        for value in axes.values():
            _rename_field_list(value, mapping)


def _match_dataset(sql: str) -> tuple[str, dict[str, str]] | None:
    for pattern, dataset_id, fields in SQL_DATASET_MAP:
        if re.search(pattern, sql, re.IGNORECASE):
            return dataset_id, fields
    return None


def migrate_chart_config(chart_cfg: dict) -> bool:
    if chart_cfg.get("mode") != "sql":
        return False
    sql = chart_cfg.get("sql") or ""
    matched = _match_dataset(sql)
    if matched is None:
        raise RuntimeError(f"Unmapped SQL widget: {sql[:80]!r}")
    dataset_id, field_map = matched
    chart_cfg["mode"] = "dataset"
    chart_cfg["datasetId"] = dataset_id
    chart_cfg["configId"] = None
    chart_cfg["sql"] = None
    chart_cfg["schema"] = None
    chart_cfg["table"] = None
    chart_cfg["bindingId"] = None
    if chart_cfg.get("dataSourceId") not in (None, "", "__demo:sample_db__"):
        chart_cfg["dataSourceId"] = "__demo:sample_db__"
    _rename_fields(chart_cfg, field_map)
    return True


def migrate_file(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    layout = data.get("layoutJson") or {}
    widgets = layout.get("widgets") or []
    changed = 0
    for widget in widgets:
        if not isinstance(widget, dict) or widget.get("type") != "chart":
            continue
        chart_cfg = widget.get("chartConfig")
        if isinstance(chart_cfg, dict) and migrate_chart_config(chart_cfg):
            changed += 1
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    total = 0
    for path in sorted(LAYOUT_DIR.glob("*.json")):
        n = migrate_file(path)
        if n:
            print(f"{path.name}: {n} widgets")
            total += n
    print(f"done, migrated {total} widgets")


if __name__ == "__main__":
    main()
