"""gov catalog + bus_registrations

Revision ID: 0014
Revises: 0013
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import now_server_default

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_CATEGORIES = [
    ("CAT-01", "实体生命周期查询类", "entity", "附录 E 实体类"),
    ("CAT-02", "统计分析聚合类", "aggregate", "附录 E 聚合类"),
    ("CAT-03", "地域维度查询类", "geo", "附录 E 地域类"),
]


def upgrade() -> None:
    now = now_server_default(op.get_bind())
    op.create_table(
        "catalog_categories",
        sa.Column("code", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
    )
    op.create_table(
        "catalog_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("http_method", sa.String(8), nullable=False),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("category_codes", sa.JSON(), nullable=False),
        sa.Column("openapi_operation_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "bus_registrations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "catalog_entry_id",
            sa.Uuid(),
            sa.ForeignKey("catalog_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("bus_payload", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    categories = sa.table(
        "catalog_categories",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("kind", sa.String),
    )
    op.bulk_insert(
        categories,
        [{"code": c, "name": n, "description": d, "kind": k} for c, n, k, d in SEED_CATEGORIES],
    )


def downgrade() -> None:
    op.drop_table("bus_registrations")
    op.drop_table("catalog_entries")
    op.drop_table("catalog_categories")
