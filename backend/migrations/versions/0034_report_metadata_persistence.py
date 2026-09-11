"""report metadata persistence tables

Revision ID: 0034
Revises: 0033
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_catalog_nodes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("node_type", sa.String(length=16), nullable=False),
        sa.Column("template_kind", sa.String(length=16), nullable=True),
        sa.Column("template_key", sa.String(length=64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_catalog_nodes_parent_id", "report_catalog_nodes", ["parent_id"])
    op.create_index("ix_report_catalog_nodes_template_key", "report_catalog_nodes", ["template_key"])

    op.create_table(
        "report_catalog_owners",
        sa.Column("node_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("node_id"),
    )

    op.create_table(
        "report_extension_configs",
        sa.Column("catalog_node_id", sa.Uuid(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("change_note", sa.String(length=500), nullable=True),
        sa.Column("default_data_source_id", sa.Uuid(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("catalog_node_id"),
    )

    op.create_table(
        "report_extension_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("catalog_node_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("change_note", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_extension_revisions_node", "report_extension_revisions", ["catalog_node_id"])

    op.create_table(
        "report_prefab_bindings",
        sa.Column("binding_key", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("binding_key"),
    )

    op.create_table(
        "report_template_definitions",
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("template_key"),
    )

    op.create_table(
        "report_integration_exports",
        sa.Column("export_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("fmt", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("export_id"),
    )
    op.create_index("ix_report_integration_exports_template", "report_integration_exports", ["template_id"])


def downgrade() -> None:
    op.drop_index("ix_report_integration_exports_template", table_name="report_integration_exports")
    op.drop_table("report_integration_exports")
    op.drop_table("report_template_definitions")
    op.drop_table("report_prefab_bindings")
    op.drop_index("ix_report_extension_revisions_node", table_name="report_extension_revisions")
    op.drop_table("report_extension_revisions")
    op.drop_table("report_extension_configs")
    op.drop_table("report_catalog_owners")
    op.drop_index("ix_report_catalog_nodes_template_key", table_name="report_catalog_nodes")
    op.drop_index("ix_report_catalog_nodes_parent_id", table_name="report_catalog_nodes")
    op.drop_table("report_catalog_nodes")
