"""Builtin standard analysis pack seed."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.datasources.models import get_meta_engine
from app.metadata.physical import service as physical_service
from app.metadata.physical.errors import PhysicalTableError
from app.reports.standard.legacy_cleanup import materialize_std_pack_from_physical
from app.reports.standard.schemas import AnalysisPackIn, AnalysisPackOut, FieldMapping
from app.reports.standard import service as standard_service

_EQUIPMENT_FQN = "ops.equipment"
_PACK_KEY = "equipment-overview"


def seed_builtin_analysis_pack(actor: UserContext | None = None) -> int:
    user = actor or UserContext(id="seed", username="seed", roles=["admin"])
    try:
        pt = physical_service.get_physical_table(_EQUIPMENT_FQN)
    except PhysicalTableError:
        return 0

    from app.reports.standard.capabilities import evaluate_capabilities

    columns = [{"name": c.name, "dataType": c.data_type} for c in pt.columns]
    field_mapping = FieldMapping(status="status", region="region", createdAt="created_at")
    enabled_themes: list[str] = ["lifecycle", "distribution", "activity", "trend"]
    caps = evaluate_capabilities(field_mapping, columns)
    available = {c.theme for c in caps if c.available}
    enabled_themes = [t for t in enabled_themes if t in available]
    if not enabled_themes:
        enabled_themes = ["lifecycle"]

    legacy = AnalysisPackOut.model_construct(
        pack_key=_PACK_KEY,
        display_name="设备标准分析",
        business_object_code="equipment",
        physical_table_fqn=_EQUIPMENT_FQN,
        data_source_id=pt.data_source_id,
        field_mapping=field_mapping,
        enabled_themes=enabled_themes,
        allowed_roles=["analyst", "admin"],
        snapshot_cron_preset="daily",
    )

    with Session(bind=get_meta_engine()) as db:
        dataset_id, bound_id = materialize_std_pack_from_physical(db, legacy)

    payload = AnalysisPackIn(
        packKey=_PACK_KEY,
        displayName="设备标准分析",
        datasetId=dataset_id,
        boundConfigId=bound_id,
        dataSourceId=pt.data_source_id,
        fieldMapping=field_mapping,
        enabledThemes=enabled_themes,  # type: ignore[arg-type]
        allowedRoles=["analyst", "admin"],
        snapshotCronPreset="daily",
    )
    standard_service.upsert_pack(_PACK_KEY, payload, user)
    return 1
