"""dashboards.surface_kind for list filter and SQL pagination

Revision ID: 0027
Revises: 0026
"""

from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _read_surface_kind(layout_json: object) -> str:
    if not isinstance(layout_json, dict):
        return "dashboard"
    style = layout_json.get("styleConfig") or layout_json.get("style_config") or {}
    if isinstance(style, dict):
        kind = style.get("surfaceKind") or style.get("surface_kind")
        if kind == "data-screen":
            return "data-screen"
    return "dashboard"


def upgrade() -> None:
    op.add_column(
        "dashboards",
        sa.Column("surface_kind", sa.String(length=32), nullable=False, server_default="dashboard"),
    )
    op.create_index("ix_dashboards_surface_kind", "dashboards", ["surface_kind"])

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, layout_json FROM dashboards")).fetchall()
    for row in rows:
        layout = row.layout_json
        if isinstance(layout, str):
            try:
                layout = json.loads(layout)
            except json.JSONDecodeError:
                layout = {}
        kind = _read_surface_kind(layout)
        conn.execute(
            sa.text("UPDATE dashboards SET surface_kind = :kind WHERE id = :id"),
            {"kind": kind, "id": row.id},
        )


def downgrade() -> None:
    op.drop_index("ix_dashboards_surface_kind", table_name="dashboards")
    op.drop_column("dashboards", "surface_kind")
