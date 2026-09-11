from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportAnalysisPack, ReportAnalysisSnapshot


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def _pack_to_dict(row: ReportAnalysisPack) -> dict:
    out: dict = {
        "packKey": row.pack_key,
        "displayName": row.display_name,
        "businessObjectCode": row.business_object_code,
        "physicalTableFqn": row.physical_table_fqn,
        "dataSourceId": str(row.data_source_id),
        "fieldMapping": row.field_mapping or {},
        "enabledThemes": row.enabled_themes or [],
        "allowedRoles": row.allowed_roles or [],
        "snapshotCronPreset": row.snapshot_cron_preset,
        "snapshotRetentionPeriods": row.snapshot_retention_periods,
    }
    if row.dataset_id:
        out["datasetId"] = row.dataset_id
    if row.bound_config_id:
        out["boundConfigId"] = str(row.bound_config_id)
    return out


def _snapshot_to_dict(row: ReportAnalysisSnapshot) -> dict:
    return {
        "id": str(row.id),
        "packKey": row.pack_key,
        "theme": row.theme,
        "periodKind": row.period_kind,
        "periodKey": row.period_key,
        "capturedAt": row.captured_at.isoformat() if row.captured_at else "",
        "payload": row.payload or {},
    }


def all_packs() -> dict[str, dict]:
    if not _use_db():
        return memory_stores.analysis_packs
    with Session(bind=get_meta_engine()) as db:
        models = db.scalars(select(ReportAnalysisPack)).all()
        return {m.pack_key: _pack_to_dict(m) for m in models}


def get_pack(key: str) -> dict | None:
    if not _use_db():
        return memory_stores.analysis_packs.get(key)
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportAnalysisPack, key)
        return _pack_to_dict(model) if model else None


def save_pack(key: str, payload: dict) -> None:
    if not _use_db():
        memory_stores.analysis_packs[key] = dict(payload)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportAnalysisPack, key)
        bound_raw = payload.get("boundConfigId")
        bound_config_id = uuid.UUID(str(bound_raw)) if bound_raw else None
        common = {
            "display_name": payload["displayName"],
            "business_object_code": payload.get("businessObjectCode"),
            "physical_table_fqn": payload.get("physicalTableFqn"),
            "dataset_id": payload.get("datasetId"),
            "bound_config_id": bound_config_id,
            "data_source_id": uuid.UUID(str(payload["dataSourceId"])),
            "field_mapping": payload.get("fieldMapping") or {},
            "enabled_themes": payload.get("enabledThemes") or [],
            "allowed_roles": payload.get("allowedRoles") or [],
            "snapshot_cron_preset": payload["snapshotCronPreset"],
            "snapshot_retention_periods": int(payload.get("snapshotRetentionPeriods") or 12),
        }
        if model is None:
            db.add(ReportAnalysisPack(pack_key=key, **common))
        else:
            for attr, value in common.items():
                setattr(model, attr, value)
            model.updated_at = datetime.now(UTC)
        db.commit()


def delete_pack(key: str) -> bool:
    if not _use_db():
        if key not in memory_stores.analysis_packs:
            return False
        del memory_stores.analysis_packs[key]
        memory_stores.analysis_snapshots = [
            s for s in memory_stores.analysis_snapshots if s.get("packKey") != key
        ]
        return True
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportAnalysisPack, key)
        if model is None:
            return False
        db.query(ReportAnalysisSnapshot).filter(ReportAnalysisSnapshot.pack_key == key).delete()
        db.delete(model)
        db.commit()
        return True


def list_snapshots(pack_key: str, theme: str | None = None, limit: int = 50) -> list[dict]:
    if not _use_db():
        items = [s for s in memory_stores.analysis_snapshots if s.get("packKey") == pack_key]
        if theme:
            items = [s for s in items if s.get("theme") == theme]
        return sorted(items, key=lambda x: x.get("capturedAt", ""), reverse=True)[:limit]
    with Session(bind=get_meta_engine()) as db:
        q = db.query(ReportAnalysisSnapshot).filter(ReportAnalysisSnapshot.pack_key == pack_key)
        if theme:
            q = q.filter(ReportAnalysisSnapshot.theme == theme)
        rows = q.order_by(ReportAnalysisSnapshot.captured_at.desc()).limit(limit).all()
        return [_snapshot_to_dict(r) for r in rows]


