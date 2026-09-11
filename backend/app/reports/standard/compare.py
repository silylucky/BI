from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.reports.persistence import standard_repo
from app.reports import label_translation
from app.reports.standard.errors import RPT_STD_SNAPSHOT_NOT_FOUND, StandardAnalysisError
from app.reports.standard.schemas import CompareDeltaRow, CompareMatrixOut, CompareMatrixRow, CompareOut, RunIn
from app.reports.standard import service as pack_service

_MATRIX_MAX_PERIODS = 12


def _column_name(col: object) -> str:
    if isinstance(col, dict):
        return str(col.get("name") or col.get("key") or "")
    return str(col)


def _rows_to_map(payload: dict | None) -> dict[str, float]:
    if not payload:
        return {}
    rows = payload.get("rows") or []
    columns = payload.get("columns") or []
    if not rows or not columns:
        return {}
    key_col = _column_name(columns[0]) or "dim"
    val_col = _column_name(columns[1]) if len(columns) > 1 else "cnt"
    out: dict[str, float] = {}
    for row in rows:
        if isinstance(row, dict):
            k = str(row.get(key_col, row.get("dim", "")))
            v = row.get(val_col, row.get("cnt", 0))
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            k, v = str(row[0]), row[1]
        else:
            continue
        try:
            out[k] = float(v)
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _section_payload_from_run(run_out) -> dict:
    first = (run_out.render_spec.get("sections") or [{}])[0]
    return {"columns": first.get("columns") or [], "rows": first.get("rows") or []}


def _translate_payload(
    db: Session,
    pack,
    theme: str,
    payload: dict | None,
) -> dict | None:
    if not payload:
        return payload
    bindings = label_translation.standard_analysis_bindings(theme, pack.field_mapping)
    if not bindings:
        return payload
    translated, _meta = label_translation.translate_table_payload(db, payload, bindings)
    return translated


def _snapshot_payload(
    db: Session,
    pack,
    pack_key: str,
    theme: str,
    period_kind: str,
    period_key: str,
    *,
    required: bool,
) -> dict | None:
    raw = standard_repo.get_snapshot_for_period(pack_key, theme, period_kind, period_key)
    if raw is None:
        if required:
            raise StandardAnalysisError(
                RPT_STD_SNAPSHOT_NOT_FOUND,
                f"快照不存在：{period_key}",
                404,
            )
        return None
    payload = raw.get("payload")
    return _translate_payload(db, pack, theme, payload)


def _build_deltas(current_map: dict[str, float], previous_map: dict[str, float]) -> list[CompareDeltaRow]:
    deltas: list[CompareDeltaRow] = []
    for k in sorted(set(current_map) | set(previous_map)):
        cur = current_map.get(k, 0.0)
        prev = previous_map.get(k) if k in previous_map else None
        delta = cur - prev if prev is not None else None
        delta_pct = (delta / prev * 100) if prev not in (None, 0) and delta is not None else None
        deltas.append(
            CompareDeltaRow(
                key=k,
                currentValue=cur,
                previousValue=prev,
                delta=delta,
                deltaPct=delta_pct,
            )
        )
    return deltas


def _resolve_period_maps(
    db: Session,
    pack_key: str,
    theme: str,
    period_kind: str,
    live_period_key: str,
    period_keys: list[str],
    user: UserContext,
) -> dict[str, dict[str, float]]:
    maps: dict[str, dict[str, float]] = {}
    pack = pack_service.get_pack(pack_key, user)
    for period_key in period_keys:
        if period_key == live_period_key:
            run_out = pack_service.run_pack(db, pack_key, RunIn(theme=theme), user)
            maps[period_key] = _rows_to_map(_section_payload_from_run(run_out))
            continue
        payload = _snapshot_payload(
            db, pack, pack_key, theme, period_kind, period_key, required=False,
        )
        maps[period_key] = _rows_to_map(payload) if payload else {}
    return maps


def compare_pack(
    db: Session,
    pack_key: str,
    theme: str,
    user: UserContext,
    *,
    baseline_period_key: str | None = None,
    current_period_key: str | None = None,
) -> CompareOut:
    pack = pack_service.get_pack(pack_key, user)
    if theme not in pack.enabled_themes:
        raise StandardAnalysisError("RPT_STD_THEME_DISABLED", "theme not enabled", 422)

    period_kind, live_period_key = pack_service.period_key_for(pack.snapshot_cron_preset)

    if current_period_key:
        current_key = current_period_key
        current_payload = _snapshot_payload(
            db, pack, pack_key, theme, period_kind, current_key, required=True,
        )
        current_source = "snapshot"
    else:
        current_key = live_period_key
        run_out = pack_service.run_pack(db, pack_key, RunIn(theme=theme), user)
        current_payload = _section_payload_from_run(run_out)
        current_source = "live"

    if baseline_period_key:
        baseline_key = baseline_period_key
    elif current_period_key:
        baseline_key = pack_service.previous_period_key(period_kind, current_period_key)
    else:
        baseline_key = pack_service.previous_period_key(period_kind, live_period_key)

    previous_payload = (
        _snapshot_payload(db, pack, pack_key, theme, period_kind, baseline_key, required=False)
        if baseline_key
        else None
    )
    current_map = _rows_to_map(current_payload)
    previous_map = _rows_to_map(previous_payload)
    deltas = _build_deltas(current_map, previous_map)

    return CompareOut(
        packKey=pack_key,
        theme=theme,
        currentPeriodKey=current_key,
        previousPeriodKey=baseline_key,
        currentSource=current_source,
        current=current_payload,
        previous=previous_payload,
        deltas=deltas,
    )


def compare_periods_matrix(
    db: Session,
    pack_key: str,
    theme: str,
    period_keys: list[str],
    user: UserContext,
) -> CompareMatrixOut:
    pack = pack_service.get_pack(pack_key, user)
    if theme not in pack.enabled_themes:
        raise StandardAnalysisError("RPT_STD_THEME_DISABLED", "theme not enabled", 422)

    period_kind, live_period_key = pack_service.period_key_for(pack.snapshot_cron_preset)
    keys = sorted({k.strip() for k in period_keys if k.strip()}, reverse=True)[:_MATRIX_MAX_PERIODS]
    if len(keys) < 2:
        raise StandardAnalysisError(
            "RPT_STD_COMPARE_INVALID",
            "多期对比至少选择 2 个周期",
            400,
        )

    period_maps = _resolve_period_maps(
        db, pack_key, theme, period_kind, live_period_key, keys, user,
    )
    all_dims = sorted({dim for period_map in period_maps.values() for dim in period_map})
    rows = [
        CompareMatrixRow(
            key=dim,
            values={period_key: period_maps[period_key].get(dim, 0.0) for period_key in keys},
        )
        for dim in all_dims
    ]
    return CompareMatrixOut(
        packKey=pack_key,
        theme=theme,
        periodKind=period_kind,
        periodKeys=keys,
        rows=rows,
    )
