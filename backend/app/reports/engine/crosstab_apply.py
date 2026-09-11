"""Apply template crosstab blocks to metric table sections."""

from __future__ import annotations

from typing import Any

from app.reports.engine.crosstab import pivot_table
from app.reports.persistence import template_repo


def _crosstab_blocks_by_ref(template_key: str) -> dict[str, dict[str, Any]]:
    raw = template_repo.get_template(template_key)
    if not raw:
        return {}
    out: dict[str, dict[str, Any]] = {}
    for block in raw.get("blocks") or []:
        if (block.get("blockType") or block.get("block_type")) != "crosstab":
            continue
        ref = str(block.get("tableRef") or block.get("table_ref") or "").strip()
        if ref:
            out[ref] = block
    return out


def apply_crosstab_blocks(sections: list[dict[str, Any]], template_key: str | None) -> list[dict[str, Any]]:
    if not template_key:
        return sections
    blocks = _crosstab_blocks_by_ref(template_key)
    if not blocks:
        return sections
    out: list[dict[str, Any]] = []
    for section in sections:
        key = str(section.get("metricKey") or "")
        block = blocks.get(key)
        if block and section.get("kind") == "table":
            try:
                pivoted = pivot_table(
                    list(section.get("columns") or []),
                    list(section.get("rows") or []),
                    row_field=str(block.get("rowField") or block.get("row_field") or ""),
                    col_field=str(block.get("colField") or block.get("col_field") or ""),
                    value_field=str(block.get("valueField") or block.get("value_field") or ""),
                    agg=str(block.get("agg") or "sum"),  # type: ignore[arg-type]
                )
            except ValueError as exc:
                out.append({
                    "kind": "error",
                    "metricKey": key,
                    "title": block.get("title") or section.get("title") or key,
                    "errorMessage": f"交叉表透视失败：{exc}",
                })
                continue
            pivoted["metricKey"] = key
            pivoted["title"] = block.get("title") or section.get("title") or key
            out.append(pivoted)
        else:
            out.append(section)
    return out
