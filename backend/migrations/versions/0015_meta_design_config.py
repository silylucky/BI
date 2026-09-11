"""meta glossary/themes + query config store

Revision ID: 0015
Revises: 0014
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import now_server_default

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    now = now_server_default(op.get_bind())
    op.create_table(
        "glossary_terms",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("definition", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_table(
        "theme_nodes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("theme_nodes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("term_id", sa.Uuid(), sa.ForeignKey("glossary_terms.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
    )
    op.create_index("ix_theme_nodes_parent_id", "theme_nodes", ["parent_id"])
    op.create_index("ix_theme_nodes_term_id", "theme_nodes", ["term_id"])
    op.create_table(
        "query_config_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("config_type", sa.String(64), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False),
        sa.Column("ref_type", sa.String(32), nullable=True),
        sa.Column("ref_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=now, nullable=False),
        sa.UniqueConstraint(
            "config_type",
            "ref_type",
            "ref_id",
            "schema_version",
            name="uq_query_config_natural_key",
        ),
    )
    op.create_index("ix_query_config_records_owner_id", "query_config_records", ["owner_id"])


def downgrade() -> None:
    op.drop_table("query_config_records")
    op.drop_table("theme_nodes")
    op.drop_table("glossary_terms")
