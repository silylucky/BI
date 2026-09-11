"""Dev-only report demo seed (G3): datasource + template + equipment + standard analysis + schedule."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.templates.demo_datasource import resolve_sample_db_datasource_id
from app.datasources.credentials import decrypt_credential
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.models import DataSource
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.metadata.entity import service as entity_service
from app.metadata.entity.errors import EntityTypeError
from app.metadata.entity.schemas import EntityTypeCreate
from app.metadata.physical import service as physical_service
from app.metadata.physical.errors import PhysicalTableError
from app.metadata.physical.schemas import PhysicalTableRegisterFromSchemaIn
from app.reports.catalog import service as catalog_service
from app.reports.persistence import catalog_repo
from app.reports.catalog.schemas import CatalogNodeCreate
from app.reports.errors import ReportExtensionError
from app.reports.extension.schemas import ExtensionConfigUpsert, MetricAdjustment
from app.reports.extension import service as extension_service
from app.reports.standard.seed import seed_builtin_analysis_pack
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleRecipientIn
from app.reports.templates.schemas import TemplateBlock, TemplateDefinitionIn
from app.reports.templates import service as template_service

logger = logging.getLogger(__name__)

_DEMO_TEMPLATE_KEY = "dev_demo_report"
_DEMO_FOLDER_NAME = "演示报表"
_EQUIPMENT_FQN = "ops.equipment"
_ADMIN = UserContext(id="dev-seed", username="admin", roles=["admin"])


def _resolve_or_create_datasource(session: Session) -> uuid.UUID | None:
    existing = resolve_sample_db_datasource_id(session)
    if existing is not None:
        return existing
    try:
        out = create_data_source(
            session,
            DataSourceCreate(
                name="Sample MySQL (dev seed)",
                code="sample-mysql-dev",
                type="mysql",
                host="127.0.0.1",
                port=3307,
                database="sample_db",
                username="sample",
                password="sample",
                description="Auto-created by DEV_REPORT_SEED",
            ),
        )
        return out.id
    except Exception:
        logger.warning("report_dev_seed_datasource_skip", exc_info=True)
        return None


def _ensure_equipment_table(session: Session, ds_id: uuid.UUID) -> bool:
    row = session.get(DataSource, ds_id)
    if row is None or (row.type or "").lower() != "mysql":
        return False
    try:
        password = decrypt_credential(row.password_encrypted)
    except Exception:
        return False
    ddl = """
    CREATE TABLE IF NOT EXISTS equipment (
      id INT PRIMARY KEY AUTO_INCREMENT,
      status VARCHAR(32) NOT NULL,
      region VARCHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """
    seed_sql = """
    INSERT INTO equipment (status, region)
    SELECT * FROM (
      SELECT 'running' AS status, 'east' AS region UNION ALL
      SELECT 'idle', 'north' UNION ALL
      SELECT 'maintenance', 'south'
    ) AS seed_rows
    WHERE NOT EXISTS (SELECT 1 FROM equipment LIMIT 1)
    """
    connector = MysqlConnector()
    try:
        conn = connector.open_connection(
            host=row.host,
            port=row.port,
            database=row.database or "sample_db",
            username=row.username,
            password=password,
        )
        with conn.cursor() as cur:
            cur.execute(ddl)
            cur.execute(seed_sql)
        conn.commit()
        conn.close()
        return True
    except Exception:
        logger.warning("report_dev_seed_equipment_ddl_skip", exc_info=True)
        return False


def _equipment_table_registered() -> bool:
    try:
        physical_service.get_physical_table(_EQUIPMENT_FQN)
        return True
    except PhysicalTableError:
        return False


def _seed_equipment_entity(session: Session, ds_id: uuid.UUID, actor: UserContext) -> int:
    if _equipment_table_registered():
        return 0
    try:
        entity_service.get_entity_type("equipment")
    except EntityTypeError:
        entity_service.create_entity_type(
            EntityTypeCreate(typeCode="equipment", displayName="设备", attributes=[], lifecycleStates=[]),
        )
    if not _ensure_equipment_table(session, ds_id):
        return 0
    try:
        physical_service.register_from_schema(
            session,
            actor.roles,
            PhysicalTableRegisterFromSchemaIn(
                dataSourceId=ds_id,
                schema="sample_db",
                table="equipment",
                displayName="设备表",
                entityTypeCode="equipment",
                tableFqn=_EQUIPMENT_FQN,
            ),
            actor,
        )
        return 1
    except PhysicalTableError as exc:
        if exc.code == "META_PHYSICAL_DS_TABLE_CONFLICT":
            return 0
        logger.warning("report_dev_seed_equipment_register_skip", exc_info=True)
        return 0


def _find_demo_node_id() -> uuid.UUID | None:
    for raw in catalog_repo.all_nodes().values():
        if raw.get("template_key") == _DEMO_TEMPLATE_KEY:
            return uuid.UUID(str(raw["id"]))
    return None


def _find_demo_root_folder_id() -> uuid.UUID | None:
    for raw in catalog_repo.all_nodes().values():
        if (
            raw.get("name") == _DEMO_FOLDER_NAME
            and raw.get("node_type") == "folder"
            and raw.get("parent_id") is None
        ):
            return uuid.UUID(str(raw["id"]))
    return None


def _demo_sales_metric(session: Session, ds_id: uuid.UUID | None) -> MetricAdjustment | None:
    if ds_id is None:
        return None
    from app.metadata.dataset.demo_bindings import ensure_demo_dataset_bindings
    from app.metadata.dataset.models import DatasetRecord

    ensure_demo_dataset_bindings(session)
    row = session.get(DatasetRecord, "demo-sales-wide")
    if row is None or row.bound_config_id is None:
        return None
    return MetricAdjustment(
        key="province_sales",
        label="省份销售",
        datasetId="demo-sales-wide",
        boundConfigId=row.bound_config_id,
        visible=True,
        dimensionDictCode="region",
        dimensionValueColumn="province",
    )


def _seed_report_dimension_values(session: Session) -> int:
    from app.metadata.dimensions.schemas import DimensionValueItem
    from app.metadata.dimensions.service import (
        ensure_legacy_probe_dimensions,
        list_values,
        register_values,
        resolve_dimension_by_code,
    )

    ensure_legacy_probe_dimensions(session)
    seeded = 0
    status_values = [
        DimensionValueItem(code="running", label="运行中"),
        DimensionValueItem(code="idle", label="空闲"),
        DimensionValueItem(code="maintenance", label="维护中"),
        DimensionValueItem(code="active", label="活跃"),
    ]
    try:
        dim = resolve_dimension_by_code(session, "status")
        existing = {v.code for v in list_values(session, dim.id, limit=500)[0]}
        new_items = [v for v in status_values if v.code not in existing]
        if new_items:
            register_values(session, dim.id, new_items, _ADMIN)
            seeded += len(new_items)
    except Exception:
        logger.warning("report_dev_seed_status_values_skip", exc_info=True)
    region_values = [
        DimensionValueItem(code="east", label="华东"),
        DimensionValueItem(code="north", label="华北"),
        DimensionValueItem(code="south", label="华南"),
    ]
    try:
        region_dim = resolve_dimension_by_code(session, "region")
        existing_region = {v.code for v in list_values(session, region_dim.id, limit=500)[0]}
        new_region = [v for v in region_values if v.code not in existing_region]
        if new_region:
            register_values(session, region_dim.id, new_region, _ADMIN)
            seeded += len(new_region)
    except Exception:
        logger.warning("report_dev_seed_region_values_skip", exc_info=True)
    return seeded


def _seed_demo_template(
    session: Session,
    actor: UserContext,
    ds_id: uuid.UUID | None,
) -> tuple[int, uuid.UUID | None]:
    demo_metric = _demo_sales_metric(session, ds_id)
    existing = _find_demo_node_id()
    if existing is not None:
        if ds_id is not None and demo_metric is not None:
            try:
                ext = extension_service.get_extension(existing)
                metrics = ext.metrics
                if not any(m.bound_config_id for m in metrics):
                    metrics = [demo_metric]
                extension_service.upsert(
                    existing,
                    ExtensionConfigUpsert(
                        catalogNodeId=existing,
                        metrics=metrics,
                        filters=ext.filters,
                        defaultDataSourceId=ds_id,
                        changeNote="dev seed datasource link",
                    ),
                    actor,
                )
            except ReportExtensionError:
                pass
        return 0, existing
    template_service.upsert_template_definition(
        _DEMO_TEMPLATE_KEY,
        TemplateDefinitionIn(
            templateKey=_DEMO_TEMPLATE_KEY,
            format="pdf",
            displayName="演示销售报表",
            blocks=[TemplateBlock(blockType="table", tableRef="sales")],
        ),
        actor,
    )
    folder_id = _find_demo_root_folder_id()
    if folder_id is None:
        folder = catalog_service.create_node(
            CatalogNodeCreate(name=_DEMO_FOLDER_NAME, nodeType="folder"),
            actor,
        )
        folder_id = folder.id
    node = catalog_service.create_node(
        CatalogNodeCreate(
            name="演示销售报表",
            parentId=folder_id,
            nodeType="template",
            templateKind="pdf",
            templateKey=_DEMO_TEMPLATE_KEY,
        ),
        actor,
    )
    metrics = [demo_metric] if demo_metric is not None else []
    extension_service.upsert(
        node.id,
        ExtensionConfigUpsert(
            catalogNodeId=node.id,
            metrics=metrics,
            filters=[],
            changeNote="dev seed",
            defaultDataSourceId=ds_id,
        ),
        actor,
    )
    return 1, node.id


def _seed_demo_schedule(node_id: uuid.UUID, actor: UserContext) -> int:
    from app.reports.scheduler.store import get_schedule_store
    for row in get_schedule_store().list_all():
        if row.get("source_id") == node_id or row.get("catalog_node_id") == node_id:
            return 0
    sched = scheduler_service.create_schedule(
        ScheduleCreate(
            catalogNodeId=node_id,
            sourceId=node_id,
            cron="0 8 * * *",
            recipients=[ScheduleRecipientIn(type="role", value="admin")],
        ),
        actor,
    )
    scheduler_service.transition_schedule(sched.id, "schedule", actor)
    return 1


def seed_dev_reports(session: Session, *, actor: UserContext | None = None) -> dict[str, Any]:
    """幂等 dev seed；返回各步计数。"""
    user = actor or _ADMIN
    counts: dict[str, Any] = {
        "datasource": 0,
        "equipment": 0,
        "template": 0,
        "standard": 0,
        "schedule": 0,
        "dimensions": 0,
        "dataSourceId": None,
        "catalogNodeId": None,
    }
    ds_id = _resolve_or_create_datasource(session)
    counts["dimensions"] = _seed_report_dimension_values(session)
    if ds_id is None:
        logger.warning("report_dev_seed_aborted_no_datasource")
        counts["standard"] = seed_builtin_analysis_pack(user)
        return counts
    counts["dataSourceId"] = str(ds_id)
    counts["equipment"] = _seed_equipment_entity(session, ds_id, user)
    tpl_n, node_id = _seed_demo_template(session, user, ds_id)
    counts["template"] = tpl_n
    counts["standard"] = seed_builtin_analysis_pack(user)
    if node_id is not None:
        counts["catalogNodeId"] = str(node_id)
        counts["schedule"] = _seed_demo_schedule(node_id, user)
    return counts
