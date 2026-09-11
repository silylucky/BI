from __future__ import annotations

import re
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.datasources.models import Base

MAX_BUNDLE_BYTES = 2 * 1024 * 1024
INLINE_D3_MIN_BYTES = 200 * 1024
ALLOWED_RUNTIMES = ("html", "d3")
FORBIDDEN_HTML_PATTERNS = (
    re.compile(r"<script[^>]+src\s*=", re.IGNORECASE),
    # HTML 内联事件（onclick=）；勿匹配 JS 属性赋值 .onmouseenter=
    re.compile(r"(?<![.\w])on\w+\s*=", re.IGNORECASE),
    re.compile(r"javascript:", re.IGNORECASE),
)


class AiVizArtifact(Base):
    __tablename__ = "ai_viz_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    files_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


def validate_manifest(manifest: dict) -> None:
    from app.ai_viz.errors import AiVizError

    field_slots = manifest.get("fieldSlots")
    if not isinstance(field_slots, dict):
        raise AiVizError(
            "AIVIZ_INVALID_MANIFEST",
            "manifest.fieldSlots is required (dimensions + metrics)",
            422,
        )
    for key in ("dimensions", "metrics"):
        rule = field_slots.get(key)
        if not isinstance(rule, dict):
            raise AiVizError(
                "AIVIZ_INVALID_MANIFEST",
                f"manifest.fieldSlots.{key} is required",
                422,
            )
        min_count = rule.get("min")
        if key == "metrics":
            dim_rule = field_slots.get("dimensions")
            dim_max = (
                dim_rule.get("max")
                if isinstance(dim_rule, dict) and isinstance(dim_rule.get("max"), int)
                else 1
            )
            # 明细表范式：多列 dimensions + metrics.min=0（纯展示列，不做聚合）
            if dim_max > 1 and min_count == 0:
                continue
        if not isinstance(min_count, int) or min_count < 1:
            raise AiVizError(
                "AIVIZ_INVALID_MANIFEST",
                f"manifest.fieldSlots.{key}.min must be >= 1",
                422,
            )

    style_schema = manifest.get("styleSchema")
    if not isinstance(style_schema, dict):
        raise AiVizError(
            "AIVIZ_INVALID_MANIFEST",
            "manifest.styleSchema is required",
            422,
        )
    properties = style_schema.get("properties")
    if not isinstance(properties, dict) or len(properties) == 0:
        raise AiVizError(
            "AIVIZ_INVALID_MANIFEST",
            "manifest.styleSchema.properties must declare at least one style field",
            422,
        )

    runtime = manifest.get("runtime")
    if runtime is None:
        hint = manifest.get("rendererHint")
        runtime = "d3" if hint == "d3" else "html"
    if runtime not in ALLOWED_RUNTIMES:
        raise AiVizError(
            "AIVIZ_INVALID_MANIFEST",
            "manifest.runtime must be 'html' or 'd3'",
            422,
        )


def _resolve_runtime(manifest: dict) -> str:
    runtime = manifest.get("runtime")
    if runtime is None:
        hint = manifest.get("rendererHint")
        runtime = "d3" if hint == "d3" else "html"
    return str(runtime)


def _validate_bundle_runtime_contract(entry_html: str, manifest: dict) -> None:
    from app.ai_viz.errors import AiVizError

    runtime = _resolve_runtime(manifest)
    if re.search(r'\bid=["\']root["\']', entry_html, re.IGNORECASE):
        raise AiVizError(
            "AIVIZ_FORBIDDEN_HOST_ID",
            'entry HTML must not use id="root" (conflicts with platform SPA)',
            422,
        )
    if re.search(r'\bid=["\']app["\']', entry_html, re.IGNORECASE):
        raise AiVizError(
            "AIVIZ_FORBIDDEN_HOST_ID",
            'entry HTML must not use id="app" (conflicts with platform SPA)',
            422,
        )
    if "vsCv.mount" not in entry_html:
        raise AiVizError(
            "AIVIZ_MOUNT_REQUIRED",
            "entry must call host.vsCv.mount(renderFn) for resize/payload lifecycle",
            422,
        )


def validate_bundle_files(files: dict[str, str], entry: str, manifest: dict | None = None) -> None:
    from app.ai_viz.errors import AiVizError

    if entry not in files:
        raise AiVizError("AIVIZ_MISSING_ENTRY", f"files must include entry {entry!r}", 422)
    total = sum(len(v.encode("utf-8")) for v in files.values())
    if total > MAX_BUNDLE_BYTES:
        raise AiVizError("AIVIZ_BUNDLE_TOO_LARGE", "bundle exceeds 2MB limit", 413)
    for name, content in files.items():
        if not name.endswith((".html", ".css", ".svg")):
            raise AiVizError("AIVIZ_INVALID_FILE", f"unsupported file name: {name}", 422)
        encoded = content.encode("utf-8")
        if len(encoded) >= INLINE_D3_MIN_BYTES and "d3.version" in content:
            raise AiVizError(
                "AIVIZ_INLINE_D3_FORBIDDEN",
                "do not inline the d3 library; use host.vsCv.d3",
                422,
            )
        for pattern in FORBIDDEN_HTML_PATTERNS:
            if pattern.search(content):
                raise AiVizError(
                    "AIVIZ_UNSAFE_CONTENT",
                    f"forbidden pattern in {name}",
                    422,
                )
    if manifest is not None:
        _validate_bundle_runtime_contract(files[entry], manifest)
