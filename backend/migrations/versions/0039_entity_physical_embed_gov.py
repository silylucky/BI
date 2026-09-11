"""entity/physical tables, gov persistence, embed tokens, idempotency

Revision ID: 0039
Revises: 0038
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migrations.dialect_ops import bool_true_default, now_server_default

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bool_true = bool_true_default(bind)
    now_default = now_server_default(bind)

    op.create_table(
        "entity_types",
        sa.Column("type_code", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("attributes", sa.JSON(), nullable=False),
        sa.Column("lifecycle_states", sa.JSON(), nullable=False),
        sa.Column("physical_table_fqn", sa.String(length=128), nullable=True),
        sa.Column("ref_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("type_code"),
    )

    op.create_table(
        "physical_tables",
        sa.Column("table_fqn", sa.String(length=128), nullable=False),
        sa.Column("data_source_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("entity_type_code", sa.String(length=64), nullable=True),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("source_schema", sa.String(length=128), nullable=True),
        sa.Column("source_table", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("table_fqn"),
        sa.UniqueConstraint(
            "data_source_id",
            "source_schema",
            "source_table",
            name="uq_physical_ds_schema_table",
        ),
    )
    op.create_index("ix_physical_tables_entity_type", "physical_tables", ["entity_type_code"])

    op.create_table(
        "gov_openapi_mappings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("catalog_entry_id", sa.Uuid(), nullable=False),
        sa.Column("http_method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("operation_id", sa.String(length=128), nullable=False),
        sa.Column("entity_type_ref", sa.String(length=64), nullable=True),
        sa.Column("api_version", sa.String(length=16), nullable=False, server_default="v1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=bool_true),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("operation_id"),
    )
    op.create_index("ix_gov_openapi_catalog_entry", "gov_openapi_mappings", ["catalog_entry_id"])

    op.create_table(
        "gov_geo_regions",
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.Column("region_code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("region_id"),
        sa.UniqueConstraint("region_code"),
    )
    op.create_index("ix_gov_geo_regions_parent", "gov_geo_regions", ["parent_id"])

    op.create_table(
        "gov_classification_nodes",
        sa.Column("node_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="category"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("node_id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_gov_classification_parent", "gov_classification_nodes", ["parent_id"])

    op.create_table(
        "gov_publish_submitters",
        sa.Column("entry_id", sa.Uuid(), nullable=False),
        sa.Column("submitter_id", sa.String(length=128), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=now_default,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("entry_id"),
    )

    op.create_table(
        "embed_tokens",
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index("ix_embed_tokens_expires_at", "embed_tokens", ["expires_at"])

    op.create_table(
        "integration_idempotency_records",
        sa.Column("cache_key", sa.String(length=256), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=now_default,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("cache_key"),
    )
    op.create_index(
        "ix_integration_idempotency_expires",
        "integration_idempotency_records",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_integration_idempotency_expires", table_name="integration_idempotency_records")
    op.drop_table("integration_idempotency_records")
    op.drop_index("ix_embed_tokens_expires_at", table_name="embed_tokens")
    op.drop_table("embed_tokens")
    op.drop_table("gov_publish_submitters")
    op.drop_index("ix_gov_classification_parent", table_name="gov_classification_nodes")
    op.drop_table("gov_classification_nodes")
    op.drop_index("ix_gov_geo_regions_parent", table_name="gov_geo_regions")
    op.drop_table("gov_geo_regions")
    op.drop_index("ix_gov_openapi_catalog_entry", table_name="gov_openapi_mappings")
    op.drop_table("gov_openapi_mappings")
    op.drop_index("ix_physical_tables_entity_type", table_name="physical_tables")
    op.drop_table("physical_tables")
    op.drop_table("entity_types")
