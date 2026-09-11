"""In-memory backing dicts for report metadata (tests + memory store mode)."""

from __future__ import annotations

import uuid

catalog_nodes: dict[uuid.UUID, dict] = {}
catalog_owners: dict[uuid.UUID, str] = {}
artifact_owners: dict[str, str] = {}
extension_configs: dict[uuid.UUID, dict] = {}
extension_audit: list[dict] = []
analysis_packs: dict[str, dict] = {}
analysis_snapshots: list[dict] = []
template_definitions: dict[str, dict] = {}
integration_exports: dict[uuid.UUID, dict] = {}


def clear_all() -> None:
    catalog_nodes.clear()
    catalog_owners.clear()
    artifact_owners.clear()
    extension_configs.clear()
    extension_audit.clear()
    analysis_packs.clear()
    analysis_snapshots.clear()
    template_definitions.clear()
    integration_exports.clear()
