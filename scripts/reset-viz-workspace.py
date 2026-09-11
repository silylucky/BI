#!/usr/bin/env python3
"""清空仪表板/数据大屏列表，并预置内置政企模板工作副本。

用法（仓库根目录）：
  python scripts/reset-viz-workspace.py
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
    from app.dashboard.templates.demo_datasource import ensure_official_demo_datasource
    from app.dashboard.templates.official_demo_bootstrap import ensure_sample_db_schema
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates
    from app.dashboard.workspace_instances.seed import (
        purge_all_dashboard_instances,
        resolve_workspace_instance_ids,
        seed_workspace_instances,
    )

    schema = ensure_sample_db_schema()
    print(
        f"[sample_db] reachable={schema.mysql_reachable} "
        f"version={schema.schema_version} {schema.message or ''}",
    )

    session = get_meta_session()
    try:
        ensure_official_demo_datasource(session)
        tpl = seed_builtin_dashboard_templates(session)
        print(f"[templates] upserted={tpl}")
        purged = purge_all_dashboard_instances(session)
        print(f"[purge] soft_deleted={purged}")
        inserted = seed_workspace_instances(session, reset_layout=True)
        ids = resolve_workspace_instance_ids(session)
        print(f"[workspace] inserted={inserted} active={len(ids)} ids={ids}")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
