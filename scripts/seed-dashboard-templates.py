#!/usr/bin/env python3
"""手动写入/更新内置可视化模板（含 10 套政企模板）。

用法（在仓库根目录）：
  cd backend && python ../scripts/seed-dashboard-templates.py

依赖 backend/.env 中的 DATABASE_URL；须已 alembic upgrade head。
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import os

os.chdir(BACKEND)

from app.auth.models import get_meta_session  # noqa: E402
from app.dashboard.templates.models import DashboardTemplate  # noqa: E402
from app.dashboard.templates.seed import seed_builtin_dashboard_templates  # noqa: E402
from sqlalchemy import func, select  # noqa: E402


def main() -> int:
    session = get_meta_session()
    try:
        before = session.scalar(select(func.count()).select_from(DashboardTemplate)) or 0
        upserted = seed_builtin_dashboard_templates(session)
        after = session.scalar(select(func.count()).select_from(DashboardTemplate)) or 0
        gov = session.scalar(
            select(func.count())
            .select_from(DashboardTemplate)
            .where(DashboardTemplate.category_key == "government"),
        ) or 0
        print(f"模板总数: {before} -> {after}（本次新增 {upserted} 条）")
        print(f"政务分类: {gov} 套")
        keys = session.scalars(
            select(DashboardTemplate.template_key)
            .where(DashboardTemplate.category_key == "government")
            .order_by(DashboardTemplate.template_key),
        ).all()
        for key in keys:
            print(f"  - {key}")
        print("")
        print("若图表仍无数据，请运行: powershell -File scripts/seed-demo-mysql.ps1")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