def upsert_snapshot(
    pack_key: str,
    theme: str,
    period_kind: str,
    period_key: str,
    payload: dict[str, Any],
    filters_hash: str = "none",
) -> dict:
    if not _use_db():
        for item in memory_stores.analysis_snapshots:
            if (
                item.get("packKey") == pack_key
                and item.get("theme") == theme
                and item.get("periodKind") == period_kind
                and item.get("periodKey") == period_key
                and item.get("filtersHash", "none") == filters_hash
            ):
                item["payload"] = payload
                item["capturedAt"] = datetime.now(UTC).isoformat()
                return item
        snap_id = str(uuid.uuid4())
        row = {
            "id": snap_id,
            "packKey": pack_key,
            "theme": theme,
            "periodKind": period_kind,
            "periodKey": period_key,
            "filtersHash": filters_hash,
            "capturedAt": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        memory_stores.analysis_snapshots.append(row)
        return row
    with Session(bind=get_meta_engine()) as db:
        existing = db.scalar(
            select(ReportAnalysisSnapshot).where(
                ReportAnalysisSnapshot.pack_key == pack_key,
                ReportAnalysisSnapshot.theme == theme,
                ReportAnalysisSnapshot.period_kind == period_kind,
                ReportAnalysisSnapshot.period_key == period_key,
                ReportAnalysisSnapshot.filters_hash == filters_hash,
            )
        )
        if existing:
            existing.payload = payload
            existing.captured_at = datetime.now(UTC)
            db.commit()
            db.refresh(existing)
            return _snapshot_to_dict(existing)
        row = ReportAnalysisSnapshot(
            id=uuid.uuid4(),
            pack_key=pack_key,
            theme=theme,
            period_kind=period_kind,
            period_key=period_key,
            filters_hash=filters_hash,
            payload=payload,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _snapshot_to_dict(row)


def get_snapshot_for_period(
    pack_key: str,
    theme: str,
    period_kind: str,
    period_key: str,
    filters_hash: str = "none",
) -> dict | None:
    if not _use_db():
        for item in memory_stores.analysis_snapshots:
            if (
                item.get("packKey") == pack_key
                and item.get("theme") == theme
                and item.get("periodKind") == period_kind
                and item.get("periodKey") == period_key
                and item.get("filtersHash", "none") == filters_hash
            ):
                return item
        return None
    with Session(bind=get_meta_engine()) as db:
        row = db.scalar(
            select(ReportAnalysisSnapshot).where(
                ReportAnalysisSnapshot.pack_key == pack_key,
                ReportAnalysisSnapshot.theme == theme,
                ReportAnalysisSnapshot.period_kind == period_kind,
                ReportAnalysisSnapshot.period_key == period_key,
                ReportAnalysisSnapshot.filters_hash == filters_hash,
            )
        )
        return _snapshot_to_dict(row) if row else None


def prune_snapshots(pack_key: str, theme: str, period_kind: str, retain: int) -> int:
    """Keep newest `retain` period keys per pack/theme/kind; return deleted count."""
    if retain < 1:
        return 0
    if not _use_db():
        matched = [
            s
            for s in memory_stores.analysis_snapshots
            if s.get("packKey") == pack_key
            and s.get("theme") == theme
            and s.get("periodKind") == period_kind
        ]
        keys = sorted({s.get("periodKey", "") for s in matched}, reverse=True)
        drop_keys = set(keys[retain:])
        if not drop_keys:
            return 0
        before = len(memory_stores.analysis_snapshots)
        memory_stores.analysis_snapshots = [
            s
            for s in memory_stores.analysis_snapshots
            if not (
                s.get("packKey") == pack_key
                and s.get("theme") == theme
                and s.get("periodKind") == period_kind
                and s.get("periodKey") in drop_keys
            )
        ]
        return before - len(memory_stores.analysis_snapshots)
    with Session(bind=get_meta_engine()) as db:
        rows = db.scalars(
            select(ReportAnalysisSnapshot.period_key)
            .where(
                ReportAnalysisSnapshot.pack_key == pack_key,
                ReportAnalysisSnapshot.theme == theme,
                ReportAnalysisSnapshot.period_kind == period_kind,
            )
            .distinct()
        ).all()
        keys = sorted(rows, reverse=True)
        drop_keys = keys[retain:]
        if not drop_keys:
            return 0
        deleted = (
            db.query(ReportAnalysisSnapshot)
            .filter(
                ReportAnalysisSnapshot.pack_key == pack_key,
                ReportAnalysisSnapshot.theme == theme,
                ReportAnalysisSnapshot.period_kind == period_kind,
                ReportAnalysisSnapshot.period_key.in_(drop_keys),
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return int(deleted)
