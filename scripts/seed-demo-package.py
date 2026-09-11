#!/usr/bin/env python3
"""一键修复/预置官方演示包（sample_db 迁移 + demo 源 + 官方示例看板/大屏）。

官方演示包 **不经 Dataset**：内置模板与示例看板均为 SQL 直连「示例数据」源。

用法（仓库根目录）：
  python scripts/seed-demo-package.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import os

os.chdir(BACKEND)


def main() -> int:
    from app.auth.models import get_meta_session
    from app.dashboard.demo_instances.seed import resolve_demo_instance_ids, seed_demo_instances
    from app.dashboard.demo_package.status import build_demo_package_status
    from app.dashboard.templates.demo_datasource import ensure_official_demo_datasource
    from app.dashboard.templates.official_demo_bootstrap import ensure_sample_db_schema
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates
    from app.metadata.dataset.demo_bindings import ensure_demo_dataset_bindings
    from app.metadata.dataset.demo_seed import resolve_demo_dataset_ids, seed_demo_datasets

    schema = ensure_sample_db_schema()
    print(f"[sample_db] reachable={schema.mysql_reachable} version={schema.schema_version} {schema.message or ''}")

    session = get_meta_session()
    try:
        ds_id = ensure_official_demo_datasource(session)
        print(f"[datasource] demo id={ds_id}")
        tpl = seed_builtin_dashboard_templates(session)
        print(f"[templates] upserted={tpl}")
        inst = seed_demo_instances(session)
        print(f"[instances] upserted={inst} ids={resolve_demo_instance_ids(session)}")
        ds = seed_demo_datasets(session)
        print(f"[datasets] upserted={ds} ids={resolve_demo_dataset_ids(session)}")
        bound = ensure_demo_dataset_bindings(session)
        print(f"[dataset-bindings] bound={bound}")
        status = build_demo_package_status(session, refresh_schema=False)
        print(
            f"[status] ready={status.ready} message={status.message or 'ok'} "
            f"dashboards={len(status.demo_dashboard_ids)} datasets={len(status.demo_dataset_ids)}",
        )
        return 0 if status.ready else 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
