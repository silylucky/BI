"""官方演示包就绪状态探测。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.dashboard.demo_instances.seed import DEMO_INSTANCE_SLUGS, resolve_demo_instance_ids
from app.metadata.dataset.demo_seed import DEMO_DATASET_IDS, resolve_demo_dataset_ids
from app.dashboard.templates.demo_datasource import (
    OFFICIAL_DEMO_DATASOURCE_CODE,
    resolve_sample_db_datasource_id,
)
from app.dashboard.templates.official_demo_bootstrap import (
    SchemaBootstrapResult,
    ensure_sample_db_schema,
    get_last_schema_bootstrap_result,
    probe_sample_db_schema,
)


@dataclass(frozen=True)
class DemoPackageStatus:
    ready: bool
    mysql_reachable: bool
    schema_version: int
    datasource_id: uuid.UUID | None
    datasource_code: str
    demo_dashboard_ids: list[uuid.UUID]
    demo_dataset_ids: list[str]
    message: str | None

    def as_dict(self) -> dict:
        return {
            "ready": self.ready,
            "mysqlReachable": self.mysql_reachable,
            "schemaVersion": self.schema_version,
            "datasourceId": str(self.datasource_id) if self.datasource_id else None,
            "datasourceCode": self.datasource_code,
            "demoDashboardIds": [str(item) for item in self.demo_dashboard_ids],
            "demoDatasetIds": list(self.demo_dataset_ids),
            "message": self.message,
        }


def build_demo_package_status(
    db: Session,
    *,
    refresh_schema: bool = False,
) -> DemoPackageStatus:
    schema: SchemaBootstrapResult
    if refresh_schema:
        schema = ensure_sample_db_schema()
    else:
        schema = probe_sample_db_schema() or get_last_schema_bootstrap_result() or probe_sample_db_schema()

    datasource_id = resolve_sample_db_datasource_id(db)
    demo_ids = resolve_demo_instance_ids(db)
    demo_dataset_ids = resolve_demo_dataset_ids(db)
    expected_instances = len(DEMO_INSTANCE_SLUGS)
    expected_datasets = len(DEMO_DATASET_IDS)
    has_datasource = datasource_id is not None
    has_instances = len(demo_ids) >= expected_instances
    has_datasets = len(demo_dataset_ids) >= expected_datasets

    ready = schema.ready and has_datasource and has_instances and has_datasets
    message = schema.message
    if ready:
        message = None
    elif not schema.mysql_reachable:
        message = message or "示例 MySQL（sample-mysql）不可达，请先启动容器"
    elif not schema.ready:
        message = message or "演示库结构未完全迁移，请重启后端或查看日志"
    elif not has_datasource:
        message = "未找到「示例数据」数据源，请重启后端完成注册"
    elif not has_instances:
        message = "官方示例看板/大屏尚未就绪，请重启后端完成预置"
    elif not has_datasets:
        message = "官方示例 Dataset 尚未就绪，请运行 scripts/seed-demo-package.py"

    return DemoPackageStatus(
        ready=ready,
        mysql_reachable=schema.mysql_reachable,
        schema_version=schema.schema_version,
        datasource_id=datasource_id,
        datasource_code=OFFICIAL_DEMO_DATASOURCE_CODE,
        demo_dashboard_ids=demo_ids,
        demo_dataset_ids=demo_dataset_ids,
        message=message,
    )
