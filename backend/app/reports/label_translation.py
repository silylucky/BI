"""报表展示层维度码值翻译（META-003 · M-RPT F-C）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.metadata.dimensions.schemas import DimensionError
from app.metadata.dimensions import service as dimension_service
from app.reports.extension.schemas import MetricAdjustment
from app.reports.standard.schemas import FieldMapping, ThemeType

_KNOWN_DIMENSION_CODES = frozenset({"status", "region", "dim_sales"})

_THEME_DIMENSION_FIELD: dict[ThemeType, str] = {
    "lifecycle": "status",
    "distribution": "region",
}


@dataclass(frozen=True)
class ColumnDimensionBinding:
    column: str
    dimension_code: str


def lookup_value_labels(
    session: Session,
    dimension_code: str,
    raw_codes: Iterable[str],
) -> tuple[dict[str, str], list[str]]:
    """返回 (code→label, 未翻译的 code 列表)。"""
    unique = sorted({str(c).strip() for c in raw_codes if str(c).strip()})
    if not unique:
        return {}, []
    try:
        dimension = dimension_service.resolve_dimension_by_code(session, dimension_code)
    except DimensionError:
        return {}, list(unique)
    needed = set(unique)
    label_map: dict[str, str] = {}
    offset = 0
    while needed:
        values, total = dimension_service.list_values(session, dimension.id, limit=500, offset=offset)
        for value in values:
            if value.code in needed:
                label_map[value.code] = value.label
                needed.discard(value.code)
        if not values or offset + len(values) >= total:
            break
        offset += len(values)
    translated: dict[str, str] = {}
    missing: list[str] = []
    for code in unique:
        label = label_map.get(code)
        if label:
            translated[code] = label
        else:
            missing.append(code)
    return translated, missing


def standard_analysis_bindings(theme: ThemeType, mapping: FieldMapping) -> list[ColumnDimensionBinding]:
    dimension_field = _THEME_DIMENSION_FIELD.get(theme)
    if dimension_field is None:
        return []
    if not getattr(mapping, dimension_field, None):
        return []
    # lifecycle/distribution 聚合后列名固定为 dim（见 theme_aggregate.py）
    return [ColumnDimensionBinding(column="dim", dimension_code=dimension_field)]


def extension_section_bindings(
    metric: MetricAdjustment,
    columns: list[Any],
) -> list[ColumnDimensionBinding]:
    bindings: list[ColumnDimensionBinding] = []
    if metric.dimension_dict_code:
        col = metric.dimension_value_column
        if not col and columns:
            col = _column_name(columns[0])
        if col:
            bindings.append(
                ColumnDimensionBinding(column=col, dimension_code=metric.dimension_dict_code),
            )
        return bindings
    for col in columns:
        name = _column_name(col)
        lower = name.lower()
        if lower in _KNOWN_DIMENSION_CODES:
            bindings.append(ColumnDimensionBinding(column=name, dimension_code=lower))
    return bindings


def _column_name(col: Any) -> str:
    if isinstance(col, dict):
        return str(col.get("name") or col.get("key") or "")
    return str(col)


def _column_index(columns: list[Any], column: str) -> int | None:
    for idx, col in enumerate(columns):
        if _column_name(col) == column:
            return idx
    return None


def translate_table_payload(
    session: Session,
    payload: dict[str, Any],
    bindings: list[ColumnDimensionBinding],
) -> tuple[dict[str, Any], dict[str, Any]]:
    columns = payload.get("columns") or []
    rows = payload.get("rows") or []
    if not columns or not rows or not bindings:
        return payload, {}

    translated = dict(payload)
    new_rows: list[Any] = []
    untranslated_codes: list[str] = []

    binding_maps: list[tuple[int, dict[str, str], list[str]]] = []
    for binding in bindings:
        idx = _column_index(columns, binding.column)
        if idx is None:
            continue
        codes = []
        for row in rows:
            if isinstance(row, dict):
                codes.append(str(row.get(binding.column, row.get(_column_name(columns[idx]), ""))))
            elif isinstance(row, (list, tuple)) and len(row) > idx:
                codes.append(str(row[idx]))
        label_map, missing = lookup_value_labels(session, binding.dimension_code, codes)
        binding_maps.append((idx, label_map, missing))
        untranslated_codes.extend(missing)

    for row in rows:
        if isinstance(row, dict):
            item = dict(row)
            for idx, label_map, _missing in binding_maps:
                col_name = _column_name(columns[idx])
                raw = str(item.get(col_name, ""))
                if raw in label_map:
                    item[col_name] = label_map[raw]
            new_rows.append(item)
        elif isinstance(row, (list, tuple)):
            item = list(row)
            for idx, label_map, _missing in binding_maps:
                raw = str(item[idx]) if len(item) > idx else ""
                if raw in label_map and len(item) > idx:
                    item[idx] = label_map[raw]
            new_rows.append(item)
        else:
            new_rows.append(row)

    translated["rows"] = new_rows
    meta: dict[str, Any] = {}
    if untranslated_codes:
        unique_missing = sorted(set(untranslated_codes))
        meta["translationNote"] = f"部分码值未翻译（{len(unique_missing)} 项）"
        meta["untranslatedCodes"] = unique_missing[:20]
    elif binding_maps:
        meta["translationApplied"] = True
    return translated, meta


def apply_bindings_to_render_spec(
    session: Session,
    render_spec: dict[str, Any],
    bindings_by_section: list[list[ColumnDimensionBinding]],
) -> dict[str, Any]:
    spec = dict(render_spec)
    sections = spec.get("sections") or []
    if not sections:
        return spec
    meta = dict(spec.get("meta") or {})
    notes: list[str] = []
    new_sections: list[dict[str, Any]] = []
    for idx, section in enumerate(sections):
        bindings = bindings_by_section[idx] if idx < len(bindings_by_section) else []
        if section.get("kind") in {"table", "chart"} and bindings:
            payload = {
                "columns": section.get("columns") or [],
                "rows": section.get("rows") or [],
            }
            translated_payload, tmeta = translate_table_payload(session, payload, bindings)
            new_section = dict(section)
            new_section["columns"] = translated_payload.get("columns") or []
            new_section["rows"] = translated_payload.get("rows") or []
            new_sections.append(new_section)
            if tmeta.get("translationNote"):
                notes.append(str(tmeta["translationNote"]))
            elif tmeta.get("translationApplied"):
                meta["translationApplied"] = True
        else:
            new_sections.append(section)
    spec["sections"] = new_sections
    if notes:
        meta["translationNote"] = "；".join(dict.fromkeys(notes))
    if meta:
        spec["meta"] = meta
    return spec


def translate_standard_render_spec(
    session: Session,
    render_spec: dict[str, Any],
    theme: ThemeType,
    mapping: FieldMapping,
) -> dict[str, Any]:
    bindings = standard_analysis_bindings(theme, mapping)
    if not bindings:
        return render_spec
    return apply_bindings_to_render_spec(session, render_spec, [bindings])


def translate_extension_sections(
    session: Session,
    sections: list[dict[str, Any]],
    metrics: list[MetricAdjustment],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    bindings_by_section: list[list[ColumnDimensionBinding]] = []
    metric_idx = 0
    for section in sections:
        if section.get("kind") not in {"table", "chart"}:
            bindings_by_section.append([])
            continue
        metric = metrics[metric_idx] if metric_idx < len(metrics) else None
        metric_idx += 1
        if metric is None:
            bindings_by_section.append([])
            continue
        bindings_by_section.append(
            extension_section_bindings(metric, section.get("columns") or []),
        )
    spec = apply_bindings_to_render_spec(
        session,
        {"sections": sections, "meta": {}},
        bindings_by_section,
    )
    return spec.get("sections") or sections, spec.get("meta") or {}
